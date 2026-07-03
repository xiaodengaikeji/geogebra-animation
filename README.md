# GeoGebra Animation Skill

A standard `SKILL.md`-format skill that any compatible agent can use: describe a mathematical construction, preview it in a browser with the official GeoGebra engine, then export an animated `.ggb` file and a command script that can be pasted into GeoGebra.

## Example Gallery

![GeoGebra examples gallery showing four animated previews](docs/images/examples-gallery.png)

The built-in gallery demonstrates four animation types: geometry, algebra, statistics, and calculus. Each preview is generated from a `scene.json` file and can be opened as a detail page, copied as GeoGebra commands, or exported as a Classic 6 `.ggb` file.

## Why It Is Reliable

Preview and export use the same official GeoGebra engine (`deployggb.js`). The bytes returned by `getBase64()` in the preview page are the `.ggb` file, so the preview and exported construction share one source of truth.

```text
scene.json -> browser preview with real GeoGebra
           -> .ggb download
           -> script.txt command script
```

## Quick Start

```bash
# 1. Optionally install with symlinks for locally configured skill directories.
bash scripts/install-skill.sh

# 2. Check the local environment.
bash scripts/self-check.sh

# 3. Preview the built-in geometry example.
node bin/ggb-anim.mjs preview examples/01-geometry-triangle-orbit

# 4. Build all local examples and the 2x2 gallery.
node bin/ggb-anim.mjs examples

# 5. Export a GeoGebra command script.
node bin/ggb-anim.mjs script examples/01-geometry-triangle-orbit

# 6. Export a .ggb for GeoGebra Classic 6.
node bin/ggb-anim.mjs export examples/04-calculus-tangent-integral --style dark
```

The examples gallery includes four advanced examples: geometry, algebra, statistics, and calculus. It also includes two built-in animation themes: `light` and `dark`. The default is `light`; switch the gallery with the `Light Animation` / `Dark Animation` toggle, or pass `--style dark` to CLI commands such as `preview`, `export`, `script`, and `check`. The style selection applies to iframe previews, detail pages, copied commands, and downloaded `.ggb` files.

## Commands

| Command | Purpose | Dependency |
| --- | --- | --- |
| `preview <scene>` | Inline a scene into `preview.html` and open it in a browser | Browser + network access |
| `examples [dir]` | Build each example preview and a 2x2 gallery | Browser + network access |
| `new <name>` | Scaffold a `scene.json` | None |
| `script <scene>` | Export a GeoGebra command script | None |
| `validate <scene>` | Validate schema, references, and syntax lint | None |
| `check <scene>` | Headless smoke test with the real GeoGebra engine | Playwright |
| `export <scene>` | Headless `.ggb` export | Playwright |

`<scene>` may be a `scene.json` file or the directory that contains it. To enable optional headless features, run `bash scripts/install-skill.sh --browser`.

Built-in themes:

```bash
# Default Light theme.
node bin/ggb-anim.mjs preview <scene>

# Switch to Dark theme.
node bin/ggb-anim.mjs preview <scene> --style dark
node bin/ggb-anim.mjs export <scene> --style dark
```

## Support Target

This skill verifies and exports `.ggb` files for GeoGebra Classic 6 only. The official GeoGebra installation manual lists Classic 6 as the offline app for tablets, laptops, and desktops and notes that it includes Graphing, CAS, Geometry, 3D Graphing, Spreadsheet, Probability Calculator, and Exam mode:

https://geogebra.github.io/docs/reference/en/GeoGebra_Installation/

The preview page has one `Classic 6 .ggb` download button. CLI export writes a single `.ggb` file:

```bash
node bin/ggb-anim.mjs export <scene> --style dark
```

`--format classic` and `--format classic6` are accepted only as compatibility aliases. Other GeoGebra apps are not a verified target.

## Repository Layout

```text
SKILL.md            # Skill workflow and hard rules
AGENTS.md           # Coding-agent constraints
bin/ggb-anim.mjs    # CLI: preview, examples, new, script, validate, check, export
assets/preview.html # Preview and export harness
docs/images/        # README screenshots
references/         # Commands, animation recipes, schema, API, troubleshooting
scripts/            # install-skill.sh and self-check.sh
examples/           # Four advanced examples
```

## Environment

- Core features require Node and a modern browser. The GeoGebra engine loads from the official CDN.
- Optional headless check/export requires Playwright and Chromium.
- Verified desktop target: GeoGebra Classic 6.

## Boundaries

- The animated export format is `.ggb` opened in GeoGebra. GIF/MP4 export is not built in.
- Export compatibility is verified for GeoGebra Classic 6 only.
- Native GeoGebra animation is uniform or oscillating, with no easing.
- Animation state is saved into `.ggb`, but GeoGebra desktop may require pressing Play after reopening.

## References

- Commands: `references/commands.md`
- Animation recipes: `references/animation.md`
- Scene schema: `references/scene-schema.md`
- API notes: `references/api.md`
- Troubleshooting: `references/troubleshooting.md`
