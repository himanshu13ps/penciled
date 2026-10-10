# penciled — v0.1 plan

## Goal

An agent skill that turns a small JSON description into a diagram that looks
drawn by hand with a graphite pencil on paper.

## What makes it different

Other hand-drawn diagram tools give a "sketchy" marker or ink look. penciled
goes for **paper realism**: graphite pencil strokes, soft shading, paper
grain and the odd eraser mark.

## Key decisions

| Topic | Decision |
|-------|----------|
| Name | `penciled`. Free on npm and skills.sh; GitHub repo `himanshu13ps/penciled` |
| First diagram type | Architecture diagrams (boxes, labels, arrows, groups) |
| Output | SVG, plus a self-contained HTML viewer |
| Strokes | Each stroke is drawn as a tapered, wobbly filled shape, not a plain line, and laid down in several light passes the way pencil builds up |
| Validator | Hand-written, no runtime dependencies. Rejects bad input and warns about layout problems (overlaps, crossing arrows, labels that don't fit) |
| Font | Free handwriting font with an open license (candidates: Caveat, Kalam, Patrick Hand), embedded in the output |
| Dependencies | None at runtime |
| License | MIT |

## Milestones

| Milestone | Goal | Done when |
|-----------|------|-----------|
| M0 | Repo setup | Folders, LICENSE, README, .gitignore pushed; name checked |
| M1 | JSON Schema | Schema for architecture diagrams plus a sample input that passes it |
| M2 | Pencil test | One box and one arrow rendered to SVG that look convincingly hand-drawn. Checkpoint: review before going further |
| M3 | Full renderer | All shapes, labels, shading and paper texture |
| M4 | Validator | Schema checks plus layout warnings |
| M5 | Viewer and examples | Self-contained HTML viewer; a set of example diagrams |
| M6 | Package and publish | Packaged as an agent skill, published to npm and skills.sh |

## Status

- M0: done
- M1: done (schema/architecture.schema.json, examples/, tests/fixtures/invalid/)
- M2: done
- M3: done (all shapes, groups, layered layout, arrow routing, lined/grid paper)
- M4: next
