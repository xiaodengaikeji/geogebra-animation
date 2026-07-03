#!/usr/bin/env bash
# Install this repository as a local skill by symlinking it into supported skill directories.
# Idempotent: existing entries require --force, which backs up the old entry before replacing it.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
skill_name="geogebra-animation"
install_codex=0
install_claude=0
force=0
install_browser=0

usage() {
  cat <<'EOF'
Usage: scripts/install-skill.sh [options]

Install targets:
  --all              Install to Codex and Claude Code (default)
  --codex            Install to Codex only
  --claude           Install to Claude Code only

Options:
  --name NAME        Skill directory name (default: geogebra-animation)
  --force            Back up and replace existing entries
  --browser          Install Playwright + Chromium for headless check/export
  -h, --help         Show help

Environment:
  CODEX_HOME         Default: ~/.codex
  CLAUDE_HOME        Default: ~/.claude
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all) install_codex=1; install_claude=1; shift ;;
    --codex) install_codex=1; shift ;;
    --claude) install_claude=1; shift ;;
    --name) skill_name="${2:?--name requires a value}"; shift 2 ;;
    --force) force=1; shift ;;
    --browser) install_browser=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

# Default to installing both targets.
if [[ "$install_codex" -eq 0 && "$install_claude" -eq 0 ]]; then
  install_codex=1; install_claude=1
fi

if [[ ! -f "$repo_root/SKILL.md" ]]; then
  echo "SKILL.md not found in $repo_root" >&2; exit 2
fi

# Optional Playwright + Chromium install for check/export.
if [[ "$install_browser" -eq 1 ]]; then
  if command -v npm >/dev/null 2>&1; then
    echo "==> Installing Playwright + Chromium"
    (cd "$repo_root" && npm i -D playwright --no-audit --no-fund --loglevel=error && npx playwright install chromium)
  else
    echo "note: npm is missing; skipping Playwright install (check/export will be unavailable)" >&2
  fi
fi

install_one() {
  local label="$1" base="$2"
  local dest="$base/skills/$skill_name"
  mkdir -p "$(dirname "$dest")"
  if [[ -L "$dest" || -e "$dest" ]]; then
    # Existing symlink already points to this repository, so skip.
    if [[ -L "$dest" && "$(readlink "$dest")" == "$repo_root" ]]; then
      echo "$label: already installed (symlink points to this repository), skipping"; return 0
    fi
    if [[ "$force" -ne 1 ]]; then
      echo "$label: $dest already exists; use --force to replace it" >&2; return 1
    fi
    local backup="${dest}.backup.$(date +%Y%m%d%H%M%S)"
    mv "$dest" "$backup"; echo "$label: backed up existing entry to $backup"
  fi
  ln -s "$repo_root" "$dest"
  echo "$label: installed $skill_name -> $repo_root"
}

rc=0
[[ "$install_codex" -eq 1 ]] && { install_one "Codex" "${CODEX_HOME:-$HOME/.codex}" || rc=1; }
[[ "$install_claude" -eq 1 ]] && { install_one "Claude Code" "${CLAUDE_HOME:-$HOME/.claude}" || rc=1; }

echo "done"
exit "$rc"
