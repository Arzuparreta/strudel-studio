/**
 * AST → Strudel source. Single spine only; canonical method order.
 * @see docs/implementation-roadmap.md Task 1.4
 */

import type {
  Literal,
  TransformChain,
  CompositePattern,
  PatternDoc,
} from "@strudel-studio/pattern-ast";

function isComposite(doc: PatternDoc): doc is CompositePattern {
  return "call" in doc && "children" in doc;
}

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

/**
 * Generate Strudel source from a single-spine TransformChain.
 * Emits base call then methods in canonical order.
 */
export function generate(ast: TransformChain): string {
  const base = ast.base;
  const mini = formatLiteral(base.mini);
  const head =
    base.kind === "s" ? `s(${mini})` : `note(${mini})`;

  const methods = ast.methods;
  if (methods.length === 0) {
    return head;
  }

  // Transform order is user-defined and must be preserved as-is.
  const parts = methods.map(
    (call) =>
      `.${call.name}(${call.args.map(formatLiteral).join(", ")})`
  );
  return head + parts.join("");
}

/** True if doc is the silence pattern (v1.2 lane mute). */
function isSilence(doc: PatternDoc): doc is { silence: true } {
  return typeof doc === "object" && doc !== null && "silence" in doc && (doc as { silence: unknown }).silence === true;
}

/**
 * Generate Strudel source from a PatternDoc (single chain, stack/cat composition, or silence).
 * Deterministic: child order follows the AST order.
 * @see docs/implementation-roadmap.md Task 3.2 (multi-track)
 */
export function generateDocument(doc: PatternDoc): string {
  if (isSilence(doc)) {
    return "silence";
  }
  if (isComposite(doc)) {
    const args = doc.children.map((child) => generateDocument(child));
    return `${doc.call}(${args.join(", ")})`;
  }
  return generate(doc);
}
