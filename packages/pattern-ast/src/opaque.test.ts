import { describe, it, expect } from "vitest";
import type {
  OpaqueEmitMode,
  OpaqueNode,
  OpaqueParentComposition,
  SourceRange,
} from "./index.js";

describe("opaque AST types", () => {
  it("allow constructing a minimal OpaqueNode value", () => {
    const range: SourceRange = { start: 0, end: 10 };
    const parent: OpaqueParentComposition = { call: "stack", argIndex: 1 };
    const emitMode: OpaqueEmitMode = "expression";

    const node: OpaqueNode = {
      id: "opaque_1",
      rawCode: "note(sine.range(0,12))",
      sourceRange: range,
      outputType: "Pattern",
      dependencies: [],
      parentComposition: parent,
      emitMode,
    };

    expect(node.id).toBe("opaque_1");
    expect(node.sourceRange).toEqual({ start: 0, end: 10 });
    expect(node.emitMode).toBe("expression");
  });
});

