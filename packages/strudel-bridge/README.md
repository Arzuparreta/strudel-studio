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

## Public API (v0.1)

- `evaluateToPattern(source: string): Promise<Pattern | null>`

Evaluates Strudel source code and resolves to the resulting `Pattern` when successful, or `null` when evaluation fails or does not produce a `Pattern`. This is intentionally side-effect free with respect to scheduling; audio output and debounced evaluation are added in later roadmap tasks.

