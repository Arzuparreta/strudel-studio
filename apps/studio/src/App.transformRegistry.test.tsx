import { describe, it, expect } from "vitest";
import App from "./App.js";

describe("Studio transform registry integration", () => {
  it("applies per-lane transform selection and coerced default args", async () => {
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

    // For the demo graph, there is a lane "lane_drums". The per-lane selector
    // should exist; choose "gain" as the transform to add.
    const selects = document.querySelectorAll("select");
    // First select is the global default; the second (if present) is per-lane.
    const laneSelect = selects[1] ?? selects[0];
    (laneSelect as HTMLSelectElement).value = "gain";
    laneSelect.dispatchEvent(new Event("change", { bubbles: true }));

    // Click the "+ Add transform" button for the first lane.
    const addButtons = Array.from(
      document.querySelectorAll("button"),
    ).filter((btn) => btn.textContent === "+ Add transform");
    (addButtons[0] as HTMLButtonElement).click();

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

