import { useEffect, useMemo, useRef, useState } from "react";
import { astVersion, EvalScheduler, HapCache, hushAll } from "@strudel-studio/strudel-bridge";
import { generateDocument } from "@strudel-studio/code-generator";
import { parseToAstOrOpaque } from "@strudel-studio/strudel-parser";
import type { ParseResult } from "@strudel-studio/strudel-parser";
import {
  graphToAst,
  astToGraph,
  addLane,
  deleteLane,
  renameLane,
  reorderParallelLanes,
  reorderSerialChildren,
  changeLaneBasePattern,
  addTransformToLane,
  setLaneCycleHint,
  removeTransformFromLane,
  reorderLaneTransforms,
  validatePatternGraph,
} from "@strudel-studio/pattern-graph";
import { updateLaneTransformArgs } from "@strudel-studio/pattern-graph";
import {
  TRANSFORM_REGISTRY,
  getTransformSpec,
  coerceTransformArgs,
} from "@strudel-studio/plugins-sdk";
import { LaneStack } from "@strudel-studio/ui-components";
import { GraphCanvas } from "@strudel-studio/ui-components";
import { HapList, HapTimeline } from "@strudel-studio/pattern-inspector";
import type { PatternGraph } from "@strudel-studio/pattern-graph";
import { MonacoEditor } from "./monaco";

/** Demo multi-track graph (parallel root, two lanes) for Task 3.11. */
const demoGraph: PatternGraph = {
  graphVersion: 2,
  astVersion: 1,
  root: "root_parallel",
  nodes: [
    {
      id: "root_parallel",
      type: "parallel",
      order: ["lane_drums", "lane_bass"],
    },
    {
      id: "lane_drums",
      type: "lane",
      cycleHint: 2,
      head: "n_drums",
    },
    {
      id: "n_drums",
      type: "transformChain",
      base: { kind: "s", miniSerialization: "bd ~ sd ~" },
      methods: [],
    },
    {
      id: "lane_bass",
      type: "lane",
      head: "n_bass",
    },
    {
      id: "n_bass",
      type: "transformChain",
      base: { kind: "s", miniSerialization: "arpy ~ cp" },
      methods: [],
    },
  ],
  edges: [],
};

