import type { Pattern } from "@strudel/core";
// Static import so web + soundfonts load in the same chunk (one @strudel/core). Dynamic import lets Vite split them in dev.
import * as strudelRuntime from "./strudel-runtime.js";

let initialized = false;

type StrudelWebModule = {
  initStrudel: (opts?: {
    prebake?: () => unknown;
  }) => Promise<unknown>;
  evaluate: (code: string) => unknown;
  hush?: () => void;
};

/** Sample pack URLs matching Strudel REPL prebake (packages/repl/prebake.mjs). */
const DOUGH_SAMPLES_BASE =
  "https://raw.githubusercontent.com/felixroos/dough-samples/main";
const UZU_DRUMKIT_BASE =
  "https://raw.githubusercontent.com/tidalcycles/uzu-drumkit/main";
const TODEPOND_SAMPLES_BASE =
  "https://raw.githubusercontent.com/todepond/samples/main";

const SAMPLE_URLS = [
  `${DOUGH_SAMPLES_BASE}/tidal-drum-machines.json`,
  `${DOUGH_SAMPLES_BASE}/Dirt-Samples.json`,
  `${DOUGH_SAMPLES_BASE}/vcsl.json`,
  `${DOUGH_SAMPLES_BASE}/piano.json`,
  `${DOUGH_SAMPLES_BASE}/mridangam.json`,
  `${UZU_DRUMKIT_BASE}/strudel.json`,
];

const ALIAS_BANK_URL = `${TODEPOND_SAMPLES_BASE}/tidal-drum-machines-alias.json`;

/**
 * Bootstrap code run in a separate evaluate(). URLs come from globalThis so the
 * source has no "/" (avoids mini parse error). Use plain syntax to avoid
 * "missing ) after argument list" from the transpiler.
 */
const BOOTSTRAP_SOURCE = [
  "var __p = globalThis.__strudelStudioSamplesLoaded;",
  "if (!__p) {",
  "  __p = (async function() {",
  "    if (typeof samples !== 'function') return;",
  "    var urls = globalThis.__strudelStudioSampleUrls;",
  "    if (Array.isArray(urls)) { for (var i = 0; i < urls.length; i++) { await samples(urls[i]); } }",
  "    if (typeof aliasBank === 'function') { var a = globalThis.__strudelStudioAliasUrl; if (a) await aliasBank(a); }",
  "  })();",
  "  globalThis.__strudelStudioSamplesLoaded = __p;",
  "}",
  "await __p;",
].join("\n");

/** No-op; we load samples via bootstrap in REPL scope instead. */
function runStrudelPrebake(): void {}

/** Promise resolved when Strudel is ready to evaluate (globals and prebake done). */
let initPromise: Promise<void> | null = null;

async function loadStrudelWeb(): Promise<StrudelWebModule> {
  const mod = strudelRuntime.web as StrudelWebModule;

  if (!initialized) {
    const initDone = mod.initStrudel({
      prebake: runStrudelPrebake,
    });
    initPromise = Promise.resolve(initDone).then(() => {
      initialized = true;
    });
  }

  await initPromise;

  // Match Strudel REPL prebake: register synths, ZZFX and GM soundfonts so soundMap has all built-in sounds.
  const w = strudelRuntime.webaudio;
  if (typeof w.registerSynthSounds === "function") {
    await Promise.resolve(w.registerSynthSounds());
  }
  if (typeof w.registerZZFXSounds === "function") {
    await Promise.resolve(w.registerZZFXSounds());
  }
  if (typeof strudelRuntime.soundfonts.registerSoundfonts === "function") {
    await strudelRuntime.soundfonts.registerSoundfonts();
  }

  return mod;
}

export function isPattern(value: unknown): value is Pattern {
  return Boolean(value) && typeof (value as any).queryArc === "function";
}

export async function evaluateToPattern(source: string): Promise<Pattern | null> {
  try {
    const { evaluate } = await loadStrudelWeb();

    // Pass URLs via globalThis so bootstrap has no "/" in source (avoids mini parse error).
    const g = globalThis as Record<string, unknown>;
    g.__strudelStudioSampleUrls = SAMPLE_URLS;
    g.__strudelStudioAliasUrl = ALIAS_BANK_URL;

    // Run bootstrap in REPL scope (loads sample banks into same soundMap as playback). GM soundfonts registered in loadStrudelWeb.
    await Promise.resolve(evaluate(BOOTSTRAP_SOURCE));

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



