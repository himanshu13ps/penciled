// Pencil strokes.
//
// A stroke is not an SVG line. It is a filled outline around a wobbly centre
// line, with a width that ramps up as the pencil lands, varies with pressure
// and thins out as the pencil lifts. Several light passes over the same line
// build up graphite the way a real pencil does.

export const PENCILS = {
  HB: { width: 1.3, opacity: 0.62 },
  "2B": { width: 1.6, opacity: 0.74 },
  "4B": { width: 2.0, opacity: 0.86 },
};

const r1 = (n) => Math.round(n * 10) / 10;

// Centre-line helpers. Each returns t in [0, 1] -> {x, y}.
export const line = (a, b) => (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export const quad = (a, c, b) => (t) => {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
};

// Smooth path through points (Catmull-Rom as cubic Béziers), written with
// relative coordinates to keep the SVG small.
function smoothPath(pts, closed) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let px = r1(pts[0].x), py = r1(pts[0].y);
  let d = `M${px} ${py}`;
  const rel = (v, o) => r1(v - o);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    const ex = r1(p2.x), ey = r1(p2.y);
    d += `c${rel(c1x, px)} ${rel(c1y, py)} ${rel(c2x, px)} ${rel(c2y, py)} ${rel(ex, px)} ${rel(ey, py)}`;
    px = ex; py = ey;
  }
  return (d + (closed ? "Z" : "")).replace(/ -/g, "-");
}

/**
 * Outline of one pencil pass along `center`, as an SVG path `d`.
 *
 * options:
 *   width      full stroke width in px
 *   overshoot  px the line may run past each end (hands overshoot corners)
 *   wobble     px of slow sideways drift along the line
 *   bow        fraction of the length the whole line may sag to one side
 *   taperIn    fraction of the length spent landing the pencil
 *   taperOut   fraction spent lifting it
 */
export function strokeOutline(center, rng, options = {}) {
  const {
    width = 1.6,
    overshoot = 3,
    wobble = 0.7,
    bow = 0.006,
    taperIn = 0.06,
    taperOut = 0.18,
  } = options;

  const a = center(0), b = center(1);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;

  // Extend or shorten the ends a little: the pencil rarely starts and stops exactly on the mark.
  const t0 = -rng.range(-0.3, 1) * overshoot / len;
  const t1 = 1 + rng.range(-0.3, 1) * overshoot / len;

  const bowAmp = rng.range(-bow, bow) * len;
  const waves = [
    { amp: wobble, freq: rng.range(0.6, 1.4) * Math.max(1, len / 140), phase: rng.range(0, 6.28) },
    { amp: wobble * 0.35, freq: rng.range(0.8, 1.2) * Math.max(2, len / 35), phase: rng.range(0, 6.28) },
  ];
  const press = { freq: rng.range(1, 2.5), phase: rng.range(0, 6.28) };
  const startShift = rng.range(-1, 1) * wobble;
  const endShift = rng.range(-1, 1) * wobble;

  const samples = Math.max(6, Math.ceil(len / 8));
  const left = [], right = [];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const t = t0 + (t1 - t0) * u;
    // Tangent and normal, from the centre line itself, so curves work too.
    const p = center(t);
    const q = center(t + 0.001);
    let tx = q.x - p.x, ty = q.y - p.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    const nx = -ty, ny = tx;

    let off = bowAmp * Math.sin(Math.PI * u) + startShift * (1 - u) + endShift * u;
    for (const w of waves) off += w.amp * Math.sin(w.freq * Math.PI * 2 * u + w.phase);

    let profile = 1;
    if (u < taperIn) profile = 0.35 + 0.65 * (u / taperIn);
    else if (u > 1 - taperOut) profile = 0.12 + 0.88 * ((1 - u) / taperOut);
    profile *= 1 + 0.18 * Math.sin(press.freq * Math.PI * 2 * u + press.phase);
    const hw = (width * profile) / 2;

    const cx = p.x + nx * off, cy = p.y + ny * off;
    left.push({ x: cx + nx * hw, y: cy + ny * hw });
    right.push({ x: cx - nx * hw, y: cy - ny * hw });
  }
  return smoothPath(left.concat(right.reverse()), true);
}

/**
 * A full pencil line: one firm pass, and often a lighter second pass that
 * doesn't quite follow the first. Returns SVG markup.
 */
export function pencilLine(center, rng, pencil, options = {}) {
  const { passes = 2, opacity = 1, width = 1 } = options;
  const base = { ...options, width: pencil.width * width };
  let out = `<path d="${strokeOutline(center, rng, base)}" fill-opacity="${r1(pencil.opacity * opacity * 100) / 100}"/>`;
  if (passes > 1 && rng.chance(0.75)) {
    const second = { ...base, width: base.width * 0.75, wobble: (options.wobble ?? 0.7) * 1.3, overshoot: (options.overshoot ?? 3) * 0.6 };
    out += `<path d="${strokeOutline(center, rng, second)}" fill-opacity="${r1(pencil.opacity * opacity * 45) / 100}"/>`;
  }
  return out;
}
