import type { Hap } from "@strudel-studio/strudel-bridge";
import type { JSX } from "react";

export interface LaneInfo {
  id: string;
  name?: string;
}

export interface HapListProps {
  haps: Hap[];
  /** Optional lane order from PatternGraph for labeling when haps carry laneId (refinement 5). */
  laneOrder?: LaneInfo[];
}

/**
 * Minimal read-only Pattern Inspector view.
 *
 * When haps carry laneId, groups by lane and shows "Lane: id" (or name) per block.
 * Otherwise a single flat list (fallback).
 *
 * @see docs/architecture.md §9
 * @see docs/project-roadmap.md Before v1.0 — Refinement 5
 */
export function HapList({ haps, laneOrder = [] }: HapListProps): JSX.Element {
  if (haps.length === 0) {
    return <div>No haps in window.</div>;
  }

  const hasLaneId = haps.some((h) => h.laneId != null);
  if (!hasLaneId) {
    return (
      <div>
        <ul>
          {haps.map((hap, index) => (
            <li key={`${hap.bufferGeneration}-${index}`}>
              <code>
                [{hap.start.toFixed(3)} → {hap.end.toFixed(3)}] gen{" "}
                {hap.bufferGeneration}:{" "}
                {JSON.stringify(hap.value)}
              </code>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const byLane = new Map<string, Hap[]>();
  for (const hap of haps) {
    const id = hap.laneId ?? "";
    if (!byLane.has(id)) byLane.set(id, []);
    byLane.get(id)!.push(hap);
  }
  const order = laneOrder.length ? laneOrder.map((l) => l.id) : [...byLane.keys()].sort();
  const laneIds = order.filter((id) => byLane.has(id));
  const rest = [...byLane.keys()].filter((id) => !order.includes(id)).sort();
  const sortedLaneIds = [...laneIds, ...rest];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {sortedLaneIds.map((laneId) => {
        const laneHaps = byLane.get(laneId)!;
        const label =
          laneOrder.find((l) => l.id === laneId)?.name ?? (laneId || "Pattern");
        return (
          <div key={laneId}>
            <h3 style={{ fontSize: "0.9rem", marginBottom: "0.25rem" }}>
              Lane: {label}
            </h3>
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {laneHaps.map((hap, index) => (
                <li key={`${laneId}-${hap.bufferGeneration}-${index}`}>
                  <code>
                    [{hap.start.toFixed(3)} → {hap.end.toFixed(3)}]{" "}
                    {JSON.stringify(hap.value)}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

