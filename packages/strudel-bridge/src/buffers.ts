import type { Pattern } from "@strudel/core";

export interface PatternBuffer {
  id: number;
  pattern: Pattern | null;
}

export interface BufferSwapState {
  active: PatternBuffer | null;
  inactive: PatternBuffer | null;
}

/**
 * Simple dual-buffer manager for Patterns.
 *
 * - Holds two buffers (A/B) with monotonically increasing generation ids.
 * - New patterns are written into the inactive buffer.
 * - `swap()` flips active/inactive when the caller determines a safe boundary
 *   (e.g. a cycle boundary based on queryArc spans).
 *
 * This module does not make scheduling decisions; it only encapsulates the
 * bookkeeping around which buffer is active and what generation id it carries.
 *
 * @see docs/architecture.md §8
 * @see docs/implementation-roadmap.md Task 3.4
 */
export class DualPatternBuffers {
  private nextId = 1;
  private active: PatternBuffer | null = null;
  private inactive: PatternBuffer | null = null;

  constructor() {
    const a: PatternBuffer = { id: this.nextId++, pattern: null };
    const b: PatternBuffer = { id: this.nextId++, pattern: null };
    this.active = a;
    this.inactive = b;
  }

  /** Current active buffer (may have null pattern before first eval). */
  public getActive(): PatternBuffer | null {
    return this.active;
  }

  /** Current inactive buffer. New patterns should be written here. */
  public getInactive(): PatternBuffer | null {
    return this.inactive;
  }

  /** Replace the pattern in the inactive buffer and bump its generation id. */
  public writeInactive(pattern: Pattern | null): PatternBuffer | null {
    if (!this.inactive) return null;
    this.inactive = {
      id: this.nextId++,
      pattern,
    };
    return this.inactive;
  }

  /**
   * Atomically swap active and inactive buffers.
   *
   * Callers are responsible for only invoking this at safe musical
   * boundaries (e.g. cycle boundaries determined via queryArc spans).
   */
  public swap(): BufferSwapState {
    const currentActive = this.active;
    const currentInactive = this.inactive;
    this.active = currentInactive;
    this.inactive = currentActive;
    return { active: this.active, inactive: this.inactive };
  }
}

