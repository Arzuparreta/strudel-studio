import type { Hap } from "@strudel-studio/strudel-bridge";
import type { JSX } from "react";

export interface HapTimelineProps {
  /** Haps from the shared hap cache (with per-event start/end for layout). */
  haps: Hap[];
  /** Time range to display. Defaults to [0, 1]. */
  timeWindow?: { from: number; to: number };
  /** Height of each event row in px. */
  rowHeight?: number;
}

/**
 * Short label for a hap value (note, kind, or first meaningful key).
 */
function labelForValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value.slice(0, 12);
  if (typeof value !== "object") return String(value).slice(0, 12);
  const obj = value as Record<string, unknown>;
  if (typeof obj.note === "string") return String(obj.note).slice(0, 12);
  if (typeof obj.kind === "string") return String(obj.kind).slice(0, 12);
  const first = Object.keys(obj)[0];
  if (first) return `${first}:${String((obj as Record<string, unknown>)[first]).slice(0, 8)}`;
  return "·";
}

/** Lane key for grouping (roadmap: |bd| |sd| on one row, |C| |G| on another). */
function laneKeyForValue(value: unknown): string {
  if (value == null) return "other";
  if (typeof value !== "object") return "other";
  const obj = value as Record<string, unknown>;
  if (typeof obj.note === "string") return "note";
  if (typeof obj.kind === "string") return "sound";
  return "other";
}

const LANE_ORDER = ["sound", "note", "other"];

/**
 * Pattern Timeline Inspector (v0.9).
 *
 * Renders haps on a horizontal time axis so users see patterns evolve over time.
 * Uses hap.start / hap.end for positioning when the bridge records per-event
 * part/whole; falls back to stacked blocks when all haps share the same span.
 *
 * @see docs/project-roadmap.md v0.9 — Pattern Timeline Inspector
 * @see docs/architecture.md §9
 */
export function HapTimeline({
  haps,
  timeWindow,
  rowHeight = 28,
}: HapTimelineProps): JSX.Element {
  const from = timeWindow?.from ?? 0;
  const to = timeWindow?.to ?? 1;
  const span = Math.max(to - from, 1e-9);

  if (haps.length === 0) {
    return (
      <div style={{ padding: "0.5rem", color: "#666", fontSize: "0.9rem" }}>
        No events in time window. Generate &amp; Play to fill the timeline.
      </div>
    );
  }

  // Group by lane (sound / note / other) for multi-row timeline (roadmap sketch).
  const byLane = new Map<string, Hap[]>();
  for (const hap of haps) {
    const key = laneKeyForValue(hap.value);
    if (!byLane.has(key)) byLane.set(key, []);
    byLane.get(key)!.push(hap);
  }
  const orderedLanes = LANE_ORDER.filter((k) => byLane.has(k));
  const remaining = [...byLane.keys()].filter((k) => !LANE_ORDER.includes(k));
  const laneKeys = [...orderedLanes, ...remaining.sort()];

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", fontSize: "0.85rem" }}>
      <div
        style={{
          marginBottom: "0.25rem",
          color: "#555",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>time →</span>
        <span>
          {from.toFixed(2)} – {to.toFixed(2)} cycle
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {laneKeys.map((key) => {
          const laneHaps = [...(byLane.get(key) ?? [])].sort(
            (a, b) => a.start - b.start || a.end - b.end,
          );
          return (
            <div
              key={key}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              <div
                style={{
                  width: 48,
                  textAlign: "right",
                  fontSize: "0.7rem",
                  color: "#777",
                  flexShrink: 0,
                }}
              >
                {key}
              </div>
              <div
                data-testid={`timeline-row-${key}`}
                style={{
                  position: "relative",
                  height: rowHeight,
                  flex: 1,
                  background:
                    "linear-gradient(to right, #f5f5f5 0%, #eee 100%)",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                  overflow: "hidden",
                }}
              >
                {laneHaps.map((hap, index) => {
                  const left = ((hap.start - from) / span) * 100;
                  const width = Math.max(
                    ((hap.end - hap.start) / span) * 100,
                    2,
                  );
                  return (
                    <div
                      key={`${key}-${hap.bufferGeneration}-${hap.start}-${hap.end}-${index}`}
                      title={`[${hap.start.toFixed(3)} – ${hap.end.toFixed(3)}] ${JSON.stringify(hap.value)}`}
                      style={{
                        position: "absolute",
                        left: `${left}%`,
                        width: `${width}%`,
                        top: 4,
                        height: rowHeight - 8,
                        backgroundColor: "rgba(80, 120, 200, 0.35)",
                        border: "1px solid rgba(60, 90, 160, 0.6)",
                        borderRadius: "3px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        color: "#222",
                      }}
                    >
                      {labelForValue(hap.value)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
