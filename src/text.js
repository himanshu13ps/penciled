// Handwriting font: embedding and text measurement without a browser.

import { METRICS, fontBase64 } from "./assets.js";

export const FONT_FAMILY = "penciled-hand";

let fontFace;
export function fontFaceCss() {
  fontFace ??= `@font-face{font-family:${FONT_FAMILY};src:url(data:font/woff2;base64,${fontBase64()}) format("woff2");}`;
  return fontFace;
}

const fallbackAdvance = METRICS.advance["110"]; // "n"

export function textWidth(text, fontSize) {
  let units = 0;
  for (const ch of text) units += METRICS.advance[ch.codePointAt(0)] ?? fallbackAdvance;
  return (units / METRICS.unitsPerEm) * fontSize;
}

export function measureLines(lines, fontSize) {
  return Math.max(...lines.map((l) => textWidth(l, fontSize)));
}

export function escapeXml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
