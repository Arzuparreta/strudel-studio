/**
 * Pattern AST — code-shaped IR for Strudel Studio.
 * astVersion: 1; stable id on nodes.
 * @see docs/implementation-roadmap.md Phase v0.1
 */

export {
  astVersion,
  type NodeId,
  type Literal,
  type BaseCall,
  type Call,
  type ChainMethods,
  type TransformChain,
} from "./types.js";

export {
  CANONICAL_METHOD_ORDER_V1,
  getCanonicalOrder,
  canonicalIndexOf,
  type CanonicalMethodNameV1,
} from "./canonicalOrder.js";

export {
  type OpaqueEmitMode,
  type SourceRange,
  type OpaqueParentComposition,
  type OpaqueNode,
} from "./opaque.js";
