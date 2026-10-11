// Records docs/demo.gif and docs/demo.mp4: a short tour of the playground on
// the product page (type a node, catch a typo, switch paper, pencil and flow,
// redraw). Dev only: needs Playwright and ffmpeg.
//
//   PLAYWRIGHT=/path/to/playwright/index.mjs node scripts/record-demo.mjs
//
// PLAYWRIGHT defaults to the "playwright" package if it is installed.

import { mkdtempSync, rmSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright");
const root = new URL("../", import.meta.url);
const page_url = new URL("docs/index.html", root).href;
const work = mkdtempSync(join(tmpdir(), "penciled-demo-"));

const START = `{
  "version": "0.1",
  "type": "architecture",
  "title": "My app",
  "nodes": [
    { "id": "user", "label": "User", "shape": "person" },
    { "id": "api", "label": "API", "shape": "rounded" },
    { "id": "db", "label": "Orders", "shape": "database" }
  ],
  "edges": [
    { "from": "user", "to": "api", "label": "HTTPS" },
    { "from": "api", "to": "db", "label": "writes" }
  ]
}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
await page.goto(page_url);
// Show only the playground, with an editor large enough to read in a GIF.
await page.addStyleTag({ content: `
  body > *:not(#playground) { display: none !important; }
  #playground { padding: 18px 0 !important; border: 0 !important; }
  #playground .kicker, #playground h2, #playground .sub { display: none !important; }
  .play { grid-template-columns: 500px 1fr !important; }
  .play > .panel:first-child .panel-head { display: none !important; }
  textarea#src { font-size: 13.5px !important; height: 618px !important; overflow: hidden !important; }
  /* A fixed drawing area, so every frame is the same size. */
  .preview { height: 520px !important; min-height: 0 !important; }
  .preview .sheet { width: auto !important; }
` });
// Fit each new drawing inside the fixed area, keeping its proportions.
await page.evaluate(() => {
  const out = document.getElementById("out");
  const fit = () => {
    const s = out.querySelector("svg");
    if (!s) return;
    const [, , w, h] = s.getAttribute("viewBox").split(/\s+/).map(Number);
    const k = Math.min((out.parentElement.clientWidth - 40) / w, 480 / h);
    s.style.width = w * k + "px";
    s.style.height = h * k + "px";
  };
  new MutationObserver(fit).observe(out, { childList: true });
  fit();
});
const area = await page.$("#playground .play");
let clip;

const frames = [];
async function frame(seconds) {
  const file = join(work, `f${String(frames.length).padStart(4, "0")}.png`);
  clip ??= await area.boundingBox();
  await page.screenshot({ path: file, clip });
  frames.push({ file, seconds });
}
const settle = () => page.waitForTimeout(380); // the playground redraws 250 ms after typing stops
async function setSource(text) {
  await page.$eval("#src", (el, t) => { el.value = t; el.dispatchEvent(new Event("input")); }, text);
  await settle();
}
// Type at a position in the editor, a few characters per frame.
async function typeAt(after, text, { step = 4, seconds = 0.07 } = {}) {
  await page.$eval("#src", (el, a) => { const i = el.value.indexOf(a) + a.length; el.focus(); el.setSelectionRange(i, i); }, after);
  for (let i = 0; i < text.length; i += step) {
    await page.keyboard.type(text.slice(i, i + step));
    await frame(seconds);
  }
  await settle();
}
async function click(selector, hold) {
  await page.click(selector);
  await settle();
  await frame(hold);
}

// 1. A small diagram, left to right, clean paper, 2B.
await page.click('#playground [data-opt="direction"] [data-v="LR"]');
await page.click('#playground [data-opt="style"] [data-v="clean"]');
await page.click('#playground [data-opt="pencil"] [data-v="2B"]');
await setSource(START);
await frame(1.6);

// 2. Type a new node: it draws at once, and the validator notices it has no arrows.
await typeAt('"shape": "database" }', `,\n    { "id": "cache", "label": "Cache", "shape": "database" }`);
await frame(1.8);

// 3. An arrow to it, with a typo: caught, with a suggestion.
await typeAt('"label": "writes" }', `,\n    { "from": "api", "to": "cahce", "label": "reads" }`);
await frame(2.2);

// 4. Fix the typo.
await page.$eval("#src", (el) => { el.value = el.value.replace('"cahce"', '"cache"'); el.dispatchEvent(new Event("input")); });
await settle();
await frame(1.8);

// 5. Restyle: aged paper, soft pencil, top-to-bottom, a couple of fresh takes.
await click('#playground [data-opt="style"] [data-v="aged"]', 1.1);
await click('#playground [data-opt="pencil"] [data-v="4B"]', 1.1);
await click('#playground [data-opt="direction"] [data-v="TB"]', 1.3);
await click("#redraw", 0.9);
await click("#redraw", 2.4);
await browser.close();

// Stitch the frames: per-frame durations via the concat demuxer, one shared
// palette for the GIF, and a small MP4 for places that prefer video.
const list = frames.map((f) => `file '${f.file}'\nduration ${f.seconds}`).join("\n") + `\nfile '${frames.at(-1).file}'\n`;
writeFileSync(join(work, "list.txt"), list);
const gif = new URL("docs/demo.gif", root).pathname, mp4 = new URL("docs/demo.mp4", root).pathname;
const ff = (args) => {
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(work, "list.txt"), ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
};
ff(["-vf", `fps=10,scale=${process.env.GIF_WIDTH ?? 860}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${process.env.GIF_COLORS ?? 64}:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`, gif]);
ff(["-vf", "fps=24,scale=1100:-2:flags=lanczos", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-movflags", "+faststart", mp4]);
rmSync(work, { recursive: true, force: true });
const total = frames.reduce((s, f) => s + f.seconds, 0);
console.log(`${frames.length} frames, ${total.toFixed(1)} s; demo.gif ${Math.round(statSync(gif).size / 1024)} KB, demo.mp4 ${Math.round(statSync(mp4).size / 1024)} KB`);
void pathToFileURL;
