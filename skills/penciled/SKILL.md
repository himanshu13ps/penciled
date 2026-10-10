---
name: penciled
license: MIT
description: Draw architecture and system diagrams that look hand-sketched in graphite pencil on paper (tapered, wobbly strokes, hatched shading, paper grain, handwritten labels), as an SVG, a PNG or a self-contained interactive HTML page. Use this whenever someone wants a hand-drawn, sketchy, whiteboard-style, napkin-sketch or pencil diagram of how a system fits together (services, databases, queues, users, external APIs, pipelines, cloud infrastructure, data flows), or asks you to "sketch" or "draw" an architecture, even if they never say "pencil". Not for charts of numbers, UI mockups, or precise engineering drawings.
---

# penciled

penciled turns a small JSON description of a system into a drawing that
looks like someone sketched it with a 2B pencil: boxes whose corners cross,
arrows with a little sag, hatched shading, handwritten labels, paper texture.
It lays the diagram out automatically, checks the input, and writes either a
plain SVG or an HTML page where the reader can redraw, zoom and save.

It needs Node.js 18 or later and nothing else: no install step, no
dependencies, no network.

## Where things are

Everything is relative to this skill's directory (the folder containing this
file). Below, `PENCILED` stands for that directory's absolute path.

- `PENCILED/src/cli.js` is the command-line tool
- `PENCILED/schema/README.md` is the full input reference: every field, and
  every error and warning code with its meaning. Read it when you need a
  field this page doesn't cover or a warning you don't recognise
- `PENCILED/schema/architecture.schema.json` is the JSON Schema itself

## Workflow

### 1. Work out what to draw

Before writing JSON, decide:

- **Nodes**: the things in the system. Aim for 3 to 15. A diagram with 25
  boxes is a wall of text in pencil; past about 15, split it into an
  overview plus detail diagrams.
- **Edges**: who talks to whom. Point arrows in the direction requests or
  data flow, so the layout reads in one direction.
- **Groups**: boundaries worth showing (a cloud account, a cluster, a team,
  "services" vs "data"). Groups can nest. Leave them out if they add nothing.
- **Direction**: `LR` (left to right) suits pipelines and request chains;
  `TB` (top to bottom) suits a user at the top fanning out to services, and
  anything with more than about five steps in a row.

### 2. Write the JSON

Write it to a file next to where the drawing should go, e.g.
`docs/architecture.json`.

```json
{
  "version": "0.1",
  "type": "architecture",
  "title": "Photo sharing app",
  "direction": "TB",
  "nodes": [
    { "id": "user", "label": "User", "shape": "person" },
    { "id": "api", "label": "API server", "sublabel": "Node.js", "shape": "rounded", "group": "backend" },
    { "id": "jobs", "label": "Job queue", "sublabel": "Redis", "shape": "queue", "group": "backend" },
    { "id": "db", "label": "Database", "sublabel": "Postgres", "shape": "database", "shade": "light" }
  ],
  "groups": [
    { "id": "backend", "label": "Backend" }
  ],
  "edges": [
    { "from": "user", "to": "api", "label": "HTTPS" },
    { "from": "api", "to": "db", "label": "reads/writes", "arrow": "both" },
    { "from": "api", "to": "jobs", "label": "enqueue", "style": "dashed" }
  ]
}
```

Choosing shapes, because readers decode the shape before the label:

| Shape | Use for |
|-------|---------|
| `box` (default) | Generic component, storage bucket, anything without a better fit |
| `rounded` | A service, app or process you run |
| `database` | Databases and data stores (drawn as a cylinder) |
| `queue` | Queues, streams, topics, event buses |
| `person` | Users, actors, teams (stick figure, label underneath) |
| `cloud` | Something outside your control: the internet, a SaaS API, a CDN |
| `document` | Files, reports, configs, dashboards |

Writing labels that read well in handwriting:

- Keep `label` short (one to three words). Put the technology in `sublabel`
  ("Postgres", "Kafka", "Lambda"). Use `\n` to break a longer label.
- Edge labels are 1 to 2 words: "HTTPS", "publish", "reads/writes".
- Use `"style": "dashed"` for async or optional flows, `"arrow": "both"` for
  two-way traffic and `"arrow": "none"` for plain association.
