# Strudel Studio — Architecture v2

Strudel Studio is a browser-based visual music editor built on [Strudel](https://strudel.cc). **Strudel source code remains the source of truth** for evaluation; the **Pattern Graph** is the editable projection for non-coders and for spatial editing. **Pattern AST** is the code-shaped intermediate representation used for deterministic generation and subset parsing. This document specifies the system as a whole—suitable for implementers and contributors.

---

## 1. System Philosophy

- **Code is always visible**: Monaco presents the same Strudel/JS that runs in the REPL; nothing is hidden behind proprietary macros.
- **Code is source of truth at rest**: The document string is what gets transpiled and evaluated. The graph and AST are **projections**; when parsing fails or semantics are unsupported, **opaque regions** preserve the exact text.
- **Visual and live coding coexist**: Edits flow through a **subset** of Strudel that the graph understands; advanced JS stays in locked blocks until explicitly edited as text.
- **REPL compatibility**: Generated or hand-written code must evaluate unchanged on strudel.cc when using the same Strudel package versions.

---

## 2. Architecture Overview

### End-to-end data flow

```
Visual UI
    →  Pattern Graph     (nodes, edges, parameters; composition + transform chains)
    →  Pattern AST        (invertible IR for codegen; subset + opaque)
    →  Strudel source     (string)
    →  Transpile + eval   (Strudel REPL pipeline)
    →  Scheduler + output (WebAudio)
```

**Reverse direction** (code editing):

```
Strudel source  →  Subset parser  →  Pattern AST  →  Lift to Pattern Graph  →  Visual UI
```

Unsupported segments are **opaque**: the parser records spans and preserves text; the graph shows them as locked code blocks.

### Layer roles

| Layer            | Role |
| ---------------- | ---- |
| **Pattern Graph**| UI-native model: parallel/serial composition, lanes, transform chains. |
| **Pattern AST**  | Codegen IR: deterministic string emission; bridge to parser. |
| **Opaque nodes** | Non-visualizable code preserved verbatim with stable boundaries. |

---

## 3. Pattern Graph Model

The graph is the **authoritative structure for the visual editor**. It is **not** the runtime authority—evaluation always uses the **source string**.

### Node kinds

- **patternSource**: Base pattern constructor (`s`, `note`, etc.) with structured or serialized payload.
- **transform**: Method-chain steps (`slow`, `gain`, `delay`, …) attached in order.
- **parallel** (composition): Maps to `stack(...)`—multiple inputs, simultaneous.
- **serial** (composition): Maps to `cat(...)`—sequential concatenation.
- **lane** (optional abstraction): Groups a sub-graph with **polymetric** or timing context.
- **opaque**: See §7; appears as a single node with no internal wiring.

### Edges

- **role: `chain`**: Linear transform chain on one pattern spine (method order matches edge order).
- **role: `parallel`**: Inputs to a **parallel** composition node; order defined by **deterministic child ordering** (§5).
- **role: `serial`**: Inputs to a **serial** composition node; same ordering rules.

### Composition vs transform chains

- **Composition nodes** (`parallel`, `serial`) answer *how patterns are combined in time*—overlay vs sequence. They have **multiple children**.
- **Transform chains** answer *how a single pattern spine is modified*—`.slow(2).gain(0.8)`. They are **linear** and attach to one head (patternSource or composition output).

This separation prevents conflating “bus send” with “effect chain” until explicitly modeled (e.g. as chain methods on a spine).

### Polymetric and lane hints

- **`cycleHint`** (optional on lane or patternSource): Integer or ratio hint for codegen (e.g. per-lane `.slow()` or structural mini) so multiple lanes can run in different cycle lengths without collapsing graph semantics into one global tempo only.

### Deterministic child ordering

- Every composition node with multiple inputs stores **`order: string[]`** (child node ids) or relies on **lexicographic sort of child ids**—one rule per `graphVersion`, documented and tested so codegen never depends on object key order.

### Example Pattern Graph (composition + chain)

```json
{
  "graphVersion": 2,
  "astVersion": 1,
  "root": "n_mix",
  "nodes": [
    {
      "id": "lane_drums",
      "type": "lane",
      "cycleHint": 1,
      "head": "n_drums_chain"
    },
    {
      "id": "n_drums_chain",
      "type": "transformChain",
      "base": { "kind": "s", "miniSerialization": "[bd ~] [sd ~]" },
      "methods": [
        { "name": "bank", "args": ["tr909"] },
        { "name": "slow", "args": [2] }
      ]
    },
    {
      "id": "n_mix",
      "type": "parallel",
      "order": ["lane_drums", "lane_bass"]
    },
    {
      "id": "lane_bass",
      "type": "lane",
      "cycleHint": 2,
      "head": "n_bass_chain"
    },
    {
      "id": "n_bass_chain",
      "type": "transformChain",
      "base": { "kind": "note", "miniSerialization": "c2 eb2" },
      "methods": [{ "name": "gain", "args": [0.5] }]
    }
  ],
  "edges": []
}
```

Graphs that only need a **single spine** may use a **`transformChain`** root without parallel/serial nodes until multi-track features ship.

---

## 4. Pattern AST

- **Purpose**: Deterministic codegen; round-trip for supported subset; **mini notation is serialization**, not canonical—structured nodes are canonical where possible (see §5).
- **Root**: Typically one expression evaluating to a Pattern; multi-root intent compiles to a single **`stack`** (or **`cat`**) at root.
- **Versioning**: Every document includes **`astVersion`**; migrations live in `pattern-ast` package.
- **Stable ids**: Every node has **`id`** for UI binding, Monaco rebinding, and incremental updates—even after reparse.

---

## 5. Graph → AST Compilation

Compilation is **deterministic**: same graph + `graphVersion` ⇒ same AST ⇒ same emitted source (modulo optional whitespace policy).

### Canonicalization rules

1. **Composition**: `parallel` → `stack(a, b, …)`; `serial` → `cat(a, b, …)`. Child order from **`order`** array or fixed **sort by id**.
2. **Transform chains**: Emit **base call** then **methods in canonical order**. Canonical order is a **total order** per `astVersion` (e.g. `bank` before `slow` if both present)—listed in schema doc to avoid commutative reorderings.
3. **Mini vs function form**: If structure is not expressible as one mini string without ambiguity, emit **function form** (`seq`, nested `stack`) per Strudel API.
4. **Single root**: Multiple export nodes compile to one **`stack`** with ordered children; order rule as above.

### Golden tests

- **Graph fixtures** → **snapshot strings**. CI fails on unexpected diffs. Guarantees UI actions don’t flip emitted code across commits.

---

## 6. Parser and Code Synchronization

### Subset parser

- Parses **only** the supported subset (see prior spec: `s`, `note`, `stack`, `cat`, whitelisted chains). **Acorn** for JS shell; **mini** parser for string contents where applicable.
- Produces **Pattern AST** plus **opaque spans** for everything else.

### Failure recovery

| Condition           | Behavior |
| ------------------- | -------- |
| **Incomplete typing** | No graph replace; **debounced** reparse; UI shows “typing…”; last valid AST/graph retained. |
| **Syntax error**      | Same—opaque **widens** to safe boundary (statement/expression) when possible; else whole top-level becomes opaque. |
| **Unsupported construct** | Becomes **opaque** with `sourceRange`; codegen echoes **verbatim**. |

### Opaque expansion fallback rule

- If parsing fails or only partially succeeds inside a region, **expand opaque to the smallest enclosing expression or statement** that can be echoed unchanged. **Never** emit partial JS. **Never** drop user text.
- Reparse after edit: **rebind** by **logical AST path** when spans shift; if rebinding fails, **widen opaque** again.

### Debounced evaluation

- Parsing and codegen are **debounced** (e.g. 150–300 ms idle).
- **Evaluation** is **capped** (max evaluations per second) and queued so the **inactive buffer** (§8) is built without thrashing the main thread.

### Monaco synchronization

- **Primary mapping**: **node id → logical path** in AST/graph; **secondary**: `sourceRange` refreshed after successful parse.
- **Edits that shift ranges**: Full reparse; re-walk to refresh ranges; **path-based rebinding** preserves identity when structure unchanged.
- **Multiple graph nodes → one code region**: Either **one primary owner** per span or **non-overlapping spans** per method—policy fixed per `astVersion` so codegen never overlaps writes.

---

## 7. Opaque Node System

Opaque nodes preserve **arbitrary** Strudel/JS without visual editing of internals.

### Schema

| Field | Purpose |
| ----- | ------- |
| `id` | Stable node id. |
| `rawCode` | Exact substring for codegen. |
| `sourceRange` | `{ start, end }` in Monaco document. |
| `outputType` | `Pattern` or `unknown`—tooling and inspector hints. |
| `dependencies` | Optional list of free identifiers required at eval. |
| `parentComposition` | Optional `{ call: "stack" \| "cat", argIndex: number }` when opaque is one argument among parseable siblings. |
| `emitMode` | See below. |

### Emit modes

| Mode | Use |
| ---- | --- |
| **`expression`** | Single expression; can sit inside `stack`/assign. |
| **`statementBlock`** | Multiple statements; **cannot** be spliced into expression—whole document or surrounding region stays opaque until user refactors. |
| **`verbatimOnly`** | Never re-generated; manual edit only; graph shows locked block. |

### Example

```json
{
  "id": "opaque_a1",
  "type": "opaque",
  "rawCode": "note(sine.range(0,12))",
  "sourceRange": { "start": 40, "end": 65 },
  "outputType": "Pattern",
  "dependencies": [],
  "parentComposition": { "call": "stack", "argIndex": 1 },
  "emitMode": "expression"
}
```

### UI

- Locked **code block** card; edit only in Monaco; optional single **composition edge** at boundary when used as `stack`/`cat` argument.

---

## 8. Runtime and Scheduling

### Dual pattern buffers

- **patternBufferA** / **patternBufferB**: each holds an evaluated **Pattern** instance (or null).
- New code evaluates into the **inactive** buffer in the background; **swap** occurs at **cycle boundaries** only—avoids rhythmic discontinuities from mid-cycle replacement.

### Generation IDs

- Each scheduled **hap** (or batch) is tagged with **bufferGeneration**. After swap, the output layer **ignores** haps from stale generations whose musical time overlaps the new buffer’s ownership window—policy configurable (hard cut vs short crossfade).

### Swap policy

- **Alignment**: Swap when **cycle index** increments (integer boundary in pattern cycle space) or when **no active hap** from the old buffer extends past the boundary—implementation uses Strudel’s `queryArc` spans to pick boundary times.
- **Tempo/cps change**: Prefer **re-evaluating** the inactive buffer with current globals before swap, or **freeze** swap until next boundary if eval not ready.

### Interaction with Strudel’s scheduler

- Strudel’s model: **queryArc(t0, t1)** is pure; scheduler polls at fixed wall-clock intervals. Studio **reads only the active buffer** for polling; buffer swap is atomic for readers. **Strudel REPL compatibility** is preserved because evaluation input remains the **same source string** transpiled the same way.

### Evaluation limits

- **No eval on every keystroke**; debounced + rate-limited build of inactive buffer only.

---

## 9. Pattern Inspector

- **Purpose**: Educational and debug view of **events**, **timing**, and **params**—without hiding code.
- **No independent `queryArc` loop**: The **scheduler (or bridge) maintains a shared hap cache** for the time window currently relevant (e.g. next cycle or next N ms). The inspector **reads only that cache**—no second pattern evaluation path.
- **Scrubbing** (optional): One-shot `queryArc` for arbitrary time range when user scrubs timeline—throttled.
- **Display**: Haps as list or overlay; show cycle position, onset, `hap.value` (gain, note, etc.). Stale generation haps filtered by §8.

---

## 10. Plugin Architecture

### Contract

- Plugins extend **graph node types** and/or **AST node types** with **registered codegen and parse hooks**.
- **Manifest** declares **`astVersion`** compatibility range and node kinds.

### Safety rules

- **Immutable transforms**: Plugins return **new graph/AST**; no in-place mutation of shared document.
- **Schema validation**: Every plugin output is validated against **pattern-graph** / **pattern-ast** schemas before commit.
- **Execution budget**: Plugin transforms run under a **time budget** per invocation; heavy work deferred or rejected.
- **Sandboxing (optional later)**: Untrusted plugins in worker/iframe with message API.

---

## 11. Repository Structure

```
/apps
  /studio                 # Shell, routes, layout
/packages
  /pattern-graph          # Graph schema, composition + chain nodes, compile → AST
  /pattern-ast            # AST types, astVersion, migrations, opaque types
  /strudel-parser         # Subset parser; opaque spans; path rebinding
  /code-generator         # AST → Strudel source (canonical order, golden tests)
  /strudel-bridge         # Transpile, eval, dual buffers, generation ids, scheduler glue
  /ui-components          # Sequencer, graph canvas, opaque blocks
  /plugins-sdk            # Manifest, validation, registry, budgets
  /pattern-inspector      # Reads shared hap cache only
/plugins
  /…                      # Reference plugins (e.g. euclidean)
/docs
  architecture.md         # This document
```

---

## 12. Development Roadmap

### v0.1

- **Pattern AST** (single-spine chain; `astVersion` 1).
- **Code generation** with canonical method order and golden tests.
- **Playback** via strudel-bridge.
- **Debounced evaluation**; optional **single buffer** first—**dual buffer + cycle swap** as soon as bridge stabilizes.
- **Optional thin graph adapter**: graph may be implicit (single `transformChain`) to avoid full graph UI before needed.

### v0.2

- **Subset parser** + **opaque nodes** + **opaque expansion** rules.
- **Bidirectional sync** with **path-based rebinding** and **region ownership** policy.
- **Lane** and **composition** nodes as needed for parsed code.

### v0.3

- **Full pattern graph** (parallel/serial/lanes) in UI.
- **Multi-track** patterns.
- **Plugin system** with validation and budgets.
- **Pattern Inspector** backed by **shared hap cache**.

**Rationale for delaying full graph in v0.1**: A single-spine AST + codegen + playback proves the eval pipeline and canonical emission without graph layout, hit-testing, and composition-edge ambiguity. The graph schema in §3 is **defined early** so v0.2/v0.3 do not require breaking changes—v0.1 simply may not instantiate all node kinds in the UI yet.

---

## Summary

Architecture v2 fixes **composition vs chain** semantics in the graph, **deterministic** codegen with golden tests, **parser recovery** via opaque expansion, **opaque** placement inside `stack`/`cat`, **cycle-boundary** swapping with **generation ids**, **inspector** fed from a **single hap cache**, **Monaco** rebinding by **path**, and **plugin** immutability plus validation. **v0.1** stays lean—AST + codegen + playback + debounced eval—while the **full graph** lands when multi-track and bidirectional sync require it.
