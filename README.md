# strudel-studio

Visual music editor built on [Strudel](https://strudel.cc/). Code remains the source of truth; the UI edits a Pattern Graph / AST that compiles to Strudel.

**Plugin system:** Extend the editor with custom transforms, plugin graph nodes, and UI panels. See [docs/plugin-authoring.md](docs/plugin-authoring.md) 

## Getting started

Requires **Node 18+** and **pnpm** (e.g. `corepack enable` then `pnpm install`, or `npm i -g pnpm`).

```bash
pnpm install
pnpm build    # build all packages and app
pnpm dev      # start the Studio app (Vite dev server)
```
