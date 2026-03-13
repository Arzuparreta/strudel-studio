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

/**
 * List all registered (pluginId, nodeKind) pairs for UI (e.g. "Add plugin node").
 * @see docs/project-roadmap.md v1.0 follow-on — UI to create plugin nodes
 */
export function getRegisteredPluginNodeKinds(): { pluginId: string; nodeKind: string }[] {
  const list = Array.from(compilers.keys()).map((k) => {
    const idx = k.indexOf(":");
    const pluginId = idx >= 0 ? k.slice(0, idx) : k;
    const nodeKind = idx >= 0 ? k.slice(idx + 1) : "";
    return { pluginId, nodeKind };
  });
  list.sort((a, b) => a.pluginId.localeCompare(b.pluginId) || a.nodeKind.localeCompare(b.nodeKind));
  return list;
}

/** Clear all registered compilers. For testing only. */
export function _resetPluginNodeCompilersForTesting(): void {
  compilers.clear();
}
