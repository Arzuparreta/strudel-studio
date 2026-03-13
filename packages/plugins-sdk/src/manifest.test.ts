import { describe, it, expect } from "vitest";
import { parseManifest, isAstVersionSupported } from "./manifest.js";

describe("plugin manifest", () => {
  it("parses a valid manifest", () => {
    const manifest = parseManifest({
      name: "euclidean buddy",
      version: "0.1.0",
      astVersion: { min: 1, max: 1 },
      nodeKinds: ["transformChain"],
    });
    expect(manifest.name).toBe("euclidean buddy");
    expect(manifest.astVersion.min).toBe(1);
    expect(manifest.astVersion.max).toBe(1);
  });

  it("isAstVersionSupported returns true when version in range", () => {
    const manifest = parseManifest({
      name: "p",
      version: "0.1.0",
      astVersion: { min: 1, max: 2 },
    });
    expect(isAstVersionSupported(manifest, 1)).toBe(true);
    expect(isAstVersionSupported(manifest, 2)).toBe(true);
  });

  it("isAstVersionSupported returns false when version out of range", () => {
    const manifest = parseManifest({
      name: "p",
      version: "0.1.0",
      astVersion: { min: 1, max: 1 },
    });
    expect(isAstVersionSupported(manifest, 0)).toBe(false);
    expect(isAstVersionSupported(manifest, 2)).toBe(false);
  });
});
