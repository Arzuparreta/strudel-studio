import { CANONICAL_METHOD_ORDER_V1 } from "@strudel-studio/pattern-ast";

/** Whitelisted method names for v0.2 parsing. */
export const KNOWN_METHOD_NAMES: readonly string[] = CANONICAL_METHOD_ORDER_V1;

export function isKnownMethod(name: string): boolean {
  return KNOWN_METHOD_NAMES.includes(name);
}

