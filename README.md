# penciled

An agent skill that turns a small JSON description into a diagram that looks
drawn by hand with a graphite pencil on paper: tapered, wobbly strokes,
layered passes, soft shading, paper grain and the odd eraser smudge.

![A hand-drawn architecture diagram of a photo sharing app: a user, a CDN, an API server, a job queue, a worker, a database and object storage, inside dashed AWS, Backend and Data outlines](examples/web-app.jpg)

> Status: early work (v0.1 in progress). Rendering, the validator and the HTML
> viewer work. Packaging as an agent skill is next.

## Try it

Needs Node.js 18 or later. No install step, no dependencies.

```
node src/cli.js examples/pencil-test.json -o diagram.svg
```

Open `diagram.svg` in a browser. Add `--seed 123` for a different take on
the same drawing; the same seed always gives the same result.

### Interactive viewer

```
node src/cli.js examples/web-app.json -o diagram.html
```

Writing to a `.html` file (or passing `--html`) gives a single
self-contained page with the renderer built in. It works offline, straight
from disk. In it you can:

- redraw with a new seed, or switch paper, ruling, pencil and flow direction
- zoom and pan (scroll, drag, `F` to fit, `0` for actual size)
- see the validator's warnings for the current drawing
- save as SVG, PNG, JPG, or as JSON with your chosen settings baked in

Try [`examples/web-app.html`](examples/web-app.html) (download it and open
it locally; GitHub shows HTML as source).

### Examples

Each input in [`examples/`](examples/) has its rendered SVG and a JPEG preview:

| Example | Shows |
|---------|-------|
| [`web-app`](examples/web-app.jpg) | Groups, nesting, top-to-bottom flow |
| [`microservices`](examples/microservices.jpg) | A gateway fanning out to services, queues, an external API |
| [`ci-pipeline`](examples/ci-pipeline.jpg) | Left-to-right flow, documents, two groups |
| [`data-platform`](examples/data-platform.jpg) | Aged paper on a grid, 4B pencil, shaded databases |
| [`shapes`](examples/shapes.jpg) | All seven shapes on grid paper |
| [`event-pipeline`](examples/event-pipeline.jpg) | Manual positions, lined paper, HB pencil |
| [`pencil-variants`](examples/pencil-variants.jpg) | 4B pencil, shading levels, dashed and two-way arrows |

### Checking input


```
node src/cli.js validate diagram.json
```

This checks an input without drawing it. The validator catches mistakes (unknown ids, typos, groups nested in a loop)
and warns about things that will draw badly, such as arrows crossing or
nodes overlapping, with a suggestion for each. The input format and every
check are described in [`schema/README.md`](schema/README.md).

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
scripts/    dev tools (font rebuild)
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
