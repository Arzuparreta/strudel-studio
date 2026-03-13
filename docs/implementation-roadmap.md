# Strudel Studio — Implementation Roadmap

Execution plan derived from [Architecture v2](architecture.md). Tasks are sized for **solo developer** GitHub issues. **Difficulty**: S = small (≤1 day), M = medium (2–5 days), L = large (1–2 weeks).

---

## Repository layout (target)

```
strudel-studio/
├── apps/
│   └── studio/                 # Vite + React; entry, layout, playback shell
├── packages/
│   ├── pattern-ast/            # AST types, astVersion, opaque types, migrations
│   ├── code-generator/         # AST → Strudel source; golden tests
│   ├── strudel-bridge/         # Transpile, eval, buffers, scheduler glue
│   ├── pattern-graph/          # (v0.3 primary) graph schema, compile graph → AST
│   ├── strudel-parser/         # (v0.2) subset parser, opaque spans, rebinding
│   ├── ui-components/          # Sequencer, Monaco shell, opaque blocks
│   ├── plugins-sdk/            # (v0.3) manifest, validation, registry, budgets
│   └── pattern-inspector/       # (v0.3) reads hap cache only
├── plugins/                    # (v0.3) reference plugins
└── docs/
    ├── architecture.md
    └── implementation-roadmap.md
```

**Dependency graph (high level)**

```
pattern-ast  →  code-generator  →  strudel-bridge  →  apps/studio
                    ↑
pattern-graph (v0.3) ──→ code-generator (optional compile step)
strudel-parser (v0.2) → pattern-ast
ui-components → strudel-bridge, code-generator
```

---

# Phase v0.1 — Vertical slice: AST, codegen, playback, debounced eval

## Goals

- Prove **end-to-end**: AST → deterministic Strudel string → transpile/eval → audio.
- **No** subset parser and **no** full graph UI—single-spine only (optional thin adapter).
- **Debounced evaluation** so the main thread stays responsive.

## Components to implement

| Component        | Package            | Purpose |
| ---------------- | ------------------ | ------- |
| Monorepo + CI    | root               | pnpm workspaces, TypeScript, Vitest, lint |
| Pattern AST v1   | `pattern-ast`      | Chain + call + literal; `astVersion`; stable `id` on nodes |
| Code generator   | `code-generator`   | AST → `s("...").bank().slow()` etc.; canonical method order |
| Strudel bridge   | `strudel-bridge`     | Pin `@strudel/*`; eval; single buffer first; optional dual buffer |
| Studio app       | `apps/studio`      | Monaco read-only or append-only generated region; play/stop |
| Eval scheduler   | `strudel-bridge` or `apps/studio` | Debounce + max eval rate |

## Dependency order

1. `pattern-ast` (no Strudel dependency).
2. `code-generator` depends on `pattern-ast`.
3. `strudel-bridge` depends on Strudel packages + `code-generator` (or accepts raw string).
4. `apps/studio` depends on `strudel-bridge` + Monaco.

## Concrete tasks

