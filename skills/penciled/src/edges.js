// Arrows: choosing a path between two nodes, and drawing it in pencil.

import { line, pencilLine, strokeOutline } from "./stroke.js";
import { center, inflate, overlaps, quadPoint, rayExit } from "./geometry.js";

// Bends to try, in px of sideways bulge at the middle of the arrow. Straight
// first; otherwise the smallest bend that misses every other node.
const BENDS = [0, 30, -30, 60, -60, 100, -100, 150, -150, 210, -210];

function pointInRect(p, r) {
  return p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;
}

function crossings(from, ctrl, to, obstacles) {
  let hits = 0;
  for (const r of obstacles) {
    for (let t = 0.04; t <= 0.96; t += 0.04) {
      if (pointInRect(quadPoint(from, ctrl, to, t), r)) {
        hits++;
        break;
      }
    }
  }
  return hits;
}

/**
 * Pick a path for an arrow from node `a` to node `b` (placed nodes with
 * `rect` and `outline`). `bias` pushes the arrow to one side, used to keep
 * two arrows between the same pair apart. Returns {from, ctrl, to}.
 */
export function route(a, b, others, bias, rng) {
  const ac = center(a.rect), bc = center(b.rect);
  const dx = bc.x - ac.x, dy = bc.y - ac.y;
  const len = Math.hypot(dx, dy) || 1;
  const n = { x: -dy / len, y: dx / len };
  const mid = { x: (ac.x + bc.x) / 2, y: (ac.y + bc.y) / 2 };
  const obstacles = others.map((o) => inflate(o.rect, 8));

  let best = null;
  for (const bend of BENDS) {
    const bulge = bias + bend;
    // A quadratic curve's midpoint is (from + 2·ctrl + to) / 4, so a control
    // point 2·bulge out gives a curve that bulges by `bulge`.
    const ctrl = { x: mid.x + n.x * 2 * bulge, y: mid.y + n.y * 2 * bulge };
    const from = push(rayExit(a.outline, ac, ctrl), ctrl, rng.range(6, 10));
    const to = push(rayExit(b.outline, bc, ctrl), ctrl, rng.range(5, 8));
    const hits = crossings(from, ctrl, to, obstacles);
    if (!best || hits < best.hits) best = { from, ctrl, to, hits };
    if (hits === 0) break;
  }
  return best;
}

function push(p, toward, by) {
  const dx = toward.x - p.x, dy = toward.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: p.x + (dx / len) * by, y: p.y + (dy / len) * by };
}

/**
 * Where to write an edge label: beside the middle of the arrow, on whichever
 * side doesn't land on a node. Returns {x, y} for the text baseline centre.
 */
export function labelSpot(path, width, height, nodes, frames = []) {
  const { from, ctrl, to } = path;
  const clear = (p) => {
    // A few px of margin all round: handwriting leans and has descenders.
    const box = { x: p.x - width / 2 - 5, y: p.y - height * 0.8 - 5, width: width + 10, height: height + 10 };
    // Frames (group outlines) may contain the label but not cut through it.
    const inside = (r) => box.x >= r.x && box.y >= r.y && box.x + box.width <= r.x + r.width && box.y + box.height <= r.y + r.height;
    return !nodes.some((r) => overlaps(box, r)) && !frames.some((r) => overlaps(box, r) && !inside(r));
  };
  // Beside the middle of the arrow first, then nearer either end.
  let fallback = null;
  for (const t of [0.5, 0.38, 0.62, 0.28, 0.72]) {
    const m = quadPoint(from, ctrl, to, t);
    const a = quadPoint(from, ctrl, to, t - 0.05), b = quadPoint(from, ctrl, to, t + 0.05);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    // Prefer the upper side (or the right side for vertical arrows).
    if (ny > 0.01 || (Math.abs(ny) <= 0.01 && nx < 0)) { nx = -nx; ny = -ny; }
    fallback ??= { x: m.x + nx * 14, y: m.y + ny * 14 + height * 0.3, clear: false };
    for (const dist of [14, 22, 34]) {
      for (const s of [1, -1]) {
        // Offset grows with how sideways the text sits relative to the line.
        const off = dist + Math.abs(nx) * (width / 2);
        const p = { x: m.x + nx * s * off, y: m.y + ny * s * off + height * 0.3 };
        if (clear(p)) return { ...p, clear: true };
      }
    }
  }
  return fallback;
}

// An arrow along a routed path: a pencil shaft with a little extra sag of its
// own, and a head made of two flicks out from the tip.
export function drawArrow(path, rng, pencil, { style = "solid", heads = "end" } = {}) {
  const { from, to } = path;
  const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const sag = rng.range(-0.025, 0.025) * len;
  const ctrl = { x: path.ctrl.x - ((to.y - from.y) / len) * sag, y: path.ctrl.y + ((to.x - from.x) / len) * sag };
  const shaft = (t) => quadPoint(from, ctrl, to, t);

  let out = "";
  if (style === "dashed") {
    const dash = 9, gap = 6;
    for (let t = 0; t < len; t += dash + gap) {
      const a = t / len, b = Math.min(1, (t + dash * rng.range(0.8, 1.15)) / len);
      out += `<path d="${strokeOutline((u) => shaft(a + (b - a) * u), rng, { width: pencil.width, overshoot: 0, wobble: 0.3, taperIn: 0.15, taperOut: 0.3 })}" fill-opacity="${pencil.opacity}"/>`;
    }
  } else {
    out += pencilLine(shaft, rng, pencil, { overshoot: 0, wobble: 0.6, taperIn: 0.04, taperOut: 0.06 });
  }

  const head = (tip, tangentFrom) => {
    const ang = Math.atan2(tip.y - tangentFrom.y, tip.x - tangentFrom.x);
    let s = "";
    for (const side of [-1, 1]) {
      const spread = rng.range(0.38, 0.5) * side;
      const size = rng.range(14, 18);
      const wing = { x: tip.x - Math.cos(ang + spread) * size, y: tip.y - Math.sin(ang + spread) * size };
      // Pencil lands at the tip and flicks outwards.
      s += pencilLine(line(tip, wing), rng, pencil, { passes: 1, overshoot: 1, wobble: 0.3, taperIn: 0.02, taperOut: 0.45, width: 1.15 });
    }
    return s;
  };
  if (heads === "end" || heads === "both") out += head(to, shaft(0.96));
  if (heads === "start" || heads === "both") out += head(from, shaft(0.04));
  return out;
}
