import { describe, it, expect, beforeEach } from "vitest";
import {
  registerPlugin,
  registerPluginFromManifest,
  getPlugin,
  listPluginIds,
  _resetRegistryForTesting,
} from "./registry.js";

beforeEach(() => {
  _resetRegistryForTesting();
});

describe("registry", () => {
  it("registers and retrieves a plugin", () => {
    const transform = (x: unknown) => x;
    registerPlugin("buddy", { name: "b", version: "0.1.0", astVersion: { min: 1, max: 1 } }, transform);
    const p = getPlugin("buddy");
    expect(p).toBeDefined();
    expect(p?.id).toBe("buddy");
    expect(p?.transform(42)).toBe(42);
  });

  it("registerPluginFromManifest parses manifest and registers", () => {
    const manifest = registerPluginFromManifest(
      "euclidean",
      { name: "euclidean buddy", version: "0.1.0", astVersion: { min: 1, max: 1 } },
      (input) => input,
    );
    expect(manifest.name).toBe("euclidean buddy");
    expect(getPlugin("euclidean")).toBeDefined();
  });

  it("listPluginIds returns sorted ids", () => {
    registerPlugin("b", { name: "b", version: "0.1.0", astVersion: { min: 1, max: 1 } }, (x) => x);
    registerPlugin("a", { name: "a", version: "0.1.0", astVersion: { min: 1, max: 1 } }, (x) => x);
    expect(listPluginIds()).toEqual(["a", "b"]);
  });
});
