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

for (const name of ["minimal.json", "pencil-test.json", "web-app.json", "shapes.json", "event-pipeline.json"]) {
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

test("every shape renders", () => {
  const shapes = ["box", "rounded", "database", "queue", "person", "cloud", "document"];
  const svg = render({
    version: "0.1",
    type: "architecture",
    nodes: shapes.map((s) => ({ id: s, label: s, shape: s, shade: "dark" })),
    edges: shapes.slice(1).map((s, i) => ({ from: shapes[i], to: s })),
  }, { seed: 3 });
  assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
  for (const s of shapes) assert.match(svg, new RegExp(`>${s}</text>`));
});

test("groups get a label and do not overlap their siblings", async () => {
  const { layout } = await import("../src/layout.js");
  const d = load("web-app.json");
  for (const direction of ["LR", "TB"]) {
    const sizes = new Map(d.nodes.map((n) => [n.id, { width: 120, height: 70 }]));
    const { rects, groups } = layout({ ...d, direction }, sizes);
    const backend = groups.get("backend"), data = groups.get("data");
    const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    assert.ok(!overlap(backend, data), `${direction}: backend and data overlap`);
    const ids = [...rects.keys()];
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        assert.ok(!overlap(rects.get(ids[i]), rects.get(ids[j])), `${direction}: ${ids[i]} overlaps ${ids[j]}`);
  }
  assert.match(render(d, { seed: 1 }), />Backend</);
});

test("manual positions are kept relative to each other", async () => {
  const { layout } = await import("../src/layout.js");
  const d = load("event-pipeline.json");
  const sizes = new Map(d.nodes.map((n) => [n.id, { width: 100, height: 60 }]));
  const { rects } = layout(d, sizes);
  const cx = (id) => rects.get(id).x + 50;
  assert.equal(Math.round(cx("q") - cx("a")), 260);
});

test("lined and grid paper add ruling", () => {
  const base = { version: "0.1", type: "architecture", nodes: [{ id: "a", label: "A" }] };
  assert.match(render({ ...base, paper: { texture: "lined" } }, { seed: 1 }), /stroke="#d07070"/);
  assert.match(render({ ...base, paper: { texture: "grid" } }, { seed: 1 }), /stroke="#7d9cc4"/);
  assert.doesNotMatch(render(base, { seed: 1 }), /stroke="#7d9cc4"/);
});

test("paper styles change the paper colour", () => {
  const base = { version: "0.1", type: "architecture", nodes: [{ id: "a", label: "A" }] };
  assert.match(render(base, { seed: 1 }), /fill="#f7f4ec"/);
  assert.match(render({ ...base, paper: { style: "clean" } }, { seed: 1 }), /fill="#fbfaf7"/);
  assert.match(render({ ...base, paper: { style: "bright" } }, { seed: 1 }), /fill="#fefefe"/);
});
