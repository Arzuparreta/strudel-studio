import { describe, it, expect } from "vitest";

describe("Studio transform registry integration", () => {
  // TODO: Enable this test once Studio exposes a test harness that can
  // force `canEditGraph` into an editable state without depending on the
  // current parser/opaque-region behavior.
  it.skip("applies per-lane transform selection and coerced default args", async () => {
    const app = document.createElement("div");
    document.body.appendChild(app);
    // Dynamically import to let Vite handle React rendering without requiring
    // React Testing Library as a direct dependency.
    const mod = await import("./main.js");
    if (typeof mod.renderApp === "function") {
      mod.renderApp(app);
    }

    // Wait for initial render of the multi-track graph section by polling the DOM.
    await new Promise<void>((resolve) => {
      const start = Date.now();
      const check = () => {
        if (document.body.textContent?.includes("Multi-track graph")) {
          resolve();
          return;
        }
        if (Date.now() - start > 2000) {
          resolve();
          return;
        }
        setTimeout(check, 10);
      };
      check();
    });

    // Choose "gain" as the transform to add using the global selector.
    const selects = document.querySelectorAll("select");
    const laneSelect = selects[0] as HTMLSelectElement | undefined;
    if (!laneSelect) {
      throw new Error("Global transform selector not found");
    }
    (laneSelect as HTMLSelectElement).value = "gain";
    laneSelect.dispatchEvent(new Event("change", { bubbles: true }));

    // Click the "+ Add transform" button for the first lane.
    const addButtons = Array.from(document.querySelectorAll("button")).filter(
      (btn) =>
        btn.textContent?.includes("+ Add transform") ||
        btn.textContent?.includes("Add transform"),
    );
    const addButton = addButtons[0] as HTMLButtonElement | undefined;
    if (!addButton) {
      throw new Error('"+ Add transform" button not found');
    }
    addButton.click();

    // After the graph is updated and code regenerated, the generated Strudel
    // source (shown above in the page) should contain a ".gain(" call.
    await new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const codeText = document.body.textContent ?? "";
      expect(codeText.includes(".gain(")).toBe(true);
        if (codeText.includes(".gain(")) {
          resolve();
          return;
        }
        if (Date.now() - start > 2000) {
          reject(
            new Error("Timed out waiting for generated code to include .gain("),
          );
          return;
        }
        setTimeout(check, 10);
      };
      check();
    });
  });
});

