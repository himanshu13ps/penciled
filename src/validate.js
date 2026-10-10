// Validator: is this diagram input correct, and will it draw well?
//
// Three layers, each only run if the one before found no errors:
//   1. schema     the JSON matches schema/architecture.schema.json (checked by
//                 a small built-in interpreter, so there are no dependencies
//                 and the schema file stays the single source of truth)
//   2. references ids are unique, arrows and groups point at things that
//                 exist, group nesting has no loops
//   3. layout     lay the diagram out exactly as render() would and look for
//                 things that will draw badly: overlaps, arrows through nodes,
//                 crossing arrows, crowded labels
//
// Errors mean the input can't be drawn as written. Warnings mean it can, but
// probably won't look the way the author wants. Every message says what to
// change, because the reader is often an agent fixing its own output.

import { readFileSync } from "node:fs";
import { plan } from "./render.js";
import { overlaps, quadPoint } from "./geometry.js";
import { measureLines } from "./text.js";

const SCHEMA = JSON.parse(readFileSync(new URL("../schema/architecture.schema.json", import.meta.url), "utf8"));

const LABEL_SIZE = 24;

// ---------------------------------------------------------------- 1. schema

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v)) return "integer";
  return typeof v;
}

function typeMatches(v, type) {
  const t = typeOf(v);
  return t === type || (type === "number" && t === "integer");
}

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function closest(word, options) {
  let best = null, bestD = 3;
  for (const o of options) {
    const dist = editDistance(word.toLowerCase(), String(o).toLowerCase());
    if (dist < bestD) { best = o; bestD = dist; }
  }
  return best;
}

const show = (v) => JSON.stringify(v);
const join = (path, key) => (typeof key === "number" ? `${path}[${key}]` : path ? `${path}.${key}` : key);

function resolve(schema) {
  while (schema.$ref) schema = schema.$ref.slice(2).split("/").reduce((o, k) => o[k], SCHEMA);
  return schema;
}

function checkSchema(value, schema, path, errors) {
  schema = resolve(schema);
  const at = path || "(top level)";
  for (const sub of schema.allOf ?? []) checkSchema(value, sub, path, errors);

  if ("const" in schema && value !== schema.const) {
    errors.push({ path: at, code: "schema", message: `must be ${show(schema.const)} (got ${show(value)})` });
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    const guess = typeof value === "string" ? closest(value, schema.enum) : null;
    errors.push({ path: at, code: "schema", message: `must be one of ${schema.enum.join(", ")} (got ${show(value)})${guess ? `; did you mean "${guess}"?` : ""}` });
    return;
  }
  if (schema.type && !typeMatches(value, schema.type)) {
    errors.push({ path: at, code: "schema", message: `must be ${schema.type === "array" || schema.type === "object" || schema.type === "integer" ? "an" : "a"} ${schema.type} (got ${typeOf(value)})` });
    return;
  }

  if (typeof value === "string") {
    const len = [...value].length;
    if (schema.minLength != null && len < schema.minLength) errors.push({ path: at, code: "schema", message: schema.minLength === 1 ? "must not be empty" : `must be at least ${schema.minLength} characters` });
    if (schema.maxLength != null && len > schema.maxLength) errors.push({ path: at, code: "schema", message: `must be at most ${schema.maxLength} characters (got ${len}); shorten it or move detail into a sublabel` });
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) {
      const isId = schema.pattern === SCHEMA.$defs.id.pattern;
      errors.push({ path: at, code: "schema", message: isId ? `${show(value)} is not a valid id: start with a letter, then use letters, digits, '_' or '-' (max 40)` : `${show(value)} must match ${schema.pattern}` });
    }
  }
  if (typeof value === "number") {
    if (schema.minimum != null && value < schema.minimum) errors.push({ path: at, code: "schema", message: `must be at least ${schema.minimum} (got ${value})` });
    if (schema.maximum != null && value > schema.maximum) errors.push({ path: at, code: "schema", message: `must be at most ${schema.maximum} (got ${value})` });
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push({ path: at, code: "schema", message: schema.minItems === 1 ? "must have at least one item" : `must have at least ${schema.minItems} items` });
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push({ path: at, code: "schema", message: `must have at most ${schema.maxItems} items (got ${value.length}); split the diagram into smaller ones` });
    if (schema.items) value.forEach((item, i) => checkSchema(item, schema.items, join(path, i), errors));
  }
  if (typeOf(value) === "object") {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push({ path: at, code: "schema", message: `missing required field "${key}"` });
    }
    const props = schema.properties ?? {};
    for (const [key, v] of Object.entries(value)) {
      if (key in props) checkSchema(v, props[key], join(path, key), errors);
      else if (schema.additionalProperties === false) {
        const guess = closest(key, Object.keys(props));
        errors.push({ path: at, code: "schema", message: `unknown field "${key}"${guess ? `; did you mean "${guess}"?` : ` (allowed: ${Object.keys(props).join(", ")})`}` });
      }
    }
  }
}

