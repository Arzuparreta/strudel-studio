import { describe, it, expect } from "vitest";
import { PatternGrid } from "./PatternGrid.js";
import { render, fireEvent } from "@testing-library/react";

describe("PatternGrid", () => {
  it("renders a grid of the requested length", () => {
    const { container } = render(
      <PatternGrid mini="bd ~ bd ~" steps={4} onChangeMini={() => {}} />,
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(4);
  });

  it("toggles steps and emits a new mini string", () => {
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
});

