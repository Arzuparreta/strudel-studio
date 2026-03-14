# Plugin authoring guide

This guide explains how to extend Strudel Studio with a plugin. Plugins can add **custom transforms** that appear in the editor’s “+ Add transform” picker and can optionally provide a **transform function** for custom graph/AST generation.

## 1. Plugin package setup

Create a package under `plugins/` in the repo (or publish your own package that depends on `@strudel-studio/plugins-sdk`).

**Minimum `package.json`:**
- `name`: e.g. `@strudel-studio/plugin-euclidean`
- `dependencies`: include `@strudel-studio/plugins-sdk` (and `@strudel-studio/pattern-ast` if you use AST types)
- `main`: point to your built entry (e.g. `./dist/index.js`)

Add the plugin to the workspace in `pnpm-workspace.yaml` if it lives in this repo (`plugins/*` is already included).

## 2. Manifest

Create a `manifest.json` (or equivalent) that satisfies the plugin manifest schema:

- **name**: Human-readable plugin name
- **version**: Semver string
- **astVersion**: `{ "min": 1, "max": 1 }` (must match the studio’s supported AST version)
- **nodeKinds**: Array of graph node kinds the plugin can produce or consume (e.g. `["transformChain"]`)

Use `parseManifest(json)` from `@strudel-studio/plugins-sdk` to validate. See `plugins/euclidean/manifest.json` for an example.

## 3. Register the plugin

In your plugin’s entry module, call:

- **`registerPluginFromManifest(id, manifest, transform)`**  
  Registers the plugin with a unique `id`, the parsed manifest, and an optional **transform** function `(input: unknown) => unknown`. The transform is used when the studio invokes the plugin (e.g. for custom node generation); it must return new graph/AST and must not mutate shared state.

You can register without a transform if you only add custom transforms to the picker:

```ts
import { registerPluginFromManifest, registerPluginTransform } from "@strudel-studio/plugins-sdk";
import manifest from "../manifest.json";

registerPluginFromManifest("my-plugin", manifest, () => ({}));
```

## 4. Custom transforms (editor picker)

To show a transform in the “+ Add transform” dropdown and in the per-lane selector, call:

- **`registerPluginTransform(spec)`**

`spec` is a **TransformSpec**: `{ name, defaultArgs, description?, args? }`.  
- **name**: Method name (e.g. `"euclidean"`). Must not override a built-in transform name.  
- **defaultArgs**: Default argument list when the user adds the transform.  
- **args**: Optional array of **TransformArgSpec** for the multi-arg picker: `{ name?, type: "number"|"string"|"boolean", min?, max?, default? }`.

Example:

```ts
registerPluginTransform({
  name: "euclidean",
  defaultArgs: [3, 4],
  description: "Euclidean rhythm (hits, steps).",
  args: [
    { name: "hits", type: "number", default: 3 },
    { name: "steps", type: "number", default: 4 },
  ],
});
```

When the user adds this transform, the editor appends a method with this name and args to the lane’s chain. The code generator emits `.euclidean(3, 4)` (or whatever args the user set). Strudel runtime must understand that method (or the pattern will fail at eval until you extend the runtime).

## 5. Enabling the plugin in the studio

1. **Add the plugin as a dependency** of the studio app (`apps/studio/package.json`):
   ```json
   "@strudel-studio/plugin-euclidean": "workspace:*"
   ```
2. **Import the plugin** in `apps/studio/src/plugins.ts` so its side effects run when the app loads:
   ```ts
   import "@strudel-studio/plugin-euclidean";
   ```
3. Run `pnpm install` and rebuild. The plugin’s transforms will appear in the picker.

## Architecture notes

- **PatternGraph only:** All editor actions mutate the PatternGraph; no direct AST or source editing. Plugins that add transforms participate in this flow: the user picks a transform → the app adds a method to the graph → validate → graphToAst → codegen → setSource.
- **Immutability:** Any plugin transform function that returns graph/AST must return new objects; it must not mutate shared structures.
- **Safety:** Plugin code runs in the same context as the app. Sandboxing (e.g. workers) is not yet implemented.

## 6. Custom node types (v1.0)

Plugins can define **plugin graph nodes** that participate in graph → AST compilation.

- **Graph shape:** A node with `type: "plugin"`, `pluginId`, `nodeKind`, and optional `payload` is valid in a PatternGraph. The schema is in `@strudel-studio/pattern-graph` (export `pluginNodeSchema`, type `PluginNode`).
- **Compilation:** When the studio compiles a graph to AST, it passes **`compilePluginNode: createPluginNodeCompiler()`** into `graphToAst(graph, options)`. That callback looks up a compiler registered for each plugin node’s `(pluginId, nodeKind)`.
- **Registration:** In your plugin, call **`registerPluginNodeCompiler(pluginId, nodeKind, compile)`** from `@strudel-studio/plugins-sdk`. The `compile` function receives the `PluginNode` and must return a **PatternDoc** (e.g. a `TransformChain` or a composite). Declare the same `nodeKind` in your manifest’s **nodeKinds** for consistency.
- **Creating plugin nodes:** The editor does not yet create plugin nodes from the UI; that is follow-on work. For now, plugin nodes can be added programmatically (e.g. in tests or when importing a graph that includes them). Once the graph contains plugin nodes, compilation and codegen use your registered compiler.

## 7. Custom visual editors (v1.0 panels)

Plugins can add **custom UI panels** to the studio’s Plugins section.

- Call **`registerPluginPanel({ pluginId, title?, render })`** from `@strudel-studio/plugins-sdk`. **`render`** is a function that returns the panel content. In the React app it should return a **React node** (e.g. use `createElement` or JSX if your plugin depends on React).
- The studio renders each registered panel under “Plugin panels” with an optional title. Use panels for short help text, links, or custom controls that don’t require direct graph access.
- If your panel uses React, add **`react`** as a **peerDependency** (and optionally **`@types/react`** in devDependencies) so the host app’s React is used when the app renders your panel.

See **docs/architecture.md** §10 and **docs/project-roadmap.md** v1.0 for the full plugin contract and roadmap.
