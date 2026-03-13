# @strudel-studio/strudel-bridge

Bridge between Strudel Studio and the Strudel runtime.

## Responsibilities in v0.1

- Pin Strudel runtime packages for reproducible evaluation.
- Provide a narrow API to evaluate Strudel source into a `Pattern`.
- Keep AST and codegen (`pattern-ast`, `code-generator`) free of Strudel runtime dependencies.

## Pinned Strudel versions

This package currently depends on:

- `@strudel/web@1.3.0`
- `@strudel/core@1.2.6`

These versions should only be updated deliberately and in a dedicated change, as they influence REPL and playback behaviour.

## Aligning with Strudel’s evaluator

We rely on `@strudel/web`’s `evaluate()` so that behaviour matches the official REPL (strudel.cc):

1. **Wait for init** — We await the promise returned by `initStrudel()` before returning from the first load. That way globals (`s`, `stack`, `note`, etc.) and `prebake` (e.g. samples) are ready before any evaluation. Evaluating before init can yield `null` or throw.
2. **Await the evaluation result** — `evaluate(code)` is async and resolves to the evaluated pattern when the code’s last top-level statement is an expression. We await it and treat the resolved value as the pattern.
3. **Single top-level expression** — The Strudel transpiler adds `return` to the last statement. Our codegen emits a single expression (e.g. `stack(s('bd'), s('sd'))`) so the REPL returns that pattern. Multi-statement or opaque-segment output can still run and play, but the *returned* value may be only the last segment’s result.

## Public API (v0.1)

- `evaluateToPattern(source: string): Promise<Pattern | null>`

Evaluates Strudel source code and resolves to the resulting `Pattern` when successful, or `null` when evaluation fails or does not produce a `Pattern`. Init is awaited before the first evaluation so the result matches Strudel’s REPL.

