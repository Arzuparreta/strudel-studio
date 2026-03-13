/**
 * Lift Pattern AST to PatternGraph (code → graph adapter for v0.8).
 *
 * Supports:
 * - Single TransformChain → one parallel root, one lane, one transform chain.
 * - CompositePattern (stack/cat) with TransformChain children → one composition root,
 *   one lane per child, each lane heads a transform chain.
 *
 * Nested compositions (stack(cat(...), ...)) are not yet supported.
 * @see docs/project-roadmap.md v0.8 — Code ↔ Graph Synchronization
 */

import type {
  PatternDoc,
  TransformChain,
  CompositePattern,
} from "@strudel-studio/pattern-ast";
import type {
  PatternGraph,
  TransformChainNode,
  LaneNode,
  CompositionNode,
} from "../schema.js";

const GRAPH_VERSION = 2;
const AST_VERSION = 1;

function nextLaneId(used: Set<string>): string {
  let i = 1;
  while (used.has(`lane_${i}`)) i += 1;
  return `lane_${i}`;
}

function nextChainId(used: Set<string>): string {
  let i = 1;
  while (used.has(`chain_${i}`)) i += 1;
  return `chain_${i}`;
}

function transformChainToNodes(
  chain: TransformChain,
  laneId: string,
  chainId: string,
): { lane: LaneNode; chain: TransformChainNode } {
  const chainNode: TransformChainNode = {
    id: chainId,
    type: "transformChain",
    base: {
      kind: chain.base.kind,
      miniSerialization: chain.base.mini,
    },
    methods: chain.methods.map((m) => ({
      id: m.id,
      name: m.name,
      args: m.args,
    })),
  };

  const laneNode: LaneNode = {
    id: laneId,
    type: "lane",
    head: chainId,
  };

  return { lane: laneNode, chain: chainNode };
}

/**
 * Convert a single TransformChain AST node into a minimal PatternGraph
 * (one parallel root, one lane, one transform chain).
 */
function singleChainToGraph(ast: TransformChain): PatternGraph {
  const rootId = "root_parallel";
  const laneId = "lane_1";
  const chainId = "chain_1";

  const { lane, chain } = transformChainToNodes(ast, laneId, chainId);

  const root: CompositionNode = {
    id: rootId,
    type: "parallel",
    order: [laneId],
  };

  return {
    graphVersion: GRAPH_VERSION,
    astVersion: AST_VERSION,
    root: rootId,
    nodes: [root, lane, chain],
    edges: [],
  };
}

/**
 * Convert a composite AST (stack or cat) into a PatternGraph.
 * Each child must be a TransformChain; nested composites are not supported.
 */
function compositeToGraph(ast: CompositePattern): PatternGraph {
  const rootId = ast.call === "stack" ? "root_parallel" : "root_serial";
  const used = new Set<string>([rootId]);
  const lanes: LaneNode[] = [];
  const chains: TransformChainNode[] = [];

  function isTransformChain(
    doc: PatternDoc,
  ): doc is TransformChain {
    return "base" in doc && "methods" in doc;
  }

  for (const child of ast.children) {
    if (!isTransformChain(child)) {
      throw new Error(
        "astToGraph: nested stack/cat inside composition not yet supported",
      );
    }
    const laneId = nextLaneId(used);
    used.add(laneId);
    const chainId = nextChainId(used);
    used.add(chainId);
    const { lane, chain: chainNode } = transformChainToNodes(
      child,
      laneId,
      chainId,
    );
    lanes.push(lane);
    chains.push(chainNode);
  }

  const root: CompositionNode = {
    id: rootId,
    type: ast.call === "stack" ? "parallel" : "serial",
    order: lanes.map((l) => l.id),
  };

  return {
    graphVersion: GRAPH_VERSION,
    astVersion: AST_VERSION,
    root: rootId,
    nodes: [root, ...lanes, ...chains],
    edges: [],
  };
}

/**
 * Lift a PatternDoc (AST) to a PatternGraph.
 * - Single chain → one-lane parallel graph.
 * - stack(chain1, chain2, ...) → parallel root with one lane per chain.
 * - cat(chain1, chain2, ...) → serial root with one lane per chain.
 */
export function astToGraph(ast: PatternDoc): PatternGraph {
  if ("base" in ast && "methods" in ast) {
    return singleChainToGraph(ast as TransformChain);
  }
  if ("call" in ast && "children" in ast) {
    return compositeToGraph(ast as CompositePattern);
  }
  throw new Error("astToGraph: unsupported AST shape");
}
