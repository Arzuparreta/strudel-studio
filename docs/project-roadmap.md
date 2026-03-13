# project-roadmap.md

Below is a **tight milestone ladder designed to guarantee the end vision**.


# Core Product Goal

**Strudel Studio**

> A visual composition environment for Strudel that allows non-coders to create and manipulate musical patterns through a graphical interface while generating real Strudel code.

Design rule:

```
UI → PatternGraph → AST → Codegen → Strudel runtime
```

Code remains canonical.

---

# Development Milestone Ladder

## v0.3 (current state)

**Status:** Infrastructure mostly done.

Capabilities:

* Monaco code editor
* Pattern AST
* subset parser
* code generator
* PatternGraph schema
* graph → AST compiler
* Strudel runtime bridge
* read-only lane preview

User workflow:

```
write code → play
```

Visual layer:

```
demo only
```

---

# Phase 1 — Visual Editing Foundation

Goal: **basic visual composition becomes possible**

---

# v0.4 — Editable Lane Editor

First real visual editing.

Users can:

* add lane
* delete lane
* rename lane
* change base pattern
* add transform
* reorder transforms

Example UI:

```
Lane 1  s("bd ~ sd ~").bank("tr909").slow(2)
Lane 2  s("eb2 buddy")
```

Visual representation:

```
Lane
 ├ pattern
 └ transforms
```

Implementation:

```
LaneStack
→ editable
→ PatternGraph mutations
```

Guarantee:

```
graph → AST → code updates automatically
```

Success criteria:

* users compose simple music **without touching code**

---

# v0.5 — Pattern Grid Editor

Major usability unlock.

Mini-notation becomes visual.

Example:

```
bd ~ sd ~
```

becomes:

```
[bd] [ ] [sd] [ ]
```

Grid editor:

```
click cell → toggle event
```

Produces:

```
miniSerialization
```

Graph mutation:

```
TransformChain.base.miniSerialization
```

Success criteria:

* non-coders can create drum loops visually.

---

# v0.6 — Transform Inspector

Expose transform chains visually.

Example:

```
pattern
 ├ bank(tr909)
 ├ slow(2)
 └ room(0.8)
```

UI:

```
[ + add transform ]
```

Transforms become:

```
draggable chips
```

Example:

```
slow(2) | bank(tr909) | room(0.8)
```

Reordering updates AST canonical order.

Success criteria:

* full transform editing without code.

---

# Phase 2 — Structural Composition

Goal: **complex pattern structures visually**

---

# v0.7 — Composition Graph

Add graph editing.

Nodes:

```
lane
parallel
serial
```

Visual graph:

```
      stack
      /  \
  drums  bass
```

Graph canvas:

```
nodes
edges
drag connections
```

Possible libraries:

* React Flow
* custom canvas

Success criteria:

* users combine lanes visually.

---

# v0.8 — Code ↔ Graph Synchronization

Critical milestone.

Allow importing Strudel code.

Pipeline:

```
source
↓
subset parser
↓
AST
↓
graph adapter
↓
PatternGraph
```

Unsupported structures:

```
opaque nodes
```

Opaque blocks appear as:

```
[ custom code block ]
```

Success criteria:

* pasting Strudel code produces a visual representation.

---

# Phase 3 — Live Coding Enhancements

Goal: **become a powerful Strudel companion**

---

# v0.9 — Pattern Timeline Inspector

Use hap cache.

Visual timeline:

```
time →
|bd| |sd| |bd|
|C | |G |
```

Shows generated events.

Benefits:

* debugging patterns
* educational tool

Success criteria:

* users see patterns evolve over time.

---

# v1.0 — Plugin System

Enable extensibility.

Plugins can add:

```
custom transforms
custom node types
custom visual editors
```

Architecture:

```
plugin
→ graph node
→ AST mapping
```

This opens ecosystem growth.

Success criteria:

* external developers extend the editor.

---

# Phase 4 — Differentiation

Goal: **become more powerful than plain Strudel**

---

# v1.1 — Pattern Library

Reusable pattern modules.

Example:

```
funk-drum-groove
acid-bassline
```

Users drag patterns into lanes.

---

# v1.2 — Visual Live Performance Mode

Performance interface:

```
pattern morphing
lane mute
parameter sliders
```

Real-time control.

---

# v1.3 — AI Pattern Assistant

Optional:

AI suggests:

```
fills
variations
transform chains
```

Based on the graph.

---

# Final Architecture After v1

```
visual editor
   ↓
PatternGraph
   ↓
Pattern AST
   ↓
Codegen
   ↓
Strudel code
   ↓
Strudel runtime
```

---

## ⚠ Optional considerations / future improvements

- **Selector UX**  
  Currently, the transform selector is rendered above the `LaneStack`. For multi-lane graphs, consider a per-lane selector in a future milestone (e.g. v0.6) so each lane can have its own default transform if desired.

- **Transform args**  
  The selector currently chooses only the transform name. For transforms with multiple arguments, a future picker UI should allow editing args per lane. Existing tests assume `defaultArgs` are correct, which is acceptable for now but may need broader coverage once custom args are supported.

- **Edge cases**  
  If `selectedTransformName` is changed while lanes already exist, `onAddTransform` affects only newly added transforms. In a later v0.6 design pass, decide whether mass-replacing transforms in existing lanes should be supported or explicitly avoided.

- **Pattern inspector window**  
  The current inspector uses a fixed hap window \([0, 1]\). Future milestones could expose a UI control for arbitrary inspection windows or scrubbing, while still reading from the shared hap cache.

- **Multi-lane hap separation**  
  All haps are currently recorded into a single `HapCache`. For richer UX, consider per-lane or per-transform filtering in the inspector UI so overlapping events from multiple lanes can be distinguished.

- **Inspector tests & performance**  
  While `HapList` has its own tests, the Studio integration is not yet covered by explicit UI tests. A future test can render `HapList` with mock haps and assert entries/empty state. If inspector usage grows, consider throttling or streaming strategies around `queryArc` for large patterns.

- **Transform argument editing UX**  
  The current inline transform-args editor parses comma-separated values with a simple numeric regexp. This may not handle all edge cases (e.g. `-.5`, strings containing numbers). Future work could either document this limitation or adopt richer parsing informed by transform metadata from the registry. Empty input currently maps to `[]`, which is acceptable for optional-arg transforms but should be validated once stricter arg typing is introduced.


