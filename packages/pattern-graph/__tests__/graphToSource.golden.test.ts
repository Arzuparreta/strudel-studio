/**
 * Golden tests: graph JSON → graphToAst → generateDocument → snapshot.
 * Ensures multi-track (parallel/serial) compilation is deterministic.
 * @see docs/implementation-roadmap.md Task 3.2
 */

import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";
import { parsePatternGraph } from "../src/schema.js";
import { graphToAst } from "../src/compile/graphToAst.js";
import { generateDocument } from "@strudel-studio/code-generator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const goldenDir = join(__dirname, "golden");

const fixtureFiles = readdirSync(goldenDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

describe("graphToSource golden", () => {
  for (const file of fixtureFiles) {
    it(`${file} → snapshot`, () => {
      const path = join(goldenDir, file);
      const json = JSON.parse(readFileSync(path, "utf-8"));
      const graph = parsePatternGraph(json);
      const doc = graphToAst(graph);
      const out = generateDocument(doc);
      expect(out).toMatchSnapshot();
    });
  }
});
