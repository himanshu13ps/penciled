# penciled

An agent skill that turns a small JSON description into a diagram that looks
drawn by hand with a graphite pencil on paper: tapered, wobbly strokes,
layered passes, soft shading, paper grain and the odd eraser smudge.

> Status: early work (v0.1 in progress). Nothing is usable yet.

## What it does (planned for v0.1)

- **Architecture diagrams** first: boxes, labels and arrows.
- **Output:** an SVG file plus a self-contained HTML viewer.
- **Validator:** checks the JSON and warns about layout problems
  (overlaps, crossing arrows, labels that don't fit) before drawing.
- **No runtime dependencies.** The handwriting font is embedded.

## Layout

```
schema/     JSON Schema for diagram input
src/        validator and renderer
examples/   sample inputs and rendered outputs
fonts/      embedded handwriting font (open license)
tests/      tests
specs/      plan and design notes
```

## Roadmap

| Milestone | Goal |
|-----------|------|
| M0 | Repo setup, license, README |
| M1 | JSON Schema for architecture diagrams |
| M2 | Pencil test: one box and one arrow that look hand-drawn |
| M3 | Full renderer: shading, paper texture, labels |
| M4 | Validator with layout warnings |
| M5 | HTML viewer and examples |
| M6 | Package as an agent skill and publish |

## License

MIT, see [LICENSE](LICENSE).
