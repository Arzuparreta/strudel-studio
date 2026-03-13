import { describe, it, expect } from "vitest";
import { makeOpaqueFromExpression } from "./opaqueExpand.js";

describe("makeOpaqueFromExpression", () => {
  it("uses node start/end when available", () => {
    const source = "s(\"[bd ~]\").unknown(1)";
    const node = { start: 0, end: source.length };

    const opaque = makeOpaqueFromExpression("o1", source, node);

    expect(opaque.sourceRange).toEqual({ start: 0, end: source.length });
    expect(opaque.rawCode).toBe(source);
  });

  it("falls back to whole document when node is missing", () => {
    const source = "s(\"[bd ~]\").unknown(1)";

    const opaque = makeOpaqueFromExpression("o1", source, null);

    expect(opaque.sourceRange).toEqual({ start: 0, end: source.length });
    expect(opaque.rawCode).toBe(source);
  });
});

