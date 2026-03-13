import { describe, it, expect } from "vitest";
import type { PatternGraph } from "./schema.js";
import {
  addLane,
  deleteLane,
  renameLane,
  reorderParallelLanes,
  reorderSerialChildren,
  setLaneCycleHint,
  changeLaneBasePattern,
  addTransformToLane,
  updateLaneTransformArgs,
  removeTransformFromLane,
  reorderLaneTransforms,
  validatePatternGraph,
} from "./mutations.js";

const baseGraph: PatternGraph = {
  graphVersion: 2,
  astVersion: 1,
  root: "root_parallel",
  nodes: [
    {
      id: "root_parallel",
      type: "parallel",
      order: [],
    },
  ],
  edges: [],
};

describe("PatternGraph lane mutations", () => {
  it("addLane creates a lane and chain and attaches to root order", () => {
    const { graph, laneId } = addLane(baseGraph, {
      basePatternMini: "bd ~ sd ~",
      name: "Drums",
    });

    const lane = graph.nodes.find((n) => n.id === laneId);
    expect(lane && lane.type).toBe("lane");

    const root = graph.nodes.find((n) => n.id === graph.root);
    expect(root && root.type).toBe("parallel");
    expect((root as { order?: string[] }).order).toContain(laneId);

    // validate should succeed
    expect(() => validatePatternGraph(graph)).not.toThrow();
  });

  it("deleteLane removes lane and its chain and updates root order", () => {
    const { graph: withLane, laneId } = addLane(baseGraph, {
      basePatternMini: "bd ~ sd ~",
    });
    const lane = withLane.nodes.find((n) => n.id === laneId && n.type === "lane");
    expect(lane).toBeDefined();

    const afterDelete = deleteLane(withLane, laneId);
    expect(afterDelete.nodes.find((n) => n.id === laneId)).toBeUndefined();
  });

  it("reorderParallelLanes updates root order", () => {
    const { graph: g1, laneId: id1 } = addLane(baseGraph, {
      basePatternMini: "bd",
    });
    const { graph: g2, laneId: id2 } = addLane(g1, { basePatternMini: "sd" });
    const rootBefore = g2.nodes.find((n) => n.id === g2.root) as {
      id: string;
      type: string;
      order: string[];
    };
    expect(rootBefore.order).toEqual([id1, id2]);

    const reordered = reorderParallelLanes(g2, [id2, id1]);
    const rootAfter = reordered.nodes.find((n) => n.id === reordered.root) as {
      id: string;
      type: string;
      order: string[];
    };
    expect(rootAfter.order).toEqual([id2, id1]);
    expect(() => validatePatternGraph(reordered)).not.toThrow();
  });

  it("renameLane updates the lane name hint", () => {
    const { graph, laneId } = addLane(baseGraph);
    const renamed = renameLane(graph, laneId, "My Lane");
    const lane = renamed.nodes.find((n) => n.id === laneId);
    // @ts-expect-error - name is an optional UI field
    expect((lane as any).name).toBe("My Lane");
  });

  it("setLaneCycleHint updates or clears the lane cycle hint", () => {
    const { graph, laneId } = addLane(baseGraph);

    const withHint = setLaneCycleHint(graph, laneId, 4);
    const laneWithHint = withHint.nodes.find(
      (n) => n.id === laneId && n.type === "lane",
    ) as any;
    expect(laneWithHint.cycleHint).toBe(4);

    const cleared = setLaneCycleHint(withHint, laneId, null);
    const laneCleared = cleared.nodes.find(
      (n) => n.id === laneId && n.type === "lane",
    ) as any;
    expect(laneCleared.cycleHint).toBeUndefined();

    // Graph should still validate after changing hints.
    expect(() => validatePatternGraph(withHint)).not.toThrow();
    expect(() => validatePatternGraph(cleared)).not.toThrow();
  });

  it("changeLaneBasePattern updates the base mini string", () => {
    const { graph, laneId } = addLane(baseGraph, {
      basePatternMini: "bd ~ sd ~",
    });
    const updated = changeLaneBasePattern(graph, laneId, "bd ~");
    const lane = updated.nodes.find((n) => n.id === laneId && n.type === "lane")!;
    const chain = updated.nodes.find(
      (n) => n.id === (lane as any).head && n.type === "transformChain",
    ) as any;
    expect(chain.base.miniSerialization).toBe("bd ~");
  });

  it("addTransformToLane only appends; existing transforms unchanged (refinement 4)", () => {
    const { graph, laneId } = addLane(baseGraph);
    const withSlow = addTransformToLane(graph, laneId, {
      name: "slow",
      args: [2],
    });
    const lane1 = withSlow.nodes.find((n) => n.id === laneId && n.type === "lane") as any;
    const chain1 = withSlow.nodes.find(
      (n) => n.id === lane1.head && n.type === "transformChain",
    ) as any;
    expect(chain1.methods).toHaveLength(1);
    expect(chain1.methods[0].name).toBe("slow");

    const withGain = addTransformToLane(withSlow, laneId, {
      name: "gain",
      args: [0.5],
    });
    const lane2 = withGain.nodes.find((n) => n.id === laneId && n.type === "lane") as any;
    const chain2 = withGain.nodes.find(
      (n) => n.id === lane2.head && n.type === "transformChain",
    ) as any;
    expect(chain2.methods).toHaveLength(2);
    expect(chain2.methods[0].name).toBe("slow");
    expect(chain2.methods[1].name).toBe("gain");
  });

  it("add/remove/reorder transforms preserves user-defined order", () => {
    const { graph, laneId } = addLane(baseGraph);
    const withBank = addTransformToLane(graph, laneId, {
      name: "bank",
      args: ["tr909"],
    });
    const withSlow = addTransformToLane(withBank, laneId, {
      name: "slow",
      args: [2],
    });

    const lane = withSlow.nodes.find((n) => n.id === laneId && n.type === "lane")!;
    const chain = withSlow.nodes.find(
      (n) => n.id === (lane as any).head && n.type === "transformChain",
    ) as any;

    expect(chain.methods.map((m: any) => m.name)).toEqual(["bank", "slow"]);

    const reordered = reorderLaneTransforms(withSlow, laneId, [
      chain.methods[1].id,
      chain.methods[0].id,
    ]);
    const lane2 = reordered.nodes.find(
      (n) => n.id === laneId && n.type === "lane",
    )!;
    const chain2 = reordered.nodes.find(
      (n) => n.id === (lane2 as any).head && n.type === "transformChain",
    ) as any;
    expect(chain2.methods.map((m: any) => m.name)).toEqual(["slow", "bank"]);

    const removed = removeTransformFromLane(reordered, laneId, chain2.methods[0].id);
    const lane3 = removed.nodes.find(
      (n) => n.id === laneId && n.type === "lane",
    )!;
    const chain3 = removed.nodes.find(
      (n) => n.id === (lane3 as any).head && n.type === "transformChain",
    ) as any;
    expect(chain3.methods.map((m: any) => m.name)).toEqual(["bank"]);
  });

  it("updateLaneTransformArgs updates arguments for a specific transform", () => {
    const { graph, laneId } = addLane(baseGraph);
    const withSlow = addTransformToLane(graph, laneId, {
      name: "slow",
      args: [2],
    });

    const lane = withSlow.nodes.find(
      (n) => n.id === laneId && n.type === "lane",
    ) as any;
    const chain = withSlow.nodes.find(
      (n) => n.id === lane.head && n.type === "transformChain",
    ) as any;

    const slowId = chain.methods[0].id as string;
    const updated = updateLaneTransformArgs(withSlow, laneId, slowId, [4]);
    const laneUpdated = updated.nodes.find(
      (n) => n.id === laneId && n.type === "lane",
    ) as any;
    const chainUpdated = updated.nodes.find(
      (n) => n.id === laneUpdated.head && n.type === "transformChain",
    ) as any;

    expect(chainUpdated.methods[0].args).toEqual([4]);
  });

  it("validatePatternGraph rejects non-composition root", () => {
    const bad: PatternGraph = {
      graphVersion: 2,
      astVersion: 1,
      root: "lane_root",
      nodes: [
        {
          id: "lane_root",
          type: "lane",
          head: "chain",
        } as any,
        {
          id: "chain",
          type: "transformChain",
          base: { kind: "s", miniSerialization: "bd" },
          methods: [],
        },
      ],
      edges: [],
    };

    expect(() => validatePatternGraph(bad)).toThrow(
      /root must be parallel or serial composition/,
    );
  });

  it("addLane and deleteLane work with serial root", () => {
    const serialBase: PatternGraph = {
      graphVersion: 2,
      astVersion: 1,
      root: "root_serial",
      nodes: [{ id: "root_serial", type: "serial", order: [] }],
      edges: [],
    };

    const { graph: withLane, laneId } = addLane(serialBase, {
      basePatternMini: "bd",
    });
    const root = withLane.nodes.find((n) => n.id === withLane.root) as {
      order?: string[];
    };
    expect(root.order).toContain(laneId);
    expect(() => validatePatternGraph(withLane)).not.toThrow();

    const afterDelete = deleteLane(withLane, laneId);
    expect(afterDelete.nodes.find((n) => n.id === laneId)).toBeUndefined();
  });

  it("reorderSerialChildren updates serial root order", () => {
    const serialBase: PatternGraph = {
      graphVersion: 2,
      astVersion: 1,
      root: "root_serial",
      nodes: [{ id: "root_serial", type: "serial", order: [] }],
      edges: [],
    };
    const { graph: g1, laneId: id1 } = addLane(serialBase, {
      basePatternMini: "bd",
    });
    const { graph: g2, laneId: id2 } = addLane(g1, { basePatternMini: "sd" });
    const rootBefore = g2.nodes.find((n) => n.id === g2.root) as {
      type: string;
      order: string[];
    };
    expect(rootBefore.type).toBe("serial");
    expect(rootBefore.order).toEqual([id1, id2]);

    const reordered = reorderSerialChildren(g2, [id2, id1]);
    const rootAfter = reordered.nodes.find((n) => n.id === reordered.root) as {
      order: string[];
    };
    expect(rootAfter.order).toEqual([id2, id1]);
    expect(() => validatePatternGraph(reordered)).not.toThrow();
  });
});

