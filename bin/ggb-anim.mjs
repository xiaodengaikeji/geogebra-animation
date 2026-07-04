#!/usr/bin/env node
/**
 * ggb-anim - CLI tool for the GeoGebra animation skill
 *
 *   preview  <scene>        Inline a scene into preview.html and open it in a browser
 *   examples [dir]          Build local examples, preview.html files, and an index page
 *   new      <name>         Scaffold a scene.json
 *   script   <scene>        Export a GeoGebra command script
 *   validate <scene>        Validate scene.json schema, references, and lint rules
 *   check    <scene>        Run a headless Playwright smoke test
 *   export   <scene> [-o f] Export a .ggb file through headless Playwright
 *
 * Core commands use only Node built-ins. check/export require Playwright.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW_TEMPLATE = path.join(REPO_ROOT, "assets", "preview.html");
const DEPLOY_TAG = '<script src="https://www.geogebra.org/apps/deployggb.js"></script>';

const ANIMATION_STYLE_THEMES = {
  light: {
    label: "Light Animation",
    view: {
      background: "#FBFCFE",
      axes: "#2F3A4C",
      grid: "#E3EAF2",
      slider: "#2F3A4C"
    },
    colors: {
      "#4C78A8": "#3B6FD8",
      "#1F77B4": "#0B79B7",
      "#72B7B2": "#0E8F87",
      "#54A24B": "#2F9B63",
      "#F58518": "#E78A00",
      "#E45756": "#D84A5F",
      "#B279A2": "#7A5CCF",
      "#9D755D": "#6B7280",
      "#111827": "#111827"
    },
    fillings: {
      "0.18": "0.20",
      "0.35": "0.32",
      "0.55": "0.50"
    }
  },
  dark: {
    label: "Dark Animation",
    view: {
      background: "#0B1020",
      axes: "#AEBBD2",
      grid: "#253149",
      slider: "#E6EDF7"
    },
    colors: {
      "#4C78A8": "#86A8FF",
      "#1F77B4": "#38BDF8",
      "#72B7B2": "#52D6C5",
      "#54A24B": "#8BE8B0",
      "#F58518": "#F8C45C",
      "#E45756": "#F47C8E",
      "#B279A2": "#C2B2FF",
      "#9D755D": "#C5D0E0",
      "#111827": "#F5F7FB"
    },
    fillings: {
      "0.18": "0.30",
      "0.35": "0.36",
      "0.55": "0.48"
    }
  }
};
const DEFAULT_ANIMATION_STYLE = "light";

// ----------------------------------------------------------------- Utilities
const isTTY = process.stdout.isTTY;
const c = (code, s) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = (s) => c(32, s), red = (s) => c(31, s), yellow = (s) => c(33, s), dim = (s) => c(2, s), bold = (s) => c(1, s);
function die(msg, code = 1) { console.error(red("Error: ") + msg); process.exit(code); }
function cmdOf(o) { return typeof o === "string" ? o : (o && o.cmd) || ""; }
function safeName(scene) { return (scene.title || "geogebra-animation").replace(/[^\w.\-]+/g, "-"); }
function htmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
function urlPathFrom(fromFile, toFile) {
  let rel = path.relative(path.dirname(fromFile), toFile);
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel.split(path.sep).map(encodeURIComponent).join("/");
}
function categoryLabel(relDir) {
  const s = relDir.toLowerCase();
  if (s.includes("geometry")) return "Geometry";
  if (s.includes("algebra")) return "Algebra";
  if (s.includes("statistics")) return "Statistics";
  if (s.includes("calculus")) return "Calculus";
  return "Example";
}
function summaryOf(scene) {
  const notes = String(scene.notes || "").trim();
  if (!notes) return "Open the detail page to view the full GeoGebra animation.";
  const first = notes.split(/[。.!]/)[0].trim();
  return first || notes;
}
function stripStringLiterals(s) {
  return String(s)
    .replace(/"([^"\\]|\\.)*"/g, "\"\"")
    .replace(/'([^'\\]|\\.)*'/g, "''");
}
function animationStyleButtonsHtml() {
  return Object.entries(ANIMATION_STYLE_THEMES).map(([name, theme]) =>
    `<button type="button" data-animation-style-choice="${name}">${htmlEscape(theme.label)}</button>`
  ).join("");
}
function assertAnimationStyle(style) {
  if (style && !ANIMATION_STYLE_THEMES[style]) die(`Unknown --style '${style}' (choices: ${Object.keys(ANIMATION_STYLE_THEMES).join("/")})`);
  return style || DEFAULT_ANIMATION_STYLE;
}
function exportTargetInfo(format) {
  if (format && format !== "classic" && format !== "classic6") {
    die("Only GeoGebra Classic 6 export is supported. Remove --format or use --format classic.");
  }
  return {
    format: "classic",
    appName: "classic",
    label: "Classic 6 .ggb",
    target: "GeoGebra Classic 6",
    note: "uses native Classic construction commands; preview and export use the same Classic applet state"
  };
}
function rewriteSetColor(cmd, colors) {
  if (!colors) return cmd;
  return String(cmd).replace(/(SetColor\s*\(\s*[^,]+,\s*")#([0-9a-fA-F]{6})(")/g, (_, head, hex, tail) => {
    const next = colors["#" + hex.toUpperCase()];
    return next ? head + next + tail : head + "#" + hex + tail;
  });
}
function rewriteSetFilling(cmd, fillings) {
  if (!fillings) return cmd;
  return String(cmd).replace(/(SetFilling\s*\(\s*[^,]+,\s*)([0-9]*\.?[0-9]+)(\s*\))/g, (_, head, raw, tail) => {
    const exact = fillings[raw];
    const fixed = fillings[Number(raw).toFixed(2)];
    return head + (exact || fixed || raw) + tail;
  });
}
function styleCommand(o, theme) {
  const styleText = (cmd) => rewriteSetFilling(rewriteSetColor(cmd, theme.colors || {}), theme.fillings || {});
  if (typeof o === "string") return styleText(o);
  if (!o || typeof o !== "object") return o;
  const copy = { ...o };
  if (copy.cmd) copy.cmd = styleText(copy.cmd);
  return copy;
}
function styleScene(scene, style) {
  const name = assertAnimationStyle(style);
  if (!name) return scene;
  const theme = ANIMATION_STYLE_THEMES[name];
  return { ...scene, objects: (scene.objects || []).map((o) => styleCommand(o, theme)), animationStyle: name };
}

function explicitShowLabelNames(objects) {
  const names = new Set();
  for (const o of objects || []) {
    const m = cmdOf(o).match(/^\s*ShowLabel\s*\(\s*([A-Za-z_]\w*)\s*,/);
    if (m) names.add(m[1]);
  }
  return names;
}
function prepareClassic6Scene(scene) {
  const objects = [...(scene.objects || [])];
  const explicit = explicitShowLabelNames(objects);
  const animationTargets = new Set((scene.animate || []).map((a) => a && a.target).filter(Boolean));
  for (const label of definedNames(objects)) {
    if (!animationTargets.has(label) && !explicit.has(label)) objects.push(`ShowLabel(${label}, false)`);
  }
  return { ...scene, app: "classic", exportFormat: "classic", objects };
}

/** Resolve a <scene> argument into { file, dir, scene }. The argument may be a directory or a .json file. */
function resolveScene(arg) {
  if (!arg) die("Missing <scene> argument (path to scene.json or its directory)");
  let file = path.resolve(arg);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "scene.json");
  if (!fs.existsSync(file)) die(`Scene file not found: ${file}`);
  let scene;
  try { scene = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { die(`scene.json is not valid JSON: ${e.message}`); }
  return { file, dir: path.dirname(file), scene };
}

