import { describe, it, expect } from "vitest";
import type {
  TransformChain,
  CompositePattern,
  PatternDoc,
} from "@strudel-studio/pattern-ast";
import { astToGraph } from "./astToGraph.js";
import { graphToAst } from "./graphToAst.js";
import { validatePatternGraph } from "../mutations.js";

describe("astToGraph", () => {
  it("lifts a single TransformChain to a one-lane parallel graph", () => {
    const ast: TransformChain = {
      id: "root",
      base: { kind: "s", mini: "bd ~ sd ~" },
      methods: [
        { id: "m1", name: "bank", args: ["tr909"] },
        { id: "m2", name: "slow", args: [2] },
      ],
    };

    const graph = astToGraph(ast);

    expect(graph.root).toBe("root_parallel");
    expect(graph.nodes).toHaveLength(3);
    const root = graph.nodes.find((n) => n.id === "root_parallel");
    expect(root?.type).toBe("parallel");
    expect((root as { order: string[] }).order).toEqual(["lane_1"]);
    const lane = graph.nodes.find((n) => n.id === "lane_1");
    expect(lane?.type).toBe("lane");
    const chain = graph.nodes.find((n) => n.id === "chain_1");
    expect(chain?.type).toBe("transformChain");
    expect((chain as { base: { kind: string; miniSerialization: string } }).base).toEqual({
      kind: "s",
      miniSerialization: "bd ~ sd ~",
    });
    expect(() => validatePatternGraph(graph)).not.toThrow();
  });

  it("round-trips single chain: graphToAst(astToGraph(ast)) preserves structure", () => {
    const ast: TransformChain = {
      id: "c",
      base: { kind: "note", mini: "c2 eb2" },
      methods: [{ id: "m1", name: "slow", args: [2] }],
    };

    const graph = astToGraph(ast);
    const back: PatternDoc = graphToAst(graph);

    // Single chain becomes one-lane parallel → graphToAst returns stack(chain)
    const chain = "call" in back ? (back as CompositePattern).children[0] : back;
    expect("base" in chain && "methods" in chain).toBe(true);
    expect((chain as TransformChain).base.kind).toBe("note");
    expect((chain as TransformChain).base.mini).toBe("c2 eb2");
    expect((chain as TransformChain).methods.map((m) => m.name)).toEqual(["slow"]);
  });

  it("lifts stack(chain1, chain2) to parallel root with two lanes", () => {
    const ast: CompositePattern = {
      call: "stack",
      children: [
        {
          id: "a",
          base: { kind: "s", mini: "bd ~" },
          methods: [],
        },
        {
          id: "b",
          base: { kind: "s", mini: "sd ~" },
          methods: [],
        },
      ],
    };

    const graph = astToGraph(ast);

    expect(graph.root).toBe("root_parallel");
    const root = graph.nodes.find((n) => n.id === "root_parallel");
    expect((root as { order: string[] }).order).toHaveLength(2);
    expect(() => validatePatternGraph(graph)).not.toThrow();
  });

  it("lifts cat(chain1, chain2) to serial root with two lanes", () => {
    const ast: CompositePattern = {
      call: "cat",
      children: [
        { id: "a", base: { kind: "s", mini: "bd" }, methods: [] },
        { id: "b", base: { kind: "s", mini: "sd" }, methods: [] },
      ],
    };

    const graph = astToGraph(ast);

    expect(graph.root).toBe("root_serial");
    const root = graph.nodes.find((n) => n.id === "root_serial");
    expect(root?.type).toBe("serial");
    expect((root as { order: string[] }).order).toHaveLength(2);
    expect(() => validatePatternGraph(graph)).not.toThrow();
  });
});