- Shade (`light`, `medium`, `dark`) only the one or two nodes you want the
  eye to go to. Shading everything shades nothing.
- Ids start with a letter and use letters, digits, `_` or `-`. They're
  never drawn, so make them short and obvious (`api`, `ordersdb`).

The look is set under `paper`, all optional:

| Field | Values | Default |
|-------|--------|---------|
| `style` | `clean` near-white, `aged` warm cream, `bright` white | `clean` |
| `texture` | `plain`, `lined` (notebook), `grid` | `plain` |
| `pencil` | `HB` light, `2B`, `4B` dark and soft | `2B` |
| `eraserMarks` | faint ghost lines and smudges | `true` |
| `seed` | any integer; the same seed gives the same drawing | random |

Set a `seed` once you or the user like a drawing, so re-rendering after an
edit keeps the same character.

Layout is automatic. Only give nodes a `position` (`{ "x": …, "y": … }`)
if the user needs an exact arrangement, and then give every node one.

### 3. Validate and fix

```bash
node PENCILED/src/cli.js validate docs/architecture.json --json
```

The result is `{ valid, errors, warnings }`; each problem has a `path` into
the JSON, a `code` and a message saying what to change. Errors (unknown ids,
typos, duplicate ids, groups nested in a loop) must be fixed: the renderer
refuses input with errors. Warnings come from laying the diagram out exactly
as it will be drawn, so take them seriously:

| Warning | Usual fix |
|---------|-----------|
| `arrow-crossings` | Try the other `direction`; or put both ends of a long arrow in the same group; or drop an edge that isn't essential |
| `arrow-through-node` | Try the other `direction`, or reorder `nodes` so linked nodes are listed near each other |
| `aspect` | The drawing is a long strip; switch `direction` |
| `group-overlap`, `node-in-other-group` | A node in one group is linked deep into another; nest the groups or switch `direction` |
| `label-crowded`, `label-overflow` | Shorten the label, or add a line break |
| `isolated-node`, `empty-group` | Usually a forgotten edge or `group` field |

Re-validate after each change. Two or three rounds is normal; if a warning
won't go away and the drawing still reads clearly, it's fine to keep it and
mention it.

### 4. Render

```bash
# Interactive page: redraw, switch paper/pencil/direction, zoom, save PNG/JPG/SVG
node PENCILED/src/cli.js docs/architecture.json -o docs/architecture.html

# Plain SVG for a README, docs site or slide
node PENCILED/src/cli.js docs/architecture.json -o docs/architecture.svg

# PNG, for places that don't show SVG (chat, some wikis, email)
node PENCILED/src/cli.js docs/architecture.json -o docs/architecture.png
```

Pick by where the drawing is going. A person looking at it in a browser gets
the most from the HTML page; anything embedded in a document wants the SVG;
chat apps, email and wikis that don't show SVG want the PNG.

PNG output borrows an installed Chrome, Edge, Chromium or Brave, run
headless. If none is found the command fails with a clear message; then
write the SVG or the HTML page instead and tell the user they can save a PNG
from the page. A PNG is twice the drawing's size by default (`--scale 1` to
`4`), and often a few megabytes, because paper grain doesn't compress.
When unsure, write both: they come from the same input and seed, so they
match. Both files embed the font, so they work offline and anywhere SVG
renders. Expect roughly 100 to 400 KB per drawing; the paper grain is the
bulk of it.

`--seed N` overrides the seed for one run. `--strict` makes warnings fail
the command, which is useful in CI.

### 5. Hand it over

Tell the user where the files are, and in a sentence what the drawing shows.
If you made judgment calls (left out a component, grouped things a certain
way, chose a direction), say so briefly so they can ask for changes. If you
wrote the HTML page, mention they can press R for a fresh take and save the
version they like as JSON with its seed.

## Changing a drawing later

Edit the JSON and render again. For a different hand-drawn take with the
same content, change only `paper.seed`. To match a look the user chose in
the HTML viewer, use the JSON they saved from it; it carries their paper,
pencil, direction and seed.
