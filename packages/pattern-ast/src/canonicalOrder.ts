/**
 * Canonical method order per astVersion.
 * Codegen must emit methods in this order so output is deterministic.
 * @see docs/implementation-roadmap.md Task 1.3
 * @see docs/architecture.md §5 (transform chains)
 */

import { astVersion } from "./types.js";

/** Total order for chain methods when astVersion === 1. */
export const CANONICAL_METHOD_ORDER_V1: readonly string[] = [
  "bank",
  "slow",
  "fast",
  "gain",
  "delay",
  "room",
] as const;

export type CanonicalMethodNameV1 = (typeof CANONICAL_METHOD_ORDER_V1)[number];

/** Returns the canonical order for the given astVersion. */
export function getCanonicalOrder(version: number): readonly string[] {
  if (version === astVersion) {
    return CANONICAL_METHOD_ORDER_V1;
  }
  throw new Error(`Unsupported astVersion: ${version}`);
}

/** Index of method name in canonical order; unknown methods sort after known. */
export function canonicalIndexOf(version: number, methodName: string): number {
  const order = getCanonicalOrder(version);
  const i = order.indexOf(methodName);
  return i >= 0 ? i : order.length;
}
