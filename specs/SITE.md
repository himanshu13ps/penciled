# Product page plan (docs/index.html)

The page at https://himanshu13ps.github.io/penciled/ is the product page for
the penciled skill. Everything on it is rendered live by the real renderer.

## Decisions

- **Audience:** anyone who wants technical diagrams. Three equal ways in:
  ask your agent (the skill), the command line, or the browser playground
  with nothing to install.
- **No comparisons** with other tools, named or not. Describe what penciled
  does, not what others don't.
- **Agent replay (section 2) comes from a real run** of the skill: a real
  request, the JSON actually written, the validator's actual output, the fix
  actually made. Fall back to a scripted replay only if the real run doesn't
  work or doesn't look good, and say so on the page if it is scripted.
- **Main sections stay open; detail sections expand.** Reference material
  (shape-by-shape JSON, every validator code, per-agent install notes, FAQ)
  sits in expandable panels so the page reads quickly.

## Sections

| # | Section | Open or expandable | Live samples |
|---|---------|--------------------|--------------|
| 1 | Hero: what it is, three ways in, self-drawing diagram | open | hero diagram |
| 2 | Watch an agent use it: request → JSON → validate → fix → drawing | open | each step, before/after of the fix |
| 3 | Why it looks hand-drawn: strokes, corners, second pass, grain, hatching, eraser marks | open, close-ups | zoomed crops with captions |
| 4 | What you can describe: shapes, arrows, groups, shading, direction | open overview; JSON for each in expandable panels | every item drawn live |
| 5 | Make it your own: paper, ruling, pencil, seed | open | one diagram in rows of variations |
| 6 | The validator: errors vs warnings | open summary; full code list expandable | three before/after cards |
| 7 | Two outputs: SVG and the interactive viewer | open | embedded live viewer |
| 8 | Playground | open | editor and live drawing |
| 9 | Gallery, each with the plain-English request behind it | open | eight live cards |
| 10 | Install: agent, command line, browser | open summary; per-agent notes expandable | — |
| 11 | FAQ and limits | expandable items | — |
| 12 | Footer | open | — |

## Notes

- Keep it self-contained: no external scripts, stylesheets or fonts.
- Light and dark, phone width up, reduced motion respected.
- `scripts/build-site.mjs` copies the renderer and examples into `docs/`;
  `tests/site.test.js` keeps them in sync.

## Status

Built. All twelve sections are in `docs/index.html`; the agent replay is the
real run in `docs/replay/` (a food delivery app; the first draft got an
`aspect` warning, the fix was `"direction": "TB"`, the recheck was clean).
Gallery requests are labelled "Try asking" except url-shortener, which
was actually made from its request.
