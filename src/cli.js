#!/usr/bin/env node
// Usage: penciled <diagram.json> [-o out.svg] [--seed N]

import { readFileSync, writeFileSync } from "node:fs";
import { render } from "./render.js";

const args = process.argv.slice(2);
let input, output, seed;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "-o" || args[i] === "--out") output = args[++i];
  else if (args[i] === "--seed") seed = Number(args[++i]);
  else input = args[i];
}
if (!input) {
  console.error("usage: penciled <diagram.json> [-o out.svg] [--seed N]");
  process.exit(2);
}

const svg = render(JSON.parse(readFileSync(input, "utf8")), { seed });
if (output) writeFileSync(output, svg);
else process.stdout.write(svg);
