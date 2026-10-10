// Shapes built from pencil strokes.

import { line, quad, pencilLine, strokeOutline } from "./stroke.js";
import { GRAPHITE } from "./paper.js";

const r1 = (n) => Math.round(n * 10) / 10;

// A box drawn the way people draw one: four separate sides, each starting a
// little before its corner and running a little past the next one, so the
// corners cross or just miss.
export function box(rect, rng, pencil) {
  const { x, y, width: w, height: h } = rect;
  const j = () => rng.range(-1.5, 1.5);
  const tl = { x: x + j(), y: y + j() }, tr = { x: x + w + j(), y: y + j() };
  const br = { x: x + w + j(), y: y + h + j() }, bl = { x: x + j(), y: y + h + j() };
  const sides = [[tl, tr], [tr, br], [br, bl], [bl, tl]];
  // Start on a random side, as a hand would.
  const start = rng.int(0, 3);
  let out = "";
  for (let i = 0; i < 4; i++) {
    const [a, b] = sides[(start + i) % 4];
    out += pencilLine(line(a, b), rng, pencil, { overshoot: rng.range(3, 7), wobble: 0.8 });
  }
  return out;
}

// Rectangle clipped against a line through `p` with direction `d`: returns the
// entry and exit parameters, or null if the line misses.
function clipLine(rect, p, d) {
  let t0 = -Infinity, t1 = Infinity;
  for (const [pos, dir, lo, hi] of [[p.x, d.x, rect.x, rect.x + rect.width], [p.y, d.y, rect.y, rect.y + rect.height]]) {
    if (Math.abs(dir) < 1e-9) {
      if (pos < lo || pos > hi) return null;
      continue;
    }
    let a = (lo - pos) / dir, b = (hi - pos) / dir;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
  }
  return t1 > t0 ? [t0, t1] : null;
}

const SHADE = {
  light: { spacing: 7, opacity: 0.36, smudge: 0.06, cross: false },
  medium: { spacing: 5, opacity: 0.48, smudge: 0.1, cross: false },
  dark: { spacing: 4.2, opacity: 0.6, smudge: 0.14, cross: true },
};

// Graphite shading: a soft finger smudge underneath, then quick diagonal
// hatching that stops short of, or slightly crosses, the outline. If `clear`
// is given, the shading is rubbed out behind it (where the label sits), the
// way an artist lifts graphite with an eraser so text stays readable.
export function shading(rect, level, rng, pencil, { id, clear } = {}) {
  const s = SHADE[level];
  if (!s) return "";
  const inset = 3;
  const inner = { x: rect.x + inset, y: rect.y + inset, width: rect.width - 2 * inset, height: rect.height - 2 * inset };
  let out = `<rect x="${r1(inner.x + 2)}" y="${r1(inner.y + 2)}" width="${r1(inner.width - 4)}" height="${r1(inner.height - 4)}" rx="6" fill="${GRAPHITE}" opacity="${s.smudge}" filter="url(#pc-smudge)"/>`;
  out += hatch(inner, rng, pencil, s, rng.range(52, 62));
  if (s.cross) out += hatch(inner, rng, pencil, { ...s, opacity: s.opacity * 0.7, spacing: s.spacing * 1.4 }, rng.range(-62, -52) + 180);
  if (!clear) return out;
  const m = `pc-clear-${id}`;
  const pad = 10;
  return `<mask id="${m}" maskUnits="userSpaceOnUse" x="${r1(rect.x - pad)}" y="${r1(rect.y - pad)}" width="${r1(rect.width + 2 * pad)}" height="${r1(rect.height + 2 * pad)}">` +
    `<rect x="${r1(rect.x - pad)}" y="${r1(rect.y - pad)}" width="${r1(rect.width + 2 * pad)}" height="${r1(rect.height + 2 * pad)}" fill="#fff"/>` +
    `<rect x="${r1(clear.x)}" y="${r1(clear.y)}" width="${r1(clear.width)}" height="${r1(clear.height)}" rx="${r1(clear.height / 2)}" fill="#000" fill-opacity="${level === "light" ? 0.6 : 0.85}" filter="url(#pc-soft)" transform="rotate(${r1(rng.range(-3, 3))} ${r1(clear.x + clear.width / 2)} ${r1(clear.y + clear.height / 2)})"/>` +
    `</mask><g mask="url(#${m})">${out}</g>`;
}

