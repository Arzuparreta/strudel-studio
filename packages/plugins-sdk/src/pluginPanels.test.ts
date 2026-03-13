import { describe, it, expect, afterEach } from "vitest";
import {
  registerPluginPanel,
  getPluginPanels,
  _resetPluginPanelsForTesting,
} from "./pluginPanels.js";

describe("plugin panels", () => {
  afterEach(() => {
    _resetPluginPanelsForTesting();
  });

  it("registers a panel and returns it from getPluginPanels", () => {
    registerPluginPanel({
      pluginId: "test",
      title: "Test Panel",
      render: () => "content",
    });
    const panels = getPluginPanels();
    expect(panels).toHaveLength(1);
    expect(panels[0].pluginId).toBe("test");
    expect(panels[0].title).toBe("Test Panel");
    expect(panels[0].render()).toBe("content");
  });

  it("replaces existing panel when same pluginId is registered again", () => {
    registerPluginPanel({
      pluginId: "a",
      title: "First",
      render: () => 1,
    });
    registerPluginPanel({
      pluginId: "a",
      title: "Second",
      render: () => 2,
    });
    const panels = getPluginPanels();
    expect(panels).toHaveLength(1);
    expect(panels[0].title).toBe("Second");
    expect(panels[0].render()).toBe(2);
  });

  it("ignores registration with missing pluginId or render", () => {
    registerPluginPanel({
      pluginId: "",
      title: "Bad",
      render: () => "x",
    });
    expect(getPluginPanels()).toHaveLength(0);

    registerPluginPanel({
      pluginId: "b",
      title: "Bad",
      render: undefined as any,
    });
    expect(getPluginPanels()).toHaveLength(0);
  });
});
