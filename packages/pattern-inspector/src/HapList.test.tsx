import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HapList } from "./HapList.js";

describe("HapList", () => {
  it("renders empty state when there are no haps", () => {
    render(<HapList haps={[]} />);
    expect(screen.getByText("No haps in window.")).toBeTruthy();
  });

  it("renders a list of haps with timing and value", () => {
    render(
      <HapList
        haps={[
          { start: 0, end: 1, value: { note: "c2 buddy" }, bufferGeneration: 1 },
          { start: 1, end: 2, value: { note: "eb2 buddy" }, bufferGeneration: 1 },
        ]}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("c2 buddy");
    expect(items[1].textContent).toContain("eb2 buddy");
  });
});

