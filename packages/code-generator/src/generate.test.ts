import { describe, it, expect } from "vitest";
import { generate, generateDocument, escapeString, formatLiteral } from "./generate.js";
import type { TransformChain, PatternDoc } from "@strudel-studio/pattern-ast";

describe("generate", () => {
  it("emits base s() with no methods", () => {
    const ast: TransformChain = {
      id: "root",
      base: { kind: "s", mini: "[bd ~]" },
      methods: [],
    };
    expect(generate(ast)).toBe('s("[bd ~]")');
  });

  it("emits base note() with no methods", () => {
    const ast: TransformChain = {
      id: "root",
      base: { kind: "note", mini: "c2 eb2" },
      methods: [],
    };
    expect(generate(ast)).toBe('note("c2 eb2")');
  });

  it("emits methods in canonical order (bank before slow)", () => {
    const ast: TransformChain = {
      id: "root",
      base: { kind: "s", mini: "[bd ~]" },
      methods: [
        { id: "m1", name: "slow", args: [2] },
        { id: "m2", name: "bank", args: ["tr909"] },
      ],
    };
    expect(generate(ast)).toBe('s("[bd ~]").bank("tr909").slow(2)');
  });

  it("escapes quotes and backslashes in mini string", () => {
    const ast: TransformChain = {
      id: "root",
      base: { kind: "s", mini: 'say "hi" \\' },
      methods: [],
    };
    expect(generate(ast)).toBe('s("say \\"hi\\" \\\\")');
  });
});

describe("escapeString", () => {
  it("escapes backslash and double quote", () => {
    expect(escapeString("")).toBe("");
    expect(escapeString("a")).toBe("a");
    expect(escapeString('"')).toBe('\\"');
    expect(escapeString("\\")).toBe("\\\\");
    expect(escapeString('\\"')).toBe('\\\\\\"');
  });
});

describe("generateDocument", () => {
  it("emits single chain unchanged", () => {
    const doc: PatternDoc = {
      id: "root",
      base: { kind: "s", mini: "[bd ~]" },
      methods: [],
    };
    expect(generateDocument(doc)).toBe('s("[bd ~]")');
  });

  it("emits stack(a, b) for parallel composition", () => {
    const doc: PatternDoc = {
      call: "stack",
      children: [
        { id: "a", base: { kind: "s", mini: "bd ~" }, methods: [] },
        { id: "b", base: { kind: "s", mini: "sd ~" }, methods: [] },
      ],
    };
    expect(generateDocument(doc)).toBe('stack(s("bd ~"), s("sd ~"))');
  });

  it("emits cat(a, b) for serial composition", () => {
    const doc: PatternDoc = {
      call: "cat",
      children: [
        { id: "a", base: { kind: "s", mini: "bd ~" }, methods: [] },
        { id: "b", base: { kind: "s", mini: "sd ~" }, methods: [] },
      ],
    };
    expect(generateDocument(doc)).toBe('cat(s("bd ~"), s("sd ~"))');
  });

  it("emits nested stack(cat(...), ...)", () => {
    const doc: PatternDoc = {
      call: "stack",
      children: [
        {
          call: "cat",
          children: [
            { id: "a", base: { kind: "s", mini: "bd" }, methods: [] },
            { id: "b", base: { kind: "s", mini: "sd" }, methods: [] },
          ],
        },
        { id: "c", base: { kind: "s", mini: "hh" }, methods: [] },
      ],
    };
    expect(generateDocument(doc)).toBe(
      'stack(cat(s("bd"), s("sd")), s("hh"))',
    );
  });
});

describe("formatLiteral", () => {
  it("quotes strings and escapes", () => {
    expect(formatLiteral("x")).toBe('"x"');
    expect(formatLiteral("")).toBe('""');
  });
  it("formats numbers as-is", () => {
    expect(formatLiteral(2)).toBe("2");
    expect(formatLiteral(0.5)).toBe("0.5");
  });
  it("formats booleans as true/false", () => {
    expect(formatLiteral(true)).toBe("true");
    expect(formatLiteral(false)).toBe("false");
  });
});