| # | Task | Description | Expected output | Package | Difficulty |
|---|------|-------------|----------------|---------|------------|
| 1.1 | **Scaffold monorepo** | pnpm workspaces, `tsconfig` base, ESLint, Vitest in CI. | `pnpm build` / `pnpm test` green at root | root | S |
| 1.2 | **pattern-ast types** | TypeScript types: `TransformChain`, `Call`, `Literal`, `ChainMethods` with `astVersion: 1`; node `id` field. | `packages/pattern-ast/src/types.ts` + export barrel | pattern-ast | S |
| 1.3 | **Canonical method order** | Single ordered list per `astVersion` (e.g. `bank`, `slow`, `gain`, …). | `canonicalOrder.ts` + unit test | pattern-ast or code-generator | S |
| 1.4 | **Codegen single spine** | Walk AST; emit `s("mini").method(args)...`; escape strings; no mini inside unsupported shapes. | `generate(ast) => string` + golden snapshots | code-generator | M |
| 1.5 | **Golden tests** | Fixtures: 3–5 AST JSON files → snapshot strings; CI fails on diff. | `packages/code-generator/__tests__/golden/` | code-generator | S |
| 1.6 | **Bridge: pin Strudel** | Add `@strudel/core`, `@strudel/webaudio`, etc.; single `evaluateToPattern(source): Pattern \| null`. | `evaluate.ts` + README note on versions | strudel-bridge | M |
| 1.7 | **Bridge: scheduler hook** | Wire REPL-style tick: `queryArc` on active pattern → WebAudio output; start/stop. | Playable demo in app | strudel-bridge | M |
| 1.8 | **Debounced eval** | Queue: user commits source string → debounce 200ms → eval into buffer; cap 2–4 evals/sec. | `EvalScheduler` class + tests with fake timers | strudel-bridge | M |
| 1.9 | **Studio shell** | Vite app; one pane Monaco showing generated code; button “Generate & Play” from hardcoded or minimal AST. | Running app in browser | apps/studio | S |
| 1.10 | **Thin graph adapter (optional)** | In-memory only: build minimal `transformChain` → existing codegen input (no graph package yet). | One function `graphToAst(thin)` or skip if timeboxed | apps/studio or pattern-ast | S–M |

---

## Strudel Studio Implementation Step 1 — Recommended scope (quality-first)

This block is the **formal Step 1** on the roadmap: small, reviewable, and safe. It locks the **contract** before codegen and bridge work so logic and generation stay deterministic.

### Task numbers (quick reference)

| # | Short name | What it is |
|---|------------|------------|
| **1.2** | pattern-ast types | TypeScript IR: `TransformChain`, calls, literals; `astVersion: 1`; stable `id` on nodes. |
| **1.3** | Canonical method order | Single ordered list per `astVersion` (e.g. `bank`, `slow`, `gain`, …) so emission order is never ambiguous. |
| **1.4** | Codegen single spine | `generate(ast) => string`; walk AST and emit `s("...").method(args)...` with escaping rules. |
| **1.5** | Golden tests | AST JSON fixtures → snapshot strings; CI fails on unexpected diffs. |

**Suggested bundle for Step 1:** **1.2 + 1.3** together (types + order) as one milestone; **1.4 then 1.5** as the next—codegen without golden tests drifts; golden tests without a frozen IR are brittle.

### JSON fixture scope

- Aim for **1–2 nodes per type** in each fixture—enough to exercise structure and ordering **without** building large graphs prematurely.
- Prefer **multiple small fixtures** over one large document so failures point to a specific shape.
- Tasks **1.4 / 1.5** stay meaningful when fixtures are minimal; expand only when adding new node kinds or emit branches.

### Optional micro-step (before or with 1.2)

- Add a **human-readable contract** in-repo (short markdown or JSON in `docs/`, or a comment-heavy example) that states: allowed base kinds for v0.1, whitelisted chain methods, and **one canonical example string** you expect codegen to produce.
- **Why:** Gives reviewers and contributors a **single source of expectations** before diving into TypeScript; reduces friction on the first PR that introduces `pattern-ast` and canonical order.

---

## Package / file structure (v0.1)

```
packages/pattern-ast/
  src/
    types.ts
    index.ts
  package.json

packages/code-generator/
  src/
    emit.ts
    canonical.ts
    index.ts
  __tests__/golden/*.json + *.snap
  package.json

packages/strudel-bridge/
  src/
    evaluate.ts
    scheduler.ts
    evalScheduler.ts
    audio.ts
    index.ts
  package.json

apps/studio/
  src/
    main.tsx
    App.tsx
    monaco.tsx
  package.json
  vite.config.ts
```

## Technical risks (v0.1)

| Risk | Mitigation |
|------|------------|
| Strudel API/version drift | Pin exact versions; document in README; golden tests only on codegen side first. |
| Audio context autoplay | User gesture to start; resume AudioContext on first click. |
| Eval throws on bad code | Try/catch; show error state; never leave scheduler without active pattern guard. |

---

# Phase v0.2 — Subset parser, opaque nodes, bidirectional sync

## Goals

