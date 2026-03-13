/**
 * Strudel subset parser entrypoint.
 *
 * For v0.2, this package is responsible for:
 * - Parsing Strudel/JS source into Pattern AST where supported.
 * - Emitting opaque regions for unsupported or unparsed code.
 *
 * The initial implementation deliberately parses nothing and
 * returns the entire document as a single opaque region. This
 * is a safe fallback that preserves user code verbatim until
 * the subset parser is implemented incrementally.
 *
 * @see docs/implementation-roadmap.md Phase v0.2
 */

export type { ParseResult } from "./parse.js";
export { parseToAstOrOpaque } from "./parse.js";

