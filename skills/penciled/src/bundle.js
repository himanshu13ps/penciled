// Packs the renderer and validator into one browser script for the HTML
// viewer, without a build tool.
//
// Each module becomes a function with its own scope; `import { a } from
// "./x.js"` becomes a lookup in a small module table, and `export` lines
// become the function's return value. This only needs to understand the
// plain import/export style used in src/, which the tests keep honest.
// assets.js is replaced by a module with the font, metrics and schema
// written inline.

import { readFileSync } from "node:fs";
import { METRICS, SCHEMA, fontBase64 } from "./assets.js";

const MODULES = ["random", "geometry", "text", "paper", "stroke", "shapes", "edges", "layout", "render", "validate"];

function transform(name, source) {
  const exported = [];
  let code = source.replace(/^import \{([^}]*)\} from "\.\/([\w-]+)\.js";$/gm, (_, names, from) => {
    const bindings = names.split(",").map((n) => n.trim()).filter(Boolean).map((n) => n.replace(/\s+as\s+/, ": "));
    return `const { ${bindings.join(", ")} } = load("${from}");`;
  });
  code = code.replace(/^export (function|const|let|class) (\w+)/gm, (_, kind, id) => {
    exported.push(id);
    return `${kind} ${id}`;
  });
  if (/^\s*(import|export)\b/m.test(code)) throw new Error(`bundle: unsupported import/export in ${name}.js`);
  return `${JSON.stringify(name)}: (load) => {\n${code}\nreturn { ${exported.join(", ")} };\n}`;
}

let cached;

/** The bundle as a script that defines a global `penciled`. */
export function bundle() {
  if (cached) return cached;
  const assets = `"assets": () => {
const METRICS = ${JSON.stringify(METRICS)};
const SCHEMA = ${JSON.stringify(SCHEMA)};
const FONT = "${fontBase64()}";
return { METRICS, SCHEMA, fontBase64: () => FONT };
}`;
  const modules = MODULES.map((m) => transform(m, readFileSync(new URL(`./${m}.js`, import.meta.url), "utf8")));
  cached = `(() => {
const defs = {
${[assets, ...modules].join(",\n")}
};
const done = {};
const load = (name) => done[name] ??= defs[name](load);
const { render, plan } = load("render");
const { validate, formatReport } = load("validate");
const { PAPER_STYLES } = load("paper");
globalThis.penciled = { render, plan, validate, formatReport, PAPER_STYLES };
})();`;
  return cached;
}
