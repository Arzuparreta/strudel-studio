import { describe, it, expect } from "vitest";
import { astVersion } from "@strudel-studio/pattern-ast";

describe("code-generator", () => {
  it("depends on pattern-ast", () => {
    expect(astVersion).toBe(1);
  });
});
