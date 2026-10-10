// Files the renderer needs: the handwriting font, its metrics and the input
// schema. This is the only module that touches the file system; the HTML
// viewer's bundle swaps it for one with the data written inline.

import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url));

export const METRICS = JSON.parse(read("../fonts/caveat-metrics.json"));
export const SCHEMA = JSON.parse(read("../schema/architecture.schema.json"));

let font;
export function fontBase64() {
  font ??= read("../fonts/caveat.woff2").toString("base64");
  return font;
}
