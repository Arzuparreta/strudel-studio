import type { OpaqueNode, SourceRange } from "@strudel-studio/pattern-ast";

/**
 * Create an opaque node that covers the enclosing ExpressionStatement
 * (or the whole document as a fallback).
 *
 * For v0.2 we keep this utility minimal: use `node.start`/`node.end`
 * when available from Acorn, else fall back to the full [0, length)
 * range.
 */
export function makeOpaqueFromExpression(
  id: string,
  source: string,
  stmtNode: { start?: number; end?: number } | null | undefined,
): OpaqueNode {
  const fallback: SourceRange = { start: 0, end: source.length };

  const range: SourceRange =
    stmtNode && typeof stmtNode.start === "number" && typeof stmtNode.end === "number"
      ? { start: stmtNode.start, end: stmtNode.end }
      : fallback;

  return {
    id,
    rawCode: source.slice(range.start, range.end),
    sourceRange: range,
    outputType: "unknown",
    emitMode: "statementBlock",
  };
}

