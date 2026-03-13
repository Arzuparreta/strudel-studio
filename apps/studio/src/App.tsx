import { useEffect, useMemo, useState } from "react";
import { astVersion, EvalScheduler, hushAll } from "@strudel-studio/strudel-bridge";
import { generate } from "@strudel-studio/code-generator";
import type { TransformChain } from "@strudel-studio/pattern-ast";

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

export default function App() {
  const [source, setSource] = useState<string>(() => generate(demoAst));
  const [status, setStatus] = useState<string>("idle");

  const scheduler = useMemo(
    () =>
      new EvalScheduler({
        debounceMs: 200,
        maxEvalsPerSecond: 4,
      }),
    [],
  );

  useEffect(() => {
    setSource(generate(demoAst));
  }, []);

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
        <textarea
          value={source}
          onChange={(event) => setSource(event.target.value)}
          rows={4}
          style={{
            width: "100%",
            maxWidth: "48rem",
            fontFamily: "monospace",
          }}
        />
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
          <button type="button" onClick={handleEvaluate}>
            Generate &amp; Play
          </button>
          <button type="button" onClick={handleStop}>
            Stop
          </button>
          <span>{status}</span>
        </div>
      </section>
    </main>
  );
}
