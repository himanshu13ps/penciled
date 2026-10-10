// Diagram JSON -> pencil-drawn SVG.

import { createRandom } from "./random.js";
import { PENCILS, strokeOutline } from "./stroke.js";
import { GRAPHITE, background, defs } from "./paper.js";
import { SHAPES, eraserMark, shading, tone } from "./shapes.js";
import { drawArrow, labelSpot, route } from "./edges.js";
import { layout } from "./layout.js";
import { ellipsePoints, polyline, quadPoint, r1 } from "./geometry.js";
import { FONT_FAMILY, escapeXml, fontFaceCss, measureLines, textWidth } from "./text.js";

const LABEL_SIZE = 24;
const SUBLABEL_SIZE = 17;
const EDGE_LABEL_SIZE = 18;
const GROUP_LABEL_SIZE = 20;
const TITLE_SIZE = 32;
const MARGIN = 50;

function labelBlock(node) {
  const lines = node.label.split("\n");
  let width = measureLines(lines, LABEL_SIZE);
  let height = lines.length * LABEL_SIZE * 1.05;
  if (node.sublabel) {
    width = Math.max(width, measureLines([node.sublabel], SUBLABEL_SIZE));
    height += SUBLABEL_SIZE * 1.2;
  }
  return { lines, width, height };
}

const shapeOf = (node) => SHAPES[node.shape ?? "box"] ?? SHAPES.box;

function text(x, y, str, size, rng, extra = "") {
  const rot = r1(rng.range(-1.5, 1.5));
  return `<text x="${r1(x)}" y="${r1(y)}" font-size="${size}" transform="rotate(${rot} ${r1(x)} ${r1(y)})"${extra}>${escapeXml(str)}</text>`;
}

function nodeLabel(node, block, at, rng) {
  const lh = LABEL_SIZE * 1.05;
  const cx = at.x + rng.range(-2, 2);
  let y = at.y - block.height / 2 + LABEL_SIZE * 0.78;
  let out = "";
  for (const l of block.lines) {
    out += text(cx, y, l, LABEL_SIZE, rng);
    y += lh;
  }
  if (node.sublabel) out += text(cx, y + SUBLABEL_SIZE * 0.1, node.sublabel, SUBLABEL_SIZE, rng, ` fill-opacity="0.7"`);
  return out;
}

// A group outline: a rounded rectangle drawn in quick, uneven dashes.
function groupOutline(rect, rng, pencil) {
  const r = 12;
  const { x, y, width: w, height: h } = rect;
  const pts = [];
  for (const [cx, cy, a] of [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]]) {
    pts.push(...ellipsePoints(cx, cy, r, r, a, a + Math.PI / 2, 6));
  }
  pts.push(pts[0]);
  const path = polyline(pts);
  const total = 2 * (w + h);
  let out = "";
  for (let d = rng.range(0, 8); d < total; ) {
    const dash = rng.range(10, 16), gap = rng.range(6, 9);
    const a = d / total, b = Math.min(1, (d + dash) / total);
    out += `<path d="${strokeOutline((u) => path(a + (b - a) * u), rng, { width: pencil.width * 0.85, overshoot: 0, wobble: 0.35, taperIn: 0.15, taperOut: 0.3 })}" fill-opacity="${r1(pencil.opacity * 85) / 100}"/>`;
    d += dash + gap;
  }
  return out;
}

