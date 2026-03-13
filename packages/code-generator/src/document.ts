/**
 * Full-document emission with opaque regions.
 *
 * For v0.2, this provides a simple contract:
 * - `ast` is emitted via `generate` when present.
 * - `opaques` are emitted by echoing `rawCode` verbatim.
 * - Segments are concatenated in the provided order with a separator.
 *
 * Future phases may extend this to splice generated AST into
 * a richer document model; the contract that opaque `rawCode`
 * is never modified must remain stable.
 *
 * @see docs/architecture.md §7
 * @see docs/implementation-roadmap.md Task 2.1
 */

import type { OpaqueNode, TransformChain } from "@strudel-studio/pattern-ast";
import { generate } from "./generate.js";

export interface EmitDocumentOptions {
  /**
   * Separator string inserted between emitted segments.
   * Defaults to a single newline.
   */
  separator?: string;
}

/**
 * Emit a full Strudel document from a TransformChain plus opaque regions.
 *
 * For initial v0.2 implementation:
 * - When `ast` is non-null, it is emitted first using `generate`.
 * - Each opaque node is emitted by echoing its `rawCode` verbatim.
 * - The caller controls segment ordering by the order of `opaques`.
 */
export function emitDocument(
  ast: TransformChain | null,
  opaques: readonly OpaqueNode[],
  options?: EmitDocumentOptions,
): string {
  const separator = options?.separator ?? "\n";
  const segments: string[] = [];

  if (ast) {
    segments.push(generate(ast));
  }

  for (const opaque of opaques) {
    segments.push(opaque.rawCode);
  }

  return segments.join(separator);
}

