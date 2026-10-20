/** Sparkline math (API-surface stub; implemented in the GREEN step). */
import type { TickPoint } from "./types";

/** Rolling window: ticks older than this many seconds before the newest are dropped. */
export const SPARK_WINDOW_SECONDS = 300;
/** At most this many points are drawn. */
export const SPARK_MAX_POINTS = 600;

export type SparkTrend = "up" | "down" | "flat";

export function sparklineWindow(_ticks: readonly TickPoint[]): number[] {
  return [];
}

export function sparklinePoints(_values: number[], _width = 80, _height = 20): string {
  return "";
}

export function sparklineTrend(_values: number[]): SparkTrend {
  return "flat";
}
