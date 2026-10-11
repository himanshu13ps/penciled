// Builds docs/og.png, the link preview image (1280 x 640) shown when the
// site or repo is shared on Hacker News, Reddit, X, LinkedIn, Slack, etc.
// The same file works as the GitHub repo's social preview.
//
// It's a small HTML page (wordmark, tagline, install command, and a real
// penciled drawing on a taped sheet) screenshotted with penciled's own
// PNG code, so it needs Chrome, Edge, Chromium or Brave (or
// PENCILED_BROWSER). Run after changing the look of the drawings:
//   node scripts/build-og.mjs

import { readFileSync } from "node:fs";
import { render } from "../skills/penciled/src/render.js";
import { htmlToPng } from "../skills/penciled/src/raster.js";

const root = new URL("../", import.meta.url);
const W = 1280, H = 640;

const diagram = {
  version: "0.1",
  type: "architecture",
  direction: "TB",
  nodes: [
    { id: "user", label: "User", shape: "person" },
    { id: "api", label: "API", sublabel: "Node.js", shape: "rounded" },
    { id: "db", label: "Orders", sublabel: "Postgres", shape: "database", shade: "light" },
    { id: "jobs", label: "Jobs", sublabel: "Kafka", shape: "queue" },
    { id: "pay", label: "Stripe", shape: "cloud" },
  ],
  edges: [
    { from: "user", to: "api", label: "HTTPS" },
    { from: "api", to: "db", label: "writes" },
    { from: "api", to: "jobs", style: "dashed" },
    { from: "api", to: "pay", label: "charge" },
  ],
  paper: { eraserMarks: false, pencil: "4B", seed: 4 },
};

const svg = render(diagram).replace(/<svg ([^>]*?)width="\d+" height="\d+"/, '<svg $1width="100%"');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Caveat; src: url(caveat.woff2) format("woff2"); }
* { box-sizing: border-box; }
html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; }
body { background: #f3f1ea; font-family: Caveat, cursive; color: #26262b; position: relative; }
.left { position: absolute; left: 84px; top: 0; bottom: 0; width: 560px; display: flex; flex-direction: column; justify-content: center; }
.logo { display: flex; align-items: center; gap: 18px; font-size: 132px; font-weight: 700; line-height: .9; letter-spacing: -1px; }
.logo svg { width: 76px; height: 76px; flex: none; }
.tag { font-size: 58px; font-weight: 700; line-height: 1.05; margin: 22px 0 26px; }
.tag .mark { background: linear-gradient(transparent 60%, #ffe08a 60%, #ffe08a 92%, transparent 92%); }
.ways { font-size: 34px; color: #55545c; margin-bottom: 30px; }
.cmd { display: inline-block; align-self: flex-start; background: #26262b; color: #f3f1ea; border-radius: 14px; padding: 14px 20px; font: 21px "DejaVu Sans Mono", monospace; white-space: nowrap; }
.cmd span { color: #9b9aa2; }
.sheet { position: absolute; right: 70px; top: 56px; width: 500px; height: 528px; background: #fbfaf7; border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,.06), 0 24px 50px -14px rgba(38,38,43,.35); transform: rotate(1.6deg); overflow: hidden; display: grid; place-items: center; }
.sheet svg { width: 100%; height: auto; display: block; }
.tape { position: absolute; width: 130px; height: 34px; background: rgba(242,227,179,.8); top: 40px; z-index: 2; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
</style></head><body>
<div class="left">
  <div class="logo"><svg viewBox="0 0 64 64"><path d="M14 50 L44 12 L52 18 L22 56 L12 58 Z" fill="#f2c14e" stroke="#26262b" stroke-width="3.5" stroke-linejoin="round"/><path d="M12 58 L14 50 L22 56 Z" fill="#26262b"/><path d="M40 17 L48 23" stroke="#26262b" stroke-width="3"/></svg>penciled</div>
  <div class="tag">Technical diagrams,<br><span class="mark">sketched in pencil.</span></div>
  <div class="ways">Ask your AI agent · command line · browser</div>
  <div class="cmd"><span>$</span> npx skills add himanshu13ps/penciled</div>
</div>
<div class="tape" style="right: 400px; transform: rotate(-5deg)"></div>
<div class="tape" style="right: 92px; transform: rotate(6deg)"></div>
<div class="sheet">${svg}</div>
</body></html>`;

const out = new URL("docs/og.png", root);
const r = htmlToPng(html, out, {
  width: W, height: H, scale: 1,
  assets: { "caveat.woff2": readFileSync(new URL("skills/penciled/fonts/caveat.woff2", root)) },
});
console.log(`docs/og.png ${r.width}x${r.height}`);
