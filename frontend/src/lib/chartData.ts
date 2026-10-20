import type { TickPoint } from "./types";

// RED stub: signatures only, behavior arrives in the GREEN commit.
export function toChartTime(ts: number): number {
  return ts;
}

export function collapseBySecond(ticks: readonly TickPoint[]): { time: number; value: number }[] {
  return ticks.length === 0 ? [] : [{ time: 0, value: 0 }];
}
