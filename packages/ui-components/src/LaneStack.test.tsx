import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
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

  it("renders and emits cycle length edits when onChangeCycleHint is provided", () => {
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
          // @ts-expect-error - cycleHint is optional in schema
          cycleHint: 3,
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

    const calls: Array<{ laneId: string; hint: number | null }> = [];

    const { container } = render(
      <LaneStack
        graph={graph}
        onChangeBasePattern={() => {}}
        onChangeCycleHint={(laneId, hint) => {
          calls.push({ laneId, hint });
        }}
      />,
    );

    const input = container.querySelector(
      'input[type="number"]',
    ) as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.value).toBe("3");

    if (input) {
      fireEvent.change(input, { target: { value: "4" } });
    }

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ laneId: "lane_drums", hint: 4 });
  });

  it("renders transform args input and emits changes when onChangeTransformArgs is provided", () => {
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
          methods: [
            { id: "m1", name: "slow", args: [2] },
          ],
        },
      ],
      edges: [],
    };

    const calls: Array<{ laneId: string; transformId: string; args: unknown[] }> = [];

    const { getByDisplayValue } = render(
      <LaneStack
        graph={graph}
        onChangeBasePattern={() => {}}
        onChangeTransformArgs={(laneId, transformId, args) => {
          calls.push({ laneId, transformId, args });
        }}
      />,
    );

    const argsInput = getByDisplayValue("2") as HTMLInputElement;
    expect(argsInput).toBeTruthy();

    argsInput.value = "4";
    fireEvent.change(argsInput);

    expect(calls).toHaveLength(1);
    expect(calls[0].laneId).toBe("lane_drums");
    expect(calls[0].args).toEqual([4]);
  });
}

