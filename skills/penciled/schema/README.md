# Input format (v0.1)

`architecture.schema.json` describes the JSON you write to get a diagram.
See [`examples/minimal.json`](../examples/minimal.json) for the smallest
valid input and [`examples/web-app.json`](../examples/web-app.json) for one
that uses every feature.

## Top level

| Field | Required | Meaning |
|-------|----------|---------|
| `version` | yes | Always `"0.1"` |
| `type` | yes | Always `"architecture"` |
| `nodes` | yes | 1–40 shapes |
| `edges` | no | Up to 80 arrows between nodes |
| `groups` | no | Up to 12 dashed outlines around nodes |
| `title` | no | Handwritten title at the top |
| `direction` | no | `LR` (default) or `TB`: main flow for automatic layout |
| `paper` | no | Paper ruling, pencil hardness, eraser marks, random seed |

## Nodes

| Field | Required | Meaning |
|-------|----------|---------|
| `id` | yes | Starts with a letter; letters, digits, `_`, `-`; max 40 chars |
| `label` | yes | Up to 60 chars; `\n` for a line break |
| `sublabel` | no | Smaller second line, e.g. `"Postgres"` |
| `shape` | no | `box` (default), `rounded`, `database`, `queue`, `person`, `cloud`, `document` |
| `shade` | no | `none` (default), `light`, `medium`, `dark` |
| `group` | no | Id of the group the node sits in |
| `position` | no | `{x, y}` of the node's centre. Omit for automatic layout |
| `size` | no | `{width, height}`. Omit to fit the label |

## Groups

`id`, `label`, optional `parent` (another group's id, for nesting) and `shade`.
A group's outline is drawn around its member nodes, so it has no position of
its own.

## Edges

`from` and `to` (node ids), plus optional `label` (max 40 chars), `style`
(`solid` or `dashed`) and `arrow` (`end`, `start`, `both`, `none`).

## Paper

| Field | Default | Meaning |
|-------|---------|---------|
| `texture` | `plain` | `plain`, `lined` or `grid` |
| `style` | `clean` | `clean` near-white, `aged` warm cream, `bright` white |
| `pencil` | `2B` | `HB` light and crisp, `2B`, `4B` dark and soft |
| `eraserMarks` | `true` | Faint smudges and ghost lines |
| `seed` | random | Same input and seed give the same drawing |

## Checking input

```
node src/cli.js validate diagram.json          # human-readable report
node src/cli.js validate diagram.json --json   # { valid, errors, warnings }
```

(Paths are relative to this skill's folder, `skills/penciled/` in the repo.)
```

Rendering runs the same checks first: errors stop it, warnings are printed
and drawing goes ahead. Add `--strict` to either command to fail on warnings
too. Every problem has a `path` (where in the JSON), a `code` and a message
that says what to change.

**Errors** — the input can't be drawn as written:

| Code | Meaning |
|------|---------|
| `schema` | A value doesn't match the schema (with a "did you mean" for typos) |
| `duplicate-id` | Two nodes or groups share an id |
| `unknown-node` | An arrow points at a node that doesn't exist |
| `edge-to-group` | An arrow points at a group; arrows connect nodes |
| `unknown-group` | A node's `group` or a group's `parent` doesn't exist |
| `group-cycle` | Groups nest in a loop |
| `partial-positions` | Some nodes have a `position` and some don't |

**Warnings** — it will draw, but probably not as intended:

| Code | Meaning |
|------|---------|
| `self-loop` | Arrow from a node to itself (not drawn) |
| `duplicate-edge` | The same arrow twice |
| `empty-group` | A group with no nodes (not drawn) |
| `isolated-node` | A node with no arrows in a diagram that has some |
| `node-overlap` | Two nodes on top of each other |
| `node-in-other-group` | A node drawn inside a group it isn't in |
| `group-overlap` | Two groups that aren't nested overlap |
| `arrow-through-node` | An arrow couldn't be routed around a node |
| `arrow-crossings` | Arrows cross each other |
| `label-crowded` | An arrow label has no clear space |
| `label-overflow` | A label is wider than its node's manual `size` |
| `aspect` | The drawing is very wide or very tall; try the other `direction` |

Layout warnings come from laying the diagram out exactly as it will be
drawn, with the same seed.
