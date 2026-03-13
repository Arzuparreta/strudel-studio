import { describe, it, expect } from "vitest";
import { astVersion } from "./index.js";

describe("pattern-ast", () => {
  it("exports astVersion 1", () => {
    expect(astVersion).toBe(1);
  });
});
