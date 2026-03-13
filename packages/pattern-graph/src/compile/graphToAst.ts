import { type Literal, type TransformChain, type PatternDoc, type CompositePattern } from "@strudel-studio/pattern-ast";
import type {
  PatternGraph,
  GraphNode,
  TransformChainNode,
  LaneNode,
  CompositionNode,
  PluginNode,
} from "../schema.js";

/** Options for graph → AST compilation (v1.0 plugin node support, v1.2 lane mute). */
export interface GraphToAstOptions {
  /** When present, plugin nodes are compiled via this callback. */
  compilePluginNode?: (node: PluginNode) => PatternDoc;
  /** Lane node ids to treat as muted; compiled as silence (v1.2 live performance). */
  mutedLaneIds?: Set<string>;
}

function findNode(graph: PatternGraph, id: string): GraphNode {
  const node = graph.nodes.find((n) => n.id === id);
  if (!node) {
    throw new Error(`graphToAst: node not found: ${id}`);
  }
  return node;
}

function toTransformChainNode(node: GraphNode): TransformChainNode {
  if (node.type !== "transformChain") {
    throw new Error(
      `graphToAst: expected transformChain node, got ${node.type}`,
    );
  }
  return node;
}

function toLaneNode(node: GraphNode): LaneNode {
  if (node.type !== "lane") {
    throw new Error(`graphToAst: expected lane node, got ${node.type}`);
  }
  return node;
}

/**
 * Convert a graph transformChain node into a Pattern AST TransformChain.
 *
 * - base.kind: "s" or "note"
 * - base.mini: taken from miniSerialization
 * - methods: sorted by canonical method order for the current astVersion
 */
function compileTransformChainNode(
  node: TransformChainNode,
  lane?: LaneNode,
): TransformChain {
  const baseKind = node.base.kind;
  const baseMini = node.base.miniSerialization;

  const methods = [...node.methods];

  if (lane && typeof lane.cycleHint === "number" && lane.cycleHint !== 1) {
    const hasSlow = methods.some((m) => m.name === "slow");
    if (!hasSlow) {
      methods.push({
        id: `${node.id}_cycle`,
        name: "slow",
        args: [lane.cycleHint],
      });
    }
  }

  return {
    id: node.id,
    base: {
      kind: baseKind,
      mini: baseMini,
    },
    // Transform order is user-defined and must be preserved as-is.
    methods: methods.map((m) => ({
      id: m.id,
      name: m.name,
      args: m.args as Literal[],
    })),
  };
}

/** Get ordered child ids for a composition node (from order array or edges, then sort by id). */
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

/** Silence PatternDoc for muted lanes (v1.2). */
const SILENCE_DOC: PatternDoc = { silence: true };

/**
 * Compile a single graph node to a PatternDoc (chain, stack/cat composition, or silence).
 */
function compileNode(
  graph: PatternGraph,
  nodeId: string,
  options?: GraphToAstOptions,
): PatternDoc {
  const node = findNode(graph, nodeId);

  if (node.type === "transformChain") {
    return compileTransformChainNode(node);
  }

  if (node.type === "lane") {
    if (options?.mutedLaneIds?.has(nodeId)) {
      return SILENCE_DOC;
    }
    const lane = toLaneNode(node);
    const headNode = findNode(graph, lane.head);
    const chain = toTransformChainNode(headNode);
    return compileTransformChainNode(chain, lane);
  }

  if (node.type === "parallel" || node.type === "serial") {
    const comp = node as CompositionNode;
    const childIds = getCompositionChildIds(graph, comp);
    const children: PatternDoc[] = childIds.map((id) =>
      compileNode(graph, id, options),
    );
    const composite: CompositePattern = {
      call: comp.type === "parallel" ? "stack" : "cat",
      children,
    };
    return composite;
  }

  if (node.type === "plugin") {
    if (options?.compilePluginNode) {
      return options.compilePluginNode(node);
    }
    throw new Error(
      `graphToAst: plugin node ${node.pluginId}/${node.nodeKind} has no registered compiler`,
    );
  }

  throw new Error(
    `graphToAst: unsupported node type: ${node.type}`,
  );
}

/**
 * Compile a PatternGraph into a PatternDoc (single chain or stack/cat composition).
 *
 * - transformChain / lane roots → single TransformChain.
 * - parallel root → stack(child1, child2, …); serial root → cat(child1, child2, …).
 * - plugin nodes → compiled via options.compilePluginNode when provided (v1.0).
 * Child order is from node.order when present, else from edges sorted by id.
 */
export function graphToAst(
  graph: PatternGraph,
  options?: GraphToAstOptions,
): PatternDoc {
  return compileNode(graph, graph.root, options);
}

