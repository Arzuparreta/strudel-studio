import { describe, it, expect } from "vitest";
import { getTopLevelTrackIds, getNodeLabel } from "./laneStackUtils.js";
import type { PatternGraph } from "@strudel-studio/pattern-graph";

describe("laneStackUtils", () => {
  it("getTopLevelTrackIds returns single root for transformChain root", () => {
    const graph: PatternGraph = {
      graphVersion: 2,
      astVersion: 1,
      root: "chain",
      nodes: [
        {
          id: "chain",
          type: "transformChain",
          base: { kind: "s", miniSerialization: "bd ~" },
          methods: [],
        },
      ],
      edges: [],
    };
    expect(getTopLevelTrackIds(graph)).toEqual(["chain"]);
  });

  it("getTopLevelTrackIds returns order for parallel root", () => {
    const graph: PatternGraph = {
      graphVersion: 2,
      astVersion: 1,
      root: "root_parallel",
      nodes: [
        { id: "root_parallel", type: "parallel", order: ["lane_a", "lane_b"] },
        { id: "lane_a", type: "lane", head: "chain_a" },
        { id: "chain_a", type: "transformChain", base: { kind: "s", miniSerialization: "bd" }, methods: [] },
        { id: "lane_b", type: "lane", head: "chain_b" },
        { id: "chain_b", type: "transformChain", base: { kind: "s", miniSerialization: "sd" }, methods: [] },
      ],
      edges: [],
    };
    expect(getTopLevelTrackIds(graph)).toEqual(["lane_a", "lane_b"]);
  });

  it("getNodeLabel returns chain summary for transformChain node", () => {
    const graph: PatternGraph = {
      graphVersion: 2,
      astVersion: 1,
      root: "c",
      nodes: [
        {
          id: "c",
          type: "transformChain",
          base: { kind: "s", miniSerialization: "bd ~ sd" },
          methods: [{ id: "m1", name: "slow", args: [2] }],
        },
      ],
      edges: [],
    };
    expect(getNodeLabel(graph, "c")).toContain('s("bd ~ sd")');
    expect(getNodeLabel(graph, "c")).toContain("slow");
  });
});
