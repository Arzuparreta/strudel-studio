import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { astVersion, EvalScheduler, HapCache, hushAll } from "@strudel-studio/strudel-bridge";
import { generateDocument } from "@strudel-studio/code-generator";
import { parseToAstOrOpaque } from "@strudel-studio/strudel-parser";
import type { ParseResult } from "@strudel-studio/strudel-parser";
import {
  graphToAst,
  astToGraph,
  addLane,
  deleteLane,
  addPluginNode,
  deletePluginNode,
  renameLane,
  reorderParallelLanes,
  reorderSerialChildren,
  changeLaneBasePattern,
  addTransformToLane,
  setLaneCycleHint,
  removeTransformFromLane,
  reorderLaneTransforms,
  replaceLaneContent,
  validatePatternGraph,
} from "@strudel-studio/pattern-graph";
import type { LibraryPatternContent } from "@strudel-studio/pattern-graph";
import { updateLaneTransformArgs } from "@strudel-studio/pattern-graph";
import {
  getAvailableTransformNames,
  getTransformSpec,
  coerceTransformArgs,
  listPluginIds,
  getPlugin,
  createPluginNodeCompiler,
  getPluginPanels,
  getRegisteredPluginNodeKinds,
} from "@strudel-studio/plugins-sdk";
import {
  LaneStack,
  GraphCanvas,
  LIBRARY_PATTERN_DRAG_TYPE,
} from "@strudel-studio/ui-components";
import { HapList, HapTimeline } from "@strudel-studio/pattern-inspector";
import type { PatternGraph } from "@strudel-studio/pattern-graph";
import { MonacoEditor } from "./monaco";
import { getSuggestions } from "./suggestions";
import "./plugins";

const PATTERN_LIBRARY_STORAGE_KEY = "strudel-studio-pattern-library";

export interface PatternLibraryEntry {
  id: string;
  name: string;
  content: LibraryPatternContent;
}

function loadPatternLibrary(): PatternLibraryEntry[] {
  try {
    const raw = localStorage.getItem(PATTERN_LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is PatternLibraryEntry =>
        e &&
        typeof e === "object" &&
        typeof (e as PatternLibraryEntry).id === "string" &&
        typeof (e as PatternLibraryEntry).name === "string" &&
        (e as PatternLibraryEntry).content != null &&
        typeof (e as PatternLibraryEntry).content.base === "object" &&
        typeof (e as PatternLibraryEntry).content.base?.miniSerialization === "string",
    );
  } catch {
    return [];
  }
}

