import {
  astVersion,
  canonicalIndexOf,
  type Literal,
  type TransformChain,
} from "@strudel-studio/pattern-ast";
import type {
  PatternGraph,
  GraphNode,
  TransformChainNode,
  LaneNode,
} from "../schema.js";

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

  const sortedMethods = methods.sort(
    (a, b) =>
      canonicalIndexOf(astVersion, a.name) -
      canonicalIndexOf(astVersion, b.name),
  );

  return {
    id: node.id,
    base: {
      kind: baseKind,
      mini: baseMini,
    },
    methods: sortedMethods.map((m) => ({
      id: m.id,
      name: m.name,
      args: m.args as Literal[],
    })),
  };
}

/**
 * Compile a PatternGraph into a single-spine TransformChain AST.
 *
 * Supported roots (v0.3 initial scope):
 * - transformChain: root is a single spine.
 * - lane: root lane whose `head` points to a transformChain node.
 *
 * Other root kinds (parallel/serial/opaque) are rejected for now and can be
 * added when multi-track graph → AST rules are implemented.
 */
export function graphToAst(graph: PatternGraph): TransformChain {
  const rootNode = findNode(graph, graph.root);

  if (rootNode.type === "transformChain") {
    return compileTransformChainNode(rootNode);
  }

  if (rootNode.type === "lane") {
    const lane = toLaneNode(rootNode);
    const headNode = findNode(graph, lane.head);
    const chain = toTransformChainNode(headNode);
    return compileTransformChainNode(chain, lane);
  }

  throw new Error(
    `graphToAst: unsupported root node type: ${rootNode.type}`,
  );
}

