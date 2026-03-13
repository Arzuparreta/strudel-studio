import type {
  PatternGraph,
  GraphNode,
  LaneNode,
  TransformChainNode,
  CompositionNode,
} from "./schema.js";

type LaneId = string;
type TransformId = string;

function cloneGraph(graph: PatternGraph): PatternGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => ({ ...n })),
    edges: graph.edges.map((e) => ({ ...e })),
  };
}

function findNode(graph: PatternGraph, id: string): GraphNode {
  const node = graph.nodes.find((n) => n.id === id);
  if (!node) {
    throw new Error(`PatternGraph: node not found: ${id}`);
  }
  return node;
}

function asLane(node: GraphNode): LaneNode {
  if (node.type !== "lane") {
    throw new Error(`PatternGraph: expected lane node, got ${node.type}`);
  }
  return node;
}

function asTransformChain(node: GraphNode): TransformChainNode {
  if (node.type !== "transformChain") {
    throw new Error(
      `PatternGraph: expected transformChain node, got ${node.type}`,
    );
  }
  return node;
}

function asComposition(node: GraphNode): CompositionNode {
  if (node.type !== "parallel" && node.type !== "serial") {
    throw new Error(
      `PatternGraph: expected composition node, got ${node.type}`,
    );
  }
  return node;
}

function getRootComposition(graph: PatternGraph): CompositionNode {
  const rootNode = findNode(graph, graph.root);
  if (rootNode.type !== "parallel") {
    throw new Error(
      `PatternGraph: lane editor requires parallel root, got ${rootNode.type}`,
    );
  }
  return rootNode as CompositionNode;
}

function collectIds(graph: PatternGraph): Set<string> {
  return new Set(graph.nodes.map((n) => n.id));
}

function nextId(prefix: string, existing: Set<string>): string {
  let i = 1;
  // Deterministic, collision-free id generation.
  while (existing.has(`${prefix}${i}`)) {
    i += 1;
  }
  return `${prefix}${i}`;
}

function laneForId(graph: PatternGraph, laneId: LaneId): LaneNode {
  const lane = asLane(findNode(graph, laneId));
  return lane;
}

function chainForLane(graph: PatternGraph, laneId: LaneId): TransformChainNode {
  const lane = laneForId(graph, laneId);
  const head = asTransformChain(findNode(graph, lane.head));
  return head;
}

/**
 * Add a new lane with its own transformChain and attach it to the parallel root.
 *
 * - Generates deterministic ids for lane and chain.
 * - Appends the lane id to root.order (creating it if needed).
 */
export function addLane(
  graph: PatternGraph,
  options?: { basePatternMini?: string; name?: string },
): { graph: PatternGraph; laneId: LaneId } {
  const cloned = cloneGraph(graph);
  const ids = collectIds(cloned);
  const root = getRootComposition(cloned);

  const laneId = nextId("lane_", ids);
  ids.add(laneId);
  const chainId = nextId("chain_", ids);
  ids.add(chainId);

  const basePatternMini = options?.basePatternMini ?? 'bd ~ sd ~';

  const laneNode: LaneNode = {
    id: laneId,
    type: "lane",
    // Optional in schema; default cycle length is 1.
    cycleHint: 1,
    head: chainId,
    // name is optional; when absent, UI falls back to id.
    // @ts-expect-error - name is allowed by schema via passthrough.
    name: options?.name,
  };

  const chainNode: TransformChainNode = {
    id: chainId,
    type: "transformChain",
    base: {
      kind: "s",
      miniSerialization: basePatternMini,
    },
    methods: [],
  };

  cloned.nodes = [...cloned.nodes, laneNode, chainNode];

  const rootIndex = cloned.nodes.findIndex((n) => n.id === root.id);
  const updatedRoot: CompositionNode = {
    ...root,
    order: root.order ? [...root.order, laneId] : [laneId],
  };
  cloned.nodes = [
    ...cloned.nodes.slice(0, rootIndex),
    updatedRoot,
    ...cloned.nodes.slice(rootIndex + 1),
  ];

  return { graph: cloned, laneId };
}

