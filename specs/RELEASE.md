# Releasing

Steps that need the maintainer's accounts. Everything before them is
checked by `npm test`.

## Before a release

1. `npm test` passes.
2. Every example validates: `for f in examples/*.json; do node skills/penciled/src/cli.js validate $f; done`
   (`shapes.json` is expected to warn that it is very wide).
3. Bump `version` in `package.json` and note the changes in the commit.
4. `npm pack --dry-run` lists only `skills/penciled/`, `README.md`,
   `LICENSE` and `package.json` (about 25 files, under 100 kB).

## skills.sh

There is nothing to upload. skills.sh lists public GitHub repos that the
`skills` CLI can install from, and this repo is laid out the way it expects
(`skills/penciled/SKILL.md`). Check it from any folder:

```
npx skills add himanshu13ps/penciled --list
```

It should find one skill, `penciled`. The listing on skills.sh appears once
people install it; installs are counted from the CLI's anonymous telemetry.

## npm

```
npm login            # once
npm publish --dry-run
npm publish
```

After that, `npx penciled diagram.json -o out.svg` works anywhere, and the
README can show `npx penciled` instead of the `node skills/penciled/...`
path.

## GitHub release

Tag the version (`git tag v0.1.0 && git push origin v0.1.0`) and create a
release from the tag with a short summary and one example image.
