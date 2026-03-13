import { describe, it, expect } from "vitest";
import {
  getCanonicalOrder,
  canonicalIndexOf,
  CANONICAL_METHOD_ORDER_V1,
  astVersion,
} from "./index.js";

describe("canonicalOrder", () => {
  it("returns v1 order for astVersion 1", () => {
    const order = getCanonicalOrder(astVersion);
    expect(order).toBe(CANONICAL_METHOD_ORDER_V1);
    expect(order).toEqual(["bank", "slow", "fast", "gain", "delay", "room"]);
  });

  it("has no duplicate method names", () => {
    const seen = new Set<string>();
    for (const name of CANONICAL_METHOD_ORDER_V1) {
      expect(seen.has(name)).toBe(false);
      seen.add(name);
    }
  });

  it("throws for unsupported astVersion", () => {
    expect(() => getCanonicalOrder(0)).toThrow("Unsupported astVersion: 0");
    expect(() => getCanonicalOrder(2)).toThrow("Unsupported astVersion: 2");
  });

  it("canonicalIndexOf returns index for known methods", () => {
    expect(canonicalIndexOf(astVersion, "bank")).toBe(0);
    expect(canonicalIndexOf(astVersion, "slow")).toBe(1);
    expect(canonicalIndexOf(astVersion, "gain")).toBe(3);
    expect(canonicalIndexOf(astVersion, "room")).toBe(5);
  });

  it("canonicalIndexOf returns order.length for unknown methods", () => {
    expect(canonicalIndexOf(astVersion, "unknown")).toBe(
      CANONICAL_METHOD_ORDER_V1.length
    );
  });
});
