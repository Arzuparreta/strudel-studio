import { z } from "zod";

/**
 * Pattern Graph schema (v0.3).
 *
 * This is the authoritative JSON shape for graphs used by the
 * visual editor. It is intentionally narrow and versioned so
 * graph → AST compilation and plugins can rely on a stable contract.
 *
 * @see docs/architecture.md §3, §5
 * @see docs/implementation-roadmap.md Task 3.1
 */

export const laneNodeSchema = z.object({
  id: z.string(),
  type: z.literal("lane"),
  cycleHint: z.number().optional(),
  head: z.string(),
});

export const transformChainNodeSchema = z.object({
  id: z.string(),
  type: z.literal("transformChain"),
  base: z.object({
    kind: z.enum(["s", "note"]),
    miniSerialization: z.string(),
  }),
  methods: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        args: z.array(z.unknown()),
      }),
    )
    .default([]),
});

export const compositionNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["parallel", "serial"]),
  /**
   * Deterministic child ordering.
   *
   * When provided, this array defines the order of child node ids.
   * If omitted, consumers must fall back to a documented default
   * (e.g. lexicographic sort by id) per graphVersion.
   */
  order: z.array(z.string()).optional(),
});

export const opaqueNodeSchema = z.object({
  id: z.string(),
  type: z.literal("opaque"),
  rawCode: z.string(),
  outputType: z.enum(["Pattern", "unknown"]).default("unknown"),
});

export const graphNodeSchema = z.discriminatedUnion("type", [
  laneNodeSchema,
  transformChainNodeSchema,
  compositionNodeSchema,
  opaqueNodeSchema,
]);

export const graphEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  role: z.enum(["chain", "parallel", "serial"]),
});

export const patternGraphSchema = z.object({
  graphVersion: z.number().int().nonnegative(),
  astVersion: z.number().int().nonnegative(),
  root: z.string(),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema).default([]),
});

export type LaneNode = z.infer<typeof laneNodeSchema>;
export type TransformChainNode = z.infer<typeof transformChainNodeSchema>;
export type CompositionNode = z.infer<typeof compositionNodeSchema>;
export type OpaqueGraphNode = z.infer<typeof opaqueNodeSchema>;
export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export type PatternGraph = z.infer<typeof patternGraphSchema>;

/**
 * Parse and validate an unknown JSON value into a PatternGraph.
 * Throws ZodError on invalid input.
 */
export function parsePatternGraph(json: unknown): PatternGraph {
  return patternGraphSchema.parse(json);
}