export function render(diagram, options = {}) {
  const seed = options.seed ?? diagram.paper?.seed ?? Math.floor(Math.random() * 2 ** 32);
  const rng = createRandom(seed);
  const pencil = PENCILS[diagram.paper?.pencil ?? "2B"];

  const blocks = new Map(diagram.nodes.map((n) => [n.id, labelBlock(n)]));
  const sizes = new Map(diagram.nodes.map((n) => [n.id, n.size ?? shapeOf(n).size(blocks.get(n.id))]));
  const titleRoom = diagram.title ? TITLE_SIZE * 1.8 : 0;
  const { rects, groups, width: layoutWidth, height } = layout(diagram, sizes, { top: titleRoom, margin: MARGIN });
  const width = diagram.title ? Math.max(layoutWidth, Math.ceil(textWidth(diagram.title, TITLE_SIZE) + 2 * MARGIN)) : layoutWidth;

  const placed = new Map();
  for (const n of diagram.nodes) placed.set(n.id, { rect: rects.get(n.id), ...shapeOf(n).place(rects.get(n.id), rng) });

  let back = "", shade = "", lines = "", labels = "", erased = "";

  const groupList = (diagram.groups ?? []).filter((g) => groups.has(g.id));
  // Group labels are kept clear of arrows and arrow labels.
  const groupLabels = groupList.map((g) => {
    const gr = groups.get(g.id);
    return { rect: { x: gr.x + 8, y: gr.y + 4, width: textWidth(g.label, GROUP_LABEL_SIZE) + 14, height: GROUP_LABEL_SIZE + 6 } };
  });
  for (const g of groupList) {
    const gr = groups.get(g.id);
    if (g.shade && g.shade !== "none") {
      back += tone([{ x: gr.x, y: gr.y }, { x: gr.x + gr.width, y: gr.y }, { x: gr.x + gr.width, y: gr.y + gr.height }, { x: gr.x, y: gr.y + gr.height }], g.shade);
    }
    lines += groupOutline(gr, rng, pencil);
    labels += text(gr.x + 14, gr.y + GROUP_LABEL_SIZE + 4, g.label.replace(/\n/g, " "), GROUP_LABEL_SIZE, rng, ` text-anchor="start" fill-opacity="0.8"`);
  }

  for (const n of diagram.nodes) {
    const p = placed.get(n.id);
    const block = blocks.get(n.id);
    if (n.shade && n.shade !== "none" && p.shadeArea) {
      const clear = { x: p.label.x - block.width / 2 - 11, y: p.label.y - block.height / 2 - 4, width: block.width + 22, height: block.height + 8 };
      shade += shading(p.shadeArea, n.shade, rng, pencil, { id: n.id, clear });
    }
    lines += p.draw(rng, pencil);
    labels += nodeLabel(n, block, p.label, rng);
  }

  // Arrows between the same two nodes are spread apart.
  const edges = (diagram.edges ?? []).filter((e) => placed.has(e.from) && placed.has(e.to) && e.from !== e.to);
  const pairKey = (e) => (e.from < e.to ? `${e.from}\u0000${e.to}` : `${e.to}\u0000${e.from}`);
  const pairs = new Map();
  for (const e of edges) pairs.set(pairKey(e), [...(pairs.get(pairKey(e)) ?? []), e]);
  const nodeRects = [...rects.values()];
  const extents = [];
  const takenLabels = [];
  for (const e of edges) {
    const group = pairs.get(pairKey(e));
    const i = group.indexOf(e);
    const flip = e.from < e.to ? 1 : -1;
    const bias = group.length > 1 ? (i - (group.length - 1) / 2) * 40 * flip : 0;
    const others = [...diagram.nodes.filter((n) => n.id !== e.from && n.id !== e.to).map((n) => placed.get(n.id)), ...groupLabels];
    const path = route(placed.get(e.from), placed.get(e.to), others, bias, rng);
    lines += drawArrow(path, rng, pencil, { style: e.style, heads: e.arrow ?? "end" });
    for (let t = 0; t <= 1; t += 0.1) extents.push(quadPoint(path.from, path.ctrl, path.to, t));
    if (e.label) {
      const w = textWidth(e.label, EDGE_LABEL_SIZE);
      const at = labelSpot(path, w, EDGE_LABEL_SIZE, [...nodeRects, ...groupLabels.map((l) => l.rect), ...takenLabels], [...groups.values()]);
      takenLabels.push({ x: at.x - w / 2, y: at.y - EDGE_LABEL_SIZE * 0.8, width: w, height: EDGE_LABEL_SIZE });
      labels += text(at.x, at.y, e.label, EDGE_LABEL_SIZE, rng, ` fill-opacity="0.85"`);
    }
  }

  if (diagram.paper?.eraserMarks ?? true) {
    const count = Math.min(diagram.nodes.length, rng.int(1, 2));
    for (let i = 0; i < count; i++) erased += eraserMark(rects.get(diagram.nodes[rng.int(0, diagram.nodes.length - 1)].id), rng, pencil);
  }

  if (diagram.title) labels += text(width / 2, MARGIN + TITLE_SIZE * 0.7, diagram.title, TITLE_SIZE, rng);

  // Bent arrows and their labels can reach past the nodes: grow the page so
  // nothing is cut off.
  for (const b of takenLabels) extents.push({ x: b.x, y: b.y }, { x: b.x + b.width, y: b.y + b.height });
  const pad = MARGIN * 0.6;
  const minX = Math.min(0, ...extents.map((p) => p.x - pad)), minY = Math.min(0, ...extents.map((p) => p.y - pad));
  const maxX = Math.max(width, ...extents.map((p) => p.x + pad)), maxY = Math.max(height, ...extents.map((p) => p.y + pad));
  const vb = `${r1(minX)} ${r1(minY)} ${Math.ceil(maxX - minX)} ${Math.ceil(maxY - minY)}`;
  const W = Math.ceil(maxX - minX), H = Math.ceil(maxY - minY);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${vb}">
<style>${fontFaceCss()} text{font-family:${FONT_FAMILY},cursive;text-anchor:middle;fill:${GRAPHITE}}</style>
<defs>${defs(seed)}</defs>
<g transform="translate(${r1(minX)} ${r1(minY)})">${background(W, H, diagram.paper?.texture)}</g>
<g fill="${GRAPHITE}">${back}${erased}</g>
<g fill="${GRAPHITE}" filter="url(#pc-graphite)">${shade}${lines}${labels}</g>
</svg>
`;
}

