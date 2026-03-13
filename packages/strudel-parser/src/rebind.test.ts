import { describe, it, expect } from "vitest";
import type { TransformChain } from "@strudel-studio/pattern-ast";
import { rebindTransformChain } from "./rebind.js";

function makeChain(id: string, mini: string, methodNames: string[]): TransformChain {
  return {
    id,
    base: { kind: "s", mini },
    methods: methodNames.map((name, index) => ({
      id: `m_${index + 1}`,
      name,
      args: [`arg_${index + 1}`],
    })),
  };
}

describe("rebindTransformChain", () => {
  it("returns null when next is null", () => {
    const prev = makeChain("prev_root", "bd buddy", ["bank"]);
    const rebound = rebindTransformChain(prev, null);
    expect(rebound).toBeNull();
  });

  it("returns next unchanged when previous is null", () => {
    const next = makeChain("next_root", "bd buddy", ["bank", "slow"]);
    const rebound = rebindTransformChain(null, next);

    expect(rebound).not.toBeNull();
    expect(rebound?.id).toBe("next_root");
    expect(rebound?.methods.map((m) => m.id)).toEqual(["m_1", "m_2"]);
  });

  it("reuses base and method ids when structure matches", () => {
    const prev = makeChain("prev_root", "bd buddy", ["bank", "slow"]);
    const next: TransformChain = {
      id: "next_root",
      base: { kind: "s", mini: "bd buddy" },
      methods: [
        { id: "next_a", name: "bank", args: ["arg_1"] },
        { id: "next_b", name: "slow", args: ["arg_2"] },
      ],
    };

    const rebound = rebindTransformChain(prev, next)!;

    expect(rebound.id).toBe("prev_root");
    expect(rebound.methods.map((m) => m.id)).toEqual(["m_1", "m_2"]);
  });

  it("reuses ids only for matching prefix methods", () => {
    const prev = makeChain("prev_root", "bd buddy", ["bank", "slow"]);
    const next: TransformChain = {
      id: "next_root",
      base: { kind: "s", mini: "bd buddy" },
      methods: [
        { id: "next_a", name: "bank", args: ["arg_1"] },
        { id: "next_b", name: "gain", args: ["arg_2"] },
      ],
    };

    const rebound = rebindTransformChain(prev, next)!;

    expect(rebound.id).toBe("prev_root");
    expect(rebound.methods[0]?.id).toBe("m_1");
    expect(rebound.methods[1]?.id).toBe("next_b");
  });

  it("does not reuse ids when base kind or mini differ", () => {
    const prev = makeChain("prev_root", "bd buddy", ["bank"]);
    const next = makeChain("next_root", "sd buddy", ["bank"]);

    const rebound = rebindTransformChain(prev, next)!;

    expect(rebound.id).toBe("next_root");
    expect(rebound.methods[0]?.id).toBe("m_1");
  });
});

