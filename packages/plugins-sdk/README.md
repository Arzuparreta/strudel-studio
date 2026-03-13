# @strudel-studio/plugins-sdk

SDK for extending Strudel Studio with plugins (v1.0).

## Plugin API (for plugin authors)

Use these exports when building a plugin:

| Export | Purpose |
|--------|---------|
| `registerPluginFromManifest(id, manifest, transform?)` | Register the plugin with a manifest and optional transform function. |
| `registerPluginTransform(spec)` | Add a custom transform to the editor picker (name, defaultArgs, args, description). |
| `parseManifest(json)` | Validate manifest JSON. |
| `pluginManifestSchema`, `PluginManifest` | Manifest schema and type. |
| `isAstVersionSupported(manifest, astVersion)` | Check compatibility with the studio AST version. |
| `getSupportedAstVersion()` | Current supported AST version (for validation). |
| `validatePatternGraph(graph)` | Validate a graph before applying (e.g. after plugin transform). |
| `withBudgetAsync(fn, budgetMs?)` | Run async plugin work under a time budget. |

The editor uses these internally; plugins typically only call the registration and validation APIs above.

## Custom transforms

- **`getTransformSpec(name)`** – Resolves built-in and plugin-registered transform specs (used by the editor).
- **`getAvailableTransformNames()`** – Sorted list of all transform names (built-in + plugin).
- **`coerceTransformArgs(spec, raw)`** – Coerce raw args using spec metadata.
- **`parseTransformArgsString(str)`** – Parse comma-separated argument string.

Plugins call **`registerPluginTransform(spec)`** to expose a transform in the “+ Add transform” picker. Built-in names cannot be overridden.

## Full guide

See **docs/plugin-authoring.md** in the repo root for package setup, manifest format, and how to enable your plugin in the studio.