/** Build a self-contained preview HTML by inlining the scene as window.__SCENE__. */
function inlineHtml(scene) {
  const tpl = fs.readFileSync(PREVIEW_TEMPLATE, "utf8");
  if (!tpl.includes(DEPLOY_TAG)) die("preview.html template is missing the deployggb marker");
  const inject = `<script>window.__SCENE__ = ${JSON.stringify(scene)}; window.__ANIMATION_STYLES__ = ${JSON.stringify(ANIMATION_STYLE_THEMES)};</script>\n  `;
  return tpl.replace(DEPLOY_TAG, inject + DEPLOY_TAG);
}

function writePreview(scene, dir) {
  const out = path.join(dir, "preview.html");
  fs.writeFileSync(out, inlineHtml(scene));
  return out;
}

function openInBrowser(file, query = "") {
  const url = "file://" + file + query;
  let cmd, args;
  if (process.platform === "darwin") { cmd = "open"; args = [url]; }
  else if (process.platform === "win32") { cmd = "cmd"; args = ["/c", "start", "", url]; }
  else { cmd = "xdg-open"; args = [url]; }
  try { spawn(cmd, args, { stdio: "ignore", detached: true }).unref(); }
  catch (e) { console.log(dim("(Could not open the browser automatically. Open the file manually.)")); }
}

// Extract assigned object names from objects for cross-reference validation.
function definedNames(objects) {
  const names = new Set();
  for (const o of objects) {
    const m = cmdOf(o).match(/^\s*([A-Za-z_]\w*)\s*(?::=|=(?!=)|:)/); // name = ...  /  name := ...  /  name: equation
    if (m) names.add(m[1]);
  }
  return names;
}

const DESKTOP_GEOMETRY_COMMANDS = new Set([
  "Segment", "Polygon", "Line", "Circle", "Ray", "Vector", "Midpoint",
  "PerpendicularLine", "PerpendicularBisector", "ParallelLine", "CircularArc", "CircularSector"
]);

