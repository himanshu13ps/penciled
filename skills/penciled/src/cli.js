#!/usr/bin/env node
// penciled <diagram.json> [-o out.svg|out.html|out.png] [--html] [--scale N] [--seed N] [--strict]
// penciled validate <diagram.json> [--json] [--strict]

import { readFileSync, writeFileSync } from "node:fs";
import { render } from "./render.js";
import { formatReport, validate } from "./validate.js";
import { viewerHtml } from "./viewer.js";
import { svgToPng } from "./raster.js";

const USAGE = `usage:
  penciled <diagram.json> [-o out.svg | out.html | out.png] [--html] [--scale N] [--seed N] [--strict]
  penciled validate <diagram.json> [--json] [--strict]

-o out.html, --html  write the interactive HTML viewer instead of a bare SVG
-o out.png           write a PNG (uses an installed Chrome, Edge, Chromium or Brave)
--scale N            PNG size as a multiple of the drawing, 1 to 4 (default 2)
--strict             treat warnings as failures (exit code 1)`;

const args = process.argv.slice(2);
const command = args[0] === "validate" ? args.shift() : "render";
let input, output, seed, json = false, strict = false, html = false, scale = 2;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "-o" || args[i] === "--out") output = args[++i];
  else if (args[i] === "--seed") seed = Number(args[++i]);
  else if (args[i] === "--json") json = true;
  else if (args[i] === "--strict") strict = true;
  else if (args[i] === "--html") html = true;
  else if (args[i] === "--scale") scale = Number(args[++i]);
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
if (output?.toLowerCase().endsWith(".png")) {
  if (!(scale >= 1 && scale <= 4)) {
    console.error("error   --scale must be between 1 and 4");
    process.exit(2);
  }
  try {
    svgToPng(render(diagram, { seed }), output, { scale });
  } catch (err) {
    console.error(`error   ${output}: ${err.message}`);
    process.exit(1);
  }
} else {
  const result = html || output?.endsWith(".html") ? viewerHtml(diagram, { seed }) : render(diagram, { seed });
  if (output) writeFileSync(output, result);
  else process.stdout.write(result);
}
