/**
 * Multi-track UI: stack lanes from a PatternGraph, with optional editing.
 * @see docs/implementation-roadmap.md Task 3.11
 */

import type { PatternGraph, GraphNode, TransformChainNode, LaneNode } from "@strudel-studio/pattern-graph";
import { getTopLevelTrackIds, getNodeLabel } from "./laneStackUtils.js";
import { PatternGrid } from "./PatternGrid.js";

export interface LaneStackProps {
  /** The pattern graph to display (e.g. parallel root with lanes). */
  graph: PatternGraph;
  /** Optional CSS class for the container. */
  className?: string;
  /** Optional callbacks to enable interactive lane editing. */
  onAddLane?: () => void;
  onDeleteLane?: (laneId: string) => void;
  onRenameLane?: (laneId: string, newName: string) => void;
  /** Update the optional cycle length hint for a lane. */
  onChangeCycleHint?: (laneId: string, next: number | null) => void;
  onChangeBasePattern?: (laneId: string, newMini: string) => void;
  /** Add a transform to the end of the lane's chain. */
  onAddTransform?: (laneId: string) => void;
  /** Reorder transforms by id (newOrder must be a permutation). */
  onReorderTransforms?: (laneId: string, newOrder: string[]) => void;
  /** Remove a transform from a lane by transform id. */
  onRemoveTransform?: (laneId: string, transformId: string) => void;
}

function findNode(graph: PatternGraph, id: string): GraphNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

function getLaneAndChain(
  graph: PatternGraph,
  trackId: string,
): { lane: LaneNode; chain: TransformChainNode } | null {
  const node = findNode(graph, trackId);
  if (!node) return null;

  if (node.type === "lane") {
    const lane = node as LaneNode;
    const head = findNode(graph, lane.head);
    if (!head || head.type !== "transformChain") return null;
    return { lane, chain: head as TransformChainNode };
  }

  if (node.type === "transformChain") {
    // Degenerate case: single-chain graph without explicit lane.
    const lane: LaneNode = {
      id: trackId,
      type: "lane",
      head: trackId,
    };
    return { lane, chain: node as TransformChainNode };
  }

  return null;
}

function deriveVoicesAndSteps(mini: string): { voices: string[]; steps: number } {
  const tokens = mini.trim().length === 0 ? [] : mini.trim().split(/\s+/);
  const voices: string[] = [];
  for (const token of tokens) {
    if (token === "~") continue;
    if (!voices.includes(token)) {
      voices.push(token);
    }
  }
  const steps = tokens.length > 0 ? tokens.length : 4;
  return { voices, steps };
}

/**
 * Renders a PatternGraph as stacked lanes (one row per top-level track).
 * For a parallel root, each child is a row; for a single chain, one row.
 * When callbacks are provided, the component renders editing controls.
 */
