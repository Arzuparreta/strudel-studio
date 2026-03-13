/**
 * Opaque Pattern AST nodes.
 *
 * Preserve arbitrary Strudel/JS regions that the visual AST cannot represent.
 * These nodes must be echoed verbatim by code generation.
 *
 * @see docs/architecture.md §7
 * @see docs/implementation-roadmap.md Phase v0.2, Task 2.1
 */

import type { NodeId } from "./types.js";

/** Closed set of emit modes for opaque regions. */
export type OpaqueEmitMode = "expression" | "statementBlock" | "verbatimOnly";

/** Half-open character range in the source document: [start, end). */
export interface SourceRange {
  start: number;
  end: number;
}

/** Parent composition context when opaque is one argument of stack/cat. */
export interface OpaqueParentComposition {
  call: "stack" | "cat";
  argIndex: number;
}

/**
 * Opaque node schema.
 *
 * Does not depend on Strudel runtime; describes how to re-emit code only.
 */
export interface OpaqueNode {
  /** Stable node id shared with UI and Monaco bindings. */
  id: NodeId;
  /** Exact substring that must be echoed verbatim during codegen. */
  rawCode: string;
  /** Character range in the source document. */
  sourceRange: SourceRange;
  /** Hint for downstream tooling; opaque to this package. */
  outputType: "Pattern" | "unknown";
  /** Optional free identifier dependencies required at eval time. */
  dependencies?: string[];
  /** Optional parent composition context when used as stack/cat argument. */
  parentComposition?: OpaqueParentComposition;
  /** Emit mode controls where/how this opaque can be spliced. */
  emitMode: OpaqueEmitMode;
}

