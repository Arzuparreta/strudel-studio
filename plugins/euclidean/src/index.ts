import type { TransformChain } from "@strudel-studio/pattern-ast";
import {
  registerPluginFromManifest,
  registerPluginTransform,
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

export { PLUGIN_ID, euclideanTransform };
