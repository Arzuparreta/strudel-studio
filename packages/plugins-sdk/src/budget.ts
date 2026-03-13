/**
 * Run an async plugin transform under a time budget (ms).
 * If the transform does not resolve within the budget, the promise rejects.
 *
 * For synchronous transforms, wrap in an async function, e.g.:
 *   withBudgetAsync(50, async () => transform(input))
 *
 * @see docs/architecture.md §10 (Execution budget)
 * @see docs/implementation-roadmap.md Task 3.9
 */
export async function withBudgetAsync<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Plugin transform exceeded budget of ${ms}ms`)), ms);
  });
  return Promise.race([fn(), timeoutPromise]);
}
