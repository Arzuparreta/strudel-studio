import { describe, it, expect } from "vitest";
import { HapCache } from "./hapCache.js";

describe("HapCache", () => {
  it("records and retrieves haps within a window", () => {
    const cache = new HapCache(16);

    cache.recordHaps({ from: 0, to: 1 }, [{ kind: "bd buddy" }], 1);
    cache.recordHaps({ from: 1, to: 2 }, [{ kind: "sd buddy" }], 1);

    const haps = cache.getHaps({ from: 0.5, to: 1.5 });

    expect(haps).toHaveLength(2);
    expect(haps.map((h) => (h.value as any).kind)).toEqual([
      "bd buddy",
      "sd buddy",
    ]);
  });

  it("drops oldest haps when exceeding maxEntries", () => {
    const cache = new HapCache(2);

    cache.recordHaps({ from: 0, to: 1 }, [{ id: 1 }], 1);
    cache.recordHaps({ from: 1, to: 2 }, [{ id: 2 }], 1);
    cache.recordHaps({ from: 2, to: 3 }, [{ id: 3 }], 1);

    const all = cache.getHaps({ from: 0, to: 3 });

    expect(all).toHaveLength(2);
    expect((all[0]?.value as any).id).toBe(2);
    expect((all[1]?.value as any).id).toBe(3);
  });

  it("clears all haps", () => {
    const cache = new HapCache();

    cache.recordHaps({ from: 0, to: 1 }, [{ id: 1 }], 1);
    expect(cache.getHaps({ from: 0, to: 1 })).toHaveLength(1);

    cache.clear();
    expect(cache.getHaps({ from: 0, to: 1 })).toHaveLength(0);
  });
});

