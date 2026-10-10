#!/usr/bin/env node
// penciled <diagram.json> [-o out.svg] [--seed N] [--strict]
// penciled validate <diagram.json> [--json] [--strict]

import { readFileSync, writeFileSync } from "node:fs";
import { render } from "./render.js";
import { formatReport, validate } from "./validate.js";

const USAGE = `usage:
  penciled <diagram.json> [-o out.svg] [--seed N] [--strict]
  penciled validate <diagram.json> [--json] [--strict]

--strict  treat warnings as failures (exit code 1)`;

const args = process.argv.slice(2);
const command = args[0] === "validate" ? args.shift() : "render";
let input, output, seed, json = false, strict = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "-o" || args[i] === "--out") output = args[++i];
  else if (args[i] === "--seed") seed = Number(args[++i]);
  else if (args[i] === "--json") json = true;
  else if (args[i] === "--strict") strict = true;
  else if (args[i] === "-h" || args[i] === "--help") { console.log(USAGE); process.exit(0); }
  else input = args[i];
}
if (!input) {
  console.error(USAGE);
  process.exit(2);
}

let diagram;
try {
  diagram = JSON.parse(readFileSync(input, "utf8"));
} catch (err) {
  console.error(`error   ${input}: ${err.code === "ENOENT" ? "file not found" : `not valid JSON (${err.message})`}`);
  process.exit(1);
}

// One seed for both validating and drawing, so warnings describe the
// drawing that is actually produced.
seed ??= diagram?.paper?.seed ?? Math.floor(Math.random() * 2 ** 32);
const report = validate(diagram, { seed });
const failed = !report.valid || (strict && report.warnings.length > 0);

if (command === "validate") {
  console.log(json ? JSON.stringify(report, null, 2) : formatReport(report, input));
  process.exit(failed ? 1 : 0);
}

// Rendering: errors stop it, warnings are reported on stderr.
if (report.errors.length || report.warnings.length) console.error(formatReport(report, input));
if (failed) process.exit(1);
const svg = render(diagram, { seed });
if (output) writeFileSync(output, svg);
else process.stdout.write(svg);
