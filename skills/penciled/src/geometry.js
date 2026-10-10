// Plain geometry helpers shared by shapes, layout and arrows.

export const r1 = (n) => Math.round(n * 10) / 10;

export const center = (rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

export function inflate(rect, by) {
  return { x: rect.x - by, y: rect.y - by, width: rect.width + 2 * by, height: rect.height + 2 * by };
}

export function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function rectPolygon({ x, y, width: w, height: h }) {
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
}

// Points around an ellipse, from angle a0 to a1 (radians, clockwise on screen).
export function ellipsePoints(cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, steps = 32) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return pts;
}

// A centre line through a list of points, parameterised by distance travelled
// so that t=0.5 really is halfway. Values of t a little outside [0, 1] carry
// on along the first or last segment, which is how overshoot works.
export function polyline(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = cum[cum.length - 1] || 1;
  return (t) => {
    const d = t * total;
    let i = 1;
    if (d <= 0) i = 1;
    else if (d >= total) i = pts.length - 1;
    else while (cum[i] < d) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const u = (d - cum[i - 1]) / seg;
    return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u };
  };
}

// Pieces of a line (through p, direction d) that lie inside a polygon, as
// [t0, t1] pairs along d.
export function clipToPolygon(poly, p, d) {
  const ts = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x, ey = b.y - a.y;
    const den = d.x * ey - d.y * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a.x - p.x) * ey - (a.y - p.y) * ex) / den;
    const s = ((a.x - p.x) * d.y - (a.y - p.y) * d.x) / den;
    if (s >= 0 && s < 1) ts.push(t);
  }
  ts.sort((m, n) => m - n);
  const out = [];
  for (let i = 0; i + 1 < ts.length; i += 2) out.push([ts[i], ts[i + 1]]);
  return out;
}

// Where a ray from `from` towards `toward` first leaves a polygon that
// contains `from`.
export function rayExit(poly, from, toward) {
  const len = Math.hypot(toward.x - from.x, toward.y - from.y) || 1;
  const d = { x: (toward.x - from.x) / len, y: (toward.y - from.y) / len };
  let best = Infinity;
  for (const [, t1] of clipToPolygon(poly, from, d)) if (t1 > 0 && t1 < best) best = t1;
  if (best === Infinity) best = 0;
  return { x: from.x + d.x * best, y: from.y + d.y * best };
}

// Shrink a roughly convex polygon towards its centroid by `by` px.
export function insetPolygon(poly, by) {
  const c = poly.reduce((acc, p) => ({ x: acc.x + p.x / poly.length, y: acc.y + p.y / poly.length }), { x: 0, y: 0 });
  return poly.map((p) => {
    const dist = Math.hypot(p.x - c.x, p.y - c.y) || 1;
    const k = Math.max(0, 1 - by / dist);
    return { x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k };
  });
}

export function quadPoint(a, c, b, t) {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}
