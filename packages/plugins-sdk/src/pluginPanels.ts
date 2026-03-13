/**
 * Registry for plugin-provided UI panels (v1.0 custom visual editors).
 * Panels are rendered by the studio in a "Plugin panels" section.
 * The render function should return a React node when used in the React app.
 *
 * @see docs/project-roadmap.md v1.0 — Plugin System
 */

export interface PluginPanelDescriptor {
  pluginId: string;
  /** Optional panel title; defaults to pluginId. */
  title?: string;
  /** Render the panel content. In the React app, this should return a React node. */
  render: () => unknown;
}

const panels: PluginPanelDescriptor[] = [];

/**
 * Register a UI panel for the given plugin. The studio will render it in the
 * "Plugin panels" section. Call from your plugin's entry module.
 */
export function registerPluginPanel(descriptor: PluginPanelDescriptor): void {
  if (!descriptor.pluginId || typeof descriptor.render !== "function") {
    return;
  }
  const existing = panels.findIndex((p) => p.pluginId === descriptor.pluginId);
  if (existing >= 0) {
    panels[existing] = descriptor;
  } else {
    panels.push(descriptor);
  }
}

/**
 * Get all registered plugin panels for the studio to render.
 */
export function getPluginPanels(): readonly PluginPanelDescriptor[] {
  return panels;
}

/** Clear all registered panels. For testing only. */
export function _resetPluginPanelsForTesting(): void {
  panels.length = 0;
}
