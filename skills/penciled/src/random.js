// Seeded random numbers, so the same input and seed always give the same drawing.

export function createRandom(seed) {
  let a = seed >>> 0;
  const next = () => {
    // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
  };
}
