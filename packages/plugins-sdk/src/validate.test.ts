import { describe, it, expect } from "vitest";
import { validateTransformChain, validatePatternGraph, getSupportedAstVersion } from "./validate.js";

describe("validate", () => {
  it("validateTransformChain accepts valid TransformChain shape", () => {
    const ast = {
      id: "root",
      base: { kind: "s" as const, mini: "bd buddy" },
      methods: [{ id: "m1", name: "slow", args: [2] }],
    };
    expect(validateTransformChain(ast)).toEqual(ast);
  });

  it("validateTransformChain throws on invalid shape", () => {
    expect(() => validateTransformChain({ id: "x", base: { kind: "x", mini: "y" }, methods: [] })).toThrow();
  });

  it("validatePatternGraph accepts valid graph", () => {
    const graph = {
      graphVersion: 2,
      astVersion: 1,
      root: "n1",
      nodes: [
        { id: "n1", type: "transformChain" as const, base: { kind: "s" as const, miniSerialization: "bd" }, methods: [] },
      ],
      edges: [],
    };
    expect(validatePatternGraph(graph).root).toBe("n1");
  });

  it("getSupportedAstVersion returns 1", () => {
    expect(getSupportedAstVersion()).toBe(1);
  });
});
