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

/** Plugin-registered transform specs (v1.0). Built-in registry takes precedence. */
const pluginTransformSpecs = new Map<string, TransformSpec>();

/**
 * Register a transform spec from a plugin. Used by plugins to expose custom
 * transforms in the editor (e.g. "+ Add transform" picker). Built-in names
 * cannot be overridden.
 * @see docs/project-roadmap.md v1.0 — Plugin System
 */
export function registerPluginTransform(spec: TransformSpec): void {
  if (Object.hasOwn(TRANSFORM_REGISTRY, spec.name)) {
    return; // do not override built-in
  }
  pluginTransformSpecs.set(spec.name, spec);
}

/**
 * Get transform spec by name: built-in first, then plugin-registered.
 */
export function getTransformSpec(name: string): TransformSpec | undefined {
  return TRANSFORM_REGISTRY[name] ?? pluginTransformSpecs.get(name);
}

/**
 * All transform names available in the editor (built-in + plugin), sorted.
 * Use this for "+ Add transform" picker and per-lane selector.
 */
export function getAvailableTransformNames(): string[] {
  const builtIn = Object.keys(TRANSFORM_REGISTRY);
  const plugin = [...pluginTransformSpecs.keys()];
  return [...new Set([...builtIn, ...plugin])].sort();
}

/** Clear plugin-registered transforms. For testing only. */
export function _resetPluginTransformsForTesting(): void {
  pluginTransformSpecs.clear();
}

/**
 * Coerce a raw argument list according to a TransformSpec's arg metadata.
 *
 * Rules (Before v1.0 refinement 1):
 * - If no arg metadata is present, return raw as-is.
 * - For each arg spec:
 *   - If raw[i] is missing or undefined, use argSpec.default when provided (optional-arg behavior).
 *   - For type "number": coerce via Number(), clamp to [min, max] when set.
 *   - For type "string": String(value).
 *   - For type "boolean": truthy → true, falsy → false.
 * - Extra raw args beyond spec.args length are preserved unchanged.
 * - Empty input ([]) results in all defaults when spec provides them.
 */
export function coerceTransformArgs(
  spec: TransformSpec,
  raw: unknown[],
): unknown[] {
  if (!spec.args || spec.args.length === 0) {
    return raw;
  }

  const coerced: unknown[] = [];

  spec.args.forEach((argSpec, index) => {
    const rawValue = index < raw.length ? raw[index] : undefined;
    let value = rawValue;

    if (value === undefined && argSpec.default !== undefined) {
      value = argSpec.default;
    }

    if (value === undefined) {
      coerced.push(value);
      return;
    }

    if (argSpec.type === "number") {
      let num = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(num)) {
        num = typeof argSpec.default === "number" ? argSpec.default : 0;
      }
      if (typeof argSpec.min === "number" && num < argSpec.min) {
        num = argSpec.min;
      }
      if (typeof argSpec.max === "number" && num > argSpec.max) {
        num = argSpec.max;
      }
      coerced.push(num);
    } else if (argSpec.type === "string") {
      coerced.push(String(value));
    } else if (argSpec.type === "boolean") {
      coerced.push(Boolean(value));
    } else {
      coerced.push(value);
    }
  });

  if (raw.length > spec.args.length) {
    coerced.push(...raw.slice(spec.args.length));
  }

  return coerced;
}

