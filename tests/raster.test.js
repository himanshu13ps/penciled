import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { crc32, deflateSync, inflateSync } from "node:zlib";
import { cropPngHeight, findBrowser } from "../skills/penciled/src/raster.js";

const cli = new URL("../skills/penciled/src/cli.js", import.meta.url).pathname;
const example = (n) => new URL(`../examples/${n}.json`, import.meta.url).pathname;

// A tiny RGB PNG whose rows use different filters, built by hand.
function makePng(width, rows) {
  const chunk = (type, data) => {
    const b = Buffer.alloc(12 + data.length);
    b.writeUInt32BE(data.length, 0); b.write(type, 4, "ascii"); data.copy(b, 8);
    b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(rows.length, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.concat(rows.map((r, i) => Buffer.from([i % 3, ...r])));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

test("cropPngHeight keeps the top rows exactly and fixes the header", { skip: !crc32 && "needs zlib.crc32 (Node 22)" }, () => {
  const rows = Array.from({ length: 5 }, (_, y) => Array.from({ length: 6 }, (_, x) => (x * 40 + y * 13) % 256));
  const cropped = cropPngHeight(makePng(2, rows), 3);
  assert.equal(cropped.readUInt32BE(20), 3);
  const idat = cropped.indexOf("IDAT");
  const data = inflateSync(cropped.subarray(idat + 4, idat + 4 + cropped.readUInt32BE(idat - 4)));
  assert.deepEqual([...data], rows.slice(0, 3).flatMap((r, i) => [i % 3, ...r]));
  // Every chunk's CRC must be valid.
  for (let at = 8; at < cropped.length; ) {
    const len = cropped.readUInt32BE(at);
    assert.equal(cropped.readUInt32BE(at + 8 + len), crc32(cropped.subarray(at + 4, at + 8 + len)));
    at += 12 + len;
  }
});

test("findBrowser honours PENCILED_BROWSER", () => {
  assert.equal(findBrowser({ PENCILED_BROWSER: "/no/such/browser" }), null);
  assert.equal(findBrowser({ PENCILED_BROWSER: process.execPath }), process.execPath);
});

test("cli: PNG without a browser fails with advice", () => {
  const out = join(mkdtempSync(join(tmpdir(), "penciled-")), "d.png");
  const r = spawnSync(process.execPath, [cli, example("minimal"), "-o", out], { encoding: "utf8", env: { ...process.env, PENCILED_BROWSER: "/no/such/browser" } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /needs Chrome, Edge, Chromium or Brave/);
  assert.match(r.stderr, /-o out\.html/);
});

test("cli: rejects a scale outside 1 to 4", () => {
  const r = spawnSync(process.execPath, [cli, example("minimal"), "-o", "x.png", "--scale", "9"], { encoding: "utf8" });
  assert.equal(r.status, 2);
});

test("cli: writes a PNG at twice the drawing's size", { skip: !findBrowser() && "no Chrome, Edge, Chromium or Brave found" }, async () => {
  const { plan } = await import("../skills/penciled/src/render.js");
  const d = JSON.parse(readFileSync(example("ci-pipeline"), "utf8"));
  const page = plan(d, { seed: d.paper.seed }).page;
  const out = join(mkdtempSync(join(tmpdir(), "penciled-")), "d.png");
  const r = spawnSync(process.execPath, [cli, example("ci-pipeline"), "-o", out], { encoding: "utf8", timeout: 90000 });
  assert.equal(r.status, 0, r.stderr);
  const png = readFileSync(out);
  assert.equal(png.toString("ascii", 1, 4), "PNG");
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [page.width * 2, page.height * 2]);
});
