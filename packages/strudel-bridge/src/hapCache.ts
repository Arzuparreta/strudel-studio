import type { Pattern } from "@strudel/core";

/**
 * Minimal hap representation used by the bridge/inspector.
 *
 * We do not depend on Strudel's exact internal hap type here; instead we
 * store the time window the hap covers plus the raw value for display.
 */
export interface Hap {
  /** Start time (inclusive) in pattern time. */
  start: number;
  /** End time (exclusive) in pattern time. */
  end: number;
  /** Raw value payload from Strudel (note, gain, etc.). */
  value: unknown;
  /** Buffer generation id that produced this hap. */
  bufferGeneration: number;
}

export interface HapCacheWindow {
  from: number;
  to: number;
}

/**
 * Hap cache API.
 *
 * - The scheduler is responsible for calling `recordHaps` on each tick with
 *   the queryArc window and its resulting haps plus the active buffer
 *   generation id.
 * - The inspector can call `getHaps(window)` to read a filtered view of the
 *   cache for a given time window.
 *
 * This implementation keeps a fixed-size ring buffer of recent haps to avoid
 * unbounded growth while still supporting near-term inspection.
 *
 * @see docs/architecture.md §9
 * @see docs/implementation-roadmap.md Task 3.5
 */
export class HapCache {
  private readonly maxEntries: number;
  private readonly haps: Hap[] = [];

  constructor(maxEntries = 1024) {
    this.maxEntries = maxEntries;
  }

  /**
   * Record a batch of haps for a given window and buffer generation.
   *
   * The caller should obtain these by calling `pattern.queryArc(from, to)`
   * on the active buffer pattern and mapping to the fields needed here.
   */
  public recordHaps(window: HapCacheWindow, rawHaps: readonly any[], bufferGeneration: number): void {
    const batch: Hap[] = rawHaps.map((raw) => ({
      start: window.from,
      end: window.to,
      value: raw,
      bufferGeneration,
    }));

    this.haps.push(...batch);

    if (this.haps.length > this.maxEntries) {
      const excess = this.haps.length - this.maxEntries;
      this.haps.splice(0, excess);
    }
  }

  /**
   * Get all haps that intersect the requested time window.
   *
   * Callers can further filter by `bufferGeneration` if they only want to
   * inspect the current buffer.
   */
  public getHaps(window: HapCacheWindow): Hap[] {
    const { from, to } = window;
    return this.haps.filter(
      (hap) => hap.start < to && hap.end > from,
    );
  }

  /** Clear all cached haps. */
  public clear(): void {
    this.haps.length = 0;
  }
}

