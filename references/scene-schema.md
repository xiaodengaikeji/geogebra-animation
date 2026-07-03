# scene.json Schema

`scene.json` is the single source of truth. Preview and export both read this file.

Validate a scene with:

```bash
node bin/ggb-anim.mjs validate <scene>
```

## Complete Example

```jsonc
{
  "$schema": "geogebra-anim/v1",
  "title": "basic-orbit",
  "app": "classic",
  "view": {
    "coords": [-3, 3, -2, 2],
    "axes": true,
    "grid": false,
    "axisRatio": [1, 1]
  },
  "objects": [
    "t = Slider(0, 2*pi, 0.02, 1, 200, false, true, true, false)",
    "P = (2*cos(t), 2*sin(t))",
    "SetColor(P, \"#1E88E5\")",
    "SetPointSize(P, 6)"
  ],
  "animate": [{ "target": "t", "speed": 1, "direction": "increasing" }],
  "autoplay": true,
  "captureAt": 0,
  "notes": "Human-readable notes only."
}
```

## Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | no | File and page title. Defaults to `geogebra-animation`. |
| `app` | enum | no | Must be `classic` when present. This skill verifies GeoGebra Classic 6 only. |
| `view.coords` | `[number, number, number, number]` | no | `[xmin, xmax, ymin, ymax]`. |
| `view.axes` | boolean | no | Defaults to true. |
| `view.grid` | boolean | no | Defaults to false. |
| `view.axisRatio` | `[number, number]` | no | Unit ratio. Use `[1, 1]` for circles that must render as circles. |
| `objects` | `(string | {cmd, expect})[]` | yes | Ordered GeoGebra commands. Define dependencies before users. |
| `animate` | `{target, speed?, direction?}[]` | no | Sliders to animate. |
| `autoplay` | boolean | no | Affects preview only. Defaults to true. |
| `captureAt` | number | no | Clock value used before `.ggb` export. Defaults to 0. |
| `notes` | string | no | Human-readable notes. Not sent to GeoGebra as a command. |

## objects[]

Use plain command strings by default:

```json
"P = (2*cos(t), 2*sin(t))"
```

An object form can be used for future assertions:

```json
{ "cmd": "P = (2*cos(t), 2*sin(t))", "expect": ["defined"] }
```

Rules:

- Command names must be English.
- Multiplication must use explicit `*`.
- Any `animate.target` must be defined in `objects` with an assignment such as `t = ...`.
- Style and trace settings should also be commands in `objects`.

## animate[]

| Key | Description |
| --- | --- |
| `target` | Slider name. It must be defined in `objects`. |
| `speed` | Speed multiplier. Defaults to 1. |
| `direction` | `increasing`, `decreasing`, `oscillating`, or `increasing-once`. Direction is patched through XML on a best-effort basis. |

## Slider Animation

To ensure exported `.ggb` files store animation state, set the eighth `Slider(...)` parameter to `true`:

```text
Slider(min, max, step, speed, width, isAngle, horizontal, animating=true, random)
```
