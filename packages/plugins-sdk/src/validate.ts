import { z } from "zod";
import { parsePatternGraph } from "@strudel-studio/pattern-graph";
import { astVersion } from "@strudel-studio/pattern-ast";

/**
 * Zod schema for TransformChain used for plugin output validation.
 * Mirrors pattern-ast TransformChain shape so plugin output can be validated without depending on runtime types.
 */
const transformChainSchema = z.object({
  id: z.string(),
  base: z.object({
    kind: z.enum(["s", "note"]),
    mini: z.string(),
    miniRange: z
      .object({
        start: z.number(),
        end: z.number(),
      })
      .optional(),
  }),
  methods: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      args: z.array(z.union([z.string(), z.number(), z.boolean()])),
    }),
  ),
});

/**
 * Validate plugin output as a TransformChain (pattern-ast shape).
 * Returns the validated object or throws z.ZodError.
 *
 * @see docs/architecture.md §10 (Schema validation)
 * @see docs/implementation-roadmap.md Task 3.8
 */
export function validateTransformChain(output: unknown): z.infer<typeof transformChainSchema> {
  return transformChainSchema.parse(output);
}

/**
 * Validate plugin output as a PatternGraph.
 * Returns the validated graph or throws (ZodError or from parsePatternGraph).
 */
export function validatePatternGraph(output: unknown): ReturnType<typeof parsePatternGraph> {
  return parsePatternGraph(output);
}

/**
 * Check if the document astVersion is supported by the plugin before running transform.
 */
export function getSupportedAstVersion(): number {
  return astVersion;
}
