import { describe, it, expect } from "vitest";
import { parsePatternGraph } from "./schema.js";

describe("patternGraphSchema", () => {
  it("parses a minimal single-lane graph", () => {
    const json = {
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

    const graph = parsePatternGraph(json);
    expect(graph.graphVersion).toBe(2);
    expect(graph.astVersion).toBe(1);
    expect(graph.root).toBe("lane_drums");
    expect(graph.nodes).toHaveLength(2);
  });
});

