// Automatic layout.
//
// A small layered ("Sugiyama-style") layout:
//   1. ranks     each node goes in a column (LR) or row (TB) by how far along
//                the flow it is; arrows that loop back are ignored for this
//   2. order     nodes within a rank are sorted to sit near their neighbours,
//                with members of a group kept together
//   3. place     ranks are spaced to leave room for arrow labels, and nodes
//                slide along their rank to line up with their neighbours
//   4. groups    each group's outline wraps its members and nested groups
//
// Work is done in (along, cross) coordinates and mapped to (x, y) at the end,
// so the same code serves both directions.

import { textWidth } from "./text.js";
import { overlaps } from "./geometry.js";

const NODE_GAP = 46;
const GROUP_PAD = 22;
const GROUP_LABEL = 28;
const EDGE_LABEL_SIZE = 18;

export function groupChains(diagram) {
  const parent = new Map((diagram.groups ?? []).map((g) => [g.id, g.parent]));
  const chainOf = (gid) => {
    const chain = [];
    const seen = new Set();
    while (gid && parent.has(gid) && !seen.has(gid)) {
      seen.add(gid);
      chain.unshift(gid);
      gid = parent.get(gid);
    }
    return chain;
  };
  const chains = new Map();
  for (const n of diagram.nodes) chains.set(n.id, chainOf(n.group));
  return { chains, chainOf };
}

// How many group outlines lie between two neighbouring nodes.
function boundaries(ca, cb) {
  let i = 0;
  while (i < ca.length && i < cb.length && ca[i] === cb[i]) i++;
  return ca.length - i + (cb.length - i);
}

function assignRanks(ids, edges) {
  const out = new Map(ids.map((id) => [id, []]));
  const inn = new Map(ids.map((id) => [id, []]));
  // Drop edges that close a cycle, found by depth-first search in input order.
  const state = new Map();
  const forward = [];
  const visit = (v) => {
    state.set(v, 1);
    for (const e of edges.filter((e) => e.from === v)) {
      const s = state.get(e.to);
      if (s === 1) continue; // back edge
      forward.push(e);
      if (!s) visit(e.to);
    }
    state.set(v, 2);
  };
  for (const id of ids) if (!state.has(id)) visit(id);
  for (const e of forward) {
    out.get(e.from).push(e.to);
    inn.get(e.to).push(e.from);
  }

  const rank = new Map();
  const rankOf = (v) => {
    if (rank.has(v)) return rank.get(v);
    rank.set(v, 0);
    const r = inn.get(v).length ? Math.max(...inn.get(v).map((u) => rankOf(u) + 1)) : 0;
    rank.set(v, r);
    return r;
  };
  for (const id of ids) rankOf(id);
  // Sources sit just before the first node they feed, not all at the start.
  for (const id of ids) {
    if (!inn.get(id).length && out.get(id).length) rank.set(id, Math.max(0, Math.min(...out.get(id).map((w) => rank.get(w))) - 1));
  }
  return rank;
}

export function layout(diagram, sizes, { top = 0, margin = 60 } = {}) {
  const ids = diagram.nodes.map((n) => n.id);
  const known = new Set(ids);
  const edges = (diagram.edges ?? []).filter((e) => known.has(e.from) && known.has(e.to) && e.from !== e.to);
  const { chains } = groupChains(diagram);
  const vertical = diagram.direction === "TB";
  const rects = new Map();

  if (diagram.nodes.every((n) => n.position)) {
    for (const n of diagram.nodes) {
      const s = sizes.get(n.id);
      rects.set(n.id, { x: n.position.x - s.width / 2, y: n.position.y - s.height / 2, ...s });
    }
  } else {
    autoPlace(diagram, ids, edges, chains, sizes, vertical, rects);
  }

  separateGroups(diagram, rects, chains, vertical);
  let groups = groupRects(diagram, rects, chains);
  nudgeOutOfGroups(diagram, rects, chains, vertical, () => (groups = groupRects(diagram, rects, chains)));
  groups = groupRects(diagram, rects, chains);

  // Move everything so the drawing starts at the margin.
  const all = [...rects.values(), ...groups.values()];
  const minX = Math.min(...all.map((r) => r.x)), minY = Math.min(...all.map((r) => r.y));
  const dx = margin - minX, dy = margin + top - minY;
  for (const r of all) { r.x += dx; r.y += dy; }
  const width = Math.ceil(Math.max(...all.map((r) => r.x + r.width)) + margin);
  const height = Math.ceil(Math.max(...all.map((r) => r.y + r.height)) + margin);
  return { rects, groups, width, height };
}

