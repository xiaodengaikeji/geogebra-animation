---
name: geogebra-animation
description: Create GeoGebra mathematical animations from natural language. Use the official GeoGebra engine for browser preview, then export animated .ggb files and command scripts. Use this skill when the user asks for GeoGebra, graph/function/geometry animation, moving points, parameter curves, transformations, .ggb export, or GeoGebra command scripts.
---

# GeoGebra Animation Skill

Turn a requested mathematical animation into a browser preview, an animated `.ggb` file, and a command script.

The preview and export use the same official GeoGebra engine (`deployggb.js`). The preview page calls `getBase64()`, and those bytes are the `.ggb` file. The single source of truth is `scene.json`.

The CLI is `bin/ggb-anim.mjs`. Core commands use only Node built-ins. Optional `check` and `export` commands require Playwright.

Local examples can be built with:

```bash
node bin/ggb-anim.mjs examples
```

This writes each `examples/*/preview.html`, builds `examples/index.html`, and opens the gallery in the default browser. The gallery includes light and dark animation color styles. The selected style affects iframe previews, detail pages, copied commands, and downloaded `.ggb` files.

## Built-In Themes

The skill has two built-in animation themes: `light` and `dark`. The default is `light`.

Use `light` unless the user asks for a dark presentation or the target context needs a dark background. To switch to the dark theme:

```bash
node bin/ggb-anim.mjs preview <scene> --style dark
node bin/ggb-anim.mjs export <scene> --style dark
node bin/ggb-anim.mjs script <scene> --style dark
node bin/ggb-anim.mjs check <scene> --style dark
```

For the examples gallery, run `node bin/ggb-anim.mjs examples`, then use the `Light Animation` / `Dark Animation` toggle in the page. The selected gallery theme is applied to iframe previews, detail pages, copied commands, and downloaded `.ggb` files.

## Hard Rules

1. Command names must be English. Use `Circle`, not localized names.
2. Always write explicit `*`: `2*cos(t)`, `a*x`, `x*y`. `ax` is a variable name, not multiplication.
3. Trigonometric functions use radians. Use `30°` or `30*pi/180` when degrees are required.
4. Referenced objects must be explicitly named. Write `P = (...)`; do not rely on automatic labels.
5. Style should be separate commands after the object, such as `SetColor(P, "#1E88E5")`. Use hex colors or 0-1 RGB values, never 0-255 values in GeoGebra commands.
6. Use one clock slider. Define other objects as functions of that slider. Bake animation into `Slider(...)` by setting the eighth parameter, `animating`, to `true`.
7. Only claim support for GeoGebra Classic 6. The generated `.ggb` is verified for Classic 6, not for Graphing Calculator, Geometry Calculator, Calculator Suite, Classic 5, mobile apps, or other app families.
8. Do not invent commands or command signatures. Use only top-level command forms shown in `references/commands.md`, or run `check` with the real engine before relying on a new form.
9. For algebraic objects, prefer direct definitions over guessed wrapper commands. Use `f(x) = ...`, `C: ... = ...`, named points, or `Curve(...)`. Do not write `Name = CommandName(expression in x/y)` unless `references/commands.md` documents that exact signature.

## Reference Routing

| Task | Read |
| --- | --- |
| GeoGebra command syntax | `references/commands.md` |
| Animation patterns | `references/animation.md` |
| `scene.json` fields | `references/scene-schema.md` |
| Preview/export harness or JS API | `references/api.md` |
| Errors, export behavior, offline, 3D | `references/troubleshooting.md` |

## Workflow

1. Clarify at most three points: what moves, whether 2D is enough, and style/color preferences.
2. Write `scene.json` in the user's working directory, not inside the skill repository unless editing examples.
3. Validate: `node <skill>/bin/ggb-anim.mjs validate <scene>`.
4. Preview: `node <skill>/bin/ggb-anim.mjs preview <scene>`.
5. Iterate. Use preview line status to locate failures. Self-repair up to three rounds.
6. Export after preview acceptance:
   - Browser button: `Classic 6 .ggb`
   - CLI: `node <skill>/bin/ggb-anim.mjs export <scene> -o out.ggb`
   - Script: `node <skill>/bin/ggb-anim.mjs script <scene>`
7. Report paths and explain how to open the `.ggb` in GeoGebra Classic 6. Be explicit that Classic 6 may require pressing Play.

Optional automation:

```bash
node <skill>/bin/ggb-anim.mjs check <scene>
```

`check` verifies command construction, English XML command names, `<animation>`, `.ggb` base64 export, and fresh-open loading in a Classic 6 applet.

## Support Target

Verified target: GeoGebra Classic 6 only.

Official reference: https://geogebra.github.io/docs/reference/en/GeoGebra_Installation/

The GeoGebra installation manual lists Classic 6 as an offline app for tablets, laptops, and desktops and notes that it includes Graphing, CAS, Geometry, 3D Graphing, Spreadsheet, Probability Calculator, and Exam mode. Use this skill's `.ggb` output with that app. Other GeoGebra app families are outside the verified support target.

## Minimal Scene

```json
{
  "$schema": "geogebra-anim/v1",
  "title": "basic-orbit",
  "app": "classic",
  "view": { "coords": [-3, 3, -2, 2], "axes": true, "grid": false, "axisRatio": [1, 1] },
  "objects": [
    "t = Slider(0, 2*pi, 0.02, 1, 200, false, true, true, false)",
    "O = (0, 0)",
    "c = Circle(O, 2)",
    "P = (2*cos(t), 2*sin(t))",
    "r = Segment(O, P)",
    "SetColor(P, \"#1E88E5\")",
    "SetPointSize(P, 6)",
    "SetTrace(P, true)"
  ],
  "animate": [{ "target": "t", "speed": 1, "direction": "increasing" }],
  "autoplay": true,
  "captureAt": 0
}
```

`Slider(min, max, step, speed, width, isAngle, horizontal, animating, random)` must have `animating` set to `true`.

## Troubleshooting Shortcuts

| Symptom | Fix |
| --- | --- |
| A preview line fails | Check English command names, explicit `*`, dependency order, and Classic 6 compatibility |
| Circle looks like an ellipse | Set `view.axisRatio` to `[1, 1]` |
| Trig result is wrong | Use radians or explicit degree notation |
| Exported `.ggb` does not animate | Ensure the slider `animating` parameter is `true`; desktop may require pressing Play |
| Export opens with localized command errors | Run `check`; XML command names must be English |
| `check/export` lacks Playwright | Install with `npm i -D playwright && npx playwright install chromium` |

## Boundaries

- The animated deliverable is `.ggb` opened in GeoGebra Classic 6.
- GIF/MP4 export is a separate frame-capture pipeline and is not built in.
- Native GeoGebra animation has no easing.
