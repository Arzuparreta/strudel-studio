import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import type { PatternGraph } from "@strudel-studio/pattern-graph";
import { LaneStack } from "./LaneStack.js";

describe("LaneStack", () => {
  it("derives voices from base mini and passes them to PatternGrid", () => {
    const graph: PatternGraph = {
      graphVersion: 2,
      astVersion: 1,
      root: "root_parallel",
      nodes: [
        {
          id: "root_parallel",
          type: "parallel",
          order: ["lane_drums"],
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
      ],
      edges: [],
    };

    const { container, getAllByText } = render(
      <LaneStack graph={graph} onChangeBasePattern={() => {}} />,
    );

    // Voices should be "bd" and "sd", rendered as row labels.
    expect(getAllByText("bd").length).toBeGreaterThan(0);
    expect(getAllByText("sd").length).toBeGreaterThan(0);

    // PatternGrid should render 2 rows * 4 steps = 8 buttons.
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(8);
  });
}

