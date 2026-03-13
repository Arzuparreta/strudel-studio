# strudel-studio

Visual music editor built on [Strudel](https://strudel.cc/). Code remains the source of truth; the UI edits a Pattern Graph / AST that compiles to Strudel.

## Getting started

Requires **Node 18+** and **pnpm** (e.g. `corepack enable` then `pnpm install`, or `npm i -g pnpm`).

```bash
pnpm install
pnpm build    # build all packages and app
pnpm test     # run tests in all workspaces
pnpm dev      # start the Studio app (Vite dev server)
```
