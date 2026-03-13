import type { PatternDoc } from "@strudel-studio/pattern-ast";
import type { PluginNode } from "@strudel-studio/pattern-graph";

type PluginNodeCompiler = (node: PluginNode) => PatternDoc;

const compilers = new Map<string, PluginNodeCompiler>();

function key(pluginId: string, nodeKind: string): string {
  return `${pluginId}:${nodeKind}`;
}

/**
 * Register a compiler for plugin-defined graph nodes (v1.0).
 * When graphToAst encounters a node with type "plugin", it calls the
 * registered compiler for that pluginId and nodeKind.
 *
 * @see docs/project-roadmap.md v1.0 — Plugin System
 */
export function registerPluginNodeCompiler(
  pluginId: string,
  nodeKind: string,
  compile: PluginNodeCompiler,
): void {
  compilers.set(key(pluginId, nodeKind), compile);
}

/**
 * Create a compilePluginNode callback for use with graphToAst(options).
 * Returns a function that looks up the registered compiler for each plugin node.
 * If no compiler is registered, throws.
 */
export function createPluginNodeCompiler(): (node: PluginNode) => PatternDoc {
  return (node: PluginNode) => {
    const fn = compilers.get(key(node.pluginId, node.nodeKind));
    if (!fn) {
      throw new Error(
        `No compiler registered for plugin node ${node.pluginId}/${node.nodeKind}`,
      );
    }
    return fn(node);
  };
}

/** Clear all registered compilers. For testing only. */
export function _resetPluginNodeCompilersForTesting(): void {
  compilers.clear();
}
