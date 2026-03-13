import { z } from "zod";

/**
 * Plugin manifest schema.
 * Declares astVersion compatibility range and node kinds the plugin can produce or consume.
 *
 * @see docs/architecture.md §10
 * @see docs/implementation-roadmap.md Task 3.7
 */
export const pluginManifestSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  /** Inclusive [min, max] astVersion range this plugin supports. */
  astVersion: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
  }),
  /** Node kinds this plugin can emit or transform (e.g. ["transformChain", "lane"]). */
  nodeKinds: z.array(z.string()).default([]),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

export function parseManifest(json: unknown): PluginManifest {
  return pluginManifestSchema.parse(json);
}

/** Check if a given astVersion is within the manifest's supported range. */
export function isAstVersionSupported(manifest: PluginManifest, astVersion: number): boolean {
  return astVersion >= manifest.astVersion.min && astVersion <= manifest.astVersion.max;
}
