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
| `style` | `aged` | `aged` warm cream, `clean` near-white, `bright` white |
| `pencil` | `2B` | `HB` light and crisp, `2B`, `4B` dark and soft |
| `eraserMarks` | `true` | Faint smudges and ghost lines |
| `seed` | random | Same input and seed give the same drawing |

## Rules the schema can't check

JSON Schema only checks the shape of each value. These rules link values
together, and the validator (milestone M4) will enforce them:

1. Every `id` is unique across nodes **and** groups.
2. Edge `from`/`to` name existing nodes. A node `group` and a group `parent`
   name existing groups.
3. Group nesting has no cycles.
4. Positions are all-or-nothing: give every node a `position`, or none.
5. Warnings, not errors: a node linked to itself, duplicate edges, empty
   groups.
