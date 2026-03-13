import type { Pattern } from "@strudel/core";

let initialized = false;

type StrudelWebModule = {
  initStrudel: (opts?: {
    prebake?: () => unknown;
  }) => Promise<unknown>;
  evaluate: (code: string) => unknown;
  hush?: () => void;
};

/** Promise resolved when Strudel is ready to evaluate (globals and prebake done). */
let initPromise: Promise<void> | null = null;

async function loadStrudelWeb(): Promise<StrudelWebModule> {
  const mod = (await import("@strudel/web")) as StrudelWebModule;

  if (!initialized) {
    // Align with Strudel's evaluator: wait for init so evaluate() runs with
    // globals (s, stack, note, etc.) and prebake (samples) ready.
    const initDone = mod.initStrudel({
      prebake: () => {
        const g = globalThis as Record<string, unknown>;
        if (typeof g.samples === "function") {
          (g.samples as (url: string) => void)("github:tidalcycles/dirt-samples");
          // Drum banks (e.g. .bank("tr909")) need a repo that provides strudel.json;
          // ritchse/tidal-drum-machines has no strudel.json (404), so we only load
          // dirt-samples. Patterns without .bank() use dirt-samples and play.
        }
      },
    });
    initPromise = Promise.resolve(initDone).then(() => {
      initialized = true;
    });
  }

  await initPromise;
  return mod;
}

export function isPattern(value: unknown): value is Pattern {
  return Boolean(value) && typeof (value as any).queryArc === "function";
}

export async function evaluateToPattern(source: string): Promise<Pattern | null> {
  try {
    const { evaluate } = await loadStrudelWeb();
    // Strudel's evaluate() is async and returns the evaluated pattern when the last statement is an expression.
    const result = (await Promise.resolve(evaluate(source))) as unknown;

    if (isPattern(result)) {
      return result;
    }

    return null;
  } catch {
    return null;
  }
}

export async function hushAll(): Promise<void> {
  const mod = await loadStrudelWeb();
  const hushFn = mod.hush ?? (mod as any).hush;

  if (typeof hushFn === "function") {
    hushFn();
  }
}



