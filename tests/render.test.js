import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { render } from "../src/render.js";

const load = (name) => JSON.parse(readFileSync(new URL(`../examples/${name}`, import.meta.url), "utf8"));

test("same input and seed give the same drawing", () => {
  const d = load("pencil-test.json");
  assert.equal(render(d), render(d));
});

test("a different seed gives a different drawing", () => {
  const d = load("pencil-test.json");
  assert.notEqual(render(d, { seed: 1 }), render(d, { seed: 2 }));
});

for (const name of ["minimal.json", "pencil-test.json", "web-app.json"]) {
  test(`${name} renders a well-formed SVG`, () => {
    const svg = render(load(name), { seed: 5 });
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+" height="\d+"/);
    assert.ok(svg.trimEnd().endsWith("</svg>"));
    assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
    assert.match(svg, /@font-face\{font-family:penciled-hand/);
  });
}

test("labels are escaped", () => {
  const svg = render({ version: "0.1", type: "architecture", nodes: [{ id: "a", label: "A & <B>" }] }, { seed: 1 });
  assert.match(svg, />A &amp; &lt;B&gt;</);
});

test("eraser marks can be turned off", () => {
  const d = { version: "0.1", type: "architecture", nodes: [{ id: "a", label: "A" }] };
  assert.match(render(d, { seed: 1 }), /url\(#pc-erased\)"/);
  assert.doesNotMatch(render({ ...d, paper: { eraserMarks: false } }, { seed: 1 }), /filter="url\(#pc-erased\)"/);
});
