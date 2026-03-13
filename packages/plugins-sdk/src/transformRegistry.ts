export type TransformArgType = "number" | "string" | "boolean";

export interface TransformArgSpec {
  name?: string;
  type: TransformArgType;
  min?: number;
  max?: number;
  default?: unknown;
}

export interface TransformSpec {
  name: string;
  defaultArgs: unknown[];
  description?: string;
  args?: TransformArgSpec[];
}

/**
 * Canonical transform registry.
 *
 * The keys and ordering here are aligned with CANONICAL_METHOD_ORDER_V1 so
 * registry iteration can follow the same deterministic order as codegen.
 */
export const TRANSFORM_REGISTRY: Record<string, TransformSpec> = {
  bank: {
    name: "bank",
    defaultArgs: ["tr909"],
    description: "Selects a sample bank (e.g. drum kit).",
    args: [
      {
        name: "name",
        type: "string",
        default: "tr909",
      },
    ],
  },
  slow: {
    name: "slow",
    defaultArgs: [2],
    description: "Slows the pattern by an integer factor.",
    args: [
      {
        name: "factor",
        type: "number",
        min: 1,
        default: 2,
      },
    ],
  },
  fast: {
    name: "fast",
    defaultArgs: [2],
    description: "Speeds up the pattern by an integer factor.",
    args: [
      {
        name: "factor",
        type: "number",
        min: 1,
        default: 2,
      },
    ],
  },
  gain: {
    name: "gain",
    defaultArgs: [1],
    description: "Scales the amplitude of the pattern.",
    args: [
      {
        name: "amount",
        type: "number",
        default: 1,
      },
    ],
  },
  delay: {
    name: "delay",
    defaultArgs: [0.25],
    description: "Applies a rhythmic delay to the pattern.",
    args: [
      {
        name: "amount",
        type: "number",
        default: 0.25,
      },
    ],
  },
  room: {
    name: "room",
    defaultArgs: [0.5],
    description: "Adds reverb-style room to the pattern.",
    args: [
      {
        name: "amount",
        type: "number",
        min: 0,
        max: 1,
        default: 0.5,
      },
    ],
  },
};

export function getTransformSpec(name: string): TransformSpec | undefined {
  return TRANSFORM_REGISTRY[name];
}

