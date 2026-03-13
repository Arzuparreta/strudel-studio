import { describe, it, expect } from "vitest";
import { astVersion } from "./index.js";

describe("strudel-bridge", () => {
  it("depends on code-generator", () => {
    expect(astVersion).toBe(1);
  });
});
