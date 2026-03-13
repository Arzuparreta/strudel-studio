import { describe, it, expect } from "vitest";
import type { PatternGraph } from "../schema.js";
import { graphToAst } from "./graphToAst.js";

describe("graphToAst", () => {
  it("compiles a transformChain root graph to a TransformChain AST", () => {
    const graph: PatternGraph = {
      graphVersion: 2,
      astVersion: 1,
      root: "n_buddy_chain",
      nodes: [
        {
          id: "n_buddy_chain",
          type: "transformChain",
          base: {
            kind: "s",
            miniSerialization: "bd buddy",
          },
          methods: [
            { id: "m_slow", name: "slow", args: [2] },
            { id: "m_bank", name: "bank", args: ["tr909"] },
          ],
        },
      ],
      edges: [],
    };

    const ast = graphToAst(graph);

    expect(ast.base.kind).toBe("s");
    expect(ast.base.mini).toBe("bd buddy");
    expect(ast.methods.map((m) => m.name)).toEqual(["bank", "slow"]);
  });

  it("compiles a lane root graph by following the head transformChain", () => {
    const graph: PatternGraph = {
      graphVersion: 2,
      astVersion: 1,
      root: "lane_drums",
      nodes: [
        {
          id: "lane_drums",
          type: "lane",
          cycleHint: 1,
          head: "n_drums_chain",
        },
        {
          id: "n_drums_chain",
          type: "transformChain",
          base: {
            kind: "s",
            miniSerialization: "bd buddy",
          },
          methods: [
            { id: "m_bank", name: "bank", args: ["tr909"] },
            { id: "m_slow", name: "slow", args: [2] },
          ],
        },
      ],
      edges: [],
    };

    const ast = graphToAst(graph);

    expect(ast.id).toBe("n_drums_chain");
    expect(ast.base.kind).toBe("s");
    expect(ast.base.mini).toBe("bd buddy");
    expect(ast.methods.map((m) => m.name)).toEqual(["bank", "slow"]);
  });

  it("throws for unsupported root node types", () => {
    const graph: PatternGraph = {
      graphVersion: 2,
      astVersion: 1,
      root: "root_parallel",
      nodes: [
        {
          id: "root_parallel",
          type: "parallel",
          order: [],
        } as any,
      ],
      edges: [],
    };

    expect(() => graphToAst(graph)).toThrow(
      "graphToAst: unsupported root node type: parallel",
    );
  });
});

