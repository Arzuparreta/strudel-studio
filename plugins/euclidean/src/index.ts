import { createElement } from "react";
import type { TransformChain } from "@strudel-studio/pattern-ast";
import type { PatternDoc } from "@strudel-studio/pattern-ast";
import {
  registerPluginFromManifest,
  registerPluginTransform,
  registerPluginPanel,
  registerPluginNodeCompiler,
  type PluginNode,
} from "@strudel-studio/plugins-sdk";
import manifest from "../manifest.json";

const PLUGIN_ID = "euclidean";

/**
 * Euclidean rhythm generator: returns a minimal TransformChain
 * (e.g. s("[bd*3 bd]") for a 3-in-4 euclidean pattern) as a reference implementation.
 *
 * @see docs/implementation-roadmap.md Task 3.10
 * @see docs/project-roadmap.md v1.0 — Plugin System
 */
function euclideanTransform(input: unknown): unknown {
  const chain: TransformChain = {
    id: "euclidean-buddy",
    base: { kind: "s", mini: "[bd*3 bd]" },
    methods: [{ id: "m1", name: "slow", args: [2] }],
  };
  return chain;
}

registerPluginFromManifest(PLUGIN_ID, manifest, euclideanTransform);

// v1.0: expose "euclidean" in the editor "+ Add transform" picker.
registerPluginTransform({
  name: "euclidean",
  defaultArgs: [3, 4],
  description: "Euclidean rhythm (hits, steps).",
  args: [
    { name: "hits", type: "number", default: 3 },
    { name: "steps", type: "number", default: 4 },
  ],
});

// v1.0 follow-on: plugin graph node — add "Euclidean pattern" in composition.
const EUCLIDEAN_NODE_KIND = "euclideanPattern";
registerPluginNodeCompiler(PLUGIN_ID, EUCLIDEAN_NODE_KIND, (node: PluginNode): PatternDoc => {
  const hits = (node.payload as { hits?: number })?.hits ?? 3;
  const steps = (node.payload as { steps?: number })?.steps ?? 4;
  const mini = steps > 0 && hits > 0 ? `[bd*${hits} bd]` : "[bd ~]";
  return {
    id: node.id,
    base: { kind: "s" as const, mini },
    methods: [{ id: "m1", name: "slow", args: [2] }],
  };
});

// v1.0: custom visual editor — panel in the Plugins section.
registerPluginPanel({
  pluginId: PLUGIN_ID,
  title: "Euclidean",
  render: () =>
    createElement(
      "p",
      { style: { margin: 0, fontSize: "0.9rem", color: "#555" } },
      "Use the \u201ceuclidean\u201d transform in the + Add transform picker. Args: hits, steps (e.g. 3, 4).",
    ),
});

export { PLUGIN_ID, euclideanTransform };
