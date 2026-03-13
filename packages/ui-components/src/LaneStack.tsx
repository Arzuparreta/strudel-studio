/**
 * Multi-track UI: stack lanes from a PatternGraph (read-only).
 * @see docs/implementation-roadmap.md Task 3.11
 */

import type { PatternGraph } from "@strudel-studio/pattern-graph";
import { getTopLevelTrackIds, getNodeLabel } from "./laneStackUtils.js";

export interface LaneStackProps {
  /** The pattern graph to display (e.g. parallel/serial root with lanes). */
  graph: PatternGraph;
  /** Optional CSS class for the container. */
  className?: string;
}

/**
 * Renders a PatternGraph as stacked lanes (one row per top-level track).
 * For a parallel root, each child is a row; for a single chain, one row.
 */
export function LaneStack({ graph, className }: LaneStackProps) {
  const trackIds = getTopLevelTrackIds(graph);

  return (
    <div
      className={className}
      role="list"
      aria-label="Pattern lanes"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      {trackIds.map((id, index) => (
        <div
          key={id}
          role="listitem"
          style={{
            padding: "0.5rem 0.75rem",
            border: "1px solid #ccc",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "0.9rem",
            backgroundColor: index % 2 === 0 ? "#f9f9f9" : "#fff",
          }}
        >
          <span style={{ fontWeight: 600, marginRight: "0.5rem" }}>
            {index + 1}.
          </span>
          {getNodeLabel(graph, id)}
        </div>
      ))}
    </div>
  );
}
