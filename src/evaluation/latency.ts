export function nonNegativeLatencyMs(startedAt: number | null | undefined, endedAt: number | null | undefined): number | null {
  if (typeof startedAt !== "number" || typeof endedAt !== "number") return null;
  return Math.max(0, endedAt - startedAt);
}

export function latencyStatus(latencyMs: number | null, targetMs: number): "passed" | "warning" {
  return latencyMs !== null && latencyMs > targetMs ? "warning" : "passed";
}