const DOCUMENTED_TOP_LEVEL_COMMANDS = new Set([
  "Slider",
  "Segment", "Polygon", "Line", "Circle", "Ray", "Vector",
  "Midpoint", "Centroid", "PerpendicularLine", "PerpendicularBisector", "ParallelLine",
  "CircularArc", "CircularSector",
  "Area", "Perimeter",
  "Rotate", "Translate", "Reflect", "Dilate",
  "Curve", "Locus", "Derivative", "Integral", "Sequence", "If",
  "SetColor", "SetBackgroundColor", "SetDynamicColor", "SetLabelColor",
  "SetPointSize", "SetPointStyle", "SetLineThickness", "SetLineStyle", "SetFilling",
  "SetVisibleInView", "SetLabelMode", "SetCaption", "SetTrace", "SetValue", "SetCoords",
  "SetConditionToShowObject", "SetLayer", "SetTooltipMode", "SetFixed", "SetSpinSpeed",
  "SetAxesRatio", "ShowLabel", "StartAnimation", "SelectObjects", "Delete", "Rename", "PlaySound"
]);

function topLevelArgs(raw) {
  const args = [];
  let depth = 0, start = 0;
  const s = String(raw || "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth = Math.max(0, depth - 1);
    else if (ch === "," && depth === 0) {
      args.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = s.slice(start).trim();
  if (tail) args.push(tail);
  return args;
}

function topLevelCommandCall(cmd) {
  const m = String(cmd || "").match(/^\s*(?:[A-Za-z_]\w*(?:\([^)]*\))?\s*(?::=|=(?!=)|:)\s*)?([A-Z][A-Za-z0-9_]*)\s*\(([\s\S]*)\)\s*$/);
  if (!m) return null;
  return { name: m[1], args: topLevelArgs(m[2]) };
}

function hasFreeXYExpression(arg) {
  const s = stripStringLiterals(arg);
  const hasFreeXY = /(^|[^A-Za-z0-9_])x([^A-Za-z0-9_]|$)/.test(s) || /(^|[^A-Za-z0-9_])y([^A-Za-z0-9_]|$)/.test(s);
  const hasAlgebra = /[=+\-*/^]/.test(s);
  const looksLikePoint = /^\s*\([^,]+,[^,]+\)\s*$/.test(s);
  return hasFreeXY && hasAlgebra && !looksLikePoint;
}

function sourceCommandIssues(scene) {
  const errors = [];
  const warnings = [];
  (scene.objects || []).forEach((o, i) => {
    const cmd = cmdOf(o);
    const call = topLevelCommandCall(cmd);
    if (!call) return;
    if (!DOCUMENTED_TOP_LEVEL_COMMANDS.has(call.name)) {
      warnings.push({
        index: i,
        cmd,
        reason: `${call.name}(...) is not documented in references/commands.md; verify it with check before relying on it.`
      });
    }
    if (call.args.length === 1 && hasFreeXYExpression(call.args[0])) {
      errors.push({
        index: i,
        cmd,
        reason: `${call.name}(...) wraps a single algebraic x/y expression. Use a direct equation label, function definition, or Curve(...), unless references/commands.md documents this exact command signature.`
      });
    }
  });
  return { errors, warnings };
}

function desktopCompatibilityIssues(scene) {
  const issues = [];
  (scene.objects || []).forEach((o, i) => {
    const cmd = cmdOf(o);
    const m = cmd.match(/^\s*(?:[A-Za-z_]\w*\s*(?::=|=)\s*)?([A-Za-z]\w*)\s*\(([\s\S]*)\)\s*$/);
    if (!m || !DESKTOP_GEOMETRY_COMMANDS.has(m[1])) return;
    const inlineArgs = topLevelArgs(m[2]).filter((arg) => arg.startsWith("("));
    if (inlineArgs.length) {
      issues.push({
        index: i,
        cmd,
        reason: `${m[1]} uses inline point argument ${inlineArgs[0]}; define that point first, then pass the point label.`
      });
    }
  });
  return issues;
}

// ----------------------------------------------------------------- Command: preview
function doPreview(args) {
  const { scene, dir } = resolveScene(args._[0]);
  const out = writePreview(prepareClassic6Scene(scene), dir);
  console.log(green("✓ ") + `Generated preview: ${out}`);
  console.log(dim("  Self-contained file. The GeoGebra engine loads from the official CDN."));
  const style = assertAnimationStyle(args.style);
  const query = style ? "?style=" + encodeURIComponent(style) : "";
  if (!args.noOpen) { openInBrowser(out, query); console.log(dim("  Opened in the browser. Re-run preview or refresh after editing scene.json.")); }
}

// ----------------------------------------------------------------- Command: examples
function findSceneFiles(root) {
  const scenes = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === "node_modules" || ent.name === ".git") continue;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && ent.name === "scene.json") scenes.push(p);
    }
  }
  walk(root);
  return scenes.sort((a, b) => path.relative(root, a).localeCompare(path.relative(root, b)));
}