- **Strudel source → AST** for supported subset; **opaque** for the rest.
- **Monaco ↔ AST** with path-based rebinding; **no** destructive merges.
- **Lane/composition** nodes only when parser can emit them—schema ready from v0.1.

## Components to implement

| Component | Package | Purpose |
| --------- | ------- | ------- |
| Subset parser | `strudel-parser` | Acorn walk; build AST or opaque spans |
| Opaque schema | `pattern-ast` | Opaque node + `emitMode`, `parentComposition` |
| Rebinder | `strudel-parser` | After reparse, map node id → new `sourceRange` by path |
| Sync layer | `apps/studio` | Debounced reparse; stale graph/AST until success |
| Opaque expansion | `strudel-parser` | Enclosing expression/statement boundaries |

## Dependency order

1. Extend `pattern-ast` with opaque types.
2. `strudel-parser` produces `pattern-ast` + opaque list.
3. `code-generator` must **echo opaque verbatim** when emitting full document.
4. Studio: Monaco model updates only from codegen when graph wins; otherwise text wins → reparse.

## Concrete tasks

| # | Task | Description | Expected output | Package | Difficulty |
|---|------|-------------|----------------|---------|------------|
| 2.1 | **Opaque types in AST** | Types + codegen passthrough for opaque regions; full-document emit API. | `opaque.ts`; `emitDocument(ast, opaques)` | pattern-ast + code-generator | M |
| 2.2 | **Acorn parse + walk** | Parse top-level expression; detect `s(`, `note(`, `stack(`, `cat(`, member chains. | `parseToAstOrOpaque(source)` | strudel-parser | M |
| 2.3 | **Whitelist method names** | Only known methods become chain nodes; else opaque. | Shared whitelist + tests | strudel-parser | S |
| 2.4 | **Opaque expansion** | On failure, expand range to parent ExpressionStatement or full `$:` body. | `expandOpaqueRange(node, source)` | strudel-parser | M |
| 2.5 | **Path-based rebinding** | After edit, re-walk; assign new `sourceRange` by stable `id` if structure matches. | `rebind(document, previousAst)` | strudel-parser | L |
| 2.6 | **Typing / error UX** | Incomplete parse → keep last good AST; show “typing…” or error badge. | Studio state machine | apps/studio | M |
| 2.7 | **Bidirectional policy** | Single owner per region or non-overlapping spans; document in code. | `docs/sync-policy.md` + integration tests | apps/studio | M |
| 2.8 | **Mini string handling** | Double-quoted args to `s`/`note` either parsed to structured or stored as mini string + span. | Parser branch + tests | strudel-parser | M |

## Package / file structure (v0.2)

```
packages/strudel-parser/
  src/
    parse.ts
    walk.ts
    opaqueExpand.ts
    rebind.ts
    whitelist.ts
    index.ts
  __tests__/
  package.json

packages/pattern-ast/
  src/
    opaque.ts
    ...
```

## Technical risks (v0.2)

| Risk | Mitigation |
|------|------------|
| Ambiguous parse (multiple valid ASTs) | Strict subset only; else opaque; golden tests on parse fixtures. |
| Range drift | Primary key = node id + path; ranges refreshed after full parse. |
| Performance on large files | Debounce; incremental parse only when edit inside known span (later). |

---

# Phase v0.3 — Full graph UI, multi-track, plugins, inspector

## Goals

- **Pattern Graph** in UI: parallel/serial/lanes; compile graph → AST using rules from architecture.
- **Multi-track** via `stack` / multiple lanes.
- **Plugin SDK** + one reference plugin; **Pattern Inspector** reads **shared hap cache** only.

## Components to implement

| Component | Package | Purpose |
| --------- | ------- | ------- |
| Graph schema + compile | `pattern-graph` | Nodes/edges/order; `graphToAst` deterministic |
| UI graph / sequencer | `ui-components` | React Flow or custom; lane views |
| Dual buffer + generation | `strudel-bridge` | Swap at cycle boundary; hap tag generation |
| Hap cache | `strudel-bridge` | Scheduler fills cache; inspector reads |
| plugins-sdk | `plugins-sdk` | Manifest, astVersion, validate, budget |
| pattern-inspector | `pattern-inspector` | List/overlay from cache |

