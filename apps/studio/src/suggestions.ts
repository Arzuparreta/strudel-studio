/**
 * v1.3 — Rule-based suggestions (fills, variations, transform chains) from the graph.
 * Extension point for an AI-backed assistant later.
 */

import type { PatternGraph } from "@strudel-studio/pattern-graph";
import {
  addTransformToLane,
  updateLaneTransformArgs,
  changeLaneBasePattern,
} from "@strudel-studio/pattern-graph";
import {
  getAvailableTransformNames,
  getTransformSpec,
  coerceTransformArgs,
} from "@strudel-studio/plugins-sdk";

export interface Suggestion {
  id: string;
  label: string;
  apply: (graph: PatternGraph) => PatternGraph;
}

function getLaneChain(
  graph: PatternGraph,
  laneId: string,
): {
  methods: { id: string; name: string; args: unknown[] }[];
  base: { miniSerialization: string };
} | null {
  const lane = graph.nodes.find(
    (n) => n.id === laneId && n.type === "lane",
  ) as { head: string } | undefined;
  if (!lane) return null;
  const chain = graph.nodes.find(
    (n) => n.id === lane.head && n.type === "transformChain",
  ) as
    | { methods: { id: string; name: string; args: unknown[] }[]; base: { miniSerialization: string } }
    | undefined;
  return chain ?? null;
}

/**
 * Returns suggestions for the given graph and selected lane (fills, variations, transform chains).
 */
export function getSuggestions(
  graph: PatternGraph,
  selectedLaneId: string | null,
): Suggestion[] {
  const out: Suggestion[] = [];
  if (!selectedLaneId) return out;

  const chain = getLaneChain(graph, selectedLaneId);
  if (!chain) return out;

  const existingNames = new Set(chain.methods.map((m) => m.name));
  const available = getAvailableTransformNames();

  // Suggest adding a transform not yet on the lane (transform chains)
  for (const name of available) {
    if (existingNames.has(name)) continue;
    const spec = getTransformSpec(name);
    const args = spec ? coerceTransformArgs(spec, spec.defaultArgs) : [];
    const label =
      args.length === 0
        ? `Add .${name}()`
        : `Add .${name}(${args.map((a) => String(a)).join(", ")})`;
    out.push({
      id: `add-${name}-${selectedLaneId}`,
      label,
      apply: (g) => addTransformToLane(g, selectedLaneId, { name, args }),
    });
  }

  // Variations: suggest changing a numeric arg (e.g. slow 2 → 4, gain 1 → 0.7)
  const variationIdeas: { name: string; argIndex: number; newVal: unknown }[] = [
    { name: "slow", argIndex: 0, newVal: 4 },
    { name: "slow", argIndex: 0, newVal: 3 },
    { name: "gain", argIndex: 0, newVal: 0.7 },
    { name: "gain", argIndex: 0, newVal: 0.5 },
    { name: "room", argIndex: 0, newVal: 0.3 },
    { name: "room", argIndex: 0, newVal: 0.8 },
  ];
  for (const { name, argIndex, newVal } of variationIdeas) {
    const method = chain.methods.find((m) => m.name === name);
    if (!method || method.args[argIndex] === newVal) continue;
    out.push({
      id: `var-${method.id}-${argIndex}-${String(newVal)}`,
      label: `Variation: .${name}(${newVal})`,
      apply: (g) =>
        updateLaneTransformArgs(g, selectedLaneId, method.id, [
          ...method.args.slice(0, argIndex),
          newVal,
          ...method.args.slice(argIndex + 1),
        ]),
    });
  }

  // Fills: suggest a different mini-notation "fill" for the base pattern
  const baseMini = chain.base.miniSerialization.trim();
  const fillMinis = ["bd ~ sd ~ bd ~", "bd sd bd sd", "hh*8", "~ bd ~ sd"];
  for (const mini of fillMinis) {
    if (mini === baseMini) continue;
    out.push({
      id: `fill-${selectedLaneId}-${mini.replace(/\s/g, "_")}`,
      label: `Fill: "${mini}"`,
      apply: (g) => changeLaneBasePattern(g, selectedLaneId, mini),
    });
  }

  return out.slice(0, 12);
}