function hatch(rect, rng, pencil, s, angleDeg) {
  let out = "";
  const diag = Math.hypot(rect.width, rect.height);
  const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
  const base = (angleDeg * Math.PI) / 180;
  const nx = -Math.sin(base), ny = Math.cos(base);
  // The hand drifts: angle and spacing wander slowly rather than jumping.
  let drift = 0;
  for (let k = -diag / 2; k <= diag / 2; k += s.spacing * rng.range(0.7, 1.3)) {
    drift = drift * 0.8 + rng.range(-0.03, 0.03);
    const a = base + drift;
    const d = { x: Math.cos(a), y: Math.sin(a) };
    const p = { x: cx + nx * k, y: cy + ny * k };
    const hit = clipLine(rect, p, d);
    if (!hit) continue;
    // Each end lands a bit inside or outside the edge.
    const t0 = hit[0] + rng.range(-1, 4), t1 = hit[1] - rng.range(-1, 4);
    if (t1 - t0 < 6) continue;
    const a0 = { x: p.x + d.x * t0, y: p.y + d.y * t0 }, a1 = { x: p.x + d.x * t1, y: p.y + d.y * t1 };
    // A quick flick of the wrist curves the stroke slightly.
    const bend = rng.range(-0.04, 0.04) * (t1 - t0);
    const c = { x: (a0.x + a1.x) / 2 - d.y * bend, y: (a0.y + a1.y) / 2 + d.x * bend };
    const opacity = s.opacity * rng.range(0.65, 1.15);
    out += `<path d="${strokeOutline(quad(a0, c, a1), rng, { width: pencil.width * rng.range(0.55, 0.8), overshoot: 0, wobble: 0.25, taperIn: 0.12, taperOut: 0.4 })}" fill-opacity="${r1(opacity * 100) / 100}"/>`;
  }
  return out;
}

// Point where the ray from the centre of `rect` towards `toward` leaves the
// rectangle, pushed out by `gap`.
export function edgePoint(rect, toward, gap) {
  const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
  const dx = toward.x - cx, dy = toward.y - cy;
  const len = Math.hypot(dx, dy) || 1;
  const sx = dx === 0 ? Infinity : rect.width / 2 / Math.abs(dx);
  const sy = dy === 0 ? Infinity : rect.height / 2 / Math.abs(dy);
  const s = Math.min(sx, sy);
  return { x: cx + dx * s + (dx / len) * gap, y: cy + dy * s + (dy / len) * gap };
}

// An arrow: a slightly bowed shaft and a head made of two flicks out from the tip.
export function arrow(from, to, rng, pencil, { style = "solid", heads = "end" } = {}) {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  const nx = -(to.y - from.y) / len, ny = (to.x - from.x) / len;
  const sag = rng.range(-0.04, 0.04) * len;
  const ctrl = { x: (from.x + to.x) / 2 + nx * sag, y: (from.y + to.y) / 2 + ny * sag };
  const shaft = quad(from, ctrl, to);

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
  if (heads === "end" || heads === "both") out += head(to, shaft(0.97));
  if (heads === "start" || heads === "both") out += head(from, shaft(0.03));
  return out;
}

// The ghost of a line that was drawn and rubbed out, plus the grey haze the
// eraser leaves behind.
export function eraserMark(rect, rng, pencil) {
  const side = rng.int(0, 3);
  const off = rng.range(5, 10);
  const { x, y, width: w, height: h } = rect;
  const k = rng.range(0.15, 0.45);
  const seg = [
    [{ x: x + w * k, y: y - off }, { x: x + w * (k + 0.5), y: y - off - rng.range(-2, 2) }],
    [{ x: x + w + off, y: y + h * k }, { x: x + w + off + rng.range(-2, 2), y: y + h * (k + 0.5) }],
    [{ x: x + w * k, y: y + h + off }, { x: x + w * (k + 0.5), y: y + h + off + rng.range(-2, 2) }],
    [{ x: x - off, y: y + h * k }, { x: x - off - rng.range(-2, 2), y: y + h * (k + 0.5) }],
  ][side];
  const mid = { x: (seg[0].x + seg[1].x) / 2, y: (seg[0].y + seg[1].y) / 2 };
  const ang = (Math.atan2(seg[1].y - seg[0].y, seg[1].x - seg[0].x) * 180) / Math.PI;
  const span = Math.hypot(seg[1].x - seg[0].x, seg[1].y - seg[0].y);
  return `<g filter="url(#pc-erased)" opacity="0.28"><path d="${strokeOutline(line(seg[0], seg[1]), rng, { width: pencil.width * 1.1 })}"/></g>` +
    `<ellipse cx="${r1(mid.x)}" cy="${r1(mid.y)}" rx="${r1(span * 0.6)}" ry="${r1(rng.range(6, 10))}" transform="rotate(${r1(ang + rng.range(-6, 6))} ${r1(mid.x)} ${r1(mid.y)})" fill="${GRAPHITE}" opacity="0.035" filter="url(#pc-smudge)"/>`;
}
