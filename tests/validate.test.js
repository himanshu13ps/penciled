import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { validate } from "../skills/penciled/src/validate.js";

const dir = (p) => new URL(p, import.meta.url);
const files = (p) => readdirSync(dir(p)).filter((f) => f.endsWith(".json"));
const load = (p) => JSON.parse(readFileSync(dir(p), "utf8"));
const codes = (list) => list.map((x) => x.code);

for (const f of files("../examples/")) {
  test(`example ${f} has no errors`, () => {
    const r = validate(load(`../examples/${f}`));
    assert.deepEqual(r.errors, []);
    assert.equal(r.valid, true);
  });
}

// Fixture file names are the error or warning code they must produce.
for (const f of files("./fixtures/invalid/")) {
  test(`schema rejects ${f}`, () => {
    const r = validate(load(`./fixtures/invalid/${f}`));
    assert.equal(r.valid, false);
    assert.ok(codes(r.errors).includes("schema"), JSON.stringify(r.errors));
  });
}

for (const f of files("./fixtures/errors/")) {
  const code = f.replace(/\.json$/, "");
  test(`error ${code}`, () => {
    const r = validate(load(`./fixtures/errors/${f}`));
    assert.equal(r.valid, false);
    assert.ok(codes(r.errors).includes(code), JSON.stringify(r.errors));
  });
}

for (const f of files("./fixtures/warnings/")) {
  const code = f.replace(/\.json$/, "");
  test(`warning ${code}`, () => {
    const r = validate(load(`./fixtures/warnings/${f}`));
    assert.deepEqual(r.errors, []);
    assert.ok(codes(r.warnings).includes(code), JSON.stringify(r.warnings));
  });
}

test("non-object input is rejected, not thrown on", () => {
  for (const bad of [null, [], "diagram", 42]) {
    const r = validate(bad);
    assert.equal(r.valid, false);
    assert.match(r.errors[0].message, /must be an object/);
  }
});

test("typos get a suggestion", () => {
  const r = validate({ version: "0.1", type: "architecture", nodes: [{ id: "a", label: "A", shape: "databse" }] });
  assert.match(r.errors[0].message, /did you mean "database"/);
  const r2 = validate({ version: "0.1", type: "architecture", nodes: [{ id: "a", label: "A", lable: "x" }] });
  assert.match(r2.errors[0].message, /unknown field "lable"; did you mean "label"/);
});

test("every message names a path and a code", () => {
  for (const sub of ["invalid", "errors", "warnings"]) {
    for (const f of files(`./fixtures/${sub}/`)) {
      const r = validate(load(`./fixtures/${sub}/${f}`));
      for (const p of [...r.errors, ...r.warnings]) {
        assert.ok(p.path && p.code && p.message.length > 10, `${f}: ${JSON.stringify(p)}`);
      }
    }
  }
});

const cli = (args) => spawnSync(process.execPath, [new URL("../skills/penciled/src/cli.js", import.meta.url).pathname, ...args], { encoding: "utf8" });

test("cli: validate prints a report and sets the exit code", () => {
  const ok = cli(["validate", dir("../examples/minimal.json").pathname]);
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /ok$/m);
  const bad = cli(["validate", "--json", dir("./fixtures/errors/unknown-node.json").pathname]);
  assert.equal(bad.status, 1);
  assert.equal(JSON.parse(bad.stdout).errors[0].code, "unknown-node");
});

test("cli: render refuses input with errors and --strict fails on warnings", () => {
  const bad = cli([dir("./fixtures/errors/duplicate-id.json").pathname]);
  assert.equal(bad.status, 1);
  assert.equal(bad.stdout, "");
  assert.match(bad.stderr, /duplicate/);
  const warn = dir("./fixtures/warnings/empty-group.json").pathname;
  assert.equal(cli([warn]).status, 0);
  assert.equal(cli([warn, "--strict"]).status, 1);
});

test("cli: renders to stdout", () => {
  const out = execFileSync(process.execPath, [new URL("../skills/penciled/src/cli.js", import.meta.url).pathname, dir("../examples/minimal.json").pathname], { encoding: "utf8" });
  assert.match(out, /^<svg /);
});
