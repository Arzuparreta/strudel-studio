import type { PluginManifest } from "./manifest.js";
import { parseManifest } from "./manifest.js";

export interface RegisteredPlugin {
  id: string;
  manifest: PluginManifest;
  /** Transform function: (input graph or AST) => new graph or AST. Must be immutable. */
  transform: (input: unknown) => unknown;
}

const plugins = new Map<string, RegisteredPlugin>();

/**
 * Register a plugin by id. Overwrites any existing registration with the same id.
 *
 * @see docs/implementation-roadmap.md Task 3.7
 */
export function registerPlugin(id: string, manifest: PluginManifest, transform: (input: unknown) => unknown): void {
  plugins.set(id, { id, manifest, transform });
}

/**
 * Register a plugin from a manifest JSON and a transform function.
 */
export function registerPluginFromManifest(
  id: string,
  manifestJson: unknown,
  transform: (input: unknown) => unknown,
): PluginManifest {
  const manifest = parseManifest(manifestJson);
  registerPlugin(id, manifest, transform);
  return manifest;
}

/**
 * Get a registered plugin by id.
 */
export function getPlugin(id: string): RegisteredPlugin | undefined {
  return plugins.get(id);
}

/**
 * List all registered plugin ids.
 */
export function listPluginIds(): string[] {
  return Array.from(plugins.keys()).sort();
}

/**
 * Clear all registrations. For testing only.
 */
export function _resetRegistryForTesting(): void {
  plugins.clear();
}
