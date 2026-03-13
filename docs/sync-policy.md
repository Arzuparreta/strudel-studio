# Strudel Studio — Text ⇄ AST ⇄ Graph sync policy

This document states the **authoritative rules** for keeping Strudel source, Pattern AST, and (later) Pattern Graph in sync. It is the reference for v0.2 subset parsing and bidirectional updates.

## 1. Source of truth

- **Strudel source string is the only source of truth at rest.**
- Pattern AST and Pattern Graph are **projections** derived from the current source.
- When parsing fails or the subset cannot represent code, we fall back to **opaque regions** that preserve text verbatim.

## 2. One owner per span

- Every byte of the source document is owned by **exactly one** of:
  - **Subset AST** (parseable Strudel subset), or
  - **Opaque region** (unparsed or unsupported code).
- Owners are **non-overlapping and contiguous**; there are no gaps and no overlaps.
- For v0.2, ownership is implemented implicitly:
  - When subset parsing succeeds, the **entire expression** is owned by the AST.
  - When it fails, the **smallest enclosing expression or statement** becomes a single opaque node.

## 3. Parser behaviour (v0.2 subset)

The v0.2 parser (`@strudel-studio/strudel-parser`) follows these rules:

- **Supported subset**:
  - A single top-level expression of the form:
    - `s("mini")` or `note("mini")`, with
    - zero or more **whitelisted** method calls in a chain, e.g. `.bank("tr909").slow(2)`.
  - All arguments to `s`, `note`, and methods must be **literals** (`string | number | boolean`).
- **Whitelist**:
  - Method names are whitelisted via `KNOWN_METHOD_NAMES` in `whitelist.ts`, derived from the canonical order in `pattern-ast`.
  - Unknown method names cause the whole expression to become opaque.
- **Failure / unsupported shapes**:
  - Syntax error while parsing the module → **whole document** becomes a single opaque node.
  - Non‑expression top level (multiple statements, declarations, etc.) → **whole document** becomes opaque.
  - Unsupported expression shapes (e.g. unknown base call, non‑literal args, non‑whitelisted methods) → the **enclosing ExpressionStatement** becomes a single opaque node.

These behaviours are exercised by `parse.test.ts` and `opaqueExpand.test.ts`.

## 4. Opaque regions

Opaque nodes (`OpaqueNode` in `pattern-ast`) preserve arbitrary code:

- **`rawCode`** stores the exact substring that must be echoed verbatim.
- **`sourceRange`** tracks the half‑open byte range \([start, end)\) in the document.
- **`emitMode`** restricts where/how the segment can be spliced:
  - `expression` — can be emitted as an expression.
  - `statementBlock` — only valid as a statement/block; for v0.2, opaque regions produced by the parser use this mode.
  - `verbatimOnly` — never regenerated; not yet used in v0.2.

For v0.2:

- Parser‑created opaque nodes are produced via `makeOpaqueFromExpression`, which:
  - Uses `node.start` / `node.end` from Acorn when available to bound the opaque span to the enclosing statement.
  - Falls back to the full `[0, source.length)` range if locations are missing.

**Invariant:** Code generation must never modify `rawCode`; it is always emitted exactly as stored.

## 5. Emission contract (AST + opaques)

`@strudel-studio/code-generator` provides `emitDocument(ast, opaques)` for full‑document emission:

- When `ast` is non‑null, it is emitted via `generate(ast)` (single‑spine transform chain with canonical method order).
- Each opaque node is emitted by echoing **`rawCode` verbatim**.
- For v0.2, callers control segment ordering by:
  - Choosing whether to pass an AST at all.
  - Choosing the order of `opaques` in the array.

Later phases may introduce a richer document model (multiple segments with explicit ordering), but the following must remain true:

- `rawCode` is never mutated by codegen.
- Given the same AST + opaque list and options, emission is **deterministic**.

## 6. Evaluation and debounce

Evaluation is intentionally **decoupled** from parsing:

- The Studio app holds the current `source` string and:
  - **Debounces parsing** (currently 200 ms) via `parseToAstOrOpaque`.
  - Tracks whether the latest parse produced:
    - Only subset AST,
    - AST + opaques, or
    - Opaque‑only fallback.
- Evaluation uses `EvalScheduler` from `@strudel-studio/strudel-bridge`:
  - Enforces a **debounce window** and **max evals per second**.
  - Ensures we never evaluate on every keystroke.

In v0.2:

- UI shows parse status but does **not** yet perform automatic AST → source regeneration after text edits; the source textarea remains the single owner for text edits.

## 7. Future work — path‑based rebinding (v0.2+)

The following behaviours are **planned** but not yet implemented:

- **Path‑based rebinding**:
  - After successful reparse, nodes in the new AST will attempt to **reuse stable ids** by comparing logical paths (e.g. base + method sequence) rather than absolute `sourceRange` only.
  - When structure matches but ranges have shifted, ids are preserved; when it does not, affected regions widen to opaque.
- **Graph lifting**:
  - When a Pattern Graph layer is present, its nodes will be bound to AST nodes by id.
  - Text edits that leave the subset intact will rebind graph nodes via AST; when parsing fails, affected graph regions become opaque/locked.

Until these are implemented, **stable ids are enforced at the type level**, but the parser assigns fresh ids when it synthesizes AST for the supported subset.

