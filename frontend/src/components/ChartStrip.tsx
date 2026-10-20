"use client";

import {
  formatPrice,
  formatSignedChange,
  formatSignedPercent,
  MISSING,
} from "@/lib/format";
import { usePriceStream } from "@/lib/priceStore";

export interface ChartStripProps {
  ticker: string;
}

function changeColor(change: number): string {
  // Same "rounds to 0.00" rule as the formatters, so +0.004 reads muted.
  if (Math.round(Math.abs(change) * 100) === 0) return "text-muted";
  return change > 0 ? "text-up" : "text-down";
}

/**
 * 40px chart strip (D-16): ticker, live price (no flash), change since page load and
 * session high/low. "Session" means since this page was opened; the first buffered
 * price is the baseline.
 */
export function ChartStrip({ ticker }: ChartStripProps) {
  const snapshot = usePriceStream();
  const stats = snapshot.session[ticker];

  const change = stats ? stats.last - stats.first : null;
  const percent = stats && stats.first !== 0 ? ((stats.last - stats.first) / stats.first) * 100 : null;
  const changeText =
    change === null
      ? MISSING
      : percent === null
        ? formatSignedChange(change)
        : `${formatSignedChange(change)} (${formatSignedPercent(percent)})`;

  return (
    <div
      data-testid="chart-strip"
      className="flex h-10 shrink-0 items-center gap-4 bg-bg px-2"
    >
      <span className="text-heading font-semibold text-text">{ticker}</span>
      <span
        data-testid="strip-price"
        className="font-mono text-display font-semibold tabular-nums text-text"
      >
        {stats ? formatPrice(stats.last) : MISSING}
      </span>
      <span
        data-testid="strip-change"
        className={`font-mono text-body tabular-nums ${change === null ? "text-muted" : changeColor(change)}`}
      >
        {changeText}
      </span>
      <span className="flex items-baseline gap-1 font-mono text-body tabular-nums">
        <span className="text-muted">H</span>
        <span data-testid="strip-high" className="text-text">
          {stats ? formatPrice(stats.high) : MISSING}
        </span>
      </span>
      <span className="flex items-baseline gap-1 font-mono text-body tabular-nums">
        <span className="text-muted">L</span>
        <span data-testid="strip-low" className="text-text">
          {stats ? formatPrice(stats.low) : MISSING}
        </span>
      </span>
    </div>
  );
}
