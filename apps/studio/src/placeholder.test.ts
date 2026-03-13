import { describe, it, expect } from "vitest";
import { astVersion } from "@strudel-studio/strudel-bridge";

describe("studio", () => {
  it("uses strudel-bridge", () => {
    expect(astVersion).toBe(1);
  });
});
