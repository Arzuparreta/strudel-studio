export {
  patternGraphSchema,
  graphNodeSchema,
  graphEdgeSchema,
  laneNodeSchema,
  transformChainNodeSchema,
  compositionNodeSchema,
  opaqueNodeSchema,
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
} from "./schema.js";

export { graphToAst } from "./compile/graphToAst.js";

export {
  addLane,
  deleteLane,
  renameLane,
  setLaneCycleHint,
  changeLaneBasePattern,
  addTransformToLane,
  removeTransformFromLane,
  reorderLaneTransforms,
  validatePatternGraph,
} from "./mutations.js";