function examplesIndexHtml(root, indexFile, items) {
  const cards = items.map((it) => {
    const href = urlPathFrom(indexFile, it.preview);
    const detailHref = href + "?style=light";
    const embedHref = href + "?embed=1&style=light";
    const relDir = path.relative(root, it.dir) || ".";
    const relScene = path.relative(root, it.file);
    const title = it.scene.title || relDir;
    return `    <li>
      <a class="card" href="${detailHref}" data-preview-href="${href}" aria-label="Open ${htmlEscape(title)} details">
        <div class="frame">
          <iframe src="${embedHref}" data-preview-frame="${href}" title="${htmlEscape(title)} preview"></iframe>
        </div>
        <div class="meta">
          <div class="row">
            <span class="badge">${htmlEscape(categoryLabel(relDir))}</span>
            <span class="path">${htmlEscape(relScene)}</span>
          </div>
          <h2>${htmlEscape(title)}</h2>
          <p>${htmlEscape(summaryOf(it.scene))}</p>
          <span class="detail">Open Details</span>
        </div>
      </a>
    </li>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GeoGebra Examples Gallery</title>
<script>
  (function () {
    var saved = "";
    try { saved = localStorage.getItem("ggbAnimationStyle") || ""; } catch (e) {}
    document.documentElement.dataset.animationStyle = saved === "dark" || saved === "light" ? saved : "light";
  })();
</script>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    color: #20242a;
    background: #f5f7fb;
  }
  main {
    width: min(1180px, calc(100vw - 24px));
    height: 100vh;
    margin: 0 auto;
    padding: 12px 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  header { display: flex; align-items: end; justify-content: space-between; gap: 14px; margin-bottom: 10px; }
  h1 { margin: 0; font-size: 24px; line-height: 1.15; font-weight: 750; }
  header p { margin: 3px 0 0; color: #667085; }
  .controls { display: flex; align-items: center; gap: 10px; }
  .count { color: #667085; font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .style-toggle {
    display: inline-grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2px;
    padding: 3px;
    border: 1px solid #d8dee8;
    border-radius: 8px;
    background: #ffffff;
  }
  .style-toggle button {
    min-width: 72px;
    padding: 4px 9px;
    border: 0;
    border-radius: 6px;
    color: #667085;
    background: transparent;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .style-toggle button[aria-pressed="true"] {
    color: #ffffff;
    background: #20242a;
    font-weight: 700;
  }
  ul {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(2, minmax(0, 1fr));
    gap: 12px;
    min-height: 0;
    flex: 1;
    margin: 0;
    padding: 0;
  }
  li { min-height: 0; }
  .card {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    border: 1px solid #d8dee8;
    border-radius: 8px;
    color: inherit;
    background: #ffffff;
    text-decoration: none;
    box-shadow: 0 10px 28px rgb(27 31 36 / 7%);
  }
  .card:hover { border-color: #2f6fed; box-shadow: 0 14px 36px rgb(27 31 36 / 12%); }
  .frame { flex: 1 1 auto; min-height: 0; border-bottom: 1px solid #d8dee8; background: #eef2f7; }
  iframe { display: block; width: 100%; height: 100%; border: 0; pointer-events: none; }
  .meta { flex: 0 0 auto; padding: 10px 12px 11px; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
  .badge {
    flex: 0 0 auto;
    padding: 2px 8px;
    border-radius: 999px;
    color: #174ea6;
    background: #e8f0fe;
    font-size: 12px;
    font-weight: 700;
  }
  .path {
    overflow: hidden;
    color: #667085;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  h2 { margin: 0 0 3px; font-size: 16px; line-height: 1.2; }
  .meta p {
    overflow: hidden;
    margin: 0 0 8px;
    color: #475467;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail { color: #2f6fed; font-weight: 700; }
  @media (max-width: 760px) {
    main { height: auto; min-height: 100vh; overflow: visible; }
    header { display: block; }
    .controls { justify-content: space-between; margin-top: 8px; }
    .count { display: block; }
    ul { grid-template-columns: 1fr; grid-template-rows: none; }
    .frame { height: 220px; flex: none; }
  }
</style>
</head>
<body>
<main>
  <header>
    <div>
      <h1>GeoGebra Examples Gallery</h1>
      <p>Four advanced animation examples: geometry, algebra, statistics, and calculus.</p>
    </div>
    <div class="controls">
      <div class="style-toggle" role="group" aria-label="Animation color style">
        ${animationStyleButtonsHtml()}
      </div>
      <span class="count">${items.length} previews</span>
    </div>
  </header>
  <ul>
${cards}
  </ul>
</main>
<script>
  (function () {
    var root = document.documentElement;
    var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-animation-style-choice]"));
    var cards = Array.prototype.slice.call(document.querySelectorAll("[data-preview-href]"));
    var frames = Array.prototype.slice.call(document.querySelectorAll("[data-preview-frame]"));
    function apply(style) {
      if (style !== "dark" && style !== "light") style = "light";
      root.dataset.animationStyle = style;
      buttons.forEach(function (button) {
        button.setAttribute("aria-pressed", button.dataset.animationStyleChoice === style ? "true" : "false");
      });
      cards.forEach(function (card) {
        card.href = card.dataset.previewHref + "?style=" + encodeURIComponent(style);
      });
      frames.forEach(function (frame) {
        frame.src = frame.dataset.previewFrame + "?embed=1&style=" + encodeURIComponent(style);
      });
      try { localStorage.setItem("ggbAnimationStyle", style); } catch (e) {}
    }
    buttons.forEach(function (button) {
      button.addEventListener("click", function () { apply(button.dataset.animationStyleChoice); });
    });
    apply(root.dataset.animationStyle);
  })();
</script>
</body>
</html>
`;
}

function doExamples(args) {
  const root = path.resolve(args.dir || args._[0] || path.join(REPO_ROOT, "examples"));
  if (!fs.existsSync(root)) die(`Examples directory not found: ${root}`);
  if (!fs.statSync(root).isDirectory()) die(`examples argument must be a directory: ${root}`);
  const files = findSceneFiles(root);
  if (!files.length) die(`No scene.json files found under: ${root}`);

  const items = files.map((file) => {
    const { scene, dir } = resolveScene(file);
    const prepared = prepareClassic6Scene(scene);
    const preview = writePreview(prepared, dir);
    const rel = path.relative(root, preview);
    console.log(green("✓ ") + `Generated ${rel}`);
    return { file, dir, scene: prepared, preview };
  });

  const indexFile = args.o ? path.resolve(args.o) : path.join(root, "index.html");
  fs.mkdirSync(path.dirname(indexFile), { recursive: true });
  fs.writeFileSync(indexFile, examplesIndexHtml(root, indexFile, items));
  console.log(green("✓ ") + `Generated examples index: ${indexFile}`);
  console.log(dim("  Preview pages are self-contained files. The GeoGebra engine loads from the official CDN."));
  if (!args.noOpen) { openInBrowser(indexFile); console.log(dim("  Opened the index page in the browser.")); }
}

// ----------------------------------------------------------------- Command: new
const TEMPLATE_SCENE = {
  $schema: "geogebra-anim/v1",
  title: "my-animation",
  app: "classic",
  view: { coords: [-5, 5, -3, 3], axes: true, grid: false, axisRatio: [1, 1] },
  objects: [
    "t = Slider(0, 2*pi, 0.02, 1, 200, false, true, true, false)",
    "P = (cos(t), sin(t))",
    'SetColor(P, "#1E88E5")',
    "SetPointSize(P, 6)",
    "SetTrace(P, true)"
  ],
  animate: [{ target: "t", speed: 1, direction: "increasing" }],
  autoplay: true,
  captureAt: 0,
  notes: "Replace objects with your construction. t is the clock slider; define other objects as functions of t to animate them."
};
function doNew(args) {
  const name = args._[0] || die("Usage: ggb-anim new <name> [--dir DIR]");
  const dir = path.resolve(args.dir || path.join(process.cwd(), name));
  const file = path.join(dir, "scene.json");
  if (fs.existsSync(file) && !args.force) die(`${file} already exists. Use --force to overwrite it.`);
  fs.mkdirSync(dir, { recursive: true });
  const scene = { ...TEMPLATE_SCENE, title: name };
  fs.writeFileSync(file, JSON.stringify(scene, null, 2) + "\n");
  console.log(green("✓ ") + `Created ${file}`);
  console.log(dim(`  Preview: node bin/ggb-anim.mjs preview ${dir}`));
}

// ----------------------------------------------------------------- Command: script
function doScript(args) {
  const { scene, dir } = resolveScene(args._[0]);
  const scripted = prepareClassic6Scene(styleScene(scene, args.style));
  const out = args.o ? path.resolve(args.o) : path.join(dir, safeName(scene) + ".script.txt");
  const body =
    `# GeoGebra command script · ${scripted.title || ""}${scripted.animationStyle ? ` · ${scripted.animationStyle}` : ""}\n` +
    `# Usage: paste these commands into the GeoGebra input bar, then press Play if needed.\n` +
    (scripted.objects || []).map(cmdOf).join("\n") + "\n";
  fs.writeFileSync(out, body);
  console.log(green("✓ ") + `Exported command script: ${out}`);
}

// ----------------------------------------------------------------- Command: validate
function doValidate(args) {
  const { scene, file } = resolveScene(args._[0]);
  const errors = [], warns = [];
  const E = (m) => errors.push(m), W = (m) => warns.push(m);

  if (!Array.isArray(scene.objects) || scene.objects.length === 0) E("objects must be a non-empty array");
  if (scene.app && scene.app !== "classic") E("Only app='classic' is supported. This skill verifies GeoGebra Classic 6 only.");
  if (scene.view && scene.view.coords && !(Array.isArray(scene.view.coords) && scene.view.coords.length === 4))
    E("view.coords must be a four-number array: [xmin, xmax, ymin, ymax]");

  const names = definedNames(scene.objects || []);
  const DIRS = ["oscillating", "increasing", "decreasing", "increasing-once"];
  for (const a of scene.animate || []) {
    if (!a.target) { E("Each animate[] item must have target"); continue; }
    if (!names.has(a.target)) E(`animate.target '${a.target}' is not defined in objects (expected an assignment like "${a.target} = ...")`);
    if (a.direction && !DIRS.includes(a.direction)) W(`animate.target '${a.target}' has invalid direction='${a.direction}' (${DIRS.join("/")})`);
  }

  // Heuristic syntax lint. Matches are warnings, not guaranteed errors.
  (scene.objects || []).forEach((o, i) => {
    const cmd = cmdOf(o);
    const lintCmd = stripStringLiterals(cmd);
    const impl = (lintCmd.match(/\d[A-Za-z]/g) || []).filter((s) => !/^\d[eE]$/.test(s)); // Exclude scientific notation like 1e3.
    if (impl.length) W(`objects[${i}] may be missing explicit * (for example "${impl[0]}" should be "${impl[0][0]}*${impl[0][1]}"): ${cmd}`);
    if (/\)\(/.test(lintCmd)) W(`objects[${i}] contains ")("; it may be missing *: ${cmd}`);
  });
  const sourceIssues = sourceCommandIssues(scene);
  for (const issue of sourceIssues.warnings) {
    W(`objects[${issue.index}] uses an undocumented top-level command: ${issue.reason} Command: ${issue.cmd}`);
  }
  for (const issue of sourceIssues.errors) {
    E(`objects[${issue.index}] uses an unstable algebraic command pattern: ${issue.reason} Command: ${issue.cmd}`);
  }
  for (const issue of desktopCompatibilityIssues(scene)) {
    E(`objects[${issue.index}] is not desktop-stable: ${issue.reason} Command: ${issue.cmd}`);
  }

  console.log(bold(`Validating ${file}`));
  for (const w of warns) console.log(yellow("  ⚠ ") + w);
  for (const e of errors) console.log(red("  ✗ ") + e);
  if (!errors.length) console.log(green("  ✓ Passed") + (warns.length ? dim(` (${warns.length} warnings)`) : ""));
  console.log(dim("  Tip: use `check` with the real GeoGebra engine for definitive command validation."));
  process.exit(errors.length ? 1 : 0);
}

// ----------------------------------------------------------------- Playwright helper
async function withPage(scene, fn, opts = {}) {
  let chromium;
  try { ({ chromium } = await import("playwright")); }
  catch (e) {
    die("check/export require Playwright:\n    npm i -D playwright && npx playwright install chromium", 2);
  }
  const tmp = path.join(REPO_ROOT, `.ggb-anim-headless-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tmp, inlineHtml(scene));
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(90000);
    page.on("pageerror", (e) => console.error(dim("[page] " + e.message)));
    const style = assertAnimationStyle(opts.style);
    const query = style ? "?style=" + encodeURIComponent(style) : "";
    await page.goto("file://" + tmp + query, { waitUntil: "load" });
    await page.waitForFunction("window.__READY__ === true", { timeout: 90000 });
    return await fn(page);
  } finally {
    await browser.close();
    try { fs.unlinkSync(tmp); } catch (e) {}
  }
}

function localizedCommandNames(xml) {
  const names = new Set();
  const re = /<command\b[^>]*\bname="([^"]+)"/g;
  let m;
  while ((m = re.exec(xml))) {
    if (/[^\x00-\x7F]/.test(m[1])) names.add(m[1]);
  }
  return Array.from(names);
}
function xmlCommandNames(xml) {
  const names = new Set();
  const re = /<command\b[^>]*\bname="([^"]+)"/g;
  let m;
  while ((m = re.exec(xml))) names.add(m[1]);
  return Array.from(names);
}
function cjkSnippets(text) {
  const snippets = new Set();
  const re = /[^\n\r]{0,40}[\u3400-\u9FFF][^\n\r]{0,40}/g;
  let m;
  while ((m = re.exec(text))) snippets.add(m[0].trim());
  return Array.from(snippets).slice(0, 8);
}
function xmlDesktopCommandIssues(xml) {
  const issues = [];
  const commandRe = /<command\b[^>]*\bname="([^"]+)"[^>]*>[\s\S]*?<input\b([^>]*)\/>[\s\S]*?<\/command>/g;
  let m;
  while ((m = commandRe.exec(xml))) {
    const name = m[1];
    if (!DESKTOP_GEOMETRY_COMMANDS.has(name)) continue;
    const attrs = m[2];
    const attrRe = /\ba\d+="([^"]*)"/g;
    let a;
    while ((a = attrRe.exec(attrs))) {
      const value = a[1].trim();
      if (value.startsWith("(")) {
        issues.push(`${name} has inline point input ${value}`);
      }
    }
  }
  return issues;
}

// ----------------------------------------------------------------- Command: check
async function doCheck(args) {
  const { scene: rawScene, file } = resolveScene(args._[0]);
  const info = exportTargetInfo(args.format);
  const scene = prepareClassic6Scene(styleScene(rawScene, args.style));
  console.log(bold(`headless check ${file}`) + dim(` (${info.label}; target: ${info.target})`));
  console.log(dim(`  Support note: ${info.note}.`));
  await withPage(scene, async (page) => {
    const build = await page.evaluate(() => window.__BUILD__);
    for (const l of build.lines) console.log((l.ok ? green("  ✓ ") : red("  ✗ ")) + `[${l.i + 1}] ${l.cmd}`);
    let fail = 0;
    if (!build.ok) {
      fail++;
      console.log(red("  ✗ Build contains failed commands"));
      for (const e of build.errors || []) {
        const label = typeof e.i === "number" && e.i >= 0 ? `objects[${e.i}]` : "scene";
        console.log(red("    - ") + `${label}: ${e.reason || e.cmd || "unknown build error"}`);
      }
    }
    else console.log(green("  ✓ All commands built successfully"));

    const sourceCommand = sourceCommandIssues(scene);
    for (const issue of sourceCommand.warnings) {
      console.log(yellow("  ⚠ ") + `objects[${issue.index}] uses an undocumented top-level command: ${issue.reason}`);
    }
    if (sourceCommand.errors.length) {
      fail += sourceCommand.errors.length;
      console.log(red("  ✗ Scene contains unstable algebraic command patterns:"));
      for (const issue of sourceCommand.errors) console.log(red("    - ") + `objects[${issue.index}]: ${issue.reason}`);
    } else {
      console.log(green("  ✓ Algebraic objects avoid guessed expression-wrapper commands"));
    }

    const sourceDesktopIssues = desktopCompatibilityIssues(scene);
    if (sourceDesktopIssues.length) {
      fail += sourceDesktopIssues.length;
      console.log(red("  ✗ Scene contains Classic 6-unstable geometry command inputs:"));
      for (const issue of sourceDesktopIssues) console.log(red("    - ") + `objects[${issue.index}]: ${issue.reason}`);
    } else {
      console.log(green("  ✓ Geometry commands use named construction inputs"));
    }

    const xml = await page.evaluate(() => window.api.getXML());
    const localized = localizedCommandNames(xml);
    const cjk = cjkSnippets(xml);
    if (localized.length) {
      fail++;
      console.log(red("  ✗ XML contains localized command names; exported .ggb may fail to open: ") + localized.join(", "));
    } else {
      console.log(green("  ✓ XML command names are English"));
    }
    if (cjk.length) {
      fail++;
      console.log(red("  ✗ XML contains CJK text; exported .ggb may fail to open:"));
      for (const s of cjk) console.log(red("    - ") + s);
    } else {
      console.log(green("  ✓ XML contains no CJK text"));
    }
    const xmlDesktopIssues = xmlDesktopCommandIssues(xml);
    if (xmlDesktopIssues.length) {
      fail += xmlDesktopIssues.length;
      console.log(red("  ✗ XML contains Classic 6-unstable geometry command inputs:"));
      for (const issue of xmlDesktopIssues) console.log(red("    - ") + issue);
    } else {
      console.log(green("  ✓ XML geometry command inputs are named objects"));
    }
    if ((scene.animate || []).length) {
      if (/<animation\b/.test(xml)) console.log(green("  ✓ Exported .ggb XML contains <animation>"));
      else { fail++; console.log(red("  ✗ XML does not contain <animation>. Check the Slider(..., animating=true, ...) parameter.")); }
    }
    const wantsTrace = (scene.objects || []).some((o) => /SetTrace\s*\([^)]*,\s*true/i.test(cmdOf(o)));
    if (wantsTrace) (/<trace\b/.test(xml) ? console.log(green("  ✓ XML contains <trace>")) : console.log(yellow("  ⚠ XML does not contain <trace>; traces are redrawn during playback.")));

    // Round-trip stability: load the exported base64 back into GeoGebra.
    const b64 = await page.evaluate(() => window.__getGGBBase64());
    console.log(green("  ✓ getBase64 produced .ggb data (") + b64.length + " base64 bytes)");
    const reload = await page.evaluate((payload) => window.__reloadGGBBase64(payload), b64);
    if (reload && reload.ok) console.log(green("  ✓ Exported .ggb can be loaded back into GeoGebra"));
    else {
      fail++;
      console.log(red("  ✗ Exported .ggb failed to load back into GeoGebra") + (reload && reload.error ? `: ${reload.error}` : ""));
    }
    const labels = Array.from(definedNames(scene.objects || []));
    const fresh = await page.evaluate((payload) => window.__freshLoadGGBBase64(payload.b64, payload.labels, payload.appName), { b64, labels, appName: info.appName });
    if (fresh && fresh.ok) {
      console.log(green("  ✓ Exported .ggb opens in a fresh GeoGebra applet with all named objects present"));
    } else {
      fail++;
      const missing = fresh && fresh.missing && fresh.missing.length ? ` missing: ${fresh.missing.join(", ")}` : "";
      const dialog = fresh && fresh.dialogText ? ` ${fresh.dialogText}` : "";
      console.log(red("  ✗ Exported .ggb failed fresh-open verification.") + missing + dialog);
    }
    console.log(fail ? red(`check failed: ${fail} item(s)`) : green("check passed ✓"));
    process.exitCode = fail ? 1 : 0;
  }, { style: args.style });
}

// ----------------------------------------------------------------- Command: export
async function doExport(args) {
  const { scene: rawScene, dir } = resolveScene(args._[0]);
  const info = exportTargetInfo(args.format);
  const scene = prepareClassic6Scene(styleScene(rawScene, args.style));
  const out = args.o ? path.resolve(args.o) : path.join(dir, safeName(scene) + ".ggb");
  console.log(bold(`headless export -> ${out}`) + dim(` (${info.label}; target: ${info.target})`));
  console.log(dim(`  Support note: ${info.note}.`));
  const sourceCommand = sourceCommandIssues(scene);
  if (sourceCommand.errors.length) {
    die(`Scene contains unstable algebraic command patterns; refusing to export:\n${sourceCommand.errors.map((issue) => `  - objects[${issue.index}]: ${issue.reason}`).join("\n")}`);
  }
  await withPage(scene, async (page) => {
    const build = await page.evaluate(() => window.__BUILD__);
    if (!build.ok) console.log(yellow("  ⚠ Build contains failed commands; exported .ggb may be incomplete. Run check first."));
    const sourceDesktopIssues = desktopCompatibilityIssues(scene);
    if (sourceDesktopIssues.length) {
      die(`Scene contains Classic 6-unstable geometry command inputs; refusing to export:\n${sourceDesktopIssues.map((issue) => `  - objects[${issue.index}]: ${issue.reason}`).join("\n")}`);
    }
    const xml = await page.evaluate(() => window.api.getXML());
    const localized = localizedCommandNames(xml);
    if (localized.length) die(`XML contains localized command names; refusing to export a .ggb that may fail to open: ${localized.join(", ")}`);
    const cjk = cjkSnippets(xml);
    if (cjk.length) die(`XML contains CJK text; refusing to export a .ggb that may fail to open:\n${cjk.map((s) => `  - ${s}`).join("\n")}`);
    const xmlDesktopIssues = xmlDesktopCommandIssues(xml);
    if (xmlDesktopIssues.length) die(`XML contains Classic 6-unstable geometry command inputs; refusing to export:\n${xmlDesktopIssues.map((s) => `  - ${s}`).join("\n")}`);
    const b64 = await page.evaluate(() => window.__getGGBBase64());
    const labels = Array.from(definedNames(scene.objects || []));
    const fresh = await page.evaluate((payload) => window.__freshLoadGGBBase64(payload.b64, payload.labels, payload.appName), { b64, labels, appName: info.appName });
    if (!fresh || !fresh.ok) {
      const missing = fresh && fresh.missing && fresh.missing.length ? `\nMissing objects: ${fresh.missing.join(", ")}` : "";
      const dialog = fresh && fresh.dialogText ? `\nDialog: ${fresh.dialogText}` : "";
      die(`Exported .ggb failed fresh-open verification; refusing to write it.${missing}${dialog}`);
    }
    fs.writeFileSync(out, Buffer.from(b64, "base64"));
    console.log(green("  ✓ ") + `Wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
    console.log(dim(`  Format: ${info.label}`));
    console.log(dim(`  Use with: ${info.target}. Desktop builds may require pressing Play.`));
  }, { style: args.style });
}

// ----------------------------------------------------------------- Argument parsing and dispatch
function parseArgs(argv) {
  const a = { _: [], noOpen: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--no-open") a.noOpen = true;
    else if (t === "--force") a.force = true;
    else if (t === "-o" || t === "--out" || t === "--output") a.o = argv[++i];
    else if (t === "--dir") a.dir = argv[++i];
    else if (t === "--style") a.style = argv[++i];
    else if (t === "--format") a.format = argv[++i];
    else a._.push(t);
  }
  return a;
}

function help() {
  console.log(`${bold("ggb-anim")} - GeoGebra animation tool

Usage: node bin/ggb-anim.mjs <command> <scene> [options]

Commands:
  preview  <scene>          Inline into preview.html and open it in a browser
  examples [dir]            Build local examples, preview.html files, and a 2x2 gallery
  new      <name> [--dir D] Scaffold a scene.json
  script   <scene> [-o f]   Export a GeoGebra command script
  validate <scene>          Validate schema, references, and syntax lint
  check    <scene>          Run a headless Classic 6 smoke test (requires Playwright)
  export   <scene> [-o f]   Export a .ggb file for GeoGebra Classic 6 (requires Playwright)

<scene> may be a scene.json file or the directory that contains it.
examples defaults to the repository examples/ directory.
Options: --no-open, --force, -o/--out/--output, --dir, --style light|dark (default: light), --format classic

Support target:
  GeoGebra Classic 6 only. --format is kept as a compatibility alias and only accepts classic/classic6.`);
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._.shift();
const table = {
  preview: doPreview, examples: doExamples, new: doNew, script: doScript, validate: doValidate,
  check: doCheck, export: doExport,
  help: help, "--help": help, "-h": help, undefined: help
};
const handler = table[cmd];
if (!handler) die(`Unknown command: ${cmd} (run node bin/ggb-anim.mjs help)`);
Promise.resolve(handler(args)).catch((e) => die(e && e.stack ? e.stack : String(e)));
