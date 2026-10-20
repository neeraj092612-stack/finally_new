/** Sparkline math: window selection, SVG point scaling and trend (D-10, D-11). */
import type { TickPoint } from "./types";

/** Rolling window: ticks older than this many seconds before the newest are dropped. */
export const SPARK_WINDOW_SECONDS = 300;
/** At most this many points are drawn. */
export const SPARK_MAX_POINTS = 600;

/** Vertical padding so a stroke at the min or max is not clipped by the viewBox. */
const PADDING_Y = 2;

export type SparkTrend = "up" | "down" | "flat";

/** Prices of the ticks inside the rolling window (at most 600), oldest first. */
export function sparklineWindow(ticks: readonly TickPoint[]): number[] {
  if (ticks.length === 0) return [];
  const cutoff = ticks[ticks.length - 1].ts - SPARK_WINDOW_SECONDS;
  const lowest = Math.max(0, ticks.length - SPARK_MAX_POINTS);
  // Walk back from the newest tick only as far as the window allows; the buffer can hold 50,000.
  let start = ticks.length - 1;
  while (start > lowest && ticks[start - 1].ts >= cutoff) start -= 1;
  return ticks.slice(start).map((tick) => tick.price);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** SVG `points` string spreading the values across the full width; "" below two points. */
export function sparklinePoints(values: number[], width = 80, height = 20): string {
  const n = values.length;
  if (n < 2) return "";
  let min = values[0];
  let max = values[0];
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min;
  const usable = height - PADDING_Y * 2;
  return values
    .map((v, i) => {
      const x = (i / (n - 1)) * width;
      const y = span === 0 ? height / 2 : PADDING_Y + (1 - (v - min) / span) * usable;
      return `${round2(x)},${round2(y)}`;
    })
    .join(" ");
}

/** Last point against the first: up, down or flat (D-11). */
export function sparklineTrend(values: number[]): SparkTrend {
  if (values.length < 2) return "flat";
  const first = values[0];
  const last = values[values.length - 1];
  if (last > first) return "up";
  if (last < first) return "down";
  return "flat";
}
