/**
 * Multi-track UI: stack lanes from a PatternGraph, with optional editing.
 * @see docs/implementation-roadmap.md Task 3.11
 */

import type { PatternGraph, GraphNode, TransformChainNode, LaneNode } from "@strudel-studio/pattern-graph";
import { parseTransformArgsString, getTransformSpec } from "@strudel-studio/plugins-sdk";
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
  onAddTransform?: (laneId: string, transformName?: string) => void;
  /** Reorder transforms by id (newOrder must be a permutation). */
  onReorderTransforms?: (laneId: string, newOrder: string[]) => void;
  /** Remove a transform from a lane by transform id. */
  onRemoveTransform?: (laneId: string, transformId: string) => void;
  /** Update arguments for a specific transform in a lane. */
  onChangeTransformArgs?: (
    laneId: string,
    transformId: string,
    nextArgs: unknown[],
  ) => void;
  /** Optional list of available transform names for lane pickers. */
  availableTransforms?: string[];
  /** Optional per-lane selected transform names (for pickers). */
  selectedTransformForLane?: Record<string, string>;
  /** Optional callback to change the selected transform for a lane. */
  onSelectTransformForLane?: (laneId: string, transformName: string) => void;
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
  onChangeTransformArgs,
  availableTransforms,
  selectedTransformForLane,
  onSelectTransformForLane,
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
        const rawLaneName = (lane as any).name;
        const laneName =
          typeof rawLaneName === "string" && rawLaneName.length > 0
            ? rawLaneName
            : lane.id;
        const selectedTransformName =
          (selectedTransformForLane && selectedTransformForLane[lane.id]) || "";
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  }}
                >
                  {onSelectTransformForLane && selectedTransformForLane && (
                    <select
                      value={selectedTransformName}
                      onChange={(e) =>
                        onSelectTransformForLane(lane.id, e.target.value)
                      }
                      style={{
                        fontFamily: "inherit",
                        fontSize: "0.8rem",
                        padding: "0.1rem 0.25rem",
                      }}
                    >
                      <option value="">(default)</option>
                      {availableTransforms?.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  )}
                  {onAddTransform && (
                    <button
                      type="button"
                      onClick={() =>
                        onAddTransform(
                          lane.id,
                          selectedTransformName || undefined,
                        )
                      }
                      style={{ fontSize: "0.8rem" }}
                    >
                      + Add transform
                    </button>
                  )}
                </div>
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
                    aria-label={
                      onReorderTransforms && chain.methods.length > 1
                        ? `Transform .${m.name}(${m.args.map(String).join(", ")}), draggable to reorder`
                        : undefined
                    }
                    draggable={!!onReorderTransforms}
                    onDragStart={(event) => {
                      if (!onReorderTransforms) return;
                      event.dataTransfer.setData("text/plain", String(idx));
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(event) => {
                      if (!onReorderTransforms) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      if (!onReorderTransforms) return;
                      event.preventDefault();
                      const raw = event.dataTransfer.getData("text/plain");
                      const fromIndex = Number.parseInt(raw, 10);
                      if (!Number.isFinite(fromIndex)) {
                        return;
                      }
                      if (fromIndex === idx) {
                        return;
                      }
                      const ids = chain.methods.map((mm) => mm.id);
                      const [moved] = ids.splice(fromIndex, 1);
                      ids.splice(idx, 0, moved!);
                      onReorderTransforms(lane.id, ids);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      cursor:
                        onReorderTransforms && chain.methods.length > 1
                          ? "grab"
                          : undefined,
                    }}
                  >
                    <code style={{ flex: 1 }}>
                      .{m.name}(
                      {m.args.map((arg, i) =>
                        i === 0 ? String(arg) : `, ${String(arg)}`,
                      )}
                      )
                    </code>
                    {onChangeTransformArgs && (() => {
                      const spec = getTransformSpec(m.name);
                      const usePicker =
                        spec?.args && spec.args.length > 0;
                      if (usePicker) {
                        return (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.2rem",
                              flexWrap: "wrap",
                            }}
                          >
                            {spec!.args!.map((argSpec, i) => {
                              const val = i < m.args.length ? m.args[i] : undefined;
                              const display =
                                val !== undefined && val !== null
                                  ? String(val)
                                  : argSpec.default !== undefined
                                    ? String(argSpec.default)
                                    : "";
                              const updateArg = (next: unknown) => {
                                const nextArgs = [...m.args];
                                while (nextArgs.length < spec!.args!.length) {
                                  nextArgs.push(
                                    spec!.args![nextArgs.length]?.default,
                                  );
                                }
                                nextArgs[i] = next;
                                onChangeTransformArgs(
                                  lane.id,
                                  m.id,
                                  nextArgs.slice(0, spec!.args!.length),
                                );
                              };
                              if (argSpec.type === "number") {
                                const numVal =
                                  typeof val === "number" && !Number.isNaN(val)
                                    ? val
                                    : typeof argSpec.default === "number"
                                      ? argSpec.default
                                      : "";
                                return (
                                  <input
                                    key={argSpec.name ?? i}
                                    type="number"
                                    aria-label={argSpec.name ?? `arg ${i}`}
                                    value={numVal}
                                    min={argSpec.min}
                                    max={argSpec.max}
                                    step={
                                      typeof argSpec.min === "number" &&
                                      typeof argSpec.max === "number"
                                        ? "any"
                                        : 1
                                    }
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      if (v === "") {
                                        updateArg(undefined);
                                        return;
                                      }
                                      const n = Number(v);
                                      updateArg(Number.isNaN(n) ? undefined : n);
                                    }}
                                    style={{
                                      fontFamily: "inherit",
                                      fontSize: "0.75rem",
                                      padding: "0.1rem 0.25rem",
                                      width: "3.5rem",
                                    }}
                                  />
                                );
                              }
                              if (argSpec.type === "boolean") {
                                return (
                                  <label
                                    key={argSpec.name ?? i}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "0.2rem",
                                      fontSize: "0.75rem",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      aria-label={argSpec.name ?? `arg ${i}`}
                                      checked={
                                        val === true ||
                                        (val !== false &&
                                          val !== undefined &&
                                          val !== null &&
                                          String(val).toLowerCase() === "true")
                                      }
                                      onChange={(e) =>
                                        updateArg(e.target.checked)
                                      }
                                    />
                                    {argSpec.name}
                                  </label>
                                );
                              }
                              return (
                                <input
                                  key={argSpec.name ?? i}
                                  type="text"
                                  aria-label={argSpec.name ?? `arg ${i}`}
                                  value={display}
                                  onChange={(e) =>
                                    updateArg(
                                      e.target.value === ""
                                        ? undefined
                                        : e.target.value,
                                    )
                                  }
                                  style={{
                                    fontFamily: "inherit",
                                    fontSize: "0.75rem",
                                    padding: "0.1rem 0.25rem",
                                    minWidth: "4rem",
                                  }}
                                />
                              );
                            })}
                          </span>
                        );
                      }
                      return (
                        <input
                          type="text"
                          value={m.args
                            .map((arg) =>
                              arg === undefined ? "" : String(arg),
                            )
                            .join(", ")}
                          onChange={(e) => {
                            const parsed = parseTransformArgsString(
                              e.target.value,
                            );
                            onChangeTransformArgs(lane.id, m.id, parsed);
                          }}
                          style={{
                            fontFamily: "inherit",
                            fontSize: "0.75rem",
                            padding: "0.1rem 0.25rem",
                            minWidth: "4rem",
                          }}
                        />
                      );
                    })()}
                    {onReorderTransforms && chain.methods.length > 1 && (
                      <div style={{ display: "flex", gap: "0.15rem" }}>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => {
                            if (!onReorderTransforms) return;
                            const ids = chain.methods.map((mm) => mm.id);
                            if (idx > 0) {
                              const tmp = ids[idx - 1]!;
                              ids[idx - 1] = ids[idx]!;
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
                              const tmp = ids[idx + 1]!;
                              ids[idx + 1] = ids[idx]!;
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

