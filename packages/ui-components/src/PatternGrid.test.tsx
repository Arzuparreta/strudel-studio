import { describe, it, expect } from "vitest";
import { PatternGrid } from "./PatternGrid.js";
import { render, fireEvent } from "@testing-library/react";

describe("PatternGrid", () => {
  it("renders a single-row grid of the requested length by default", () => {
    const { container } = render(
      <PatternGrid mini="bd ~ bd ~" steps={4} onChangeMini={() => {}} />,
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(4);
  });

  it("toggles steps in a single-row grid and emits a new mini string", () => {
    let latest: string | null = null;
    const { container } = render(
      <PatternGrid
        mini="bd ~ ~ ~"
        steps={4}
        onChangeMini={(next) => {
          latest = next;
        }}
      />,
    );

    const buttons = container.querySelectorAll("button");
    // Toggle second step on.
    fireEvent.click(buttons[1] as HTMLButtonElement);

    expect(latest).toBe("bd bd ~ ~");
  });

  it("supports multiple voices and keeps one voice per column", () => {
    let latest: string | null = null;
    const { getAllByText, container } = render(
      <PatternGrid
        mini="bd ~ sd ~"
        steps={4}
        voices={["bd", "sd"]}
        onChangeMini={(next) => {
          latest = next;
        }}
      />,
    );

    // There should be 2 rows (bd, sd) and 4 columns.
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(8);

    // Click the first column of "sd" row; this should move the hit from bd to sd.
    const sdLabel = getAllByText("sd")[0];
    const sdRow = sdLabel.parentElement?.querySelectorAll("button");
    expect(sdRow?.length).toBe(4);

    if (sdRow && sdRow[0]) {
      fireEvent.click(sdRow[0] as HTMLButtonElement);
    }

    expect(latest).toBe("sd ~ sd ~");
  });
});

