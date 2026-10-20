"use client";

import { useMemo } from "react";
import type { KeyboardEvent } from "react";
import { formatPrice, formatSignedPercent, MISSING } from "@/lib/format";
import { getTicks, usePriceStream } from "@/lib/priceStore";
import { sparklineWindow } from "@/lib/sparkline";
import type { WatchlistEntry } from "@/lib/types";
import { PriceCell } from "./PriceCell";
import { Sparkline } from "./Sparkline";

export interface WatchlistRowProps {
  entry: WatchlistEntry;
  selected: boolean;
  onSelect: (ticker: string) => void;
}

/** Hundredths of a percent, so "0.004" counts as the displayed 0.00. */
function hundredths(pct: number): number {
  return Math.round(pct * 100);
}

function dayColor(pct: number | null): string {
  if (pct === null || hundredths(pct) === 0) return "text-muted";
  return pct > 0 ? "text-up" : "text-down";
}

function ariaLabel(ticker: string, price: number | null, pct: number | null): string {
  if (price === null) return `${ticker}, no price yet`;
  const priceText = formatPrice(price);
  if (pct === null) return `${ticker}, ${priceText}`;
  const word = hundredths(pct) === 0 ? "unchanged" : pct > 0 ? "up" : "down";
  return `${ticker}, ${priceText}, ${word} ${formatPrice(Math.abs(pct))} percent`;
}

/** One dense 28px watchlist row (D-09): ticker, sparkline, price with marker, Day %. */
export function WatchlistRow({ entry, selected, onSelect }: WatchlistRowProps) {
  const snapshot = usePriceStream();
  const { ticker } = entry;
  const live = snapshot.connection === "open";
  const tick = snapshot.latest[ticker];
  const price = tick?.price ?? entry.price;
  // SSE value once a tick has arrived, the REST value before that (D-13).
  const dayPct = tick?.day_change_percent ?? entry.day_change_percent;

  // The tick buffer mutates in place, so the store version is the change signal.
  const sparkValues = useMemo(
    () => sparklineWindow(getTicks(ticker)),
    [ticker, snapshot.version],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(ticker);
    }
  }

  return (
    <div
      role="option"
      aria-selected={selected}
      aria-label={ariaLabel(ticker, price, dayPct)}
      data-ticker={ticker}
      tabIndex={selected ? 0 : -1}
      onClick={() => onSelect(ticker)}
      onKeyDown={handleKeyDown}
      className={`relative flex h-7 shrink-0 cursor-pointer items-center gap-2 px-2 outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
        selected ? "bg-surface-2" : "hover:bg-surface-2"
      }`}
    >
      {selected ? (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-accent" />
      ) : null}
      <span
        title={ticker}
        className="w-16 shrink-0 truncate text-heading font-semibold text-text"
      >
        {ticker}
      </span>
      <div data-testid="sparkline-cell" className="h-5 min-w-0 flex-1">
        <Sparkline values={sparkValues} />
      </div>
      <div className="w-[88px] shrink-0 text-right">
        <PriceCell
          price={price}
          live={live}
          flash={snapshot.flash[ticker]}
          marker={snapshot.marker[ticker]}
        />
      </div>
      <div className="w-[72px] shrink-0 text-right">
        <span className={`font-mono text-body tabular-nums ${dayColor(dayPct)}`}>
          {dayPct === null ? MISSING : formatSignedPercent(dayPct)}
        </span>
      </div>
    </div>
  );
}
