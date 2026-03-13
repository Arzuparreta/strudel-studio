import type { Pattern } from "@strudel/core";
import { evaluateToPattern } from "./evaluate.js";

export interface EvalResult {
  source: string;
  pattern: Pattern | null;
  error: unknown | null;
}

export interface EvalSchedulerOptions {
  debounceMs: number;
  maxEvalsPerSecond: number;
}

const DEFAULT_OPTIONS: EvalSchedulerOptions = {
  debounceMs: 200,
  maxEvalsPerSecond: 4,
};

export class EvalScheduler {
  private readonly options: EvalSchedulerOptions;
  private pendingSource: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastEvalTimestamps: number[] = [];
  private inflight: Promise<EvalResult> | null = null;

  constructor(options?: Partial<EvalSchedulerOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /** Queue a new source string for evaluation. Returns the Promise for the queued run. */
  public queue(source: string): Promise<EvalResult> {
    this.pendingSource = source;
    this.scheduleDebounced();

    if (!this.inflight) {
      this.inflight = new Promise<EvalResult>((resolve) => {
        this.resolveNext = resolve;
      });
    }

    return this.inflight;
  }

  private resolveNext: ((result: EvalResult) => void) | null = null;

  private scheduleDebounced(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      void this.runIfAllowed();
    }, this.options.debounceMs);
  }

  private async runIfAllowed(): Promise<void> {
    if (this.pendingSource == null) {
      return;
    }

    const now = Date.now();
    this.lastEvalTimestamps = this.lastEvalTimestamps.filter(
      (t) => now - t < 1000,
    );

    if (this.lastEvalTimestamps.length >= this.options.maxEvalsPerSecond) {
      const oldest = this.lastEvalTimestamps[0]!;
      const waitMs = Math.max(0, 1000 - (now - oldest));
      this.debounceTimer = setTimeout(() => {
        void this.runIfAllowed();
      }, waitMs);
      return;
    }

    const source = this.pendingSource;
    this.pendingSource = null;
    this.lastEvalTimestamps.push(now);

    let pattern: Pattern | null = null;
    let error: unknown | null = null;

    try {
      pattern = await evaluateToPattern(source);
    } catch (e) {
      error = e;
    }

    const result: EvalResult = { source, pattern, error };

    if (this.resolveNext) {
      this.resolveNext(result);
      this.resolveNext = null;
      this.inflight = null;
    }
  }
}