// ------------------------------------------------------------ 2. references

function checkReferences(d, errors, warnings) {
  const nodeIds = new Set(), groupIds = new Set();
  const seen = new Map();
  d.nodes.forEach((n, i) => {
    if (seen.has(n.id)) errors.push({ path: `nodes[${i}].id`, code: "duplicate-id", message: `id "${n.id}" is already used by ${seen.get(n.id)}; ids must be unique across nodes and groups` });
    else seen.set(n.id, `nodes[${i}]`);
    nodeIds.add(n.id);
  });
  (d.groups ?? []).forEach((g, i) => {
    if (seen.has(g.id)) errors.push({ path: `groups[${i}].id`, code: "duplicate-id", message: `id "${g.id}" is already used by ${seen.get(g.id)}; ids must be unique across nodes and groups` });
    else seen.set(g.id, `groups[${i}]`);
    groupIds.add(g.id);
  });

  const suggest = (id, pool) => {
    const g = closest(id, [...pool]);
    return g ? `. Did you mean "${g}"?` : "";
  };

  d.nodes.forEach((n, i) => {
    if (n.group == null) return;
    if (nodeIds.has(n.group)) errors.push({ path: `nodes[${i}].group`, code: "unknown-group", message: `"${n.group}" is a node, not a group; a node can only sit inside a group` });
    else if (!groupIds.has(n.group)) errors.push({ path: `nodes[${i}].group`, code: "unknown-group", message: `no group with id "${n.group}"${suggest(n.group, groupIds) || '; add it to "groups" or remove this field'}` });
  });

  const parent = new Map();
  (d.groups ?? []).forEach((g, i) => {
    if (g.parent == null) return;
    if (g.parent === g.id) errors.push({ path: `groups[${i}].parent`, code: "group-cycle", message: `group "${g.id}" can't be its own parent` });
    else if (!groupIds.has(g.parent)) errors.push({ path: `groups[${i}].parent`, code: "unknown-group", message: `no group with id "${g.parent}"${suggest(g.parent, groupIds)}` });
    else parent.set(g.id, g.parent);
  });
  // Loops in nesting: follow parents from each group.
  const reported = new Set();
  for (const start of parent.keys()) {
    const chain = [start];
    let p = parent.get(start);
    while (p && !chain.includes(p)) { chain.push(p); p = parent.get(p); }
    if (p && !reported.has(p)) {
      const loop = chain.slice(chain.indexOf(p));
      loop.forEach((g) => reported.add(g));
      errors.push({ path: "groups", code: "group-cycle", message: `groups nest in a loop: ${[...loop, p].join(" → ")}; remove one "parent"` });
    }
  }

  const edgeSeen = new Map();
  (d.edges ?? []).forEach((e, i) => {
    for (const end of ["from", "to"]) {
      const id = e[end];
      if (groupIds.has(id)) errors.push({ path: `edges[${i}].${end}`, code: "edge-to-group", message: `"${id}" is a group; arrows connect nodes, so point it at a node inside the group` });
      else if (!nodeIds.has(id)) errors.push({ path: `edges[${i}].${end}`, code: "unknown-node", message: `no node with id "${id}"${suggest(id, nodeIds)}` });
    }
    if (e.from === e.to) warnings.push({ path: `edges[${i}]`, code: "self-loop", message: `arrow from "${e.from}" to itself is not drawn; remove it or describe the loop in a label` });
    const key = `${e.from}→${e.to}`;
    if (edgeSeen.has(key)) warnings.push({ path: `edges[${i}]`, code: "duplicate-edge", message: `same arrow as ${edgeSeen.get(key)} (${e.from} → ${e.to}); merge them or give each a different label` });
    else edgeSeen.set(key, `edges[${i}]`);
  });

  const withPos = d.nodes.filter((n) => n.position).length;
  if (withPos && withPos < d.nodes.length) {
    const missing = d.nodes.filter((n) => !n.position).map((n) => n.id);
    errors.push({ path: "nodes", code: "partial-positions", message: `${withPos} of ${d.nodes.length} nodes have a position; give every node a position or none. Missing: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", …" : ""}` });
  }

  // Empty groups and loose nodes: legal, but rarely intended.
  for (const [i, g] of (d.groups ?? []).entries()) {
    const used = d.nodes.some((n) => n.group === g.id) || (d.groups ?? []).some((h) => h.parent === g.id);
    if (!used) warnings.push({ path: `groups[${i}]`, code: "empty-group", message: `group "${g.id}" has no nodes, so it won't be drawn; set "group": "${g.id}" on its nodes or remove it` });
  }
  if ((d.edges ?? []).length) {
    const linked = new Set((d.edges ?? []).flatMap((e) => [e.from, e.to]));
    d.nodes.forEach((n, i) => {
      if (!linked.has(n.id)) warnings.push({ path: `nodes[${i}]`, code: "isolated-node", message: `node "${n.id}" has no arrows${d.nodes.every((m) => m.position) ? "; check it isn't missing a connection" : "; it will be placed at the start of the flow"}` });
    });
  }
}

