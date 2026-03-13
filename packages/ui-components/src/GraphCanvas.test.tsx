import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import type { PatternGraph } from "@strudel-studio/pattern-graph";
import { GraphCanvas } from "./GraphCanvas.js";

describe("GraphCanvas", () => {
  it("renders parallel root and its lanes", () => {
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
          head: "chain_drums",
        },
        {
          id: "chain_drums",
          type: "transformChain",
          base: { kind: "s", miniSerialization: "bd ~ sd ~" },
          methods: [],
        },
        {
          id: "lane_bass",
          type: "lane",
          head: "chain_bass",
        },
        {
          id: "chain_bass",
          type: "transformChain",
          base: { kind: "s", miniSerialization: "c2 ~ g2 ~" },
          methods: [],
        },
      ],
      edges: [],
    };

    const { getByText } = render(<GraphCanvas graph={graph} />);

    // Root label should mention parallel and the two lanes.
    expect(getByText(/parallel/i)).toBeTruthy();
    expect(getByText("lane_drums")).toBeTruthy();
    expect(getByText("lane_bass")).toBeTruthy();
  });
});

