/**
 * Helpers for LaneStack: resolve graph root to ordered track list and labels.
 * @see docs/implementation-roadmap.md Task 3.11
 */

import type {
  PatternGraph,
  GraphNode,
  TransformChainNode,
  LaneNode,
  CompositionNode,
} from "@strudel-studio/pattern-graph";

function findNode(graph: PatternGraph, id: string): GraphNode {
  const node = graph.nodes.find((n) => n.id === id);
  if (!node) {
    throw new Error(`Node not found: ${id}`);
  }
  return node;
}

function getCompositionChildIds(graph: PatternGraph, node: CompositionNode): string[] {
  if (node.order && node.order.length > 0) {
    return node.order;
  }
  const role = node.type === "parallel" ? "parallel" : "serial";
  const fromEdges = graph.edges
    .filter((e) => e.to === node.id && e.role === role)
    .map((e) => e.from);
  return fromEdges.slice().sort((a, b) => a.localeCompare(b));
}

/**
 * Return a short label for a node (for lane/track display).
 */
export function getNodeLabel(graph: PatternGraph, nodeId: string): string {
  const node = findNode(graph, nodeId);

  if (node.type === "transformChain") {
    const chain = node as TransformChainNode;
    const base = chain.base;
    const methodPart =
      chain.methods.length > 0
        ? ` .${chain.methods.map((m) => m.name).join("().")}()`
        : "";
    return `${base.kind}("${base.miniSerialization}")${methodPart}`;
  }

  if (node.type === "lane") {
    const lane = node as LaneNode;
    const headLabel = getNodeLabel(graph, lane.head);
    const hint = typeof lane.cycleHint === "number" ? ` ×${lane.cycleHint}` : "";
    const rawLaneName = (lane as any).name;
    const displayName =
      typeof rawLaneName === "string" && rawLaneName.length > 0
        ? rawLaneName
        : lane.id;
    return `${displayName}${hint}: ${headLabel}`;
  }

  if (node.type === "parallel" || node.type === "serial") {
    return `${node.type}(${node.id})`;
  }

  if (node.type === "opaque") {
    return `opaque: ${(node as { rawCode: string }).rawCode.slice(0, 20)}…`;
  }

  return node.id;
}

/**
 * Return the ordered list of top-level track/lane node ids to display.
 * - parallel/serial root → order (or edges) child ids
 * - lane or transformChain root → single-element list with root id
 */
export function getTopLevelTrackIds(graph: PatternGraph): string[] {
  const root = findNode(graph, graph.root);

  if (root.type === "parallel" || root.type === "serial") {
    return getCompositionChildIds(graph, root as CompositionNode);
  }

  return [graph.root];
}