function savePatternLibrary(entries: PatternLibraryEntry[]): void {
  try {
    localStorage.setItem(PATTERN_LIBRARY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

/** Extract lane content (base + methods) for saving to library. */
function getLaneContent(
  graph: PatternGraph,
  laneId: string,
): LibraryPatternContent | null {
  const lane = graph.nodes.find(
    (n) => n.id === laneId && n.type === "lane",
  ) as { head: string } | undefined;
  if (!lane) return null;
  const chain = graph.nodes.find(
    (n) => n.id === lane.head && n.type === "transformChain",
  ) as
    | {
        base: { kind: "s" | "note"; miniSerialization: string };
        methods: { name: string; args: unknown[] }[];
      }
    | undefined;
  if (!chain) return null;
  return {
    base: { ...chain.base },
    methods: chain.methods.map((m) => ({ name: m.name, args: [...m.args] })),
  };
}

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
  const [showCode, setShowCode] = useState<boolean>(false);
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

  const [mutedLanes, setMutedLanes] = useState<Set<string>>(() => new Set());

  /** v1.2 pattern morph: captured A/B and amount 0..1; interpolates numeric args. */
  type MorphSnapshot = {
    laneId: string;
    methods: { id: string; name: string; args: unknown[] }[];
  };
  const [morphA, setMorphA] = useState<MorphSnapshot | null>(null);
  const [morphB, setMorphB] = useState<MorphSnapshot | null>(null);
  const [morphAmount, setMorphAmount] = useState(0);

  const [patternLibrary, setPatternLibrary] = useState<PatternLibraryEntry[]>(
    loadPatternLibrary,
  );
  const setPatternLibraryPersisted = (next: PatternLibraryEntry[] | ((prev: PatternLibraryEntry[]) => PatternLibraryEntry[])) => {
    setPatternLibrary((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      savePatternLibrary(resolved);
      return resolved;
    });
  };

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
          setParseInfo("Pattern builder: you can edit this in the graph.");
        } else if (nextHasAst && nextHasOpaques) {
          setParseInfo("Pattern builder: part of this can be edited; rest is code-only.");
        } else if (sourceIsGraphProjection && !nextHasAst && nextHasOpaques) {
          setParseInfo("Built from pattern builder.");
        } else if (!nextHasAst && nextHasOpaques) {
          setParseInfo("Code mode — not editable in the pattern builder. Playback works normally.");
        } else {
          setLastGoodParse(null);
          setParseInfo("Empty document.");
        }
      } catch {
        if (!cancelled) {
          setParseInfo("Could not parse; using previous state. Playback may still work.");
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

  function updateSourceFromGraph(
    nextGraph: PatternGraph,
    mutedLaneIds?: Set<string>,
  ) {
    try {
      validatePatternGraph(nextGraph);
      const doc = graphToAst(nextGraph, {
        compilePluginNode: createPluginNodeCompiler(),
        mutedLaneIds: mutedLaneIds ?? undefined,
      });
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

  /** v1.2 pattern morph: interpolate numeric args between two method snapshots; t in [0,1]. */
  function interpolateMorphMethods(
    methodsA: { id: string; name: string; args: unknown[] }[],
    methodsB: { id: string; name: string; args: unknown[] }[],
    t: number,
  ): { id: string; name: string; args: unknown[] }[] {
    if (methodsA.length !== methodsB.length) return t < 0.5 ? methodsA : methodsB;
    return methodsA.map((ma, i) => {
      const mb = methodsB[i];
      if (!mb || ma.id !== mb.id || ma.name !== mb.name)
        return t < 0.5 ? ma : mb;
      const args = ma.args.map((a, j) => {
        const b = mb.args[j];
        const an = Number(a);
        const bn = Number(b);
        if (Number.isFinite(an) && Number.isFinite(bn))
          return an * (1 - t) + bn * t;
        return t < 0.5 ? a : b;
      });
      return { id: ma.id, name: ma.name, args };
    });
  }

  /** v1.2: apply interpolated morph to graph for laneId and update source. */
  function applyMorph(laneId: string, methods: { id: string; name: string; args: unknown[] }[]) {
    let next = graph;
    for (const m of methods) {
      next = updateLaneTransformArgs(next, laneId, m.id, m.args);
    }
    updateSourceFromGraph(next, mutedLanes);
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
        "This code uses Strudel features that cannot yet be converted to the visual graph. The code will still run normally.",
      );
      return;
    }
    try {
      const nextGraph = astToGraph(result.ast);
      updateSourceFromGraph(nextGraph, mutedLanes);
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
      setStatus(
        "evaluated (pattern reference unavailable; audio may still be playing)",
      );
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

      <div
        style={{
          marginTop: "1rem",
          marginBottom: "1.5rem",
          padding: "0.75rem 1rem",
          background: "#f5f5f5",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
        role="toolbar"
        aria-label="Transport"
      >
        <button
          type="button"
          onClick={handleEvaluate}
          style={{
            padding: "0.5rem 1.25rem",
            fontSize: "1rem",
            fontWeight: 600,
          }}
        >
          Play
        </button>
        <button type="button" onClick={handleStop} style={{ padding: "0.5rem 1.25rem", fontSize: "1rem" }}>
          Stop
        </button>
        <span style={{ fontSize: "0.9rem", color: "#555" }}>{status}</span>
      </div>

      <section style={{ marginTop: "1.5rem" }}>
        {showCode ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <h2 style={{ margin: 0 }}>Code (advanced)</h2>
              <button type="button" onClick={() => setShowCode(false)}>
                Hide code
              </button>
            </div>
            <MonacoEditor value={source} onChange={handleSourceChange} />
            <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" onClick={handleImportCodeIntoGraph}>
                Import code into graph
              </button>
            </div>
            <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#555" }}>
              Parse status: {parseInfo}
            </p>
            <p style={{ marginTop: "0.25rem", fontSize: "0.85rem", color: "#888" }}>
              If you hear sound after Play, the pattern is running.
            </p>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button type="button" onClick={() => setShowCode(true)} style={{ fontSize: "0.9rem" }}>
              Show code (advanced)
            </button>
            <span style={{ fontSize: "0.85rem", color: "#666" }}>{parseInfo}</span>
          </div>
        )}
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Tracks</h2>
        <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: "0.5rem" }}>
          Your tracks. Add, mute, and edit patterns per track. Use &quot;Compile to code&quot; to apply changes.
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
          <span>Default for new tracks (each track can override below):</span>
          <select
            value={selectedTransformName}
            onChange={(e) => setSelectedTransformName(e.target.value)}
            style={{
              fontFamily: "inherit",
              fontSize: "0.85rem",
              padding: "0.1rem 0.25rem",
            }}
          >
            {getAvailableTransformNames().map((name) => (
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
                  updateSourceFromGraph(next, mutedLanes);
                },
                onDeleteLane: (laneId: string) => {
                  const next = deleteLane(graph, laneId);
                  updateSourceFromGraph(next, mutedLanes);
                },
                onRenameLane: (laneId: string, newName: string) => {
                  const next = renameLane(graph, laneId, newName);
                  updateSourceFromGraph(next, mutedLanes);
                },
                onChangeCycleHint: (laneId: string, nextHint: number | null) => {
                  const next = setLaneCycleHint(graph, laneId, nextHint);
                  updateSourceFromGraph(next, mutedLanes);
                },
                onChangeBasePattern: (laneId: string, newMini: string) => {
                  const next = changeLaneBasePattern(graph, laneId, newMini);
                  updateSourceFromGraph(next, mutedLanes);
                },
                onAddTransform: (laneId: string, transformNameFromLane?: string) => {
                  // Per-lane selector (refinement 3): use lane's choice when provided and non-empty,
                  // else fall back to global default (e.g. when lane has "(default)" selected).
                  const laneChoice = laneTransformSelections[laneId];
                  const transformName =
                    transformNameFromLane ??
                    (laneChoice && laneChoice !== "" ? laneChoice : selectedTransformName);
                  const spec = getTransformSpec(transformName);
                  const name = spec?.name ?? transformName;
                  const args = spec
                    ? coerceTransformArgs(spec, spec.defaultArgs)
                    : [];
                  const next = addTransformToLane(graph, laneId, {
                    name,
                    args,
                  });
                  updateSourceFromGraph(next, mutedLanes);
                },
                onReorderTransforms: (laneId: string, newOrder: string[]) => {
                  const next = reorderLaneTransforms(graph, laneId, newOrder);
                  updateSourceFromGraph(next, mutedLanes);
                },
                onRemoveTransform: (laneId: string, transformId: string) => {
                  const next = removeTransformFromLane(graph, laneId, transformId);
                  updateSourceFromGraph(next, mutedLanes);
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
                  updateSourceFromGraph(next, mutedLanes);
                },
                availableTransforms: getAvailableTransformNames(),
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
                mutedLaneIds: mutedLanes,
                onToggleMute: (laneId: string) => {
                  const next = new Set(mutedLanes);
                  if (next.has(laneId)) next.delete(laneId);
                  else next.add(laneId);
                  setMutedLanes(next);
                  updateSourceFromGraph(graph, next);
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
              updateSourceFromGraph(graph, mutedLanes);
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
        <h2>Plugins (v1.0)</h2>
        <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: "0.5rem" }}>
          Loaded plugins provide custom transforms in the &quot;+ Add transform&quot; picker.
        </p>
        {listPluginIds().length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "#888" }}>No plugins loaded.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.9rem" }}>
            {listPluginIds().map((id) => {
              const p = getPlugin(id);
              const name = p?.manifest.name ?? id;
              const version = p?.manifest.version ?? "—";
              return (
                <li key={id}>
                  <strong>{name}</strong> {version}
                  {p?.manifest.name !== id && (
                    <span style={{ color: "#666", marginLeft: "0.25rem" }}>
                      ({id})
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {getPluginPanels().length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
              Plugin panels
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#555", marginBottom: "0.5rem" }}>
              Custom UI from plugins (v1.0 visual editors).
            </p>
            {getPluginPanels().map((panel) => (
              <div
                key={panel.pluginId}
                style={{
                  marginBottom: "1rem",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  backgroundColor: "#fafafa",
                }}
              >
                <h4 style={{ fontSize: "0.9rem", marginBottom: "0.35rem" }}>
                  {panel.title ?? panel.pluginId}
                </h4>
                {panel.render() as ReactNode}
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Pattern library (v1.1)</h2>
        <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: "0.5rem" }}>
          Save lane content as reusable patterns and apply them to lanes. Select a
          lane in the graph to save or apply.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <button
            type="button"
            disabled={
              !selectedGraphNodeId ||
              !graph.nodes.some(
                (n) => n.id === selectedGraphNodeId && n.type === "lane",
              )
            }
            onClick={() => {
              if (
                !selectedGraphNodeId ||
                !graph.nodes.some(
                  (n) => n.id === selectedGraphNodeId && n.type === "lane",
                )
              )
                return;
              const content = getLaneContent(graph, selectedGraphNodeId);
              if (!content) return;
              const name =
                window.prompt("Name for this pattern", "My pattern")?.trim() ||
                "";
              if (!name) return;
              const id = `lib_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
              setPatternLibraryPersisted((prev) => [
                ...prev,
                { id, name, content },
              ]);
            }}
          >
            Save selected lane to library
          </button>
          {patternLibrary.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "#888" }}>
              No patterns saved. Select a lane and click &quot;Save selected lane
              to library&quot; to add one.
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.9rem" }}>
              {patternLibrary.map((entry) => (
                <li
                  key={entry.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.35rem",
                  }}
                >
                  <strong
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(LIBRARY_PATTERN_DRAG_TYPE, entry.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    style={{ cursor: "grab" }}
                    title="Drag onto a lane to apply"
                  >
                    {entry.name}
                  </strong>
                  <span style={{ color: "#666", fontSize: "0.85rem" }}>
                    {entry.content.base.kind}(
                    &quot;{entry.content.base.miniSerialization}
                    &quot;)
                    {entry.content.methods.length > 0 &&
                      entry.content.methods
                        .map((m) => `.${m.name}(${JSON.stringify(m.args).slice(1, -1)})`)
                        .join("")}
                  </span>
                  <button
                    type="button"
                    disabled={
                      !selectedGraphNodeId ||
                      !graph.nodes.some(
                        (n) =>
                          n.id === selectedGraphNodeId && n.type === "lane",
                      )
                    }
                    onClick={() => {
                      if (
                        !selectedGraphNodeId ||
                        !graph.nodes.some(
                          (n) =>
                            n.id === selectedGraphNodeId && n.type === "lane",
                        )
                      )
                        return;
                      const next = replaceLaneContent(
                        graph,
                        selectedGraphNodeId,
                        entry.content,
                      );
                      updateSourceFromGraph(next, mutedLanes);
                    }}
                  >
                    Apply to selected lane
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${entry.name} from library`}
                    onClick={() => {
                      setPatternLibraryPersisted((prev) =>
                        prev.filter((e) => e.id !== entry.id),
                      );
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Live control (v1.2)</h2>
        <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: "0.5rem" }}>
          Parameter sliders for the selected lane’s transforms. Changes update the
          graph and re-eval after a short delay. Select a lane in the graph or
          lane list.
        </p>
        {selectedGraphNodeId &&
        graph.nodes.some(
          (n) => n.id === selectedGraphNodeId && n.type === "lane",
        ) ? (
          (() => {
            const lane = graph.nodes.find(
              (n) => n.id === selectedGraphNodeId && n.type === "lane",
            ) as { id: string; head: string } | undefined;
            const chain = lane
              ? (graph.nodes.find(
                  (n) => n.id === lane.head && n.type === "transformChain",
                ) as
                  | {
                      methods: { id: string; name: string; args: unknown[] }[];
                    }
                  | undefined)
              : undefined;
            if (!chain || chain.methods.length === 0) {
              return (
                <p style={{ fontSize: "0.85rem", color: "#888" }}>
                  Selected lane has no transforms. Add transforms in the lane
                  editor above to control them here.
                </p>
              );
            }
            return (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  fontSize: "0.9rem",
                }}
              >
                {chain.methods.map((m) => {
                  const spec = getTransformSpec(m.name);
                  const argSpecs = spec?.args ?? [];
                  const numericIndices: number[] = [];
                  argSpecs.forEach((arg, i) => {
                    if (arg.type === "number") numericIndices.push(i);
                  });
                  if (numericIndices.length === 0) return null;
                  return (
                    <div
                      key={m.id}
                      style={{
                        padding: "0.5rem",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        backgroundColor: "#fafafa",
                      }}
                    >
                      <strong>.{m.name}</strong>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                          marginTop: "0.35rem",
                        }}
                      >
                        {numericIndices.map((i) => {
                          const argSpec = argSpecs[i];
                          const specMin =
                            argSpec?.type === "number" && typeof argSpec.min === "number"
                              ? argSpec.min
                              : undefined;
                          const specMax =
                            argSpec?.type === "number" && typeof argSpec.max === "number"
                              ? argSpec.max
                              : undefined;
                          const min = specMin ?? (specMax != null ? 0 : 0);
                          const max =
                            specMax ??
                            (specMin != null && specMin >= 1 ? Math.max(specMin, 16) : 1);
                          const val = Number(m.args[i]);
                          const numVal =
                            Number.isFinite(val) && val >= min && val <= max
                              ? val
                              : min;
                          return (
                            <label
                              key={i}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.35rem",
                              }}
                            >
                              <span style={{ minWidth: "2.5rem" }}>
                                {argSpec?.name ?? `arg ${i}`}: {numVal.toFixed(2)}
                              </span>
                              <input
                                type="range"
                                min={min}
                                max={max}
                                step={max - min > 10 ? 0.1 : 0.01}
                                value={numVal}
                                onChange={(e) => {
                                  const nextVal = Number(e.target.value);
                                  const nextArgs = [...m.args];
                                  nextArgs[i] = nextVal;
                                  const next = updateLaneTransformArgs(
                                    graph,
                                    selectedGraphNodeId,
                                    m.id,
                                    nextArgs,
                                  );
                                  updateSourceFromGraph(next, mutedLanes);
                                }}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.5rem",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    backgroundColor: "#f5f5f5",
                  }}
                >
                  <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>
                    Pattern morph
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "#555", marginBottom: "0.5rem" }}>
                    Capture two states (A and B) for this lane, then interpolate
                    between them.
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedGraphNodeId || !chain) return;
                        setMorphA({
                          laneId: selectedGraphNodeId,
                          methods: chain.methods.map((m) => ({
                            id: m.id,
                            name: m.name,
                            args: [...m.args],
                          })),
                        });
                      }}
                    >
                      Set A
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedGraphNodeId || !chain) return;
                        setMorphB({
                          laneId: selectedGraphNodeId,
                          methods: chain.methods.map((m) => ({
                            id: m.id,
                            name: m.name,
                            args: [...m.args],
                          })),
                        });
                      }}
                    >
                      Set B
                    </button>
                    {morphA &&
                      morphB &&
                      morphA.laneId === selectedGraphNodeId &&
                      morphB.laneId === selectedGraphNodeId && (
                      <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <span>Morph:</span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={morphAmount}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setMorphAmount(v);
                            applyMorph(
                              selectedGraphNodeId,
                              interpolateMorphMethods(
                                morphA.methods,
                                morphB.methods,
                                v,
                              ),
                            );
                          }}
                        />
                        <span>{morphAmount.toFixed(2)}</span>
                      </label>
                    )}
                  </div>
                  {(!morphA || !morphB || morphA.laneId !== selectedGraphNodeId || morphB.laneId !== selectedGraphNodeId) && (
                    <p style={{ fontSize: "0.8rem", color: "#888", marginTop: "0.35rem" }}>
                      Set A and Set B to enable the morph slider.
                    </p>
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          <p style={{ fontSize: "0.85rem", color: "#888" }}>
            Select a lane in the composition graph or in the lane list above to
            see parameter sliders.
          </p>
        )}
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Suggestions (v1.3)</h2>
        <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: "0.5rem" }}>
          Rule-based ideas for the selected lane: add transforms, variations, or
          fills. Select a lane to see suggestions.
        </p>
        {selectedGraphNodeId &&
        graph.nodes.some(
          (n) => n.id === selectedGraphNodeId && n.type === "lane",
        ) ? (
          (() => {
            const suggestions = getSuggestions(graph, selectedGraphNodeId);
            if (suggestions.length === 0) {
              return (
                <p style={{ fontSize: "0.85rem", color: "#888" }}>
                  No suggestions for this lane. Add a transform or change the
                  base pattern to get ideas.
                </p>
              );
            }
            return (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.35rem",
                  fontSize: "0.9rem",
                }}
              >
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      const next = s.apply(graph);
                      updateSourceFromGraph(next, mutedLanes);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            );
          })()
        ) : (
          <p style={{ fontSize: "0.85rem", color: "#888" }}>
            Select a lane in the graph or lane list to see suggestions.
          </p>
        )}
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Composition graph</h2>
        <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: "0.5rem" }}>
          Visualization of the PatternGraph: parallel/serial root with lanes and
          plugin nodes. Select a lane to rename or delete it; drag cards to
          reorder. Add plugin nodes from the dropdown when any plugin registers a node kind.
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
              updateSourceFromGraph(next, mutedLanes);
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
              updateSourceFromGraph(next, mutedLanes);
            }}
          >
            Delete selected lane
          </button>
          {getRegisteredPluginNodeKinds().length > 0 && (
            <select
              aria-label="Add plugin node"
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (!v || !canEditGraph) return;
                const [pluginId, nodeKind] = v.split(":");
                if (!pluginId || !nodeKind) return;
                const { graph: next, nodeId } = addPluginNode(graph, {
                  pluginId,
                  nodeKind,
                });
                setSelectedGraphNodeId(nodeId);
                updateSourceFromGraph(next, mutedLanes);
                e.target.value = "";
              }}
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.9rem" }}
            >
              <option value="">Add plugin node…</option>
              {getRegisteredPluginNodeKinds().map(({ pluginId, nodeKind }) => (
                <option key={`${pluginId}:${nodeKind}`} value={`${pluginId}:${nodeKind}`}>
                  {pluginId} / {nodeKind}
                </option>
              ))}
            </select>
          )}
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
                      updateSourceFromGraph(next, mutedLanes);
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
                      updateSourceFromGraph(next, mutedLanes);
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
                    updateSourceFromGraph(next, mutedLanes);
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
                    updateSourceFromGraph(next, mutedLanes);
                  }}
                >
                  Move lane down
                </button>
              </>
            );
          })()}
          {!canEditGraph && (
            <span style={{ fontSize: "0.8rem", color: "#777" }}>
              Pattern builder only works for simple lane patterns. This document is in code mode; playback is unaffected.
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
                  updateSourceFromGraph(next, mutedLanes);
                };
              if (root?.type === "serial")
                return (newOrder: string[]) => {
                  const next = reorderSerialChildren(graph, newOrder);
                  updateSourceFromGraph(next, mutedLanes);
                };
              return undefined;
            })()
          }
          onDropLibraryPattern={
            canEditGraph
              ? (laneId, libraryEntryId) => {
                  const entry = patternLibrary.find((e) => e.id === libraryEntryId);
                  if (!entry) return;
                  const next = replaceLaneContent(graph, laneId, entry.content);
                  updateSourceFromGraph(next, mutedLanes);
                }
              : undefined
          }
          onDeletePluginNode={
            canEditGraph
              ? (nodeId) => {
                  const next = deletePluginNode(graph, nodeId);
                  if (selectedGraphNodeId === nodeId) setSelectedGraphNodeId(null);
                  updateSourceFromGraph(next, mutedLanes);
                }
              : undefined
          }
        />
      </section>
    </main>
  );
}
