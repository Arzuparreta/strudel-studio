import { describe, it, expect } from "vitest";
import type { Pattern } from "@strudel/core";
import { DualPatternBuffers } from "./buffers.js";

const dummyPattern = { queryArc: () => [] } as unknown as Pattern;

describe("DualPatternBuffers", () => {
  it("initializes with two buffers and null patterns", () => {
    const buffers = new DualPatternBuffers();

    const active = buffers.getActive();
    const inactive = buffers.getInactive();

    expect(active).not.toBeNull();
    expect(inactive).not.toBeNull();
    expect(active?.pattern).toBeNull();
    expect(inactive?.pattern).toBeNull();
    expect(active?.id).not.toBe(inactive?.id);
  });

  it("writes new patterns into the inactive buffer and bumps generation ids", () => {
    const buffers = new DualPatternBuffers();

    const firstInactive = buffers.getInactive();
    const written = buffers.writeInactive(dummyPattern);

    expect(written).not.toBeNull();
    expect(written?.pattern).toBe(dummyPattern);
    expect(written?.id).toBeGreaterThan(firstInactive?.id ?? 0);
  });

  it("swaps active and inactive buffers", () => {
    const buffers = new DualPatternBuffers();

    const originalActive = buffers.getActive();
    const originalInactive = buffers.getInactive();

    buffers.writeInactive(dummyPattern);
    const afterWriteInactive = buffers.getInactive();

    const { active, inactive } = buffers.swap();

    expect(active).toBe(afterWriteInactive);
    expect(inactive).toBe(originalActive);
  });
});

