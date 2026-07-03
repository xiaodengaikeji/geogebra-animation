#!/usr/bin/env bash
# Environment check: report available capabilities and missing optional pieces.
set -uo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
no()   { printf "  \033[31m✗\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m⚠\033[0m %s\n" "$1"; }

echo "GeoGebra animation skill · environment check"
echo "Repository: $repo_root"
echo

echo "Core features (preview, examples index, command script export):"
if command -v node >/dev/null 2>&1; then ok "node $(node -v) - CLI preview/examples/new/script/validate are available"
else warn "node is missing - use python3 for a static server or open generated preview.html manually"; fi
if command -v python3 >/dev/null 2>&1; then ok "python3 $(python3 -V 2>&1 | awk '{print $2}') - usable as a local static server"
else warn "python3 is missing"; fi
# Browser support is required for preview.
if [[ "$(uname)" == "Darwin" ]]; then ok "macOS - open can launch browser previews"; else warn "non-macOS - make sure xdg-open and a browser are available"; fi
echo

echo "Optional features (headless check/export .ggb generation):"
if command -v npm >/dev/null 2>&1; then ok "npm $(npm -v)"
else no "npm is missing - cannot install Playwright"; fi
if node -e "require.resolve('playwright')" >/dev/null 2>&1 || [[ -d "$repo_root/node_modules/playwright" ]]; then
  ok "playwright is installed"
  if node -e "const{chromium}=require('playwright');process.exit(chromium.executablePath()&&require('fs').existsSync(chromium.executablePath())?0:1)" >/dev/null 2>&1; then
    ok "Chromium is installed - check/export are available"
  else warn "playwright is installed but Chromium is missing: npx playwright install chromium"; fi
else
  warn "Playwright is not installed - check/export are unavailable. Install with: npm i -D playwright && npx playwright install chromium"
fi
echo

echo "Network (GeoGebra engine loads from the official CDN):"
if curl -sI --max-time 8 https://www.geogebra.org/apps/deployggb.js >/dev/null 2>&1; then
  ok "geogebra.org CDN is reachable"
else
  warn "CDN is unreachable - offline preview requires the GeoGebra Math Apps Bundle"
fi

echo
echo "Try: node bin/ggb-anim.mjs examples"
