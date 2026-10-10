import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const skillDir = new URL("../skills/penciled/", import.meta.url).pathname;

test("SKILL.md has a valid frontmatter header", () => {
  const text = readFileSync(join(skillDir, "SKILL.md"), "utf8");
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, "frontmatter block");
  const fields = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z-]+): (.*)$/);
    assert.ok(kv, `unparseable line: ${line}`);
    // A plain YAML value can't contain ": " (the skills CLI rejects it).
    assert.ok(!/: /.test(kv[2]) || /^["']/.test(kv[2]), `quote the value of ${kv[1]}`);
    fields[kv[1]] = kv[2];
  }
  assert.equal(fields.name, "penciled");
  assert.ok(fields.description.length > 100 && fields.description.length < 1024);
});

test("the skill folder works on its own, as installed", () => {
  // Agents get a copy of skills/penciled and nothing else. Run it from a
  // temporary copy with module-syntax detection off, as on Node 18/20.
  const copy = join(mkdtempSync(join(tmpdir(), "penciled-skill-")), "penciled");
  cpSync(skillDir, copy, { recursive: true });
  const input = new URL("../examples/web-app.json", import.meta.url).pathname;
  const out = join(copy, "..", "d.html");
  const r = spawnSync(process.execPath, ["--no-experimental-detect-module", join(copy, "src/cli.js"), input, "-o", out], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(readFileSync(out, "utf8"), /^<!doctype html>/);
});

test("SKILL.md only points at files the skill ships", () => {
  const text = readFileSync(join(skillDir, "SKILL.md"), "utf8");
  for (const [, path] of text.matchAll(/PENCILED\/([\w./-]+)/g)) {
    assert.doesNotThrow(() => readFileSync(join(skillDir, path)), `missing ${path}`);
  }
});
