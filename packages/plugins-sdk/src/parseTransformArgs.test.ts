import { describe, it, expect } from "vitest";
import { parseTransformArgsString } from "./parseTransformArgs.js";

describe("parseTransformArgsString", () => {
  it("returns empty array for empty or whitespace input", () => {
    expect(parseTransformArgsString("")).toEqual([]);
    expect(parseTransformArgsString("   ")).toEqual([]);
  });

  it("parses numbers including negative and decimal", () => {
    expect(parseTransformArgsString("2")).toEqual([2]);
    expect(parseTransformArgsString("0.5")).toEqual([0.5]);
    expect(parseTransformArgsString("-.5")).toEqual([-0.5]);
    expect(parseTransformArgsString("-0.25")).toEqual([-0.25]);
    expect(parseTransformArgsString("1, 2, 3")).toEqual([1, 2, 3]);
    expect(parseTransformArgsString("0.5, -.5, 1")).toEqual([0.5, -0.5, 1]);
  });

  it("parses quoted strings and preserves commas inside", () => {
    expect(parseTransformArgsString('"tr909"')).toEqual(["tr909"]);
    expect(parseTransformArgsString('"hello, world"')).toEqual(["hello, world"]);
    expect(parseTransformArgsString("'a,b'")).toEqual(["a,b"]);
  });

  it("parses unquoted tokens as strings", () => {
    expect(parseTransformArgsString("tr909")).toEqual(["tr909"]);
    expect(parseTransformArgsString("tr909, 2")).toEqual(["tr909", 2]);
  });

  it("treats empty segments as undefined (optional args)", () => {
    expect(parseTransformArgsString("2,, 4")).toEqual([2, undefined, 4]);
    expect(parseTransformArgsString(", 1")).toEqual([undefined, 1]);
    expect(parseTransformArgsString("1, ")).toEqual([1, undefined]);
  });

  it("trims segments", () => {
    expect(parseTransformArgsString("  2  ,  0.5  ")).toEqual([2, 0.5]);
  });
});
