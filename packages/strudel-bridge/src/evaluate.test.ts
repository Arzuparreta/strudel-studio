import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@strudel/web", () => ({
  initStrudel: vi.fn(),
  evaluate: vi.fn((code: string) => ({
    code,
    // Minimal Pattern-like surface: just enough for the type guard.
    queryArc: () => [],
  })),
}));

// Import after mocking so the bridge uses the mocked implementation.
import { evaluateToPattern, isPattern } from "./evaluate.js";
import { evaluate as mockedEvaluate } from "@strudel/web";

describe("evaluateToPattern", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a Pattern when evaluate yields an object with queryArc", async () => {
    const pattern = await evaluateToPattern('s("bd ~ sd ~")');

    expect(pattern).not.toBeNull();
    expect(isPattern(pattern)).toBe(true);
    expect(pattern?.queryArc(0, 1)).toEqual([]);
    expect(mockedEvaluate).toHaveBeenCalledWith('s("bd ~ sd ~")');
  });

  it("returns null when evaluate throws", async () => {
    (mockedEvaluate as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => {
        throw new Error("boom");
      },
    );

    const pattern = await evaluateToPattern('s("bd ~ sd ~")');
    expect(pattern).toBeNull();
  });

  it("returns null when evaluate does not yield a Pattern", async () => {
    (mockedEvaluate as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => ({ notAPattern: true }),
    );

    const pattern = await evaluateToPattern("42");
    expect(pattern).toBeNull();
  });
});

