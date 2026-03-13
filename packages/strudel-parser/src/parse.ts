import { parse } from "acorn";
import type {
  Literal,
  OpaqueNode,
  SourceRange,
  TransformChain,
} from "@strudel-studio/pattern-ast";
import { isKnownMethod } from "./whitelist.js";
import { makeOpaqueFromExpression } from "./opaqueExpand.js";

/**
 * Result of parsing a Strudel source document.
 *
 * - `ast` is a TransformChain for the supported subset (single-spine).
 * - `opaques` is a list of opaque regions that must be echoed verbatim.
 */
export interface ParseResult {
  ast: TransformChain | null;
  opaques: OpaqueNode[];
}

function makeWholeDocumentOpaque(source: string): ParseResult {
  const range: SourceRange = { start: 0, end: source.length };
  const opaque: OpaqueNode = {
    id: "opaque_whole_document",
    rawCode: source,
    sourceRange: range,
    outputType: "unknown",
    emitMode: "statementBlock",
  };
  return { ast: null, opaques: [opaque] };
}

/**
 * Best-effort subset parser for v0.2:
 * - Supports a single top-level expression of the form
 *   `s("mini")` or `note("mini")` with optional whitelisted
 *   method chains (e.g. `.bank("tr909").slow(2)`).
 * - Falls back to a single opaque node for all other inputs.
 */
export function parseToAstOrOpaque(source: string): ParseResult {
  let program;
  try {
    program = parse(source, {
      ecmaVersion: "latest",
      sourceType: "module",
      locations: false,
    }) as any;
  } catch {
    return makeWholeDocumentOpaque(source);
  }

  const body = program.body as any[];
  if (body.length !== 1 || body[0].type !== "ExpressionStatement") {
    return makeWholeDocumentOpaque(source);
  }

  const stmt = body[0];
  const expr = stmt.expression;

  // Extract base + methods from supported expression shapes.
  const chain = extractTransformChain(expr, source);
  if (!chain) {
    const opaque = makeOpaqueFromExpression(
      "opaque_expression",
      source,
      stmt,
    );
    return {
      ast: null,
      opaques: [opaque],
    };
  }

  return {
    ast: chain,
    opaques: [],
  };
}

type CallExpression = any;
type MemberExpression = any;
type Identifier = any;
type LiteralNode = any;

function isIdentifier(node: any): node is Identifier {
  return node && node.type === "Identifier" && typeof node.name === "string";
}

function isLiteralNode(node: any): node is LiteralNode {
  return node && node.type === "Literal";
}

function extractLiteral(node: LiteralNode): Literal | null {
  if (typeof node.value === "string" || typeof node.value === "number" || typeof node.value === "boolean") {
    return node.value as Literal;
  }
  return null;
}

/**
 * Extract a TransformChain from an expression if it matches the
 * supported subset; otherwise return null.
 */
function extractTransformChain(expr: any, source: string): TransformChain | null {
  // We expect a CallExpression whose callee may be an Identifier
  // (`s`, `note`) or a MemberExpression (method call).
  if (expr.type !== "CallExpression") {
    return null;
  }

  // Walk the chain from the outermost call inward, collecting
  // method calls and finding the base `s` / `note` call.
  const methods: { name: string; args: Literal[] }[] = [];
  let current: CallExpression | MemberExpression | Identifier = expr;

  while (true) {
    if (current.type === "CallExpression") {
      const callee = current.callee;
      if (callee.type === "Identifier") {
        // Base call.
        if (callee.name !== "s" && callee.name !== "note") {
          return null;
        }
        // Expect exactly one literal argument for mini string.
        if (current.arguments.length !== 1 || !isLiteralNode(current.arguments[0])) {
          return null;
        }
        const mini = extractLiteral(current.arguments[0] as LiteralNode);
        if (mini == null || typeof mini !== "string") {
          return null;
        }
        // We reached the base; stop walking.
        const baseKind = callee.name as "s" | "note";
        return {
          id: "root",
          base: {
            kind: baseKind,
            mini,
          },
          methods: methods.reverse().map((m, index) => ({
            id: `m${index + 1}`,
            name: m.name,
            args: m.args,
          })),
        };
      } else if (callee.type === "MemberExpression") {
        // Method call on previous expression.
        const property = callee.property;
        if (!isIdentifier(property)) {
          return null;
        }
        const methodName = property.name;
        if (!isKnownMethod(methodName)) {
          return null;
        }
        const args: Literal[] = [];
        for (const arg of current.arguments as any[]) {
          if (!isLiteralNode(arg)) {
            return null;
          }
          const lit = extractLiteral(arg);
          if (lit == null) {
            return null;
          }
          args.push(lit);
        }
        methods.push({ name: methodName, args });
        current = callee.object;
        continue;
      } else {
        return null;
      }
    } else if (current.type === "MemberExpression") {
      // Chained property access without call is unsupported.
      return null;
    } else {
      return null;
    }
  }
}

