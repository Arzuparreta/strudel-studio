/**
 * Pattern AST v1 types.
 * Chain + call + literal; stable `id` on nodes.
 * @see docs/implementation-roadmap.md Task 1.2
 * @see docs/architecture.md §4, §5
 */

export const astVersion = 1;

/** Stable node id for UI binding, rebinding, and codegen. */
export type NodeId = string;

/** Literal values allowed in method arguments (v0.1). */
export type Literal = string | number | boolean;

/** Character range in the source document: [start, end). */
export interface MiniSourceRange {
  start: number;
  end: number;
}

/** Base pattern constructor: `s("mini")` or `note("mini")`. */
export interface BaseCall {
  kind: "s" | "note";
  /** Mini notation string (e.g. "[bd ~] [sd ~]" or "c2 eb2"). */
  mini: string;
  /**
   * Optional source range for the mini string literal, when known.
   * This is populated by the subset parser (v0.2) so later phases
   * can map edits in the mini string back to AST/graph paths.
   */
  miniRange?: MiniSourceRange;
}

/** Single method invocation in a chain (e.g. `.bank("tr909")`, `.slow(2)`). */
export interface Call {
  id: NodeId;
  name: string;
  args: Literal[];
}

/** Ordered list of chain method calls. Codegen must emit in canonical order. */
export type ChainMethods = Call[];

/** Single-spine transform chain: base pattern + ordered method chain. */
export interface TransformChain {
  id: NodeId;
  base: BaseCall;
  methods: ChainMethods;
}
