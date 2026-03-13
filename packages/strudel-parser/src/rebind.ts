import type { Literal, TransformChain } from "@strudel-studio/pattern-ast";

function literalsEqual(a: readonly Literal[], b: readonly Literal[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function basesCompatible(a: TransformChain, b: TransformChain): boolean {
  return a.base.kind === b.base.kind && a.base.mini === b.base.mini;
}

/**
 * Rebind node ids from a previous TransformChain onto the next one
 * when their logical structure (base + method sequence) is compatible.
 *
 * This is a path-based rebinding strategy:
 * - When base kind/mini match, the root id is preserved.
 * - For each method at index i, if the name and literal args match,
 *   the id from the previous chain is reused.
 * - Otherwise, the method keeps its existing id from the next chain.
 *
 * When previous is null, the next chain is returned with ids unchanged.
 * When bases are incompatible, no ids are reused.
 */
export function rebindTransformChain(
  previous: TransformChain | null,
  next: TransformChain | null,
): TransformChain | null {
  if (!next) {
    return null;
  }

  if (!previous) {
    return {
      id: next.id,
      base: { ...next.base },
      methods: next.methods.map((m) => ({ ...m })),
    };
  }

  const reuseBaseId = basesCompatible(previous, next);

  const rebound: TransformChain = {
    id: reuseBaseId ? previous.id : next.id,
    base: { ...next.base },
    methods: [],
  };

  const prevMethods = previous.methods;
  const nextMethods = next.methods;

  for (let i = 0; i < nextMethods.length; i += 1) {
    const nextMethod = nextMethods[i]!;
    let id = nextMethod.id;

    if (i < prevMethods.length) {
      const prevMethod = prevMethods[i]!;
      if (
        prevMethod.name === nextMethod.name &&
        literalsEqual(prevMethod.args, nextMethod.args)
      ) {
        id = prevMethod.id;
      }
    }

    rebound.methods.push({
      ...nextMethod,
      id,
    });
  }

  return rebound;
}