function autoPlace(diagram, ids, edges, chains, sizes, vertical, rects) {
  // With no arrows at all there is no flow to follow: lay nodes out in a line.
  const rank = edges.length ? assignRanks(ids, edges) : new Map(ids.map((id, i) => [id, i]));
  const nRanks = Math.max(...rank.values()) + 1;
  const along = (id) => (vertical ? sizes.get(id).height : sizes.get(id).width);
  const cross = (id) => (vertical ? sizes.get(id).width : sizes.get(id).height);

  const neighbours = new Map(ids.map((id) => [id, []]));
  for (const e of edges) {
    neighbours.get(e.from).push(e.to);
    neighbours.get(e.to).push(e.from);
  }

  // 2. Order within ranks. Sweep down then up, one rank at a time, sorting
  // each rank by where its neighbours in the rank just visited sit. Keep the
  // ordering with the fewest crossings seen.
  const ranks = Array.from({ length: nRanks }, () => []);
  for (const id of ids) ranks[rank.get(id)].push(id);
  const pos = new Map();
  const index = (r) => r.forEach((id, i) => pos.set(id, i - (r.length - 1) / 2));
  ranks.forEach(index);

  const cmpFor = (key) => {
    // A group's key is the average of its members', so whole groups keep the
    // same order in every rank.
    const gsum = new Map();
    for (const id of ids) for (const g of chains.get(id)) {
      const t = gsum.get(g) ?? { s: 0, n: 0 };
      t.s += key.get(id) ?? pos.get(id); t.n++;
      gsum.set(g, t);
    }
    const gkey = (g) => gsum.get(g).s / gsum.get(g).n;
    return (a, b) => {
      const ca = chains.get(a), cb = chains.get(b);
      for (let d = 0; ; d++) {
        const ea = ca[d], eb = cb[d];
        if (ea && eb && ea === eb) continue;
        const ka = ea ? gkey(ea) : key.get(a), kb = eb ? gkey(eb) : key.get(b);
        if (ka !== kb) return ka - kb;
        return (ea ?? a) < (eb ?? b) ? -1 : 1;
      }
    };
  };

  // Crossings between arrows whose rank spans overlap, judged by which side
  // of each other they are on at both ends of the overlap.
  const spans = edges.map((e) => {
    const [a, b] = rank.get(e.from) <= rank.get(e.to) ? [e.from, e.to] : [e.to, e.from];
    return { a, b, ra: rank.get(a), rb: rank.get(b) };
  }).filter((e) => e.ra < e.rb);
  const at = (e, r) => pos.get(e.a) + ((pos.get(e.b) - pos.get(e.a)) * (r - e.ra)) / (e.rb - e.ra);
  const crossings = () => {
    let n = 0;
    for (let i = 0; i < spans.length; i++)
      for (let j = i + 1; j < spans.length; j++) {
        const e = spans[i], f = spans[j];
        if (e.a === f.a || e.b === f.b || e.a === f.b || e.b === f.a) continue;
        const lo = Math.max(e.ra, f.ra), hi = Math.min(e.rb, f.rb);
        if (lo >= hi) continue;
        if ((at(e, lo) - at(f, lo)) * (at(e, hi) - at(f, hi)) < 0) n++;
      }
    return n;
  };

  let best = { n: crossings(), order: ranks.map((r) => [...r]) };
  for (let sweep = 0; sweep < 12 && best.n > 0; sweep++) {
    const down = sweep % 2 === 0;
    const order = down ? [...ranks.keys()].slice(1) : [...ranks.keys()].reverse().slice(1);
    for (const r of order) {
      const key = new Map();
      for (const id of ranks[r]) {
        const nb = neighbours.get(id).filter((w) => (down ? rank.get(w) < r : rank.get(w) > r));
        if (nb.length) key.set(id, nb.reduce((sum, w) => sum + pos.get(w), 0) / nb.length);
        else key.set(id, pos.get(id));
      }
      ranks[r].sort(cmpFor(key));
      index(ranks[r]);
    }
    const n = crossings();
    if (n < best.n) best = { n, order: ranks.map((r) => [...r]) };
  }
  best.order.forEach((r, i) => { ranks[i] = r; index(r); });

  // 3a. Space the ranks: wide enough for the longest arrow label crossing the gap.
  const gapAfter = new Array(nRanks).fill(vertical ? 90 : 110);
  for (const e of edges) {
    if (!e.label) continue;
    const ra = rank.get(e.from), rb = rank.get(e.to);
    if (ra === rb) continue;
    const need = vertical ? EDGE_LABEL_SIZE * 2.6 : textWidth(e.label, EDGE_LABEL_SIZE) + 50;
    const r = Math.min(ra, rb);
    gapAfter[r] = Math.max(gapAfter[r], need);
  }
  const maxDepth = Math.max(0, ...[...chains.values()].map((c) => c.length));
  const groupRoom = maxDepth ? GROUP_PAD + (vertical ? GROUP_LABEL : 0) : 0;
  const rankPos = [];
  let a = 0;
  for (let r = 0; r < nRanks; r++) {
    const size = Math.max(...ranks[r].map(along));
    rankPos.push(a + size / 2);
    a += size + gapAfter[r] + groupRoom;
  }

  // 3b. Slide nodes along their rank. Minimum spacing between neighbours
  // grows with the group outlines (and LR group labels) between them.
  const sep = (p, q) => {
    const cp = chains.get(p), cq = chains.get(q);
    let i = 0;
    while (i < cp.length && i < cq.length && cp[i] === cq[i]) i++;
    const entered = cq.length - i;
    return cross(p) / 2 + cross(q) / 2 + NODE_GAP + GROUP_PAD * boundaries(cp, cq) + (vertical ? 0 : GROUP_LABEL * entered);
  };
  const c = new Map();
  for (const r of ranks) {
    let y = 0;
    r.forEach((id, i) => {
      y = i === 0 ? 0 : y + sep(r[i - 1], id);
      c.set(id, y);
    });
    const mid = y / 2;
    for (const id of r) c.set(id, c.get(id) - mid);
  }
  for (let pass = 0; pass < 12; pass++) {
    const order = pass % 2 ? [...ranks].reverse() : ranks;
    for (const r of order) {
      const want = r.map((id) => {
        const nb = neighbours.get(id).filter((w) => rank.get(w) !== rank.get(id));
        return nb.length ? nb.reduce((s, w) => s + c.get(w), 0) / nb.length : c.get(id);
      });
      const placed = [];
      r.forEach((id, i) => {
        placed.push(i === 0 ? want[0] : Math.max(want[i], placed[i - 1] + sep(r[i - 1], id)));
      });
      // Shift the whole rank back so, on average, nodes sit where they want.
      const shift = placed.reduce((s, p, i) => s + (want[i] - p), 0) / placed.length;
      r.forEach((id, i) => c.set(id, placed[i] + shift));
    }
  }

  for (const id of ids) {
    const s = sizes.get(id);
    const al = rankPos[rank.get(id)], cr = c.get(id);
    rects.set(id, vertical
      ? { x: cr - s.width / 2, y: al - s.height / 2, ...s }
      : { x: al - s.width / 2, y: cr - s.height / 2, ...s });
  }
}