## Dependency order

1. `pattern-graph` schema + compile → uses `pattern-ast` + `code-generator` concepts.
2. `strudel-bridge` extends scheduler with buffer swap + hap cache.
3. `ui-components` consumes graph + bridge.
4. `plugins-sdk` + `plugins/euclidean` (example).
5. `pattern-inspector` depends only on hap cache interface.

## Concrete tasks

| # | Task | Description | Expected output | Package | Difficulty |
|---|------|-------------|----------------|---------|------------|
| 3.1 | **pattern-graph schema** | JSON types + validation (zod/io-ts); `graphVersion`. | `packages/pattern-graph/src/schema.ts` | pattern-graph | M |
| 3.2 | **graphToAst** | parallel → stack; serial → cat; deterministic child order. | `compile/graphToAst.ts` + golden tests | pattern-graph | L |
| 3.3 | **Lane + cycleHint codegen** | Emit per-lane `.slow` or structure per architecture. | Codegen extension + tests | code-generator | M |
| 3.4 | **Dual buffer + swap** | Inactive eval; swap at cycle boundary; generation id on hap. | `buffers.ts` + integration test | strudel-bridge | L |
| 3.5 | **Hap cache API** | Scheduler pushes haps per tick; `getHaps(window)`. | `hapCache.ts` | strudel-bridge | M |
| 3.6 | **Inspector UI** | Read-only list or overlay; no extra queryArc loop. | Package + story or app route | pattern-inspector | M |
| 3.7 | **plugins-sdk manifest** | Parse manifest; check astVersion range; register transforms. | `plugins-sdk/src/registry.ts` | plugins-sdk | M |
| 3.8 | **Plugin transform validation** | Run plugin output through pattern-ast validator. | `validate.ts` | plugins-sdk | S |
| 3.9 | **Execution budget** | `requestAnimationFrame` or time limit around plugin transform. | Budget wrapper | plugins-sdk | S |
| 3.10 | **Reference plugin** | Euclidean or chord generator as second package. | `plugins/euclidean/` | plugins | M |
| 3.11 | **Multi-track UI** | Stack lanes in graph or stacked sequencers; connect to graph compile. | `ui-components` | ui-components | L |

## Package / file structure (v0.3)

```
packages/pattern-graph/
  src/
    schema.ts
    compile/graphToAst.ts
    index.ts

packages/strudel-bridge/
  src/
    buffers.ts
    hapCache.ts
    ...

packages/pattern-inspector/
  src/
    HapList.tsx
    index.ts

packages/plugins-sdk/
  src/
    registry.ts
    validate.ts
    budget.ts
    index.ts

plugins/euclidean/
  package.json
  manifest.json
  src/index.ts
```

## Technical risks (v0.3)

| Risk | Mitigation |
|------|------------|
| Cycle boundary detection wrong | Use `queryArc` hap `whole` spans; add crossfade fallback. |
| Graph compile ambiguity | Single rule: `order` array or sorted ids only; documented in architecture. |
| Plugin breaks document | Validate before commit; reject or wrap opaque. |

---

## Suggested GitHub issue labels

- `phase:v0.1` | `phase:v0.2` | `phase:v0.3`
- `pkg:pattern-ast` | `pkg:code-generator` | `pkg:strudel-bridge` | …
- `risk:high` for bridge scheduling and parser rebinding

## Milestones (suggested)

| Milestone | Criteria |
|-----------|----------|
| **v0.1 done** | Play/stop from generated code; golden codegen; debounced eval in app. |
| **v0.2 done** | Parse subset + opaque; Monaco edits round-trip without losing unsupported code. |
| **v0.3 done** | Multi-track graph compiles; inspector from cache; one plugin loads safely. |

This roadmap stays aligned with Architecture v2: **v0.1** proves pipeline; **v0.2** proves sync without full graph UI; **v0.3** adds graph breadth, plugins, and inspector without second `queryArc` path.
