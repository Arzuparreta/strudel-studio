/**
 * Strudel bridge — transpile, eval, buffers, scheduler.
 * @see docs/implementation-roadmap.md Phase v0.1
 */

export { astVersion } from "@strudel-studio/code-generator";
export { evaluateToPattern, hushAll } from "./evaluate";
export { EvalScheduler } from "./evalScheduler.js";
export { DualPatternBuffers, type PatternBuffer } from "./buffers.js";

