import { useEffect, useMemo, useState } from "react";
import { astVersion, EvalScheduler, hushAll } from "@strudel-studio/strudel-bridge";
import { generate, generateDocument } from "@strudel-studio/code-generator";
import type { TransformChain } from "@strudel-studio/pattern-ast";
import { parseToAstOrOpaque } from "@strudel-studio/strudel-parser";
import type { ParseResult } from "@strudel-studio/strudel-parser";
import {
  graphToAst,
  addLane,
  deleteLane,
  renameLane,
  changeLaneBasePattern,
  addTransformToLane,
  setLaneCycleHint,
  removeTransformFromLane,
  reorderLaneTransforms,
  validatePatternGraph,
} from "@strudel-studio/pattern-graph";
import { LaneStack } from "@strudel-studio/ui-components";
import type { PatternGraph } from "@strudel-studio/pattern-graph";
import { MonacoEditor } from "./monaco";

const demoAst: TransformChain = {
  id: "demo-chain",
  base: {
    kind: "note",
    mini: "c3 eb3",
  },
  methods: [
    {
      id: "m-synth",
      name: "s",
      args: ["sawtooth"],
    },
    {
      id: "m-slow",
      name: "slow",
      args: [2],
    },
  ],
};

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
      methods: [{ id: "m1", name: "bank", args: ["tr909"] }],
    },
    {
      id: "lane_bass",
      type: "lane",
      head: "n_bass",
    },
    {
      id: "n_bass",
      type: "transformChain",
      base: { kind: "s", miniSerialization: "eb2 buddy" },
      methods: [],
    },
  ],
  edges: [],
};

export default function App() {
  const [source, setSource] = useState<string>(() => generate(demoAst));
  const [graph, setGraph] = useState<PatternGraph>(() => demoGraph);
  const [status, setStatus] = useState<string>("idle");
  const [parseInfo, setParseInfo] = useState<string>("not parsed yet");
  const [graphError, setGraphError] = useState<string | null>(null);

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
  }, [source]);

  useEffect(() => {
    setSource(generate(demoAst));
  }, []);

  const canEditGraph = hasSubsetAst && !hasOpaques;

  function updateSourceFromGraph(nextGraph: PatternGraph) {
    try {
      validatePatternGraph(nextGraph);
      const doc = graphToAst(nextGraph);
      const code = generateDocument(doc);
      setGraph(nextGraph);
      setSource(code);
      setGraphError(null);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Unknown error validating graph";
      setGraphError(message);
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

  return (
    <main style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Strudel Studio</h1>
      <p>AST version: {astVersion}</p>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Generated Strudel code</h2>
        <MonacoEditor value={source} onChange={setSource} />
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
          <button type="button" onClick={handleEvaluate}>
            Generate &amp; Play
          </button>
          <button type="button" onClick={handleStop}>
            Stop
          </button>
          <span>{status}</span>
        </div>
        <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#555" }}>
          Parse status: {parseInfo}
        </p>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Multi-track graph</h2>
        <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: "0.5rem" }}>
          Stacked lanes from pattern graph (parallel root). Compile to code to
          insert the generated Strudel into the editor above.
        </p>
        <LaneStack
          graph={graph}
          {...(canEditGraph
            ? {
                onAddLane: () => {
                  const { graph: next } = addLane(graph);
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
                onAddTransform: (laneId: string) => {
                  // For v0.4, provide a simple default transform. Future versions
                  // will surface the transform registry and argument editing.
                  const next = addTransformToLane(graph, laneId, {
                    name: "slow",
                    args: [2],
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
    </main>
  );
}
