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

/**
 * Extract start/end from a raw Strudel hap when possible.
 * Strudel events may have part/whole as [begin, end] or { start, end } or { begin, end }.
 * Falls back to the query window when the raw hap has no part/whole.
 */
function spanFromRaw(raw: unknown, window: HapCacheWindow): { start: number; end: number } {
  if (raw == null || typeof raw !== "object") {
    return { start: window.from, end: window.to };
  }
  const obj = raw as Record<string, unknown>;
  const span = obj.part ?? obj.whole;
  if (Array.isArray(span) && span.length >= 2 && typeof span[0] === "number" && typeof span[1] === "number") {
    return { start: span[0], end: span[1] };
  }
  if (span != null && typeof span === "object" && !Array.isArray(span)) {
    const s = span as Record<string, unknown>;
    const start = (s.start ?? s.begin) as number | undefined;
    const end = (s.end ?? (s as Record<string, unknown>).finish) as number | undefined;
    if (typeof start === "number" && typeof end === "number") {
      return { start, end };
    }
  }
  return { start: window.from, end: window.to };
}

/** Get the display value from a raw Strudel hap (value field or the hap itself). */
function valueFromRaw(raw: unknown): unknown {
  if (raw != null && typeof raw === "object" && "value" in (raw as object)) {
    return (raw as { value: unknown }).value;
  }
  return raw;
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
   * on the active buffer pattern. Each raw hap may have part/whole timespans;
   * when present, per-event start/end are used for timeline display.
   */
  public recordHaps(window: HapCacheWindow, rawHaps: readonly any[], bufferGeneration: number): void {
    const batch: Hap[] = rawHaps.map((raw) => {
      const { start, end } = spanFromRaw(raw, window);
      return {
        start,
        end,
        value: valueFromRaw(raw),
        bufferGeneration,
      };
    });

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