export function LaneStack({
  graph,
  className,
  onAddLane,
  onDeleteLane,
  onRenameLane,
  onChangeCycleHint,
  onChangeBasePattern,
  onAddTransform,
  onReorderTransforms,
  onRemoveTransform,
}: LaneStackProps) {
  const trackIds = getTopLevelTrackIds(graph);
  const isInteractive =
    !!onAddLane ||
    !!onDeleteLane ||
    !!onRenameLane ||
    !!onChangeBasePattern ||
    !!onAddTransform ||
    !!onReorderTransforms ||
    !!onRemoveTransform;

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
      {trackIds.map((id, index) => {
        const laneAndChain = getLaneAndChain(graph, id);
        const label = getNodeLabel(graph, id);

        if (!isInteractive || !laneAndChain) {
          return (
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
              {label}
            </div>
          );
        }

        const { lane, chain } = laneAndChain;
        // @ts-expect-error - name is an optional UI-only field on LaneNode
        const laneName: string = (lane as any).name ?? lane.id;
        const { voices, steps } = deriveVoicesAndSteps(
          chain.base.miniSerialization,
        );

        return (
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
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontWeight: 600 }}>{index + 1}.</span>
                {onRenameLane ? (
                  <input
                    type="text"
                    value={laneName}
                    onChange={(e) => onRenameLane(lane.id, e.target.value)}
                    style={{
                      fontFamily: "inherit",
                      fontSize: "0.9rem",
                      padding: "0.1rem 0.25rem",
                    }}
                  />
                ) : (
                  <span>{laneName}</span>
                )}
              </div>
              {onDeleteLane && (
                <button
                  type="button"
                  onClick={() => onDeleteLane(lane.id)}
                  style={{ fontSize: "0.8rem" }}
                >
                  Delete lane
                </button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.8rem", color: "#555" }}>
                Base pattern
              </label>
              {onChangeBasePattern ? (
                <>
                  <input
                    type="text"
                    value={chain.base.miniSerialization}
                    onChange={(e) => onChangeBasePattern(lane.id, e.target.value)}
                    style={{
                      width: "100%",
                      fontFamily: "monospace",
                      fontSize: "0.85rem",
                      padding: "0.15rem 0.25rem",
                    }}
                  />
                  <PatternGrid
                    mini={chain.base.miniSerialization}
                    steps={steps}
                    voices={voices}
                    onChangeMini={(next) => onChangeBasePattern(lane.id, next)}
                  />
                </>
              ) : (
                <code>{chain.base.miniSerialization}</code>
              )}
            </div>

            {onChangeCycleHint && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.8rem",
                  color: "#555",
                }}
              >
                <label htmlFor={`cycle-${lane.id}`}>Cycle length</label>
                <input
                  id={`cycle-${lane.id}`}
                  type="number"
                  min={1}
                  step={1}
                  value={
                    typeof lane.cycleHint === "number" && lane.cycleHint > 0
                      ? lane.cycleHint
                      : ""
                  }
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (!raw) {
                      onChangeCycleHint(lane.id, null);
                      return;
                    }
                    const parsed = Number.parseInt(raw, 10);
                    if (!Number.isFinite(parsed) || parsed <= 0) {
                      onChangeCycleHint(lane.id, null);
                      return;
                    }
                    onChangeCycleHint(lane.id, parsed === 1 ? null : parsed);
                  }}
                  style={{
                    width: "4rem",
                    fontFamily: "inherit",
                    fontSize: "0.8rem",
                    padding: "0.1rem 0.25rem",
                  }}
                />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: "0.8rem", color: "#555" }}>Transforms</span>
                {onAddTransform && (
                  <button
                    type="button"
                    onClick={() => onAddTransform(lane.id)}
                    style={{ fontSize: "0.8rem" }}
                  >
                    + Add transform
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {chain.methods.length === 0 && (
                  <span style={{ fontSize: "0.8rem", color: "#888" }}>
                    No transforms
                  </span>
                )}
                {chain.methods.map((m, idx) => (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    <code style={{ flex: 1 }}>
                      .{m.name}(
                      {m.args.map((arg, i) =>
                        i === 0 ? String(arg) : `, ${String(arg)}`,
                      )}
                      )
                    </code>
                    {onReorderTransforms && chain.methods.length > 1 && (
                      <div style={{ display: "flex", gap: "0.15rem" }}>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => {
                            if (!onReorderTransforms) return;
                            const ids = chain.methods.map((mm) => mm.id);
                            if (idx > 0) {
                              const tmp = ids[idx - 1];
                              ids[idx - 1] = ids[idx];
                              ids[idx] = tmp;
                            }
                            onReorderTransforms(lane.id, ids);
                          }}
                          style={{ fontSize: "0.7rem" }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={idx === chain.methods.length - 1}
                          onClick={() => {
                            if (!onReorderTransforms) return;
                            const ids = chain.methods.map((mm) => mm.id);
                            if (idx < ids.length - 1) {
                              const tmp = ids[idx + 1];
                              ids[idx + 1] = ids[idx];
                              ids[idx] = tmp;
                            }
                            onReorderTransforms(lane.id, ids);
                          }}
                          style={{ fontSize: "0.7rem" }}
                        >
                          ↓
                        </button>
                      </div>
                    )}
                    {onRemoveTransform && (
                      <button
                        type="button"
                        onClick={() => onRemoveTransform(lane.id, m.id)}
                        style={{ fontSize: "0.7rem" }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {onAddLane && (
        <button
          type="button"
          onClick={onAddLane}
          style={{
            marginTop: "0.5rem",
            alignSelf: "flex-start",
            fontSize: "0.85rem",
          }}
        >
          + Add lane
        </button>
      )}
    </div>
  );
}

