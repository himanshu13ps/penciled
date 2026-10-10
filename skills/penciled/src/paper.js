// Paper and graphite: SVG filters and the page background.

export const GRAPHITE = "#34343a";
// Paper styles. "clean" (the default) is near-white sketchbook paper with
// only a fine tooth; "aged" is warm cream with blotches and darker edges; "bright"
// is crisp printer paper.
export const PAPER_STYLES = {
  aged: { color: "#f7f4ec", tooth: [0.45, -0.17], toothTint: [0.4, 0.38, 0.33], blotch: [0.3, -0.1], vignette: 0.14, groupTone: 1 },
  clean: { color: "#fbfaf7", tooth: [0.32, -0.13], toothTint: [0.42, 0.42, 0.42], blotch: null, vignette: 0.04, groupTone: 0.5 },
  bright: { color: "#fefefe", tooth: [0.22, -0.09], toothTint: [0.45, 0.45, 0.47], blotch: null, vignette: 0, groupTone: 0.45 },
};

// Filters are defined once per drawing. Turbulence seeds come from the
// drawing seed so grain is reproducible too.
export function defs(seed, style = PAPER_STYLES.clean) {
  const s = seed % 1000;
  const [tr, tg, tb] = style.toothTint;
  return `
<filter id="pc-graphite" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="${s}" result="tooth"/>
  <feColorMatrix in="tooth" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2.6 0 0 0 -0.45" result="mask"/>
  <feComposite in="SourceGraphic" in2="mask" operator="in" result="grainy"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="${s + 1}" result="warp"/>
  <feDisplacementMap in="grainy" in2="warp" scale="1.1" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<filter id="pc-smudge" x="-20%" y="-20%" width="140%" height="140%">
  <feGaussianBlur stdDeviation="5"/>
</filter>
<filter id="pc-soft" x="-30%" y="-30%" width="160%" height="160%">
  <feGaussianBlur stdDeviation="4"/>
</filter>
<filter id="pc-erased" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="${s + 2}" result="tooth"/>
  <feColorMatrix in="tooth" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3 0 0 0 -1.1" result="mask"/>
  <feComposite in="SourceGraphic" in2="mask" operator="in" result="grainy"/>
  <feGaussianBlur in="grainy" stdDeviation="0.7"/>
</filter>
<filter id="pc-paper" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="${s + 3}" result="fine"/>
  <feColorMatrix in="fine" type="matrix" values="0 0 0 0 ${tr} 0 0 0 0 ${tg} 0 0 0 0 ${tb} ${style.tooth[0]} 0 0 0 ${style.tooth[1]}" result="tooth"/>${style.blotch ? `
  <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" seed="${s + 4}" result="coarse"/>
  <feColorMatrix in="coarse" type="matrix" values="0 0 0 0 0.5 0 0 0 0 0.45 0 0 0 0 0.35 ${style.blotch[0]} 0 0 0 ${style.blotch[1]}" result="blotch"/>
  <feMerge><feMergeNode in="blotch"/><feMergeNode in="tooth"/></feMerge>` : ""}
</filter>
<filter id="pc-print" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.02 0.6" numOctaves="2" seed="${s + 5}" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1.6 0 0 0 -0.2" result="mask"/>
  <feComposite in="SourceGraphic" in2="mask" operator="in"/>
</filter>
<radialGradient id="pc-vignette" cx="50%" cy="45%" r="75%">
  <stop offset="60%" stop-color="#8a7f66" stop-opacity="0"/>
  <stop offset="100%" stop-color="#8a7f66" stop-opacity="${style.vignette}"/>
</radialGradient>`;
}

// Printed ruling for lined and grid paper: faint blue, slightly uneven in
// strength the way cheap print is, with a red margin on lined paper.
function ruling(width, height, texture) {
  if (texture === "lined") {
    let d = "";
    for (let y = 72; y < height; y += 30) d += `M0 ${y}H${width}`;
    return `<path d="${d}" stroke="#7d9cc4" stroke-width="0.9" stroke-opacity="0.35" fill="none" filter="url(#pc-print)"/>` +
      `<path d="M58 0V${height}" stroke="#d07070" stroke-width="1" stroke-opacity="0.4" fill="none" filter="url(#pc-print)"/>`;
  }
  if (texture === "grid") {
    let d = "";
    for (let x = 20; x < width; x += 20) d += `M${x} 0V${height}`;
    for (let y = 20; y < height; y += 20) d += `M0 ${y}H${width}`;
    return `<path d="${d}" stroke="#7d9cc4" stroke-width="0.7" stroke-opacity="0.28" fill="none" filter="url(#pc-print)"/>`;
  }
  return "";
}

export function background(width, height, texture = "plain", style = PAPER_STYLES.clean) {
  return `<rect width="${width}" height="${height}" fill="${style.color}"/>
${ruling(width, height, texture)}
<rect width="${width}" height="${height}" filter="url(#pc-paper)"/>
${style.vignette ? `<rect width="${width}" height="${height}" fill="url(#pc-vignette)"/>` : ""}`;
}