/**
 * Delete a lane and its associated transformChain from the graph, and detach
 * it from the parallel root. Throws if the lane does not exist.
 */
export function deleteLane(
  graph: PatternGraph,
  laneId: LaneId,
): PatternGraph {
  const cloned = cloneGraph(graph);
  const root = getRootComposition(cloned);

  const lane = laneForId(cloned, laneId);
  const chainId = lane.head;

  const remainingNodes = cloned.nodes.filter(
    (n) => n.id !== laneId && n.id !== chainId,
  );

  const updatedRoot: CompositionNode = {
    ...root,
    order: (root.order ?? []).filter((id) => id !== laneId),
  };

  const nodesWithRoot = remainingNodes.map((n) =>
    n.id === root.id ? updatedRoot : n,
  );

  return {
    ...cloned,
    nodes: nodesWithRoot,
  };
}

/**
 * Rename a lane by updating its optional display name.
 * Lane ids remain stable; only the name hint used by UIs changes.
 */
export function renameLane(
  graph: PatternGraph,
  laneId: LaneId,
  newName: string,
): PatternGraph {
  const cloned = cloneGraph(graph);
  const lane = laneForId(cloned, laneId);

  const updatedLane: LaneNode = {
    ...lane,
    // @ts-expect-error - name is allowed by schema via passthrough.
    name: newName,
  };

  cloned.nodes = cloned.nodes.map((n) => (n.id === laneId ? updatedLane : n));
  return cloned;
}

/**
 * Update the optional cycle length hint for a lane.
 *
 * - When cycleHint is a positive number and not 1, it is stored on the lane.
 * - When cycleHint is null, 1, or a non-positive number, the hint is removed so
 *   codegen falls back to the default behavior.
 */
export function setLaneCycleHint(
  graph: PatternGraph,
  laneId: LaneId,
  cycleHint: number | null,
): PatternGraph {
  const cloned = cloneGraph(graph);
  const lane = laneForId(cloned, laneId);

  const normalized =
    typeof cycleHint === "number" && Number.isFinite(cycleHint) && cycleHint > 0
      ? cycleHint
      : undefined;

  const updatedLane: LaneNode = {
    ...lane,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    ...(normalized === undefined ? { cycleHint: undefined } : { cycleHint: normalized }),
  };

  cloned.nodes = cloned.nodes.map((n) => (n.id === laneId ? updatedLane : n));
  return cloned;
}

/**
 * Change the base mini-notation string for a lane's transformChain.
 */
export function changeLaneBasePattern(
  graph: PatternGraph,
  laneId: LaneId,
  newMini: string,
): PatternGraph {
  const cloned = cloneGraph(graph);
  const chain = chainForLane(cloned, laneId);

  const updatedChain: TransformChainNode = {
    ...chain,
    base: {
      ...chain.base,
      miniSerialization: newMini,
    },
  };

  cloned.nodes = cloned.nodes.map((n) =>
    n.id === chain.id ? updatedChain : n,
  );

  return cloned;
}

/**
 * Add a transform call to the end of a lane's transformChain.
 * Transform order is user-defined and preserved as-is.
 */
export function addTransformToLane(
  graph: PatternGraph,
  laneId: LaneId,
  transform: { name: string; args: unknown[] },
): PatternGraph {
  const cloned = cloneGraph(graph);
  const chain = chainForLane(cloned, laneId);

  const existingIds = new Set(chain.methods.map((m) => m.id));
  const methodId = nextId("m_", existingIds as Set<string>);

  const updatedChain: TransformChainNode = {
    ...chain,
    methods: [
      ...chain.methods,
      {
        id: methodId,
        name: transform.name,
        args: transform.args,
      },
    ],
  };

  cloned.nodes = cloned.nodes.map((n) =>
    n.id === chain.id ? updatedChain : n,
  );

  return cloned;
}

/**
 * Remove a transform from a lane's transformChain by method id.
 */
