import { describe, it, expect, afterEach } from "vitest";
import {
  registerPluginNodeCompiler,
  createPluginNodeCompiler,
  getRegisteredPluginNodeKinds,
  _resetPluginNodeCompilersForTesting,
} from "./pluginNodeCompiler.js";

describe("plugin node compiler", () => {
  afterEach(() => {
    _resetPluginNodeCompilersForTesting();
  });

  it("createPluginNodeCompiler returns a function that calls registered compiler", () => {
    registerPluginNodeCompiler("euclidean", "pattern", (node) => ({
      id: node.id,
      base: { kind: "s", mini: "[bd*3 bd]" },
      methods: [],
    }));

    const compile = createPluginNodeCompiler();
    const result = compile({
      id: "p1",
      type: "plugin",
      pluginId: "euclidean",
      nodeKind: "pattern",
      payload: { hits: 3, steps: 4 },
    });

    expect(result).toEqual({
      id: "p1",
      base: { kind: "s", mini: "[bd*3 bd]" },
      methods: [],
    });
  });

  it("getRegisteredPluginNodeKinds returns registered pluginId/nodeKind pairs", () => {
    expect(getRegisteredPluginNodeKinds()).toEqual([]);
    registerPluginNodeCompiler("euclidean", "euclideanPattern", (node) => ({
      id: node.id,
      base: { kind: "s", mini: "[bd ~]" },
      methods: [],
    }));
    expect(getRegisteredPluginNodeKinds()).toEqual([
      { pluginId: "euclidean", nodeKind: "euclideanPattern" },
    ]);
  });

  it("throws when no compiler is registered for plugin/nodeKind", () => {
    const compile = createPluginNodeCompiler();
    expect(() =>
      compile({
        id: "p1",
        type: "plugin",
        pluginId: "unknown",
        nodeKind: "custom",
      }),
    ).toThrow("No compiler registered for plugin node unknown/custom");
  });
});
