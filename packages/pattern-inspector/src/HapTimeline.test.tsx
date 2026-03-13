import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { HapTimeline } from "./HapTimeline.js";

describe("HapTimeline", () => {
  it("renders empty state when there are no haps", () => {
    const { container } = render(<HapTimeline haps={[]} />);
    expect(within(container).getByText(/No events in time window/)).toBeTruthy();
  });

  it("renders event blocks with labels from hap values", () => {
    const { container } = render(
      <HapTimeline
        haps={[
          { start: 0, end: 0.25, value: { note: "bd" }, bufferGeneration: 1 },
          { start: 0.25, end: 0.5, value: { note: "sd" }, bufferGeneration: 1 },
          { start: 0.5, end: 0.75, value: { note: "bd" }, bufferGeneration: 1 },
        ]}
      />,
    );
    const scope = within(container);
    expect(scope.getByText("sd")).toBeTruthy();
    expect(scope.getAllByText("bd")).toHaveLength(2);
  });

  it("shows time window label", () => {
    const { container } = render(
      <HapTimeline
        haps={[{ start: 0, end: 0.5, value: {}, bufferGeneration: 1 }]}
        timeWindow={{ from: 0, to: 1 }}
      />,
    );
    expect(within(container).getByText("0.00 – 1.00 cycle")).toBeTruthy();
  });
});
