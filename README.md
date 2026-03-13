# strudel-studio

Visual music editor built on [Strudel](https://strudel.cc). Code remains the source of truth; the UI edits a Pattern Graph / AST that compiles to Strudel.

## Documentation

- **[Architecture v2](docs/architecture.md)** — system design, layers, runtime, roadmap summary
- **[Implementation roadmap](docs/implementation-roadmap.md)** — phased execution plan (v0.1 → v0.3), packages, tasks, risks

## Getting started

Requires **Node 18+** and **pnpm** (e.g. `corepack enable` then `pnpm install`, or `npm i -g pnpm`).

```bash
pnpm install
pnpm build    # build all packages and app
pnpm test     # run tests in all workspaces
pnpm dev      # start the Studio app (Vite dev server)
```

## Status

Phase v0.1 scaffold done (Task 1.1). Implementation follows the [roadmap](docs/implementation-roadmap.md).
