/**
 * Golden tests: AST JSON fixtures → snapshot strings. CI fails on diff.
 * @see docs/implementation-roadmap.md Task 1.5
 */

import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";
import { generate } from "../src/generate.js";
import type { TransformChain } from "@strudel-studio/pattern-ast";

const __dirname = dirname(fileURLToPath(import.meta.url));
const goldenDir = join(__dirname, "golden");

const fixtureFiles = readdirSync(goldenDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

describe("golden", () => {
  for (const file of fixtureFiles) {
    it(`${file} → snapshot`, () => {
      const path = join(goldenDir, file);
      const json = readFileSync(path, "utf-8");
      const ast = JSON.parse(json) as TransformChain;
      const out = generate(ast);
      expect(out).toMatchSnapshot();
    });
  }
});
