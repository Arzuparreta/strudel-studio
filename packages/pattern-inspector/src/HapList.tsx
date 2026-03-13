import type { Hap } from "@strudel-studio/strudel-bridge";
import React from "react";

export interface HapListProps {
  haps: Hap[];
}

/**
 * Minimal read-only Pattern Inspector view.
 *
 * This component expects haps from the shared hap cache in
 * `@strudel-studio/strudel-bridge` and renders a simple list
 * showing time window and a JSON preview of the value.
 *
 * @see docs/architecture.md §9
 * @see docs/implementation-roadmap.md Task 3.6
 */
export function HapList({ haps }: HapListProps): JSX.Element {
  if (haps.length === 0) {
    return <div>No haps in window.</div>;
  }

  return (
    <div>
      <h2>Pattern Inspector</h2>
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

