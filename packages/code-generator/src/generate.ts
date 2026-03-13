/**
 * AST → Strudel source. Single spine only; canonical method order.
 * @see docs/implementation-roadmap.md Task 1.4
 */

import type { Literal, TransformChain } from "@strudel-studio/pattern-ast";
import { astVersion, canonicalIndexOf } from "@strudel-studio/pattern-ast";

/** Escape a string for double-quoted JS/Strudel output: backslash and quote. */
export function escapeString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Format a literal as Strudel/JS source (string quoted, number/boolean as-is). */
export function formatLiteral(value: Literal): string {
  if (typeof value === "string") {
    return `"${escapeString(value)}"`;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

/** Emit methods in canonical order; unknown methods after known. */
function sortMethodsByCanonicalOrder(
  chain: TransformChain
): TransformChain["methods"] {
  const version = astVersion;
  return [...chain.methods].sort(
    (a, b) => canonicalIndexOf(version, a.name) - canonicalIndexOf(version, b.name)
  );
}

/**
 * Generate Strudel source from a single-spine TransformChain.
 * Emits base call then methods in canonical order.
 */
export function generate(ast: TransformChain): string {
  const base = ast.base;
  const mini = formatLiteral(base.mini);
  const head =
    base.kind === "s" ? `s(${mini})` : `note(${mini})`;

  const sorted = sortMethodsByCanonicalOrder(ast);
  if (sorted.length === 0) {
    return head;
  }

  const parts = sorted.map(
    (call) =>
      `.${call.name}(${call.args.map(formatLiteral).join(", ")})`
  );
  return head + parts.join("");
}
