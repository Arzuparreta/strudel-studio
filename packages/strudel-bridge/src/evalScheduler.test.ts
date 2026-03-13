import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./evaluate.js", () => ({
  evaluateToPattern: vi.fn(async (source: string) => ({
    source,
    queryArc: () => [],
  })),
}));

import { EvalScheduler } from "./evalScheduler.js";
import { evaluateToPattern } from "./evaluate.js";

describe("EvalScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    (evaluateToPattern as unknown as ReturnType<typeof vi.fn>).mockClear();
  });

  it("debounces rapid queue calls into a single eval", async () => {
    const scheduler = new EvalScheduler({ debounceMs: 200, maxEvalsPerSecond: 4 });

    const promise = scheduler.queue("first");
    scheduler.queue("second");
    scheduler.queue("third");

    vi.advanceTimersByTime(199);
    expect(evaluateToPattern).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    const result = await promise;

    expect(evaluateToPattern).toHaveBeenCalledTimes(1);
    expect(evaluateToPattern).toHaveBeenCalledWith("third");
    expect(result.source).toBe("third");
  });

  it("rate limits evaluations to maxEvalsPerSecond", async () => {
    const scheduler = new EvalScheduler({ debounceMs: 0, maxEvalsPerSecond: 2 });

    const p1 = scheduler.queue("a");
    const p2 = scheduler.queue("b");
    const p3 = scheduler.queue("c");

    vi.runOnlyPendingTimers();
    expect(evaluateToPattern).toHaveBeenCalledTimes(1);

    vi.setSystemTime(1001);
    vi.runOnlyPendingTimers();

    await Promise.all([p1, p2, p3]);

    expect(
      (evaluateToPattern as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
        (call) => call[0],
      ),
    ).toContain("c");
  });
});

