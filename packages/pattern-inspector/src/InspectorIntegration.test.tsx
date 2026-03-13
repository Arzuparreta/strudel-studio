/**
 * v0.9.2: Integration test for Pattern inspector (HapList + HapTimeline with shared haps and time window).
 * @see docs/project-roadmap.md optional "Inspector tests & performance"
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { HapList, HapTimeline } from "./index.js";
import type { Hap } from "@strudel-studio/strudel-bridge";

const mockHaps: Hap[] = [
  { start: 0, end: 0.25, value: { kind: "bd" }, bufferGeneration: 1 },
  { start: 0.25, end: 0.5, value: { kind: "sd" }, bufferGeneration: 1 },
  { start: 0.5, end: 0.75, value: { note: "c2" }, bufferGeneration: 1 },
];

const timeWindow = { from: 0, to: 1 };

describe("Pattern inspector integration", () => {
  it("renders empty state in both list and timeline when haps are empty", () => {
    const { container } = render(
      <div>
        <HapList haps={[]} />
        <HapTimeline haps={[]} timeWindow={timeWindow} />
      </div>,
    );

    expect(screen.getByText("No haps in window.")).toBeTruthy();
    expect(within(container).getByText(/No events in time window/)).toBeTruthy();
  });

  it("renders the same haps in list and timeline with shared time window", () => {
    const { container } = render(
      <div>
        <HapList haps={mockHaps} />
        <HapTimeline haps={mockHaps} timeWindow={timeWindow} />
      </div>,
    );

    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(mockHaps.length);

    const timelineScope = within(container);
    expect(timelineScope.getByText("0.00 – 1.00 cycle")).toBeTruthy();
    expect(timelineScope.getByText("bd")).toBeTruthy();
    expect(timelineScope.getByText("sd")).toBeTruthy();
    expect(timelineScope.getByText("c2")).toBeTruthy();
  });
});
