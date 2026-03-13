import type { Pattern } from "@strudel/core";

let initialized = false;

type StrudelWebModule = {
  initStrudel: (opts?: {
    prebake?: () => unknown;
  }) => void;
  evaluate: (code: string) => unknown;
  hush?: () => void;
};

async function loadStrudelWeb(): Promise<StrudelWebModule> {
  const mod = (await import("@strudel/web")) as StrudelWebModule;

  if (!initialized) {
    mod.initStrudel({
      prebake: () => {
        const g = globalThis as Record<string, any>;
        if (typeof g.samples === "function") {
          g.samples("github:tidalcycles/dirt-samples");
          g.samples("github:ritchse/tidal-drum-machines");
        }
      },
    });
    initialized = true;
  }

  return mod;
}

export function isPattern(value: unknown): value is Pattern {
  return Boolean(value) && typeof (value as any).queryArc === "function";
}

export async function evaluateToPattern(source: string): Promise<Pattern | null> {
  try {
    const { evaluate } = await loadStrudelWeb();
    const result = evaluate(source) as unknown;

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



