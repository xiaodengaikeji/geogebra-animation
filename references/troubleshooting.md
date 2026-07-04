# Troubleshooting

## Syntax Issues

| Symptom | Cause | Fix |
| --- | --- | --- |
| `evalCommand` returns false | Localized command name, missing `*`, missing dependency, or unsupported command | Use English names, explicit `*`, and define dependencies first. |
| `validate` reports an unstable algebraic command pattern | A command wraps one free `x`/`y` expression, which is often a guessed or unsupported signature | Use a direct labeled equation (`C: ... = ...`), a function definition, or `Curve(...)`; only keep wrapper commands when their exact signature is documented and verified. |
| Circle renders as ellipse | View units are not equal | Set `view.axisRatio` to `[1, 1]`. |
| Trig result is wrong | Degrees were used as radians | Use radians, `30°`, or `30*pi/180`. |
| `ax` behaves like a variable | Adjacent letters form one variable name | Write `a*x`. |
| Object is invisible | Dependency order or color issue | Define dependencies first and use hex colors. |
| Geometry commands fail | The scene is not using the Classic 6 target or dependencies are missing | Use `"app": "classic"` and define dependencies before geometry commands. |
| `SetColor` or `SetTrace` appears to fail | Scripting commands may return false | The harness treats known scripting commands as successful. |
| Animation target is missing | `animate.target` does not match a defined slider | Align the target name with an object assignment. |

## Loading

- Blank preview or permanently disabled buttons usually mean `deployggb.js` failed to load.
- Headless `check/export` may need time for the GeoGebra engine to load from the network.

## Export

| Symptom | Fix |
| --- | --- |
| `check/export` lacks Playwright | Run `npm i -D playwright && npx playwright install chromium`. |
| Exported `.ggb` opens but does not move | Check the eighth `Slider(...)` parameter; desktop may require pressing Play. |
| Export opens at the wrong frame | Set `captureAt` to the desired clock value. |
| Trace is missing after reopening | Trace stores the switch, not pixels; replay the animation to redraw it. |
| Export reports localized command names | Ensure the applet uses `language: "en"` and run `check` again. |

## Known `.ggb` Behavior

Machine-checkable facts:

- `Slider(..., animating=true, ...)` plus `getBase64()` writes animation state into `.ggb`.
- `check` verifies command construction, English XML command names, `<animation>`, base64 export, reload, and fresh-open loading in a Classic 6 applet.

Manual confirmation is still useful for the installed Classic 6 desktop build. Classic 6 may require pressing Play after opening a file.

## Offline Mode

Offline support is not built in by default. To add it:

1. Download the official GeoGebra Math Apps Bundle.
2. Place it under a repository-relative path such as `assets/GeoGebra/`.
3. Replace the CDN `deployggb.js` script with the local bundle path.
4. Set the matching HTML5 codebase before injection.

## 3D

`app: "3d"` uses the same API, but headless export requires WebGL support in Chromium.
