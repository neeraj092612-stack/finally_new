"use client";

import { usePriceStream } from "@/lib/priceStore";
import { ChartStrip } from "./ChartStrip";
import { Panel } from "./Panel";

export interface MainChartPanelProps {
  ticker: string | null;
}

const OVERLAY =
  "pointer-events-none absolute inset-0 flex items-center justify-center text-body text-muted";

/** CHART panel (UI-04): title, stats strip and the chart area for the selected ticker. */
export function MainChartPanel({ ticker }: MainChartPanelProps) {
  const snapshot = usePriceStream();
  const hasTicks = ticker !== null && snapshot.session[ticker] !== undefined;

  return (
    <Panel
      title={
        ticker === null ? (
          "CHART"
        ) : (
          <>
            CHART · <span className="text-accent">{ticker}</span>
          </>
        )
      }
      ariaLabel="Chart"
      className="order-3 h-80 shrink-0 desk:order-none desk:h-auto desk:min-h-[280px] desk:flex-1"
      bodyClassName="flex flex-col"
    >
      {ticker !== null ? <ChartStrip ticker={ticker} /> : null}
      <div className="relative min-h-0 flex-1">
        {ticker === null ? (
          <div className={OVERLAY}>Select a ticker to see its chart.</div>
        ) : !hasTicks ? (
          <div className={OVERLAY}>Waiting for the first price…</div>
        ) : null}
      </div>
    </Panel>
  );
}
