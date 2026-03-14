# Grimes "Music 4 Machines" Cover — Root Cause Analysis & Improvement Plan

**Date:** 2025-03-14  
**Task:** Investigate why Strudel Studio plays only vocals when running the Grimes cover code that works fully on strudel.cc.

---

## 1. Root Cause Analysis

### 1.1 Why drums / bass / synth patterns do not play

**Primary cause: Incomplete prebake (missing sample banks and GM instruments)**

Strudel Studio previously loaded only `github:tidalcycles/dirt-samples`. **This has been fixed** by replicating the Strudel REPL prebake (see §Implementation below).

The song uses:

| Feature | Needed resource |
|--------|------------------|
| `.bank("RolandTR909")` | drum machine sample packs |
| `.bank("LinnDrum")` | drum machine sample packs |
| `.bank("RolandTR808")` | drum machine sample packs |
| `.sound("gm_synth_bass_1")` | GM soundfont |
| `.sound("gm_pad_poly")` | GM soundfont |
| `.sound("gm_pad_metallic")` | GM soundfont |

These are not loaded, so those instruments produce no sound.

**Vocals work** because the code explicitly loads them:

```js
samples({ vox: 'vox_chorus.wav' }, url)
```

So: **missing prebake soundbanks is the main runtime issue.**

**Secondary factor: `arrange()` and time window**

The pattern uses `arrange([8, section00], [8, section01], ...)`. Section00 (intro vocals) occupies cycles 0–8; section01 (drums, bass, synths) starts at cycle 8. The Pattern Inspector defaults to window `0–1`, so it only displays haps from section00. The inspector is technically correct; expanding the timeline (e.g. auto-extend when `arrange()` is detected) is a possible future improvement, not critical for this fix.

---

### 1.2 Why samples work but other sounds do not

- **Samples that work:** Loaded explicitly in user code via `samples({ vox: 'vox_chorus.wav' }, 'https://...')`. These are registered at eval time.
- **Samples that fail:** Depend on prebake. Strudel Studio’s prebake does not load drum machine banks or GM instruments/soundfonts.

---

### 1.3 What triggers the “opaque node” during Code → Graph import

The parser supports only this structure:

```js
s("pattern").bank("x").slow(2)
```

The song contains:

```js
let drums = stack(...)
let bass = cat(...)
let section = stack(...)
arrange(...)
```

The parser rejects it because **`body.length !== 1`** (multiple statements). So the whole document becomes opaque.

**Failure path:**

1. `handleImportCodeIntoGraph()` calls `parseToAstOrOpaque(source)`.
2. `result.ast == null` → user sees: "This code uses Strudel features that cannot yet be converted to the visual graph. The code will still run normally."
3. `astToGraph` is never called; the graph is not updated.

The agent correctly traced this failure path.

---

## 2. Architecture: Parser Stays Limited

The roadmap explicitly says:

```
UI → PatternGraph → AST → Codegen → Strudel runtime
```

**Strudel itself already evaluates the code.** The parser is a **limited import tool** for the visual graph, not a full Strudel compiler.

Expanding the parser to support full Strudel syntax would be:

- huge
- fragile
- unnecessary

So we **do not** expand the parser to support multi-statement documents, `stack`/`cat`/`arrange`, or full method whitelists for this fix. We fix playback and handle opaque documents gracefully instead.

---

## 3. What to Implement (Small Fix Plan)

### Step 1 — Fix prebake (critical)

**Location:** `packages/strudel-bridge/src/evaluate.ts`

Prebake should load the same sample sets as Strudel. Example direction:

```js
prebake: () => {
  const g = globalThis as any
  if (typeof g.samples === "function") {
    // core dirt samples
    g.samples("github:tidalcycles/dirt-samples")
    // drum machines
    g.samples("github:ritchse/tidal-drum-machines")
    // additional banks if available
    g.samples("github:strudelcc/vcsl")
  }
}
```

**You must verify which repos actually contain `strudel.json`** (e.g. `ritchse/tidal-drum-machines` was reported 404 for strudel.json; find the correct URLs).

This single change will likely fix most missing instruments.

---

### Step 2 — Verify GM instrument availability

Strudel supports `.sound("gm_synth_bass_1")` etc., but this requires a GM soundfont or mapping.

You must confirm whether Strudel:

- loads VCSL
- uses WebAudio synths
- loads GM samples

Verify the actual mechanism and ensure Studio has the same setup.

---

### Step 3 — Improve the error message

Currently you show:

> Cannot import: code could not be parsed

This is not helpful. Instead detect the real cause and show:

> This code uses Strudel features that cannot yet be converted to the visual graph. The code will still run normally.