// Outline for each group: around its members and nested groups, with room
// for the label at the top. Empty groups get no outline.
export function groupRects(diagram, rects, chains) {
  const out = new Map();
  const groups = diagram.groups ?? [];
  const depth = (g) => {
    let d = 0, p = g.parent;
    const seen = new Set();
    while (p && !seen.has(p)) { seen.add(p); d++; p = groups.find((x) => x.id === p)?.parent; }
    return d;
  };
  for (const g of [...groups].sort((p, q) => depth(q) - depth(p))) {
    const inside = [];
    for (const n of diagram.nodes) if (chains.get(n.id).includes(g.id)) inside.push(rects.get(n.id));
    for (const h of groups) if (h.parent === g.id && out.has(h.id)) inside.push(out.get(h.id));
    if (!inside.length) continue;
    const x0 = Math.min(...inside.map((r) => r.x)) - GROUP_PAD;
    const y0 = Math.min(...inside.map((r) => r.y)) - GROUP_PAD - GROUP_LABEL;
    const x1 = Math.max(...inside.map((r) => r.x + r.width)) + GROUP_PAD;
    const y1 = Math.max(...inside.map((r) => r.y + r.height)) + GROUP_PAD;
    out.set(g.id, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  }
  return out;
}

// Two groups side by side in the flow can't share space: a group spans every
// rank its members are in, so sibling groups that overlap are moved apart
// across the flow, together with everything beyond them.
function separateGroups(diagram, rects, chains, vertical) {
  const parent = new Map((diagram.groups ?? []).map((g) => [g.id, g.parent]));
  const key = vertical ? "x" : "y", size = vertical ? "width" : "height";
  for (let round = 0; round < 30; round++) {
    const groups = groupRects(diagram, rects, chains);
    const list = [...groups.keys()];
    let moved = false;
    for (let i = 0; i < list.length && !moved; i++) {
      for (let j = i + 1; j < list.length && !moved; j++) {
        const g = list[i], h = list[j];
        if (parent.get(g) !== parent.get(h)) continue;
        const rg = groups.get(g), rh = groups.get(h);
        if (!overlaps(rg, rh)) continue;
        const [first, second] = rg[key] + rg[size] / 2 <= rh[key] + rh[size] / 2 ? [g, h] : [h, g];
        const ra = groups.get(first), rb = groups.get(second);
        const delta = ra[key] + ra[size] + 18 - rb[key];
        for (const n of diagram.nodes) {
          const c = chains.get(n.id), r = rects.get(n.id);
          if (c.includes(first)) continue;
          if (c.includes(second) || r[key] + r[size] / 2 >= rb[key]) r[key] += delta;
        }
        moved = true;
      }
    }
    if (!moved) return;
  }
}

// A node that isn't in a group but ended up inside its outline is pushed
// out sideways, along with the nodes beyond it in the same rank.
function nudgeOutOfGroups(diagram, rects, chains, vertical, refresh) {
  for (let round = 0; round < 20; round++) {
    const groups = groupRects(diagram, rects, chains);
    let moved = false;
    for (const [gid, gr] of groups) {
      for (const n of diagram.nodes) {
        if (chains.get(n.id).includes(gid)) continue;
        const r = rects.get(n.id);
        if (!overlaps(r, gr)) continue;
        const key = vertical ? "x" : "y";
        const size = vertical ? "width" : "height";
        const nodeMid = r[key] + r[size] / 2, groupMid = gr[key] + gr[size] / 2;
        const down = nodeMid >= groupMid;
        const delta = down ? gr[key] + gr[size] + 16 - r[key] : gr[key] - 16 - (r[key] + r[size]);
        const along = vertical ? "y" : "x";
        for (const m of rects.values()) {
          const sameRank = Math.abs(m[along] + (vertical ? m.height : m.width) / 2 - (r[along] + (vertical ? r.height : r.width) / 2)) < 1;
          if (sameRank && (down ? m[key] >= r[key] : m[key] <= r[key])) m[key] += delta;
        }
        moved = true;
      }
    }
    refresh();
    if (!moved) return;
  }
}
