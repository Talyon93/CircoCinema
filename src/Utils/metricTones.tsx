// StatsKit/utils/metricTones.ts
export type Tone = "default" | "positive" | "negative" | "warning";

/** Delta-based: higher is better (e.g., average given, pick win-rate) */
export function toneByDelta(delta?: number): Tone {
  if (typeof delta !== "number") return "default";
  if (delta > 0) return "positive";
  if (delta < 0) return "negative";
  return "default";
}

/** Delta-based: lower is better (e.g., stdev, error rate) */
export function toneByDeltaLowerIsBetter(delta?: number): Tone {
  if (typeof delta !== "number") return "default";
  if (delta < 0) return "positive"; // stdev went down → good
  if (delta > 0) return "negative"; // stdev went up → bad
  return "default";
}

/** Absolute stdev value → tone buckets (tweak thresholds if you like) */
export function stdevTone(value: number): Tone {
  if (value < 0.9) return "positive";   // tight agreement
  if (value > 1.5) return "negative";   // very split
  return "warning";                      // moderate spread
}

/** Short helper text for stdev */
export function stdevSub(value: number): string {
  return `≈68% of votes fall within ±${value.toFixed(2)} of the average.`;
}
