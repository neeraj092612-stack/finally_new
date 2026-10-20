import type { TickPoint } from "./types";

/** One Lightweight Charts point: integer Unix seconds, strictly ascending. */
export interface ChartPoint {
  time: number;
  value: number;
}

/** SSE timestamps are Unix seconds as floats; the chart needs integer seconds. */
export function toChartTime(ts: number): number {
  return Math.floor(ts);
}

/**
 * Chart points from raw ticks: the latest price per second wins, times are strictly
 * ascending, and a tick whose second is earlier than the last emitted one is dropped.
 */
export function collapseBySecond(ticks: readonly TickPoint[]): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const tick of ticks) {
    const time = toChartTime(tick.ts);
    const last = points[points.length - 1];
    if (last === undefined || time > last.time) {
      points.push({ time, value: tick.price });
    } else if (time === last.time) {
      last.value = tick.price;
    }
  }
  return points;
}
