# Agent Rules

This repository is a distributable skill in the standard `SKILL.md` format. Agents that support this skill format can use it. The authoritative workflow lives in [SKILL.md](SKILL.md). This file defines hard constraints for coding agents.

## General
- Do not run `git push` unless the user explicitly asks for it.
- Treat this repository as an open, distributable skill. Any code, script, documentation, or example change must still work after a fresh clone.
- Do not write machine-specific absolute paths, usernames, local cache paths, proxies, or secrets into `SKILL.md`, `README.md`, examples, or generated artifacts. Use repository-relative paths, `git rev-parse --show-toplevel`, CLI arguments, and environment variables.
- Install and initialization scripts must be idempotent. They should detect already-installed or ready states and skip them. Use `--force` only for explicit rebuilds.
- Before submission, check for local path leaks: `grep -rn "/User[s]/" --include='*.md' --include='*.sh' --include='*.mjs' --include='*.json' .`. The command should produce no output. Run syntax checks for modified scripts, such as `node --check` and `bash -n`.

## Preview Gate
Before delivering an animation by exporting `.ggb` or telling the user it is done, the user must have a browser preview available. The preview page line-by-line pass/fail status is the debugging source of truth. If commands fail, self-repair according to `SKILL.md` for up to three rounds before reporting back.

## Command Generation Rules
Follow the hard rules in `SKILL.md`: English command names, explicit `*`, radians, explicit object naming, style commands as separate commands, animation baked into `Slider(...)`, and no invented commands. When uncertain, check `references/commands.md` or use `check`.

## Honest Reporting
- The only deliverable that remains animated after export is `.ggb` opened in GeoGebra. Do not claim that GIF or video export is built in.
- `.ggb` stores animation state, but GeoGebra desktop may require pressing Play after reopening. State this clearly unless the exact target environment has been tested.

## Change Constraints
- If the public interface in `assets/preview.html` changes (`window.__READY__`, `window.__BUILD__`, `window.__getGGBBase64`, `api`), update `bin/ggb-anim.mjs` check/export logic too.
- If `scene.json` fields are added, removed, or changed, update `references/scene-schema.md`, validation in `bin/ggb-anim.mjs`, and the examples.