Graph import should fail **gracefully** with a clear message.

---

### Step 4 — Accept opaque documents (do not block playback)

If the code is opaque:

- **Do NOT block playback.** Playback should still work because Strudel can run the code.
- **Graph import** should simply be **disabled** (with the improved message from Step 3).

---

### Step 5 — Single Strudel runtime (one soundMap)

**Why some GM sounds “not found” even when soundMap has 151 keys**

Playback uses superdough’s `soundMap` (nanostore) in `getTrigger` to resolve a sound name (e.g. `gm_synth_bass_1`) to an `onTrigger` handler. If the name is missing, superdough throws “sound X not found! Is it loaded?”.

- **Library that provides GM names:** `@strudel/soundfonts`. It defines a big `gm` map (e.g. `gm_synth_bass_1`, `gm_pad_poly`, `gm_piano`, …) and in `registerSoundfonts()` calls `registerSound(name, …)` from `@strudel/webaudio` (superdough) for each entry. So GM names only exist in the **same** superdough instance that runs at `getTrigger`.
- **Two runtimes in dev:** Vite can pre-bundle `@strudel/web` and `@strudel/soundfonts` as separate chunks. Each chunk can pull in its own `@strudel/webaudio` / superdough. So we get two `soundMap`s: the bridge calls `registerSoundfonts()` on one; the REPL/scheduler in `@strudel_web.js` use the other at `getTrigger` → GM names “not found”.
- **Fix (dev):** In `apps/studio/vite.config.ts`, `optimizeDeps.exclude` lists `@strudel/core`, `@strudel/webaudio`, `@strudel/web`, `@strudel/soundfonts`, `superdough` so they are not pre-bundled separately and end up in the same dependency graph as the bridge → one superdough, one soundMap.
- **Fix (build):** `manualChunks` keeps all `@strudel/*` in one chunk so production also has a single runtime.

---

## 4. What NOT to Implement Yet

These are too large for now and are **not** part of this fix:

- **Expanding the parser** to support everything (multi-statement, `stack`/`cat`/`arrange`, full method whitelist, `note().n().sound()` chains). The graph editor does not need to import arbitrary Strudel programs.
- **Full support for `arrange`, `mask`, etc.** in the graph. That is Phase 2 / Phase 3 work.
- **Full AST compatibility** with all Strudel constructs. Strudel already does evaluation; the AST is only for visual editing.

---

## 5. Timeline Inspector (Optional, Not Critical)

`arrange([8, section00], ...)` means section00 = cycles 0–8, section01 = cycles 8–16. The inspector shows 0–1, so it only displays intro vocals. That’s why the UI appears to show only vocals; the inspector is technically correct.

You might later add: **auto-extend timeline window when `arrange()` is detected.** This is not critical for the current fix.

---

## 6. Priority List (Actual Order)

**Priority 1 — Fix playback**

1. Load drum machine banks in prebake.
2. Load GM instruments or soundfonts.

This will fix the majority of songs.

**Priority 2 — Improve UX**

3. Better opaque import error message (Step 3 above).
4. Allow playback even when graph import fails (Step 4 above).

**Priority 3 — Future**

Later you can consider:

- partial graph extraction
- better AST import
- more transform coverage

But not now.

---

## 7. Takeaway: Two Problems, Two Solutions

| Problem | Solution |
|--------|----------|
| **A** Runtime resources missing (drum banks, GM) | Fix prebake |
| **B** Parser too strict (code → graph fails) | Handle opaque gracefully; do not block playback |

You **do not** need a bigger parser to fix this song.

---

## 8. Code Locations Summary

| Component | Path |
|-----------|------|
| Prebake | `packages/strudel-bridge/src/evaluate.ts` |
| Import handler / error message | `apps/studio/src/App.tsx` → `handleImportCodeIntoGraph` |
| Playback vs opaque (ensure playback still runs) | `apps/studio/src/App.tsx` (e.g. when `hasOpaques` or graph import fails) |

---

## 9. Implementation (done)

- **Prebake** — `packages/strudel-bridge/src/evaluate.ts` now replicates the Strudel REPL prebake from `packages/repl/prebake.mjs` (uzu/strudel): same sample JSON URLs from `felixroos/dough-samples` and `tidalcycles/uzu-drumkit`, plus `registerSoundfonts()` for GM instruments. Uses `@strudel/webaudio` (doughsamples) and `@strudel/soundfonts`.
- **Error message** — When Code → Graph import fails (opaque or unsupported code), the UI shows: *"This code uses Strudel features that cannot yet be converted to the visual graph. The code will still run normally."*
- **Playback** — Generate & Play always evaluates the current source; it is not disabled when the document is opaque, so playback runs normally.
