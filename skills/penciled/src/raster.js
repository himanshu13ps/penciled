// PNG output, using a browser that is already installed.
//
// Turning the drawing into pixels faithfully (paper grain, pencil grain,
// embedded font) needs a real SVG renderer. Rather than add a dependency,
// penciled looks for Chrome, Edge, Chromium or Brave on the machine and asks
// it, headless, to take a screenshot of the drawing. Set PENCILED_BROWSER to
// the browser's path to choose one explicitly.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { pathToFileURL } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const NAMES = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "microsoft-edge-stable", "brave-browser", "chrome"];

const PLATFORM_PATHS = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ],
  win32: [
    ["PROGRAMFILES", "Google\\Chrome\\Application\\chrome.exe"],
    ["PROGRAMFILES(X86)", "Google\\Chrome\\Application\\chrome.exe"],
    ["LOCALAPPDATA", "Google\\Chrome\\Application\\chrome.exe"],
    ["PROGRAMFILES(X86)", "Microsoft\\Edge\\Application\\msedge.exe"],
    ["PROGRAMFILES", "Microsoft\\Edge\\Application\\msedge.exe"],
  ],
};

/** Path of a usable browser, or null. */
export function findBrowser(env = process.env) {
  if (env.PENCILED_BROWSER) return existsSync(env.PENCILED_BROWSER) ? env.PENCILED_BROWSER : null;
  const candidates = [];
  for (const p of PLATFORM_PATHS[process.platform] ?? []) {
    if (Array.isArray(p)) { if (env[p[0]]) candidates.push(join(env[p[0]], p[1])); }
    else candidates.push(p);
  }
  for (const dir of (env.PATH ?? "").split(delimiter).filter(Boolean)) {
    for (const name of NAMES) candidates.push(join(dir, process.platform === "win32" ? `${name}.exe` : name));
  }
  return candidates.find((c) => existsSync(c)) ?? null;
}

// --- PNG trimming -----------------------------------------------------------
// Headless Chrome counts some browser chrome in --window-size, so the page
// area comes out shorter than asked. We ask for a taller window and cut the
// PNG back to the drawing's height. Rows in a PNG only depend on the rows
// above them, so dropping rows from the bottom needs no pixel decoding.

// zlib.crc32 only exists from Node 22.2, so carry our own.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

export function cropPngHeight(png, height) {
  const SIG = png.subarray(0, 8);
  const chunks = [];
  for (let at = 8; at < png.length; ) {
    const len = png.readUInt32BE(at);
    chunks.push({ type: png.toString("ascii", at + 4, at + 8), data: png.subarray(at + 8, at + 8 + len) });
    at += 12 + len;
  }
  const ihdr = Buffer.from(chunks[0].data);
  const width = ihdr.readUInt32BE(0), oldHeight = ihdr.readUInt32BE(4);
  const [depth, colour, , , interlace] = ihdr.subarray(8, 13);
  if (height >= oldHeight) return png;
  if (interlace !== 0 || depth !== 8) throw new Error("unexpected PNG format from the browser");
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colour];
  const rowBytes = 1 + width * channels;
  const pixels = inflateSync(Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data)));
  ihdr.writeUInt32BE(height, 4);
  const keep = chunks.filter((c) => c.type !== "IHDR" && c.type !== "IDAT" && c.type !== "IEND");
  return Buffer.concat([
    SIG, chunk("IHDR", ihdr), ...keep.map((c) => chunk(c.type, c.data)),
    chunk("IDAT", deflateSync(pixels.subarray(0, rowBytes * height), { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

export const NO_BROWSER = "PNG output needs Chrome, Edge, Chromium or Brave installed (or PENCILED_BROWSER set to one). " +
  "Without one, write an SVG (-o out.svg), or the viewer (-o out.html) and use its PNG button.";

/**
 * Write `svg` as a PNG at `scale` times its size. Throws with a readable
 * message if no browser is found or the screenshot fails.
 */
export function svgToPng(svg, outPath, options = {}) {
  const m = svg.match(/<svg[^>]*\swidth="(\d+)"[^>]*\sheight="(\d+)"/);
  if (!m) throw new Error("not a penciled SVG: no width and height");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff;overflow:hidden}svg{display:block}</style></head><body>${svg}</body></html>`;
  return htmlToPng(html, outPath, { ...options, width: +m[1], height: +m[2] });
}

/**
 * Screenshot a self-contained HTML page of `width` x `height` CSS pixels as
 * a PNG at `scale` times that size. `assets` maps file names to contents
 * written next to the page, so it can load them with relative URLs.
 */
export function htmlToPng(html, outPath, { width, height, scale = 2, assets = {}, browser = findBrowser(), timeout = 60000 } = {}) {
  if (!browser) throw new Error(NO_BROWSER);
  const work = mkdtempSync(join(tmpdir(), "penciled-"));
  try {
    const page = join(work, "page.html");
    const shot = join(work, "shot.png");
    writeFileSync(page, html);
    for (const [name, data] of Object.entries(assets)) writeFileSync(join(work, name), data);
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      `--user-data-dir=${join(work, "profile")}`,
      `--force-device-scale-factor=${scale}`,
      // Extra height: see cropPngHeight.
      `--window-size=${width},${height + 300}`,
      // Give embedded fonts time to load before the screenshot.
      "--virtual-time-budget=3000",
      `--screenshot=${shot}`,
      pathToFileURL(page).href,
    ];
    // Chrome refuses to run as root without this (common in containers).
    if (process.getuid?.() === 0) args.unshift("--no-sandbox");
    const r = spawnSync(browser, args, { timeout, encoding: "utf8" });
    if (!existsSync(shot)) {
      const why = r.error ? r.error.message : (r.stderr || "").trim().split("\n").slice(-3).join(" ");
      throw new Error(`the browser at ${browser} didn't produce a PNG${why ? `: ${why}` : ""}`);
    }
    writeFileSync(outPath, cropPngHeight(readFileSync(shot), height * scale));
    return { width: width * scale, height: height * scale, browser };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
