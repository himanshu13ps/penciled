// Self-contained HTML viewer: one file with the diagram, the renderer and a
// small UI. Works offline from disk; nothing is loaded from the network.
//
// Because the renderer itself is inside, the viewer can redraw live: a new
// seed, another paper, pencil or texture, the other flow direction. The
// validator runs on every redraw and its warnings are one click away.

import { bundle } from "./bundle.js";
import { escapeXml } from "./text.js";

const safeScript = (s) => s.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

export function viewerHtml(diagram, { seed } = {}) {
  const title = diagram.title || "penciled diagram";
  const data = { diagram, seed: seed ?? diagram.paper?.seed ?? Math.floor(Math.random() * 2 ** 32) };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="penciled">
<title>${escapeXml(title)}</title>
<style>
:root {
  --desk: #e9e8e4; --bar: #f8f7f4; --ink: #2a2a2e; --muted: #6b6a66; --line: #d6d4ce;
  --btn: #ffffff; --btn-on: #2f2f35; --btn-on-ink: #fbfaf7; --warn: #9a5b00; --warn-bg: #fff3dc;
  --shadow: 0 1px 2px rgba(0,0,0,.08), 0 8px 28px rgba(0,0,0,.12);
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root { --desk: #1c1c1f; --bar: #26262a; --ink: #ecebe7; --muted: #a09f9a; --line: #3a3a40;
    --btn: #303036; --btn-on: #ecebe7; --btn-on-ink: #1c1c1f; --warn: #ffc56b; --warn-bg: #3a2c12;
    --shadow: 0 1px 2px rgba(0,0,0,.4), 0 10px 30px rgba(0,0,0,.5); }
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body { display: flex; flex-direction: column; background: var(--desk); color: var(--ink);
  font: 13px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
header { display: flex; flex-direction: column; gap: 8px; padding: 10px 16px;
  background: var(--bar); border-bottom: 1px solid var(--line); }
header .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
h1 { margin: 0; font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; max-width: 50ch; }
.group { display: flex; align-items: center; gap: 6px; }
.group > span { color: var(--muted); }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.seg button { border: 0; border-right: 1px solid var(--line); border-radius: 0; }
.seg button:last-child { border-right: 0; }
button { font: inherit; color: var(--ink); background: var(--btn); border: 1px solid var(--line);
  border-radius: 8px; padding: 5px 10px; cursor: pointer; min-height: 28px; }
button:hover { filter: brightness(.96); }
button:focus-visible { outline: 2px solid #4a7bd0; outline-offset: 1px; }
button[aria-pressed="true"] { background: var(--btn-on); color: var(--btn-on-ink); }
button:disabled { opacity: .45; cursor: not-allowed; }
label.check { display: inline-flex; align-items: center; gap: 5px; color: var(--muted); cursor: pointer; }
.spacer { flex: 1; }
.zoom { font-variant-numeric: tabular-nums; min-width: 5ch; text-align: center; color: var(--muted); }
#warn { background: var(--warn-bg); color: var(--warn); border-color: transparent; font-weight: 600; }
#warn[hidden] { display: none; }
main { position: relative; flex: 1; overflow: hidden; cursor: grab; touch-action: none; }
main.dragging { cursor: grabbing; }
#sheet { position: absolute; left: 0; top: 0; box-shadow: var(--shadow); line-height: 0; }
#sheet svg { display: block; }
.zoombar { position: absolute; right: 16px; bottom: 16px; display: flex; align-items: center; gap: 4px; padding: 4px;
  background: var(--bar); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow); cursor: auto; }
.zoombar button { border-color: transparent; background: transparent; min-width: 30px; }
#panel { position: absolute; right: 16px; top: 12px; width: min(460px, calc(100% - 32px)); max-height: calc(100% - 24px);
  overflow: auto; background: var(--bar); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow);
  padding: 12px 14px; cursor: auto; }
#panel[hidden] { display: none; }
#panel h2 { margin: 0 0 8px; font-size: 13px; }
#panel ul { margin: 0; padding-left: 18px; }
#panel li { margin: 6px 0; }
#panel code { color: var(--muted); }
footer { padding: 6px 16px; color: var(--muted); font-size: 12px; border-top: 1px solid var(--line); background: var(--bar); }
kbd { font: 11px ui-monospace, monospace; border: 1px solid var(--line); border-radius: 4px; padding: 0 4px; }
noscript { padding: 24px; }
@media (max-width: 720px) { footer { display: none; } }
</style>
</head>
<body>
<header>
  <div class="row">
    <h1>${escapeXml(title)}</h1>
    <div class="spacer"></div>
    <button id="warn" hidden aria-expanded="false" aria-controls="panel"></button>
    <div class="group" role="group" aria-label="Save"><button id="svg" title="Save as SVG (vector)">SVG</button><button id="png" title="Save as PNG (lossless, large)">PNG</button><button id="jpg" title="Save as JPG (small, for sharing)">JPG</button><button id="json" title="Save the input with the current paper, pencil, flow and seed">JSON</button></div>
  </div>
  <div class="row controls">
    <div class="group"><span>Paper</span><div class="seg" data-opt="style">
    <button data-v="clean">Clean</button><button data-v="aged">Aged</button><button data-v="bright">Bright</button></div></div>
    <div class="group"><span>Ruling</span><div class="seg" data-opt="texture">
    <button data-v="plain">Plain</button><button data-v="lined">Lined</button><button data-v="grid">Grid</button></div></div>
    <div class="group"><span>Pencil</span><div class="seg" data-opt="pencil">
    <button data-v="HB">HB</button><button data-v="2B">2B</button><button data-v="4B">4B</button></div></div>
    <div class="group"><span>Flow</span><div class="seg" data-opt="direction">
    <button data-v="LR" title="Left to right">→</button><button data-v="TB" title="Top to bottom">↓</button></div></div>
    <label class="check"><input type="checkbox" id="eraser"> Eraser marks</label>
    <button id="redraw" title="Draw it again with a new seed (R)">↻ Redraw</button>
  </div>
</header>
<main id="stage"><div id="sheet"></div>
<div class="zoombar"><button id="out" title="Zoom out (−)" aria-label="Zoom out">−</button><span class="zoom" id="zoom">100%</span>
  <button id="in" title="Zoom in (+)" aria-label="Zoom in">+</button><button id="fit" title="Fit to window (F)">Fit</button></div><div id="panel" hidden role="region" aria-label="Warnings"></div>
<noscript>This viewer needs JavaScript to draw the diagram.</noscript></main>
<footer>Drag to pan · scroll to zoom · <kbd>R</kbd> redraw · <kbd>F</kbd> fit · <kbd>0</kbd> actual size</footer>
<script>${safeScript(bundle())}</script>
<script>
const DATA = ${safeScript(JSON.stringify(data))};
(() => {
  const d0 = DATA.diagram;
  const manual = d0.nodes.every((n) => n.position);
  const state = {
    style: d0.paper?.style ?? "clean", texture: d0.paper?.texture ?? "plain", pencil: d0.paper?.pencil ?? "2B",
    direction: d0.direction ?? "LR", eraserMarks: d0.paper?.eraserMarks ?? true, seed: DATA.seed >>> 0,
  };
  const $ = (id) => document.getElementById(id);
  const stage = $("stage"), sheet = $("sheet"), panel = $("panel");
  let svgText = "", size = { w: 1, h: 1 }, view = { x: 0, y: 0, s: 1 };

  const current = () => {
    const d = structuredClone(d0);
    d.paper = { ...d.paper, style: state.style, texture: state.texture, pencil: state.pencil, eraserMarks: state.eraserMarks, seed: state.seed };
    if (!manual) d.direction = state.direction;
    return d;
  };

  function draw(refit) {
    const d = current();
    svgText = penciled.render(d, { seed: state.seed });
    sheet.innerHTML = svgText;
    const svg = sheet.firstElementChild;
    size = { w: +svg.getAttribute("width"), h: +svg.getAttribute("height") };
    $("redraw").title = "Draw it again with a new seed (R). Current seed: " + state.seed;
    for (const seg of document.querySelectorAll(".seg")) {
      for (const b of seg.children) b.setAttribute("aria-pressed", String(state[seg.dataset.opt] === b.dataset.v));
    }
    for (const b of document.querySelectorAll('[data-opt="direction"] button')) {
      b.disabled = manual;
      if (manual) b.title = "Nodes have manual positions";
    }
    $("eraser").checked = state.eraserMarks;
    report(penciled.validate(d, { seed: state.seed }));
    refit ? fit() : apply();
  }

  function report({ errors, warnings }) {
    const items = [...errors.map((e) => ["error", e]), ...warnings.map((w) => ["warning", w])];
    const w = $("warn");
    w.hidden = !items.length;
    w.textContent = "⚠ " + items.length + (items.length === 1 ? " warning" : " warnings");
    const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    panel.innerHTML = "<h2>What may not draw well</h2><ul>" +
      items.map(([k, p]) => "<li><code>" + esc(p.path) + "</code> " + esc(p.message) + "</li>").join("") + "</ul>";
    if (!items.length) { panel.hidden = true; w.setAttribute("aria-expanded", "false"); }
  }

  function apply() {
    const svg = sheet.firstElementChild;
    // Resize the SVG itself rather than scaling a picture of it, so pencil
    // grain stays sharp at any zoom.
    svg.setAttribute("width", Math.round(size.w * view.s));
    svg.setAttribute("height", Math.round(size.h * view.s));
    sheet.style.transform = "translate(" + Math.round(view.x) + "px," + Math.round(view.y) + "px)";
    $("zoom").textContent = Math.round(view.s * 100) + "%";
  }

  function fit() {
    const r = stage.getBoundingClientRect(), pad = 32;
    view.s = Math.min((r.width - 2 * pad) / size.w, (r.height - 2 * pad) / size.h, 1.5);
    view.x = (r.width - size.w * view.s) / 2;
    view.y = (r.height - size.h * view.s) / 2;
    apply();
  }

  function zoomAt(factor, cx, cy) {
    const s = Math.min(8, Math.max(0.1, view.s * factor));
    view.x = cx - (cx - view.x) * (s / view.s);
    view.y = cy - (cy - view.y) * (s / view.s);
    view.s = s;
    apply();
  }
  const zoomCenter = (f) => { const r = stage.getBoundingClientRect(); zoomAt(f, r.width / 2, r.height / 2); };

  let pending = null;
  stage.addEventListener("wheel", (e) => {
    if (e.target.closest("#panel")) return;
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    const f = Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0015));
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (pending) { pending.f *= f; return; }
    pending = { f, x, y };
    requestAnimationFrame(() => { zoomAt(pending.f, pending.x, pending.y); pending = null; });
  }, { passive: false });

  let drag = null;
  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#panel, .zoombar") || e.button !== 0) return;
    drag = { x: e.clientX - view.x, y: e.clientY - view.y };
    stage.setPointerCapture(e.pointerId);
    stage.classList.add("dragging");
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    view.x = e.clientX - drag.x; view.y = e.clientY - drag.y;
    apply();
  });
  const endDrag = () => { drag = null; stage.classList.remove("dragging"); };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  for (const seg of document.querySelectorAll(".seg")) {
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      state[seg.dataset.opt] = b.dataset.v;
      draw(seg.dataset.opt === "direction");
    });
  }
  $("eraser").addEventListener("change", (e) => { state.eraserMarks = e.target.checked; draw(false); });
  const redraw = () => { state.seed = (Math.random() * 2 ** 32) >>> 0; draw(false); };
  $("redraw").addEventListener("click", redraw);
  $("in").addEventListener("click", () => zoomCenter(1.25));
  $("out").addEventListener("click", () => zoomCenter(0.8));
  $("fit").addEventListener("click", fit);
  $("warn").addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    $("warn").setAttribute("aria-expanded", String(!panel.hidden));
  });

  const slug = (d0.title || "diagram").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "diagram";
  function save(blob, ext) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = slug + "." + ext;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  $("svg").addEventListener("click", () => save(new Blob([svgText], { type: "image/svg+xml" }), "svg"));
  $("json").addEventListener("click", () => save(new Blob([JSON.stringify(current(), null, 2) + "\\n"], { type: "application/json" }), "json"));
  // Raster copies at twice the drawing's size, sharp enough for slides.
  function raster(type, ext, quality) {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
    img.onload = () => {
      const scale = 2, c = document.createElement("canvas");
      c.width = size.w * scale; c.height = size.h * scale;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => save(b, ext), type, quality);
    };
    img.src = url;
  }
  $("png").addEventListener("click", () => raster("image/png", "png"));
  $("jpg").addEventListener("click", () => raster("image/jpeg", "jpg", 0.9));

  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.matches("input, textarea")) return;
    const k = e.key.toLowerCase();
    if (k === "r") redraw();
    else if (k === "f") fit();
    else if (k === "0") zoomCenter(1 / view.s);
    else if (k === "+" || k === "=") zoomCenter(1.25);
    else if (k === "-" || k === "_") zoomCenter(0.8);
    else if (k === "escape") { panel.hidden = true; $("warn").setAttribute("aria-expanded", "false"); }
  });
  let resizeTimer;
  addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(fit, 120); });

  // Fonts inside the SVG load asynchronously; fit once they are ready.
  draw(true);
  document.fonts?.ready.then(() => fit());
})();
</script>
</body>
</html>
`;
}
