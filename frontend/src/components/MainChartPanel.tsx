"use client";

import { Panel } from "./Panel";

// RED stub: empty panel, behavior arrives in the GREEN commit.
export function MainChartPanel({ ticker }: { ticker: string | null }) {
  void ticker;
  return <Panel title="CHART" ariaLabel="Chart" />;
}
