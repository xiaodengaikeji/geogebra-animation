# GeoGebra Embed and JS API Notes

The harness is `assets/preview.html`. It embeds the official engine, builds the construction, and exports `.ggb` for GeoGebra Classic 6.

Verified target: GeoGebra Classic 6 only.

Official installation reference: https://geogebra.github.io/docs/reference/en/GeoGebra_Installation/

## Embed

```js
new GGBApplet({
  appName: "classic",
  language: "en",
  width: 800,
  height: 600,
  appletOnLoad: onLoad
}, true).inject("ggb");
```

Common parameters include `appName`, `language`, `width`, `height`, `ggbBase64`, `filename`, `material_id`, `showToolBar`, `showAlgebraInput`, and `showMenuBar`. This skill sets `appName: "classic"` for the verified Classic 6 target.

The harness sets `language: "en"` so exported XML uses English command names. This prevents localized command names from breaking `.ggb` files in Classic 6.

## Timing

- All API calls must happen after `appletOnLoad(api)`.
- Use asynchronous `getBase64(callback)` for export.
- Disable error dialogs before evaluating commands in headless runs.

## Construction

| Method | Purpose |
| --- | --- |
| `setErrorDialogsActive(false)` | Prevent modal errors from blocking headless checks. |
| `evalCommand(cmd)` | Execute a command. Bad commands return false. |
| `evalCommandGetLabels(cmd)` | Execute and return created labels. |
| `exists(name)` / `isDefined(name)` | Check whether an object was created. |

Scripting commands such as `SetColor` and `SetTrace` may return false even when they work because they do not create objects.

## Color Pitfall

GeoGebra command RGB values are 0-1. Prefer hex strings:

```geogebra
SetColor(P, "#1E88E5")
```

Do not use 0-255 values in `SetColor` commands. The JS method `setColor(name, r, g, b)` is different and uses 0-255 values.

## View

| Method | Purpose |
| --- | --- |
| `setCoordSystem(xmin, xmax, ymin, ymax)` | Set 2D viewport. |
| `setAxesVisible(xBool, yBool)` | Show or hide axes. |
| `setGridVisible(bool)` | Show or hide grid. |
| `evalCommand("SetAxesRatio(1, 1)")` | Set unit ratio. |

## Animation

| Method | Purpose |
| --- | --- |
| `setAnimating(name, bool)` | Mark object as animated. |
| `setAnimationSpeed(name, speed)` | Set speed. |
| `startAnimation()` / `stopAnimation()` | Start or stop global animation. |
| `setValue(name, value)` / `getValue(name)` | Set or read numeric values. |

The skill also bakes animation into `Slider(...)`, which is the reliable way to preserve animation in exported `.ggb`.

## Export

| Method | Purpose |
| --- | --- |
| `getBase64(cb)` | Asynchronously return `.ggb` bytes encoded as base64. |
| `setBase64(str, cb)` | Load a `.ggb` from base64 for round-trip checks. |
| `getXML()` / `setXML(str)` | Read or replace construction XML. |
| `getPNGBase64(scale, transparent, dpi)` | Capture a still frame as PNG. |
| `setSize(w, h)` | Resize the applet. |

## Headless

Open the inlined preview with `file://`, wait for `window.__READY__ === true`, then use:

- `window.__BUILD__`
- `window.api`
- `window.__getGGBBase64()`
- `window.__reloadGGBBase64(base64)`
- `window.__freshLoadGGBBase64(base64, labels, "classic")`
