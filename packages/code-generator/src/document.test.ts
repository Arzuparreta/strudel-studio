import { describe, it, expect } from "vitest";
import type { OpaqueNode, SourceRange, TransformChain } from "@strudel-studio/pattern-ast";
import { emitDocument } from "./document.js";

function makeOpaque(id: string, rawCode: string, range: SourceRange): OpaqueNode {
  return {
    id,
    rawCode,
    sourceRange: range,
    outputType: "Pattern",
    emitMode: "expression",
  };
}

describe("emitDocument", () => {
  it("emits only AST when no opaques are provided", () => {
    const ast: TransformChain = {
      id: "root",
      base: { kind: "s", mini: "[bd ~]" },
      methods: [],
    };

    const out = emitDocument(ast, []);

    expect(out).toBe('s("[bd ~]")');
  });

  it("emits only opaque regions when AST is null", () => {
    const o1 = makeOpaque("o1", "note(\"c2 eb2\")", { start: 0, end: 12 });
    const o2 = makeOpaque("o2", "// tail comment", { start: 13, end: 28 });

    const out = emitDocument(null, [o1, o2]);
    expect(out).toBe('note("c2 eb2")\n// tail comment');
  });

  it("emits AST followed by opaque regions in order", () => {
    const ast: TransformChain = {
      id: "root",
      base: { kind: "note", mini: "c2 eb2" },
      methods: [],
    };
    const opaque = makeOpaque("o1", "// comment", { start: 0, end: 10 });

    const out = emitDocument(ast, [opaque]);
    expect(out).toBe('note("c2 eb2")\n// comment');
  });
});