export function removeTransformFromLane(
  graph: PatternGraph,
  laneId: LaneId,
  transformId: TransformId,
): PatternGraph {
  const cloned = cloneGraph(graph);
  const chain = chainForLane(cloned, laneId);

  const updatedChain: TransformChainNode = {
    ...chain,
    methods: chain.methods.filter((m) => m.id !== transformId),
  };

  cloned.nodes = cloned.nodes.map((n) =>
    n.id === chain.id ? updatedChain : n,
  );

  return cloned;
}

/**
 * Reorder transforms in a lane's transformChain based on a new id ordering.
 * The newOrder array must be a permutation of the existing transform ids.
 */
export function reorderLaneTransforms(
  graph: PatternGraph,
  laneId: LaneId,
  newOrder: TransformId[],
): PatternGraph {
  const cloned = cloneGraph(graph);
  const chain = chainForLane(cloned, laneId);

  const existingIds = chain.methods.map((m) => m.id);

  if (existingIds.length !== newOrder.length) {
    throw new Error(
      "PatternGraph: reorderLaneTransforms newOrder length mismatch",
    );
  }

  const existingSet = new Set(existingIds);
  for (const id of newOrder) {
    if (!existingSet.has(id)) {
      throw new Error(
        `PatternGraph: reorderLaneTransforms unknown transform id: ${id}`,
      );
    }
  }

  const byId = new Map(chain.methods.map((m) => [m.id, m]));
  const reordered = newOrder.map((id) => byId.get(id)!);

  const updatedChain: TransformChainNode = {
    ...chain,
    methods: reordered,
  };

  cloned.nodes = cloned.nodes.map((n) =>
    n.id === chain.id ? updatedChain : n,
  );

  return cloned;
}

/**
 * Validate a PatternGraph for use in the lane editor.
 *
 * Rules:
 * - exactly one root node
 * - root must be a parallel composition
 * - lanes must reference valid transform chains
 * - no unreachable (orphan) nodes
 */
export function validatePatternGraph(graph: PatternGraph): void {
  const rootNodes = graph.nodes.filter((n) => n.id === graph.root);
  if (rootNodes.length !== 1) {
    throw new Error(
      `PatternGraph: expected exactly one root node, found ${rootNodes.length}`,
    );
  }

  const root = rootNodes[0]!;
  if (root.type !== "parallel") {
    throw new Error(
      `PatternGraph: root must be type "parallel" for lane editor, got ${root.type}`,
    );
  }

  // Lanes must reference valid transform chains.
  for (const node of graph.nodes) {
    if (node.type === "lane") {
      const lane = node as LaneNode;
      const head = graph.nodes.find((n) => n.id === lane.head);
      if (!head) {
        throw new Error(
          `PatternGraph: lane ${lane.id} head not found: ${lane.head}`,
        );
      }
      if (head.type !== "transformChain") {
        throw new Error(
          `PatternGraph: lane ${lane.id} head must be transformChain, got ${head.type}`,
        );
      }
    }
  }

  // Reachability: every node must be reachable from the root via composition
  // children (order/edges) and lane → transformChain heads.
  const visited = new Set<string>();

  function getCompositionChildIds(node: CompositionNode): string[] {
    if (node.order && node.order.length > 0) {
      return node.order;
    }
    const role = node.type === "parallel" ? "parallel" : "serial";
    return graph.edges
      .filter((e) => e.to === node.id && e.role === role)
      .map((e) => e.from)
      .slice()
      .sort((a, b) => a.localeCompare(b));
  }

  function dfs(nodeId: string): void {
    if (visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);
    const node = findNode(graph, nodeId);

    if (node.type === "parallel" || node.type === "serial") {
      const comp = asComposition(node);
      for (const childId of getCompositionChildIds(comp)) {
        dfs(childId);
      }
    } else if (node.type === "lane") {
      const lane = asLane(node);
      dfs(lane.head);
    }
  }

  dfs(graph.root);

  const unreachable = graph.nodes
    .map((n) => n.id)
    .filter((id) => !visited.has(id));

  if (unreachable.length > 0) {
    throw new Error(
      `PatternGraph: unreachable nodes detected: ${unreachable.join(", ")}`,
    );
  }
}

