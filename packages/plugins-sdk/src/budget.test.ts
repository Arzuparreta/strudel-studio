import { describe, it, expect } from "vitest";
import { withBudgetAsync } from "./budget.js";

describe("withBudgetAsync", () => {
  it("returns result when transform completes within budget", async () => {
    const result = await withBudgetAsync(100, async () => 42);
    expect(result).toBe(42);
  });

  it("rejects when transform exceeds budget", async () => {
    await expect(
      withBudgetAsync(10, async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 1;
      }),
    ).rejects.toThrow(/exceeded budget/);
  });
});
