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

  it("groups by lane and shows Lane heading when haps have laneId (refinement 5)", () => {
    render(
      <HapList
        haps={[
          {
            start: 0,
            end: 0.5,
            value: { kind: "bd" },
            bufferGeneration: 1,
            laneId: "lane_drums",
          },
          {
            start: 0.5,
            end: 1,
            value: { kind: "sd" },
            bufferGeneration: 1,
            laneId: "lane_drums",
          },
          {
            start: 0,
            end: 1,
            value: { note: "c2" },
            bufferGeneration: 1,
            laneId: "lane_bass",
          },
        ]}
        laneOrder={[
          { id: "lane_drums", name: "drums" },
          { id: "lane_bass", name: "bass" },
        ]}
      />,
    );

    expect(screen.getByText("Lane: drums")).toBeTruthy();
    expect(screen.getByText("Lane: bass")).toBeTruthy();
    expect(screen.getByText(/\{"kind":"bd"\}/)).toBeTruthy();
    expect(screen.getByText(/\{"kind":"sd"\}/)).toBeTruthy();
    expect(screen.getByText(/\{"note":"c2"\}/)).toBeTruthy();
  });
});

