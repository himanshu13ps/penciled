// Diagram JSON -> pencil-drawn SVG.
//
// M2 scope: box nodes, arrows, labels, shading, paper and eraser marks.
// Every node is drawn as a box and nodes are placed in a single row or column;
// other shapes and real layout come in M3.

import { createRandom } from "./random.js";
import { PENCILS } from "./stroke.js";
import { GRAPHITE, background, defs } from "./paper.js";
import { arrow, box, edgePoint, eraserMark, shading } from "./shapes.js";
import { FONT_FAMILY, escapeXml, fontFaceCss, measureLines } from "./text.js";

const LABEL_SIZE = 24;
const SUBLABEL_SIZE = 17;
const EDGE_LABEL_SIZE = 18;
const TITLE_SIZE = 32;
const MARGIN = 60;
const GAP = 150;

const r1 = (n) => Math.round(n * 10) / 10;

function nodeSize(node) {
  if (node.size) return { width: node.size.width, height: node.size.height };
  const lines = node.label.split("\n");
  let w = measureLines(lines, LABEL_SIZE);
  let h = lines.length * LABEL_SIZE * 1.05;
  if (node.sublabel) {
    w = Math.max(w, measureLines([node.sublabel], SUBLABEL_SIZE));
    h += SUBLABEL_SIZE * 1.2;
  }
  return { width: Math.max(110, Math.ceil(w + 44)), height: Math.max(62, Math.ceil(h + 30)) };
}

function layout(diagram) {
  const rects = new Map();
  const vertical = diagram.direction === "TB";
  const top = MARGIN + (diagram.title ? TITLE_SIZE * 1.6 : 0);
  if (diagram.nodes.every((n) => n.position)) {
    for (const n of diagram.nodes) {
      const s = nodeSize(n);
      rects.set(n.id, { x: n.position.x - s.width / 2, y: n.position.y - s.height / 2 + top - MARGIN, ...s });
    }
  } else {
    const sizes = diagram.nodes.map(nodeSize);
    const cross = Math.max(...sizes.map((s) => (vertical ? s.width : s.height)));
    let along = MARGIN;
    diagram.nodes.forEach((n, i) => {
      const s = sizes[i];
      rects.set(n.id, vertical
        ? { x: MARGIN + (cross - s.width) / 2, y: top + along - MARGIN, ...s }
        : { x: along, y: top + (cross - s.height) / 2, ...s });
      along += (vertical ? s.height : s.width) + GAP;
    });
  }
  let maxX = 0, maxY = 0;
  for (const r of rects.values()) {
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { rects, width: Math.ceil(maxX + MARGIN), height: Math.ceil(maxY + MARGIN) };
}

// Area the label covers, padded a little; shading is rubbed out here.
function labelBox(node, rect) {
  const lines = node.label.split("\n");
  let w = measureLines(lines, LABEL_SIZE);
  let h = lines.length * LABEL_SIZE * 1.05;
  if (node.sublabel) {
    w = Math.max(w, measureLines([node.sublabel], SUBLABEL_SIZE));
    h += SUBLABEL_SIZE * 1.2;
  }
  w = Math.min(w + 22, rect.width - 8);
  h = Math.min(h + 8, rect.height - 8);
  return { x: rect.x + (rect.width - w) / 2, y: rect.y + (rect.height - h) / 2, width: w, height: h };
}

function text(x, y, str, size, rng, extra = "") {
  const rot = r1(rng.range(-1.5, 1.5));
  return `<text x="${r1(x)}" y="${r1(y)}" font-size="${size}" transform="rotate(${rot} ${r1(x)} ${r1(y)})"${extra}>${escapeXml(str)}</text>`;
}

function nodeLabel(node, rect, rng) {
  const lines = node.label.split("\n");
  const lh = LABEL_SIZE * 1.05;
  const block = lines.length * lh + (node.sublabel ? SUBLABEL_SIZE * 1.2 : 0);
  const cx = rect.x + rect.width / 2 + rng.range(-2, 2);
  let y = rect.y + (rect.height - block) / 2 + LABEL_SIZE * 0.78;
  let out = "";
  for (const l of lines) {
    out += text(cx, y, l, LABEL_SIZE, rng);
    y += lh;
  }
  if (node.sublabel) out += text(cx, y + SUBLABEL_SIZE * 0.1, node.sublabel, SUBLABEL_SIZE, rng, ` fill-opacity="0.7"`);
  return out;
}

export function render(diagram, options = {}) {
  const seed = options.seed ?? diagram.paper?.seed ?? Math.floor(Math.random() * 2 ** 32);
  const rng = createRandom(seed);
  const pencil = PENCILS[diagram.paper?.pencil ?? "2B"];
  const { rects, width, height } = layout(diagram);

  let shade = "", lines = "", labels = "", erased = "";

  for (const n of diagram.nodes) {
    const r = rects.get(n.id);
    if (n.shade && n.shade !== "none") shade += shading(r, n.shade, rng, pencil, { id: n.id, clear: labelBox(n, r) });
    lines += box(r, rng, pencil);
    labels += nodeLabel(n, r, rng);
  }

  for (const e of diagram.edges ?? []) {
    const a = rects.get(e.from), b = rects.get(e.to);
    if (!a || !b || a === b) continue;
    const ac = { x: a.x + a.width / 2, y: a.y + a.height / 2 }, bc = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const from = edgePoint(a, bc, rng.range(6, 10)), to = edgePoint(b, ac, rng.range(5, 8));
    lines += arrow(from, to, rng, pencil, { style: e.style, heads: e.arrow ?? "end" });
    if (e.label) {
      const len = Math.hypot(to.x - from.x, to.y - from.y);
      const ny = (to.x - from.x) / len;
      const nx = -(to.y - from.y) / len;
      // Put the label on the upper side of the arrow.
      const s = ny > 0 || (ny === 0 && nx > 0) ? -1 : 1;
      labels += text((from.x + to.x) / 2 + nx * s * 14, (from.y + to.y) / 2 + ny * s * 14, e.label, EDGE_LABEL_SIZE, rng, ` fill-opacity="0.85"`);
    }
  }

  if (diagram.paper?.eraserMarks ?? true) {
    const nodes = diagram.nodes;
    const count = Math.min(nodes.length, rng.int(1, 2));
    for (let i = 0; i < count; i++) erased += eraserMark(rects.get(nodes[rng.int(0, nodes.length - 1)].id), rng, pencil);
  }

  if (diagram.title) {
    labels += text(width / 2, MARGIN + TITLE_SIZE * 0.6, diagram.title, TITLE_SIZE, rng);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<style>${fontFaceCss()} text{font-family:${FONT_FAMILY},cursive;text-anchor:middle;fill:${GRAPHITE}}</style>
<defs>${defs(seed)}</defs>
${background(width, height)}
<g fill="${GRAPHITE}">${erased}</g>
<g fill="${GRAPHITE}" filter="url(#pc-graphite)">${shade}${lines}${labels}</g>
</svg>
`;
}