// ----------------------------------------------------------------- 3. layout

function curvePoints(path, n = 24) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(quadPoint(path.from, path.ctrl, path.to, i / n));
  return pts;
}

function segmentsCross(p1, p2, p3, p4) {
  const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function curvesCross(a, b) {
  for (let i = 1; i < a.length; i++)
    for (let j = 1; j < b.length; j++)
      if (segmentsCross(a[i - 1], a[i], b[j - 1], b[j])) return true;
  return false;
}

const inside = (p, r) => p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;

function checkLayout(d, warnings, options) {
  const p = plan(d, options);
  const auto = !d.nodes.every((n) => n.position);
  const idx = new Map(d.nodes.map((n, i) => [n.id, i]));
  const shrink = (r, by) => ({ x: r.x + by, y: r.y + by, width: r.width - 2 * by, height: r.height - 2 * by });

  // Nodes on top of each other (usually manual positions).
  const ids = d.nodes.map((n) => n.id);
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++)
      if (overlaps(shrink(p.rects.get(ids[i]), 2), shrink(p.rects.get(ids[j]), 2)))
        warnings.push({ path: `nodes[${i}]`, code: "node-overlap", message: `node "${ids[i]}" overlaps "${ids[j]}"; move their positions further apart` });

  // Nodes inside groups they don't belong to, and sibling groups overlapping.
  const groups = d.groups ?? [];
  const parent = new Map(groups.map((g) => [g.id, g.parent]));
  const ancestors = (gid) => {
    const out = [];
    for (let g = gid; g && !out.includes(g); g = parent.get(g)) out.push(g);
    return out;
  };
  for (const n of d.nodes) {
    const mine = ancestors(n.group);
    for (const [gid, gr] of p.groups) {
      if (mine.includes(gid)) continue;
      if (overlaps(shrink(p.rects.get(n.id), 2), gr))
        warnings.push({ path: `nodes[${idx.get(n.id)}]`, code: "node-in-other-group", message: `node "${n.id}" is drawn inside group "${gid}" but isn't a member; ${auto ? `add "group": "${gid}" if it belongs there` : "move it outside the group's members"}` });
    }
  }
  const gids = [...p.groups.keys()];
  for (let i = 0; i < gids.length; i++)
    for (let j = i + 1; j < gids.length; j++) {
      const a = gids[i], b = gids[j];
      if (ancestors(a).includes(b) || ancestors(b).includes(a)) continue;
      if (overlaps(p.groups.get(a), p.groups.get(b)))
        warnings.push({ path: "groups", code: "group-overlap", message: `groups "${a}" and "${b}" overlap; ${auto ? "a node in one is probably linked to nodes deep in the other; try switching direction or nesting one group in the other" : "move their members apart"}` });
    }

  // Arrows through nodes, and arrows crossing each other.
  const curves = p.arrows.map((a) => curvePoints(a.path));
  p.arrows.forEach((a, k) => {
    const ei = (d.edges ?? []).indexOf(a.edge);
    const through = d.nodes.filter((n) => n.id !== a.edge.from && n.id !== a.edge.to && curves[k].slice(1, -1).some((pt) => inside(pt, shrink(p.rects.get(n.id), 4)))).map((n) => n.id);
    if (through.length)
      warnings.push({ path: `edges[${ei}]`, code: "arrow-through-node", message: `arrow ${a.edge.from} → ${a.edge.to} passes through ${through.map((t) => `"${t}"`).join(", ")}; ${auto ? "try the other direction (LR/TB), or reorder nodes so linked ones sit closer" : "move the nodes so the path is clear"}` });
  });
  const crossings = [];
  for (let i = 0; i < p.arrows.length; i++)
    for (let j = i + 1; j < p.arrows.length; j++) {
      const a = p.arrows[i].edge, b = p.arrows[j].edge;
      if (a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to) continue;
      if (curvesCross(curves[i], curves[j])) crossings.push(`${a.from} → ${a.to} × ${b.from} → ${b.to}`);
    }
  if (crossings.length)
    warnings.push({ path: "edges", code: "arrow-crossings", message: `${crossings.length} arrow crossing${crossings.length > 1 ? "s" : ""}: ${crossings.slice(0, 4).join("; ")}${crossings.length > 4 ? "; …" : ""}. ${auto ? "Try the other direction, or move one end into the same group as the other" : "Rearrange positions to untangle them"}` });

  // Arrow labels with nowhere clear to go.
  for (const a of p.arrows) {
    if (a.label && !a.label.clear) {
      const ei = (d.edges ?? []).indexOf(a.edge);
      warnings.push({ path: `edges[${ei}].label`, code: "label-crowded", message: `label "${a.edge.label}" has no clear space and may overlap other text; shorten it or space the nodes out` });
    }
  }

  // Labels that don't fit a manually sized node.
  d.nodes.forEach((n, i) => {
    if (!n.size) return;
    const w = measureLines(n.label.split("\n"), LABEL_SIZE);
    if (w + 16 > n.size.width) warnings.push({ path: `nodes[${i}].size`, code: "label-overflow", message: `label "${n.label.replace(/\n/g, " ")}" needs about ${Math.ceil(w + 16)}px but the node is ${n.size.width}px wide; widen it, add a line break, or drop "size"` });
  });

  // Very long, thin drawings are hard to read.
  const ratio = p.page.width / p.page.height;
  if (auto && (ratio > 3 || ratio < 1 / 3)) {
    const flip = (d.direction ?? "LR") === "LR" ? "TB" : "LR";
    warnings.push({ path: "direction", code: "aspect", message: `the drawing is ${ratio > 1 ? "very wide" : "very tall"} (${p.page.width}×${p.page.height}); try "direction": "${flip}"` });
  }
}

/**
 * Check a diagram. Returns { valid, errors, warnings }; each problem is
 * { path, code, message }. `valid` is false only when there are errors.
 */
export function validate(diagram, options = {}) {
  const errors = [], warnings = [];
  checkSchema(diagram, SCHEMA, "", errors);
  if (!errors.length) checkReferences(diagram, errors, warnings);
  if (!errors.length && options.layout !== false) checkLayout(diagram, warnings, options);
  return { valid: errors.length === 0, errors, warnings };
}

export function formatReport({ errors, warnings }, name = "diagram") {
  const lines = [];
  for (const e of errors) lines.push(`error   ${e.path}: ${e.message}`);
  for (const w of warnings) lines.push(`warning ${w.path}: ${w.message}`);
  if (!errors.length && !warnings.length) lines.push(`${name}: ok`);
  else lines.push(`${name}: ${errors.length} error${errors.length === 1 ? "" : "s"}, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`);
  return lines.join("\n");
}
