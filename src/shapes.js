// Node shapes built from pencil strokes.
//
// Each shape knows its size for a given label, and for a placed node gives:
//   outline    polygon used to end arrows on the drawn edge
//   shadeArea  polygon the shading fills
//   label      centre of the label block
//   draw()     the pencil strokes

import { line, pencilLine, strokeOutline } from "./stroke.js";
import { GRAPHITE } from "./paper.js";
import { clipToPolygon, ellipsePoints, insetPolygon, polyline, r1, rectPolygon } from "./geometry.js";

const PERSON_FIGURE = { width: 44, height: 66 };

// Box-like shapes: each side is its own stroke that starts a little before
// its corner and runs a little past the next one, so corners cross or just miss.
function straightSides(pts, rng, pencil) {
  const j = () => rng.range(-1.5, 1.5);
  const p = pts.map((q) => ({ x: q.x + j(), y: q.y + j() }));
  const start = rng.int(0, p.length - 1);
  let out = "";
  for (let i = 0; i < p.length; i++) {
    const k = (start + i) % p.length;
    const a = p[k], b = p[(k + 1) % p.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    out += pencilLine(line(a, b), rng, pencil, { overshoot: Math.min(rng.range(3, 7), len * 0.25), wobble: len < 30 ? 0.4 : 0.8 });
  }
  return out;
}

// Curved outlines: the loop is drawn in a few overlapping strokes, the way a
// hand goes round a shape and lifts the pencil once or twice.
function loopStrokes(pts, rng, pencil, pieces = 2) {
  const loop = pts.concat(pts, [pts[0]]);
  const path = polyline(loop);
  const offset = rng.next();
  let out = "";
  for (let i = 0; i < pieces; i++) {
    const s = (offset + i / pieces - rng.range(0.02, 0.05)) / 2;
    const e = (offset + (i + 1) / pieces + rng.range(0.02, 0.05)) / 2;
    out += pencilLine((u) => path(s + (e - s) * u), rng, pencil, { overshoot: 0, wobble: 0.7 });
  }
  return out;
}

// A small closed curve (head, cylinder end) drawn as one stroke that goes a
// little past where it started.
function ellipseStroke(cx, cy, rx, ry, rng, pencil) {
  const a0 = rng.range(0, Math.PI * 2);
  const pts = ellipsePoints(cx, cy, rx, ry, a0, a0 + Math.PI * 2 + rng.range(0.25, 0.5), 40);
  return pencilLine(polyline(pts), rng, pencil, { overshoot: 0, wobble: 0.5, taperIn: 0.05, taperOut: 0.12 });
}

function arcStroke(cx, cy, rx, ry, a0, a1, rng, pencil) {
  return pencilLine(polyline(ellipsePoints(cx, cy, rx, ry, a0, a1, 24)), rng, pencil, { overshoot: 1, wobble: 0.5 });
}

function roundedPolygon({ x, y, width: w, height: h }, r) {
  const pts = [];
  const corners = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
  for (const [cx, cy, a] of corners) pts.push(...ellipsePoints(cx, cy, r, r, a, a + Math.PI / 2, 6));
  return pts;
}

const fitBox = ({ width, height }, minW = 110, minH = 62) => ({
  width: Math.max(minW, Math.ceil(width + 44)),
  height: Math.max(minH, Math.ceil(height + 30)),
});

export const SHAPES = {
  box: {
    size: (label) => fitBox(label),
    place: (rect) => {
      const outline = rectPolygon(rect);
      return { outline, shadeArea: outline, label: centerOf(rect), draw: (rng, pencil) => straightSides(outline, rng, pencil) };
    },
  },

  rounded: {
    size: (label) => fitBox(label),
    place: (rect) => {
      const outline = roundedPolygon(rect, Math.min(14, rect.height / 3));
      return { outline, shadeArea: outline, label: centerOf(rect), draw: (rng, pencil) => loopStrokes(outline, rng, pencil, 3) };
    },
  },

  document: {
    size: (label) => fitBox({ width: label.width + 10, height: label.height }),
    place: (rect) => {
      const { x, y, width: w, height: h } = rect;
      const f = Math.min(16, h / 3);
      const outline = [{ x, y }, { x: x + w - f, y }, { x: x + w, y: y + f }, { x: x + w, y: y + h }, { x, y: y + h }];
      const c = centerOf(rect);
      return {
        outline,
        shadeArea: outline,
        label: { x: c.x - f / 4, y: c.y + f / 4 },
        draw: (rng, pencil) =>
          straightSides(outline, rng, pencil) +
          pencilLine(line({ x: x + w - f, y: y + 1 }, { x: x + w - f + 1, y: y + f }), rng, pencil, { passes: 1, overshoot: 1, wobble: 0.3 }) +
          pencilLine(line({ x: x + w - f + 1, y: y + f }, { x: x + w - 1, y: y + f }), rng, pencil, { passes: 1, overshoot: 1, wobble: 0.3 }),
      };
    },
  },

  database: {
    size: (label) => {
      const width = Math.max(110, Math.ceil(label.width + 44));
      const ry = cylinderCap(width);
      return { width, height: Math.max(84, Math.ceil(label.height + 30 + 2 * ry)) };
    },
    place: (rect) => {
      const { x, y, width: w, height: h } = rect;
      const rx = w / 2, ry = cylinderCap(w), cx = x + rx;
      const top = y + ry, bottom = y + h - ry;
      const outline = [...ellipsePoints(cx, top, rx, ry, Math.PI, Math.PI * 2, 16), ...ellipsePoints(cx, bottom, rx, ry, 0, Math.PI, 16)];
      const shadeArea = [...ellipsePoints(cx, top, rx, ry, Math.PI, 0, 16), ...ellipsePoints(cx, bottom, rx, ry, 0, Math.PI, 16)];
      return {
        outline,
        shadeArea,
        label: { x: cx, y: (top + ry + bottom) / 2 },
        draw: (rng, pencil) =>
          ellipseStroke(cx, top, rx, ry, rng, pencil) +
          pencilLine(line({ x, y: top }, { x, y: bottom }), rng, pencil, { overshoot: 2 }) +
          pencilLine(line({ x: x + w, y: top }, { x: x + w, y: bottom }), rng, pencil, { overshoot: 2 }) +
          arcStroke(cx, bottom, rx, ry, 0, Math.PI, rng, pencil),
      };
    },
  },

  queue: {
    size: (label) => {
      const height = Math.max(62, Math.ceil(label.height + 30));
      const rx = queueCap(height);
      return { width: Math.max(130, Math.ceil(label.width + 44 + 2 * rx)), height };
    },
    place: (rect) => {
      const { x, y, width: w, height: h } = rect;
      const ry = h / 2, rx = queueCap(h), cy = y + ry;
      const left = x + rx, right = x + w - rx;
      const outline = [...ellipsePoints(left, cy, rx, ry, Math.PI / 2, Math.PI * 1.5, 16), ...ellipsePoints(right, cy, rx, ry, -Math.PI / 2, Math.PI / 2, 16)];
      const shadeArea = [...ellipsePoints(left, cy, rx, ry, Math.PI / 2, Math.PI * 1.5, 16), ...ellipsePoints(right, cy, rx, ry, Math.PI * 1.5, Math.PI / 2, 16)];
      return {
        outline,
        shadeArea,
        label: { x: (left + right - rx) / 2, y: cy },
        draw: (rng, pencil) =>
          ellipseStroke(right, cy, rx, ry, rng, pencil) +
          pencilLine(line({ x: left, y }, { x: right, y }), rng, pencil, { overshoot: 2 }) +
          pencilLine(line({ x: left, y: y + h }, { x: right, y: y + h }), rng, pencil, { overshoot: 2 }) +
          arcStroke(left, cy, rx, ry, Math.PI / 2, Math.PI * 1.5, rng, pencil),
      };
    },
  },

  person: {
    // A stick figure with its label written underneath.
    size: (label) => ({
      width: Math.max(PERSON_FIGURE.width + 16, Math.ceil(label.width + 12)),
      height: Math.ceil(PERSON_FIGURE.height + 10 + label.height),
    }),
    place: (rect) => {
      const cx = rect.x + rect.width / 2, top = rect.y;
      const fig = { x: cx - PERSON_FIGURE.width / 2, y: top, width: PERSON_FIGURE.width, height: PERSON_FIGURE.height };
      const headR = 9.5, neck = top + 2 * headR + 1, hip = top + 42, foot = top + PERSON_FIGURE.height;
      return {
        outline: rectPolygon(fig),
        shadeArea: null,
        label: { x: cx, y: (foot + 10 + rect.y + rect.height) / 2 },
        draw: (rng, pencil) => {
          const j = () => rng.range(-1.2, 1.2);
          const s = (a, b) => pencilLine(line(a, b), rng, pencil, { passes: 1, overshoot: 1, wobble: 0.4 });
          return ellipseStroke(cx + j() / 2, top + headR, headR, headR, rng, pencil) +
            s({ x: cx + j(), y: neck }, { x: cx + j(), y: hip }) +
            s({ x: cx - 17 + j(), y: neck + 12 + j() }, { x: cx + 17 + j(), y: neck + 10 + j() }) +
            s({ x: cx, y: hip }, { x: cx - 13 + j(), y: foot + j() }) +
            s({ x: cx, y: hip }, { x: cx + 13 + j(), y: foot + j() });
        },
      };
    },
  },

  cloud: {
    size: (label) => ({
      width: Math.max(130, Math.ceil(label.width + 76)),
      height: Math.max(84, Math.ceil(label.height + 54)),
    }),
    // Bumps are random, so the outline is made once per node and reused for
    // drawing, shading and arrows.
    place: (rect, rng) => {
      const c = centerOf(rect);
      const bump = 10;
      const rx = rect.width / 2 - bump, ry = rect.height / 2 - bump;
      const n = Math.max(7, Math.min(12, Math.round((Math.PI * (rx + ry)) / 42)));
      const base = rng.range(0, Math.PI * 2);
      const anchors = [];
      for (let i = 0; i < n; i++) {
        const a = base + ((i + rng.range(-0.2, 0.2)) / n) * Math.PI * 2;
        anchors.push({ x: c.x + rx * Math.cos(a), y: c.y + ry * Math.sin(a) });
      }
      const outline = [];
      for (let i = 0; i < n; i++) {
        const a = anchors[i], b = anchors[(i + 1) % n];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const dx = mx - c.x, dy = my - c.y, dl = Math.hypot(dx, dy) || 1;
        const h = bump * rng.range(1.5, 2.1);
        const ctrl = { x: mx + (dx / dl) * h, y: my + (dy / dl) * h };
        for (let k = 0; k < 8; k++) {
          const t = k / 8, u = 1 - t;
          outline.push({ x: u * u * a.x + 2 * u * t * ctrl.x + t * t * b.x, y: u * u * a.y + 2 * u * t * ctrl.y + t * t * b.y });
        }
      }
      return {
        outline,
        shadeArea: ellipsePoints(c.x, c.y, rx + 2, ry + 2, 0, Math.PI * 2, 24),
        label: c,
        draw: (rng2, pencil) => loopStrokes(outline, rng2, pencil, 2),
      };
    },
  },
};

function centerOf(rect) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function cylinderCap(width) {
  return Math.max(8, Math.min(15, width * 0.1));
}

function queueCap(height) {
  return Math.max(8, Math.min(14, height * 0.18));
}

const SHADE = {
  light: { spacing: 7, opacity: 0.36, smudge: 0.06, cross: false },
  medium: { spacing: 5, opacity: 0.48, smudge: 0.1, cross: false },
  dark: { spacing: 4.2, opacity: 0.6, smudge: 0.14, cross: true },
};

const pathOf = (poly) => "M" + poly.map((p) => `${r1(p.x)} ${r1(p.y)}`).join("L") + "Z";

function bounds(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

// Graphite shading: a soft finger smudge underneath, then quick diagonal
// hatching that stops short of, or slightly crosses, the outline. If `clear`
// is given, the shading is rubbed out behind it (where the label sits), the
// way an artist lifts graphite with an eraser so text stays readable.
export function shading(area, level, rng, pencil, { id, clear } = {}) {
  const s = SHADE[level];
  if (!s || !area) return "";
  const inner = insetPolygon(area, 3);
  let out = `<path d="${pathOf(insetPolygon(area, 6))}" fill="${GRAPHITE}" opacity="${s.smudge}" filter="url(#pc-smudge)"/>`;
  out += hatch(inner, rng, pencil, s, rng.range(52, 62));
  if (s.cross) out += hatch(inner, rng, pencil, { ...s, opacity: s.opacity * 0.7, spacing: s.spacing * 1.4 }, rng.range(-62, -52) + 180);
  if (!clear) return out;
  const m = `pc-clear-${id}`;
  const b = bounds(area);
  const pad = 10;
  const box = `x="${r1(b.x - pad)}" y="${r1(b.y - pad)}" width="${r1(b.width + 2 * pad)}" height="${r1(b.height + 2 * pad)}"`;
  return `<mask id="${m}" maskUnits="userSpaceOnUse" ${box}><rect ${box} fill="#fff"/>` +
    `<rect x="${r1(clear.x)}" y="${r1(clear.y)}" width="${r1(clear.width)}" height="${r1(clear.height)}" rx="${r1(clear.height / 2)}" fill="#000" fill-opacity="${level === "light" ? 0.6 : 0.85}" filter="url(#pc-soft)" transform="rotate(${r1(rng.range(-3, 3))} ${r1(clear.x + clear.width / 2)} ${r1(clear.y + clear.height / 2)})"/>` +
    `</mask><g mask="url(#${m})">${out}</g>`;
}

// A large, soft tone for group backgrounds: smudge only, no hatching.
export function tone(poly, level) {
  const s = SHADE[level];
  if (!s) return "";
  return `<path d="${pathOf(insetPolygon(poly, 8))}" fill="${GRAPHITE}" opacity="${r1(s.smudge * 0.7 * 100) / 100}" filter="url(#pc-smudge)"/>`;
}

function hatch(poly, rng, pencil, s, angleDeg) {
  let out = "";
  const b = bounds(poly);
  const diag = Math.hypot(b.width, b.height);
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  const base = (angleDeg * Math.PI) / 180;
  const nx = -Math.sin(base), ny = Math.cos(base);
  // The hand drifts: angle and spacing wander slowly rather than jumping.
  let drift = 0;
  for (let k = -diag / 2; k <= diag / 2; k += s.spacing * rng.range(0.7, 1.3)) {
    drift = drift * 0.8 + rng.range(-0.03, 0.03);
    const a = base + drift;
    const d = { x: Math.cos(a), y: Math.sin(a) };
    const p = { x: cx + nx * k, y: cy + ny * k };
    for (const hit of clipToPolygon(poly, p, d)) {
      // Each end lands a bit inside or outside the edge.
      const t0 = hit[0] + rng.range(-1, 4), t1 = hit[1] - rng.range(-1, 4);
      if (t1 - t0 < 6) continue;
      const a0 = { x: p.x + d.x * t0, y: p.y + d.y * t0 }, a1 = { x: p.x + d.x * t1, y: p.y + d.y * t1 };
      // A quick flick of the wrist curves the stroke slightly.
      const bend = rng.range(-0.04, 0.04) * (t1 - t0);
      const c = { x: (a0.x + a1.x) / 2 - d.y * bend, y: (a0.y + a1.y) / 2 + d.x * bend };
      const opacity = s.opacity * rng.range(0.65, 1.15);
      const curve = (t) => {
        const u = 1 - t;
        return { x: u * u * a0.x + 2 * u * t * c.x + t * t * a1.x, y: u * u * a0.y + 2 * u * t * c.y + t * t * a1.y };
      };
      out += `<path d="${strokeOutline(curve, rng, { width: pencil.width * rng.range(0.55, 0.8), overshoot: 0, wobble: 0.25, taperIn: 0.12, taperOut: 0.4 })}" fill-opacity="${r1(opacity * 100) / 100}"/>`;
    }
  }
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
