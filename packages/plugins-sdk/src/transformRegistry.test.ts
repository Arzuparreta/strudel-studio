import { describe, it, expect } from "vitest";
import {
  TRANSFORM_REGISTRY,
  getTransformSpec,
  coerceTransformArgs,
  type TransformSpec,
} from "./transformRegistry.js";
import { parseTransformArgsString } from "./parseTransformArgs.js";
import { addTransformToLane, graphToAst } from "@strudel-studio/pattern-graph";
import type { PatternGraph } from "@strudel-studio/pattern-graph";

describe("transform registry", () => {
  it("exposes canonical transforms with defaults", () => {
    const names = Object.keys(TRANSFORM_REGISTRY);
    expect(names).toEqual(["bank", "slow", "fast", "gain", "delay", "room"]);

    const slow = getTransformSpec("slow");
    expect(slow).toBeDefined();
    expect(slow?.defaultArgs).toEqual([2]);
  });

  it("coerces args using spec metadata", () => {
    const slow = getTransformSpec("slow");
    const gain = getTransformSpec("gain");
    expect(slow).toBeDefined();
    expect(gain).toBeDefined();

    // slow: factor is number with default 2.
    expect(coerceTransformArgs(slow!, ["3"])).toEqual([3]);
    expect(coerceTransformArgs(slow!, [])).toEqual([2]);

    // gain: amount is number with default 1.
    expect(coerceTransformArgs(gain!, ["0.5"])).toEqual([0.5]);
    expect(coerceTransformArgs(gain!, [])).toEqual([1]);
  });

  it("coerces multi-arg spec (custom args per transform)", () => {
    const multiArgSpec: TransformSpec = {
      name: "custom",
      defaultArgs: [1, "x"],
      args: [
        { name: "n", type: "number", default: 1 },
        { name: "s", type: "string", default: "x" },
      ],
    };
    expect(coerceTransformArgs(multiArgSpec, [])).toEqual([1, "x"]);
    expect(coerceTransformArgs(multiArgSpec, [2])).toEqual([2, "x"]);
    expect(coerceTransformArgs(multiArgSpec, [3, "y"])).toEqual([3, "y"]);
    expect(coerceTransformArgs(multiArgSpec, ["5", "z"])).toEqual([5, "z"]);
  });

  it("parseTransformArgsString + coerce produces valid args (refinement 1)", () => {
    const gain = getTransformSpec("gain");
    const bank = getTransformSpec("bank");
    expect(gain).toBeDefined();
    expect(bank).toBeDefined();

    // Parsed numbers (including -.5) then coerced.
    expect(
      coerceTransformArgs(gain!, parseTransformArgsString("-.5")),
    ).toEqual([-0.5]);
    expect(
      coerceTransformArgs(gain!, parseTransformArgsString("0.5, ")),
    ).toEqual([0.5, undefined]);

    // Empty input → coercion applies defaults.
    expect(coerceTransformArgs(gain!, parseTransformArgsString(""))).toEqual([
      1,
    ]);
    expect(coerceTransformArgs(bank!, parseTransformArgsString(""))).toEqual([
      "tr909",
    ]);

    // Quoted string for bank.
    expect(
      coerceTransformArgs(bank!, parseTransformArgsString('"tr808"')),
    ).toEqual(["tr808"]);
  });

  it("integrates with graph → AST pipeline for a default transform", () => {
    const slow = getTransformSpec("slow");
    expect(slow).toBeDefined();

    const graph: PatternGraph = {
      graphVersion: 2,
      astVersion: 1,
      root: "root_parallel",
      nodes: [
        {
          id: "root_parallel",
          type: "parallel",
          order: ["lane_1"],
        },
        {
          id: "lane_1",
          type: "lane",
          head: "chain_1",
        },
        {
          id: "chain_1",
          type: "transformChain",
          base: { kind: "s", miniSerialization: "bd ~" },
          methods: [],
        },
      ],
      edges: [],
    };

    const withTransform = addTransformToLane(graph, "lane_1", {
      name: slow!.name,
      args: slow!.defaultArgs,
    });

    const doc = graphToAst(withTransform);
    // Root is parallel, so the AST is a stack() composite; inspect first child.
    if (!("call" in doc) || doc.call !== "stack") {
      throw new Error("expected stack composite pattern");
    }
    const firstChild = (doc as any).children?.[0];
    expect(firstChild).toBeDefined();
    expect(firstChild.methods).toHaveLength(1);
    expect(firstChild.methods[0]?.name).toBe("slow");
    expect(firstChild.methods[0]?.args).toEqual([2]);
  });

  it("supports multi-lane graphs with different registry transforms", () => {
    const slow = getTransformSpec("slow");
    const gain = getTransformSpec("gain");
    expect(slow).toBeDefined();
    expect(gain).toBeDefined();

    const graph: PatternGraph = {
      graphVersion: 2,
      astVersion: 1,
      root: "root_parallel",
      nodes: [
        {
          id: "root_parallel",
          type: "parallel",
          order: ["lane_1", "lane_2"],
        },
        {
          id: "lane_1",
          type: "lane",
          head: "chain_1",
        },
        {
          id: "chain_1",
          type: "transformChain",
          base: { kind: "s", miniSerialization: "bd ~" },
          methods: [],
        },
        {
          id: "lane_2",
          type: "lane",
          head: "chain_2",
        },
        {
          id: "chain_2",
          type: "transformChain",
          base: { kind: "s", miniSerialization: "sd ~" },
          methods: [],
        },
      ],
      edges: [],
    };

    const withSlow = addTransformToLane(graph, "lane_1", {
      name: slow!.name,
      args: slow!.defaultArgs,
    });
    const withBoth = addTransformToLane(withSlow, "lane_2", {
      name: gain!.name,
      args: gain!.defaultArgs,
    });

    const doc = graphToAst(withBoth);
    if (!("call" in doc) || doc.call !== "stack") {
      throw new Error("expected stack composite pattern");
    }
    const children = (doc as any).children ?? [];
    expect(children).toHaveLength(2);
    expect(children[0].methods[0]?.name).toBe("slow");
    expect(children[1].methods[0]?.name).toBe("gain");
  });
});

