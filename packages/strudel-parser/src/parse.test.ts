import { describe, it, expect } from "vitest";
import { parseToAstOrOpaque } from "./parse.js";

describe("parseToAstOrOpaque subset parsing", () => {
  it("parses simple s() expression into a TransformChain", () => {
    const source = 's("[bd ~]")';

    const result = parseToAstOrOpaque(source);

    expect(result.opaques).toHaveLength(0);
    expect(result.ast).not.toBeNull();
    expect(result.ast?.base).toEqual({ kind: "s", mini: "[bd ~]" });
    expect(result.ast?.methods).toEqual([]);
  });

  it("parses s() with whitelisted method chain", () => {
    const source = 's("[bd ~]").bank("tr909").slow(2)';

    const result = parseToAstOrOpaque(source);

    expect(result.opaques).toHaveLength(0);
    expect(result.ast).not.toBeNull();
    expect(result.ast?.base).toEqual({ kind: "s", mini: "[bd ~]" });
    expect(result.ast?.methods.map((m) => m.name)).toEqual(["bank", "slow"]);
    expect(result.ast?.methods[0]?.args).toEqual(["tr909"]);
    expect(result.ast?.methods[1]?.args).toEqual([2]);
  });

  it("falls back to a single opaque node for unsupported shapes, bounded to the expression", () => {
    const source = 'unknownFunc("[bd ~]")';

    const result = parseToAstOrOpaque(source);

    expect(result.ast).toBeNull();
    expect(result.opaques).toHaveLength(1);

    const [opaque] = result.opaques;
    expect(opaque.rawCode).toBe(source);
    // For now the opaque range covers the full document expression.
    expect(opaque.sourceRange).toEqual({ start: 0, end: source.length });
    expect(opaque.emitMode).toBe("statementBlock");
  });
});

