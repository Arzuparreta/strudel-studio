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
    // Transform order must be preserved as defined in the graph.
    expect(ast.methods.map((m) => m.name)).toEqual(["slow", "bank"]);
  });

  it("compiles a lane root graph and applies cycleHint as a slow transform when no explicit slow is present", () => {
    const graph: PatternGraph = {
      graphVersion: 2,
      astVersion: 1,
      root: "lane_drums",
      nodes: [
        {
          id: "lane_drums",
          type: "lane",
          cycleHint: 2,
          head: "n_drums_chain",
        },
        {
          id: "n_drums_chain",
          type: "transformChain",
          base: {
            kind: "s",
            miniSerialization: "bd buddy",
          },
          methods: [{ id: "m_bank", name: "bank", args: ["tr909"] }],
        },
      ],
      edges: [],
    };

    const ast = graphToAst(graph);

    expect(ast.id).toBe("n_drums_chain");
    expect(ast.base.kind).toBe("s");
    expect(ast.base.mini).toBe("bd buddy");
    expect(ast.methods.map((m) => m.name)).toEqual(["bank", "slow"]);
    const slow = ast.methods.find((m) => m.name === "slow");
    expect(slow?.args).toEqual([2]);
  });

  it("compiles a parallel root to stack(child1, child2) with deterministic order", () => {
    const graph: PatternGraph = {
      graphVersion: 2,
      astVersion: 1,
      root: "root_parallel",
      nodes: [
        {
          id: "root_parallel",
          type: "parallel",
          order: ["lane_drums", "lane_bass"],
        },
        {
          id: "lane_drums",
          type: "lane",
          head: "n_drums",
        },
        {
          id: "n_drums",
          type: "transformChain",
          base: { kind: "s", miniSerialization: "bd ~ sd ~" },
          methods: [],
        },
        {
          id: "lane_bass",
          type: "lane",
          head: "n_bass",
        },
        {
          id: "n_bass",
          type: "transformChain",
          base: { kind: "s", miniSerialization: "eb2 buddy" },
          methods: [],
        },
      ],
      edges: [],
    };

    const doc = graphToAst(graph);
    expect(doc).toHaveProperty("call", "stack");
    expect(doc).toHaveProperty("children");
    const children = (doc as { call: string; children: unknown[] }).children;
    expect(children).toHaveLength(2);
    expect(children[0]).toHaveProperty("base");
    expect((children[0] as { base: { mini: string } }).base.mini).toBe("bd ~ sd ~");
    expect((children[1] as { base: { mini: string } }).base.mini).toBe("eb2 buddy");
  });

  it("compiles a serial root to cat(child1, child2)", () => {
    const graph: PatternGraph = {
      graphVersion: 2,
      astVersion: 1,
      root: "root_serial",
      nodes: [
        {
          id: "root_serial",
          type: "serial",
          order: ["chain_a", "chain_b"],
        },
        {
          id: "chain_a",
          type: "transformChain",
          base: { kind: "s", miniSerialization: "bd ~" },
          methods: [],
        },
        {
          id: "chain_b",
          type: "transformChain",
          base: { kind: "s", miniSerialization: "sd ~" },
          methods: [],
        },
      ],
      edges: [],
    };

    const doc = graphToAst(graph);
    expect(doc).toHaveProperty("call", "cat");
    const children = (doc as { call: string; children: unknown[] }).children;
    expect(children).toHaveLength(2);
    expect((children[0] as { base: { mini: string } }).base.mini).toBe("bd ~");
    expect((children[1] as { base: { mini: string } }).base.mini).toBe("sd ~");
  });

  it("throws for unsupported root node types (e.g. opaque)", () => {
    const graph: PatternGraph = {
      graphVersion: 2,
      astVersion: 1,
      root: "root_opaque",
      nodes: [
        {
          id: "root_opaque",
          type: "opaque",
          rawCode: "something()",
        },
      ],
      edges: [],
    };

    expect(() => graphToAst(graph)).toThrow(
      "graphToAst: unsupported node type: opaque",
    );
  });
});

