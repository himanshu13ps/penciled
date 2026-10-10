import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { bundle } from "../skills/penciled/src/bundle.js";
import { viewerHtml } from "../skills/penciled/src/viewer.js";
import { render } from "../skills/penciled/src/render.js";

const load = (name) => JSON.parse(readFileSync(new URL(`../examples/${name}`, import.meta.url), "utf8"));

test("bundle runs without Node and draws exactly what Node draws", () => {
  const ctx = vm.createContext({});
  vm.runInContext(bundle(), ctx);
  for (const name of ["web-app.json", "shapes.json", "event-pipeline.json"]) {
    const d = load(name);
    assert.equal(ctx.penciled.render(d, { seed: 7 }), render(d, { seed: 7 }), name);
  }
  assert.equal(ctx.penciled.validate(load("web-app.json"), { seed: 7 }).valid, true);
});

test("viewer is one self-contained file", () => {
  const html = viewerHtml(load("web-app.json"), { seed: 3 });
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<title>Photo sharing app<\/title>/);
  // Nothing loaded from the network: the only URLs are XML namespaces.
  const urls = html.match(/(src|href)\s*=\s*["']?(https?:)?\/\//gi) ?? [];
  assert.deepEqual(urls, []);
  // Inline scripts can't be cut short by text inside them.
  assert.equal((html.match(/<script>/g) ?? []).length, 2);
  assert.equal((html.match(/<\/script>/gi) ?? []).length, 2);
});

test("viewer escapes the title and data", () => {
  const d = { version: "0.1", type: "architecture", title: "A </script><b>", nodes: [{ id: "a", label: "</script>x" }] };
  const html = viewerHtml(d, { seed: 1 });
  assert.match(html, /<title>A &lt;\/script&gt;&lt;b&gt;<\/title>/);
  assert.equal((html.match(/<\/script>/gi) ?? []).length, 2);
});

test("cli writes the viewer for .html output", () => {
  const out = join(mkdtempSync(join(tmpdir(), "penciled-")), "d.html");
  const r = spawnSync(process.execPath, [new URL("../skills/penciled/src/cli.js", import.meta.url).pathname, new URL("../examples/minimal.json", import.meta.url).pathname, "-o", out]);
  assert.equal(r.status, 0, r.stderr?.toString());
  assert.match(readFileSync(out, "utf8"), /^<!doctype html>/);
});
