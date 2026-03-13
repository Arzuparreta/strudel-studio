import { describe, it } from "vitest";

describe("Studio transform registry integration", () => {
  // NOTE: This is a placeholder for a future end-to-end Studio test that
  // verifies the registry-backed "gain" transform path:
  //
  //   UI -> PatternGraph mutation -> validatePatternGraph -> graphToAst
  //   -> generateDocument -> setSource -> EvalScheduler
  //
  // At the moment, mounting the full App and driving it via jsdom has proven
  // flaky because `canEditGraph` depends on parser/opaque behavior and timing
  // that are hard to control in tests. Rather than keep an unreliable test in
  // the suite, we skip this high-level check and rely on:
  //
  //   - pattern-graph tests for mutations,
  //   - plugins-sdk tests for TRANSFORM_REGISTRY and coerceTransformArgs.
  //
  // Once a small, explicit test harness exists (e.g. a helper that mounts
  // LaneStack with a known-good demo graph in an always-editable state),
  // this test should be reimplemented using that harness and un-skipped.
  it.skip(
    "applies per-lane transform selection and coerced default args (pending harness)",
    async () => {
      // Intentionally empty: see note above.
    },
  );
});