export default function App() {
  const [source, setSource] = useState<string>(() =>
    generateDocument(graphToAst(demoGraph)),
  );
  const [graph, setGraph] = useState<PatternGraph>(() => demoGraph);
  const [sourceIsGraphProjection, setSourceIsGraphProjection] =
    useState<boolean>(true);
  const [status, setStatus] = useState<string>("idle");
  const [parseInfo, setParseInfo] = useState<string>("not parsed yet");
  const [graphError, setGraphError] = useState<string | null>(null);
  const [selectedTransformName, setSelectedTransformName] =
    useState<string>("slow");
  const [laneTransformSelections, setLaneTransformSelections] = useState<
    Record<string, string>
  >({});
  const [haps, setHaps] = useState<import("@strudel-studio/strudel-bridge").Hap[]>([]);
  const [timelineWindow, setTimelineWindow] = useState<{
    from: number;
    to: number;
  }>({ from: 0, to: 1 });
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(
    null,
  );

  /** v0.9.2: ref to last evaluated pattern for one-shot scrubbed queryArc (architecture §9). */
  const lastPatternRef = useRef<{
    queryArc: (from: number, to: number) => unknown[];
  } | null>(null);
  const scrubTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced parse state: last successful parse result.
  const [hasSubsetAst, setHasSubsetAst] = useState(false);
  const [hasOpaques, setHasOpaques] = useState(false);
  const [lastGoodParse, setLastGoodParse] = useState<ParseResult | null>(null);

  const scheduler = useMemo(
    () =>
      new EvalScheduler({
        debounceMs: 200,
        maxEvalsPerSecond: 4,
      }),
    [],
  );

  /** Lane order for inspector grouping (refinement 5); when haps carry laneId, list/timeline group by lane. */
  const inspectorLaneOrder = useMemo(() => {
    const root = graph.nodes.find((n) => n.id === graph.root) as
      | { order?: string[] }
      | undefined;
    const order = root?.order ?? [];
    return order.map((id: string) => {
      const lane = graph.nodes.find(
        (n) => n.id === id && n.type === "lane",
      ) as { name?: string } | undefined;
      return { id, name: lane?.name };
    });
  }, [graph]);

  const hapCache = useMemo(() => new HapCache(), []);

  useEffect(() => {
    return () => {
      if (scrubTimeoutRef.current) {
        clearTimeout(scrubTimeoutRef.current);
        scrubTimeoutRef.current = null;
      }
    };
  }, []);

  // Debounced parse whenever the source changes.
  useEffect(() => {
    let cancelled = false;
    // While the user is editing and before debounce fires, reflect a "typing" state.
    setParseInfo("typing…");

    const handle = setTimeout(() => {
      try {
        const result = parseToAstOrOpaque(source);
        if (cancelled) {
          return;
        }
        const nextHasAst = result.ast != null;
        const nextHasOpaques = result.opaques.length > 0;

        // Keep track of the last good parse result so future features
        // (graph/AST views) can rely on a stable projection even if a
        // subsequent parse fails.
        if (nextHasAst || nextHasOpaques) {
          setLastGoodParse(result);
        }

        setHasSubsetAst(nextHasAst);
        setHasOpaques(nextHasOpaques);

        if (nextHasAst && !nextHasOpaques) {
          setParseInfo("parsed: supported subset AST");
        } else if (nextHasAst && nextHasOpaques) {
          setParseInfo("parsed: AST with opaque regions");
        } else if (sourceIsGraphProjection && !nextHasAst && nextHasOpaques) {
          setParseInfo("generated from graph (parser subset unavailable)");
        } else if (!nextHasAst && nextHasOpaques) {
          setParseInfo("parsed: opaque-only (unsupported or complex code)");
        } else {
          setLastGoodParse(null);
          setParseInfo("parsed: empty document");
        }
      } catch {
        if (!cancelled) {
          setParseInfo("parse error — using last good AST/opaques");
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [source, sourceIsGraphProjection]);

  const canEditGraph = sourceIsGraphProjection || (hasSubsetAst && !hasOpaques);

  function handleSourceChange(nextSource: string) {
    setSourceIsGraphProjection(false);
    setSource(nextSource);
  }

  function updateSourceFromGraph(nextGraph: PatternGraph) {
    try {
      validatePatternGraph(nextGraph);
      const doc = graphToAst(nextGraph);
      const code = generateDocument(doc);
      setGraph(nextGraph);
      setSource(code);
      setSourceIsGraphProjection(true);
      setGraphError(null);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Unknown error validating graph";
      setGraphError(message);
    }
  }

  /** v0.9.1: Change timeline display window and refresh haps from cache (inspector reads only cache). */
  /** v0.9.2: When window !== [0,1], one-shot throttled queryArc (scrub) and merge into cache (architecture §9). */
  function handleTimelineWindowChange(next: { from: number; to: number }) {
    const from = Math.max(0, Number(next.from));
    const to = Math.max(from + 0.25, Number(next.to));
    setTimelineWindow({ from, to });
    setHaps(hapCache.getHaps({ from, to }));

    if (scrubTimeoutRef.current) {
      clearTimeout(scrubTimeoutRef.current);
      scrubTimeoutRef.current = null;
    }
    const isEvalWindow = from === 0 && to === 1;
    if (!isEvalWindow && lastPatternRef.current) {
      scrubTimeoutRef.current = setTimeout(() => {
        scrubTimeoutRef.current = null;
        const pattern = lastPatternRef.current;
        if (!pattern) return;
        try {
          const rawHaps = pattern.queryArc(from, to);
          hapCache.recordHaps({ from, to }, rawHaps, 0);
          setHaps(hapCache.getHaps({ from, to }));
        } catch {
          // Scrub failed; leave haps as cache slice only
        }
      }, 300);
    }
  }

  /** v0.8: Import current code into the graph (when parse yields AST). */
  function handleImportCodeIntoGraph() {
    const result = parseToAstOrOpaque(source);
    if (result.ast == null) {
      setGraphError(
        "Cannot import: code could not be parsed to a graph (unsupported or opaque).",
      );
      return;
    }
    try {
      const nextGraph = astToGraph(result.ast);
      updateSourceFromGraph(nextGraph);
    } catch (e) {
      setGraphError(
        e instanceof Error ? e.message : "Unknown error building graph from AST",
      );
    }
  }

  async function handleEvaluate() {
    setStatus("evaluating…");
    const result = await scheduler.queue(source);

    if (result.error) {
      setStatus("error during evaluation");
      return;
    }

    if (!result.pattern) {
      setStatus("no pattern produced");
      return;
    }

    const playable = result.pattern as typeof result.pattern & {
      play?: () => void;
    };

    try {
      const queryable = result.pattern as typeof result.pattern & {
        queryArc?: (from: number, to: number) => unknown[];
      };
      if (typeof queryable.queryArc === "function") {
        lastPatternRef.current = queryable;
        const evalWindow = { from: 0, to: 1 };
        const rawHaps = queryable.queryArc(evalWindow.from, evalWindow.to);
        hapCache.clear();
        hapCache.recordHaps(evalWindow, rawHaps, 0);
        setHaps(hapCache.getHaps(timelineWindow));
      } else {
        lastPatternRef.current = null;
        setHaps([]);
      }
    } catch {
      lastPatternRef.current = null;
      setHaps([]);
    }

    if (typeof playable.play === "function") {
      playable.play();
      setStatus("playing pattern");
      return;
    }

    setStatus("evaluated pattern (no play() method found)");
  }

  async function handleStop() {
    await hushAll();
    setStatus("stopped");
  }

  function renderTransformSummary(graphToDescribe: PatternGraph) {
    const lanes = graphToDescribe.nodes.filter(
      (n) => n.type === "lane",
    ) as Array<{ id: string; head: string }>;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {lanes.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "#777" }}>
            No lanes available for transform summary.
          </p>
        ) : (
          lanes.map((lane) => {
            const chain = graphToDescribe.nodes.find(
              (n) => n.id === lane.head && n.type === "transformChain",
            ) as
              | {
                  id: string;
                  type: "transformChain";
                  base: { kind: string; miniSerialization: string };
                  methods: { id: string; name: string; args: unknown[] }[];
                }
              | undefined;

            const methods = chain?.methods ?? [];

            return (
              <div
                key={lane.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                  fontSize: "0.85rem",
                }}
              >
                <div>
                  <code>{lane.id}</code>
                  {chain ? (
                    <>
                      {" "}
                      · base{" "}
                      <code>
                        {chain.base.kind}("{chain.base.miniSerialization}")
                      </code>
                    </>
                  ) : (
                    <> · (no transform chain)</>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.25rem",
                  }}
                >
                  {methods.length === 0 ? (
                    <span style={{ color: "#888" }}>(no transforms)</span>
                  ) : (
                    methods.map((m) => {
                      const argString = (m.args ?? [])
                        .map((a) => String(a))
                        .join(", ");
                      const spec = m.name ? getTransformSpec(m.name) : undefined;
                      const tooltip =
                        spec?.description ??
                        (spec
                          ? `${spec.name} transform`
                          : m.name
                          ? `${m.name} transform`
                          : "transform");

                      return (
                        <span
                          key={m.id}
                          title={tooltip}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "0.1rem 0.4rem",
                            borderRadius: "999px",
                            border: "1px solid #ccc",
                            backgroundColor: "#f9f9f9",
                            fontFamily: "monospace",
                          }}
                        >
                          {m.name ?? "(unknown)"}(
                          {argString})
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <main style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Strudel Studio</h1>
      <p>AST version: {astVersion}</p>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Generated Strudel code</h2>
        <MonacoEditor value={source} onChange={handleSourceChange} />
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={handleEvaluate}>
            Generate &amp; Play
          </button>
          <button type="button" onClick={handleStop}>
            Stop
          </button>
          <button type="button" onClick={handleImportCodeIntoGraph}>
            Import code into graph
          </button>
          <span>{status}</span>
        </div>
        <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#555" }}>
          Parse status: {parseInfo}
        </p>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Pattern inspector</h2>
        <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: "0.5rem" }}>
          Read-only view of recent haps from the evaluated pattern.
          Time window 0–1 is filled at evaluation; other windows use a one-shot scrub (throttled).
        </p>
        <HapList haps={haps} laneOrder={inspectorLaneOrder} />
        <div style={{ marginTop: "1rem" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "0.25rem" }}>
            Pattern timeline (v0.9)
          </h3>
          <p style={{ fontSize: "0.85rem", color: "#555", marginBottom: "0.5rem" }}>
            Events over time. Generate &amp; Play to see the pattern evolve.
          </p>
          <div
            style={{
              marginBottom: "0.5rem",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.85rem",
            }}
          >
            <span style={{ color: "#555" }}>Time window (cycles):</span>
            <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              from
              <input
                type="number"
                min={0}
                step={0.25}
                value={timelineWindow.from}
                onChange={(e) =>
                  handleTimelineWindowChange({
                    from: Number(e.target.value),
                    to: timelineWindow.to,
                  })
                }
                style={{
                  width: "4rem",
                  fontFamily: "inherit",
                  fontSize: "0.85rem",
                  padding: "0.15rem 0.25rem",
                }}
                aria-label="Timeline window start (cycles)"
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              to
              <input
                type="number"
                min={timelineWindow.from + 0.25}
                step={0.25}
                value={timelineWindow.to}
                onChange={(e) =>
                  handleTimelineWindowChange({
                    from: timelineWindow.from,
                    to: Number(e.target.value),
                  })
                }
                style={{
                  width: "4rem",
                  fontFamily: "inherit",
                  fontSize: "0.85rem",
                  padding: "0.15rem 0.25rem",
                }}
                aria-label="Timeline window end (cycles)"
              />
            </label>
            <span style={{ color: "#888" }}>Presets:</span>
            {[
              [0, 1],
              [1, 2],
              [0, 2],
            ].map(([from, to]) => (
              <button
                key={`${from}-${to}`}
                type="button"
                onClick={() => handleTimelineWindowChange({ from, to })}
                style={{
                  fontFamily: "inherit",
                  fontSize: "0.8rem",
                  padding: "0.15rem 0.4rem",
                }}
              >
                {from}–{to}
              </button>
            ))}
            <span style={{ color: "#888", fontSize: "0.8rem" }}>
              Showing {timelineWindow.from}–{timelineWindow.to}{" "}
              {timelineWindow.from === 0 && timelineWindow.to === 1
                ? "(from last play)"
                : "(scrub)"}
            </span>
          </div>
          <HapTimeline
            haps={haps}
            timeWindow={timelineWindow}
            laneOrder={inspectorLaneOrder}
          />
        </div>
        <div style={{ marginTop: "0.75rem" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "0.25rem" }}>
            Lane transform summary
          </h3>
          <p style={{ fontSize: "0.85rem", color: "#555" }}>
            Read-only summary of each lane&apos;s base pattern and transform
            chain, derived from the current PatternGraph.
          </p>
          {renderTransformSummary(graph)}
        </div>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Multi-track graph</h2>
        <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: "0.5rem" }}>
          Stacked lanes from pattern graph (parallel root). Compile to code to
          insert the generated Strudel into the editor above.
        </p>
        <div
          style={{
            marginBottom: "0.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.85rem",
            color: "#555",
          }}
        >
          <span>Default transform for + Add transform:</span>
          <select
            value={selectedTransformName}
            onChange={(e) => setSelectedTransformName(e.target.value)}
            style={{
              fontFamily: "inherit",
              fontSize: "0.85rem",
              padding: "0.1rem 0.25rem",
            }}
          >
            {Object.keys(TRANSFORM_REGISTRY).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <LaneStack
          graph={graph}
          {...(canEditGraph
            ? {
                onAddLane: () => {
                  const { graph: next, laneId } = addLane(graph);
                  setLaneTransformSelections((prev) => ({
                    ...prev,
                    [laneId]: selectedTransformName,
                  }));
                  updateSourceFromGraph(next);
                },
                onDeleteLane: (laneId: string) => {
                  const next = deleteLane(graph, laneId);
                  updateSourceFromGraph(next);
                },
                onRenameLane: (laneId: string, newName: string) => {
                  const next = renameLane(graph, laneId, newName);
                  updateSourceFromGraph(next);
                },
                onChangeCycleHint: (laneId: string, nextHint: number | null) => {
                  const next = setLaneCycleHint(graph, laneId, nextHint);
                  updateSourceFromGraph(next);
                },
                onChangeBasePattern: (laneId: string, newMini: string) => {
                  const next = changeLaneBasePattern(graph, laneId, newMini);
                  updateSourceFromGraph(next);
                },
                onAddTransform: (laneId: string, transformNameFromLane?: string) => {
                  // Per-lane selector (refinement 3): use lane's choice when provided,
                  // else fall back to stored per-lane default or global default.
                  const transformName =
                    transformNameFromLane ??
                    laneTransformSelections[laneId] ??
                    selectedTransformName;
                  const spec = getTransformSpec(transformName);
                  const name = spec?.name ?? transformName;
                  const args = spec
                    ? coerceTransformArgs(spec, spec.defaultArgs)
                    : [];
                  const next = addTransformToLane(graph, laneId, {
                    name,
                    args,
                  });
                  updateSourceFromGraph(next);
                },
                onReorderTransforms: (laneId: string, newOrder: string[]) => {
                  const next = reorderLaneTransforms(graph, laneId, newOrder);
                  updateSourceFromGraph(next);
                },
                onRemoveTransform: (laneId: string, transformId: string) => {
                  const next = removeTransformFromLane(graph, laneId, transformId);
                  updateSourceFromGraph(next);
                },
                onChangeTransformArgs: (
                  laneId: string,
                  transformId: string,
                  nextArgs: unknown[],
                ) => {
                  // Look up the current transform name so we can coerce args
                  // using registry metadata before updating the graph.
                  const laneNode = graph.nodes.find(
                    (n) => n.id === laneId && n.type === "lane",
                  ) as any;
                  const chainNode = laneNode
                    ? graph.nodes.find(
                        (n) =>
                          n.id === laneNode.head && n.type === "transformChain",
                      )
                    : undefined;
                  const method = chainNode
                    ? (chainNode as any).methods.find(
                        (m: { id: string }) => m.id === transformId,
                      )
                    : undefined;

                  const spec =
                    method && typeof method.name === "string"
                      ? getTransformSpec(method.name)
                      : undefined;
                  const coercedArgs =
                    spec != null ? coerceTransformArgs(spec, nextArgs) : nextArgs;

                  const next = updateLaneTransformArgs(
                    graph,
                    laneId,
                    transformId,
                    coercedArgs,
                  );
                  updateSourceFromGraph(next);
                },
                availableTransforms: Object.keys(TRANSFORM_REGISTRY),
                selectedTransformForLane: laneTransformSelections,
                // Refinement 4: selector affects only NEW transforms. Changing the
                // selection here only updates UI state; existing transforms in the
                // graph are never modified. Only "+ Add transform" uses this default.
                onSelectTransformForLane: (laneId: string, transformName: string) => {
                  setLaneTransformSelections((prev) => ({
                    ...prev,
                    [laneId]: transformName,
                  }));
                },
              }
            : {})}
        />
        <div style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            disabled={!canEditGraph}
            onClick={() => {
              if (!canEditGraph) return;
              updateSourceFromGraph(graph);
            }}
          >
            Compile graph to code
          </button>
          {graphError && (
            <span
              style={{
                marginLeft: "0.75rem",
                fontSize: "0.8rem",
                color: "#b00",
              }}
            >
              {graphError}
            </span>
          )}
        </div>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Composition graph</h2>
        <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: "0.5rem" }}>
          Visualization of the PatternGraph: parallel/serial root and lane
          children. Select a lane to rename or delete it; drag lane cards to
          reorder, or use Move up/down.
        </p>
        <div
          style={{
            marginBottom: "0.75rem",
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            disabled={!canEditGraph}
            onClick={() => {
              if (!canEditGraph) return;
              const { graph: next, laneId } = addLane(graph);
              setLaneTransformSelections((prev) => ({
                ...prev,
                [laneId]: selectedTransformName,
              }));
              setSelectedGraphNodeId(laneId);
              updateSourceFromGraph(next);
            }}
          >
            {graph.nodes.find((n) => n.id === graph.root)?.type === "serial"
              ? "Add lane under serial root"
              : "Add lane under parallel root"}
          </button>
          <button
            type="button"
            disabled={
              !canEditGraph ||
              !selectedGraphNodeId ||
              !graph.nodes.some(
                (n) => n.id === selectedGraphNodeId && n.type === "lane",
              )
            }
            onClick={() => {
              if (!canEditGraph || !selectedGraphNodeId) return;
              const node = graph.nodes.find(
                (n) => n.id === selectedGraphNodeId,
              );
              if (!node || node.type !== "lane") {
                return;
              }
              const next = deleteLane(graph, node.id);
              setLaneTransformSelections((prev) => {
                const nextSelections = { ...prev };
                delete nextSelections[node.id];
                return nextSelections;
              });
              setSelectedGraphNodeId(null);
              updateSourceFromGraph(next);
            }}
          >
            Delete selected lane
          </button>
          {(() => {
            const selectedLane =
              selectedGraphNodeId != null
                ? graph.nodes.find(
                    (n) =>
                      n.id === selectedGraphNodeId && n.type === "lane",
                  )
                : undefined;
            const laneDisplayName =
              selectedLane != null
                ? (typeof (selectedLane as { name?: string }).name ===
                  "string"
                    ? (selectedLane as { name: string }).name
                    : selectedLane.id)
                : "";
            const selectedCycleHint =
              selectedLane != null &&
              typeof (selectedLane as { cycleHint?: number }).cycleHint ===
                "number" &&
              (selectedLane as { cycleHint: number }).cycleHint > 0
                ? (selectedLane as { cycleHint: number }).cycleHint
                : null;

            return (
              selectedLane &&
              canEditGraph && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.85rem",
                  }}
                >
                  <label htmlFor="composition-rename-lane">Rename:</label>
                  <input
                    id="composition-rename-lane"
                    type="text"
                    value={laneDisplayName}
                    onChange={(e) => {
                      const next = renameLane(
                        graph,
                        selectedLane.id,
                        e.target.value,
                      );
                      updateSourceFromGraph(next);
                    }}
                    style={{
                      fontFamily: "inherit",
                      fontSize: "0.85rem",
                      padding: "0.15rem 0.35rem",
                      width: "8rem",
                    }}
                  />
                  <label htmlFor="composition-cycle-lane">Cycle:</label>
                  <input
                    id="composition-cycle-lane"
                    type="number"
                    min={1}
                    step={1}
                    value={
                      selectedCycleHint !== null ? selectedCycleHint : ""
                    }
                    placeholder="—"
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      const nextHint =
                        !raw
                          ? null
                          : (() => {
                              const n = Number.parseInt(raw, 10);
                              return Number.isFinite(n) && n > 0 ? n : null;
                            })();
                      const next = setLaneCycleHint(
                        graph,
                        selectedLane.id,
                        nextHint,
                      );
                      updateSourceFromGraph(next);
                    }}
                    style={{
                      fontFamily: "inherit",
                      fontSize: "0.85rem",
                      padding: "0.15rem 0.35rem",
                      width: "4rem",
                    }}
                  />
                </div>
              )
            );
          })()}
          {(() => {
            const root = graph.nodes.find((n) => n.id === graph.root);
            const isComposition =
              root?.type === "parallel" || root?.type === "serial";
            const order =
              root && isComposition && (root as { order?: string[] }).order
                ? (root as { order: string[] }).order
                : [];
            const idx =
              selectedGraphNodeId != null
                ? order.indexOf(selectedGraphNodeId)
                : -1;
            const isLaneSelected =
              idx >= 0 &&
              graph.nodes.some(
                (n) => n.id === selectedGraphNodeId && n.type === "lane",
              );
            const canMoveUp = canEditGraph && isLaneSelected && idx > 0;
            const canMoveDown =
              canEditGraph && isLaneSelected && idx >= 0 && idx < order.length - 1;
            const reorder =
              root?.type === "serial"
                ? (g: PatternGraph, newOrder: string[]) =>
                    reorderSerialChildren(g, newOrder)
                : (g: PatternGraph, newOrder: string[]) =>
                    reorderParallelLanes(g, newOrder);
            return (
              <>
                <button
                  type="button"
                  disabled={!canMoveUp}
                  onClick={() => {
                    if (!canMoveUp || idx <= 0) return;
                    const newOrder = [...order];
                    const tmp = newOrder[idx - 1]!;
                    newOrder[idx - 1] = newOrder[idx]!;
                    newOrder[idx] = tmp;
                    const next = reorder(graph, newOrder);
                    updateSourceFromGraph(next);
                  }}
                >
                  Move lane up
                </button>
                <button
                  type="button"
                  disabled={!canMoveDown}
                  onClick={() => {
                    if (!canMoveDown || idx < 0 || idx >= order.length - 1) return;
                    const newOrder = [...order];
                    const tmp = newOrder[idx + 1]!;
                    newOrder[idx + 1] = newOrder[idx]!;
                    newOrder[idx] = tmp;
                    const next = reorder(graph, newOrder);
                    updateSourceFromGraph(next);
                  }}
                >
                  Move lane down
                </button>
              </>
            );
          })()}
          {!canEditGraph && (
            <span style={{ fontSize: "0.8rem", color: "#777" }}>
              Editing is disabled while the document contains opaque regions or
              an unsupported AST.
            </span>
          )}
        </div>
        <GraphCanvas
          graph={graph}
          selectedNodeId={selectedGraphNodeId ?? undefined}
          onSelectNode={(id) => setSelectedGraphNodeId(id)}
          onReorderLanes={
            canEditGraph &&
            (() => {
              const root = graph.nodes.find((n) => n.id === graph.root);
              if (root?.type === "parallel")
                return (newOrder: string[]) => {
                  const next = reorderParallelLanes(graph, newOrder);
                  updateSourceFromGraph(next);
                };
              if (root?.type === "serial")
                return (newOrder: string[]) => {
                  const next = reorderSerialChildren(graph, newOrder);
                  updateSourceFromGraph(next);
                };
              return undefined;
            })()
          }
        />
      </section>
    </main>
  );
}
