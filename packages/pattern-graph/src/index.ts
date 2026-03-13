export {
  patternGraphSchema,
  graphNodeSchema,
  graphEdgeSchema,
  laneNodeSchema,
  transformChainNodeSchema,
  compositionNodeSchema,
  opaqueNodeSchema,
  pluginNodeSchema,
  parsePatternGraph,
} from "./schema.js";

export type {
  PatternGraph,
  GraphNode,
  GraphEdge,
  LaneNode,
  TransformChainNode,
  CompositionNode,
  OpaqueGraphNode,
  PluginNode,
} from "./schema.js";

export { graphToAst } from "./compile/graphToAst.js";
export type { GraphToAstOptions } from "./compile/graphToAst.js";
export { astToGraph } from "./compile/astToGraph.js";

export {
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
  replaceLaneContent,
  validatePatternGraph,
} from "./mutations.js";
export type { LibraryPatternContent } from "./mutations.js";

