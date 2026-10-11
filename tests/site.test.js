import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { siteFiles, GALLERY } from "../scripts/build-site.mjs";

const docs = (name) => new URL(`../docs/${name}`, import.meta.url);

test("docs/ support files are up to date (run: node scripts/build-site.mjs)", () => {
  for (const [name, text] of Object.entries(siteFiles())) {
    assert.equal(readFileSync(docs(name), "utf8"), text, `docs/${name} is stale`);
  }
  assert.deepEqual(readFileSync(docs("caveat.woff2")), readFileSync(new URL("../skills/penciled/fonts/caveat.woff2", import.meta.url)));
});

test("site page loads only its own scripts", () => {
  const html = readFileSync(docs("index.html"), "utf8");
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(scripts, ["penciled.js", "examples.js"]);
  assert.doesNotMatch(html, /<link[^>]+stylesheet[^>]+https?:/);
});

test("gallery lists only examples that validate cleanly", async () => {
  const { validate } = await import("../skills/penciled/src/validate.js");
  for (const [name] of GALLERY) {
    if (name === "shapes") continue; // a single row of seven shapes is meant to be wide
    const d = JSON.parse(readFileSync(new URL(`../examples/${name}.json`, import.meta.url), "utf8"));
    assert.deepEqual(validate(d).warnings, [], name);
  }
});

test("link preview image exists, is 1280x640 and is referenced by the page", () => {
  const png = readFileSync(docs("og.png"));
  assert.equal(png.toString("ascii", 1, 4), "PNG");
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1280, 640]);
  const html = readFileSync(docs("index.html"), "utf8");
  for (const tag of ['property="og:image" content="https://himanshu13ps.github.io/penciled/og.png"', 'name="twitter:card" content="summary_large_image"', 'property="og:image:width" content="1280"']) {
    assert.ok(html.includes(tag), tag);
  }
});
