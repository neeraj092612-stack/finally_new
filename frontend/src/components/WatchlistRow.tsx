"use client";

import type { KeyboardEvent } from "react";
import { usePriceStream } from "@/lib/priceStore";
import type { WatchlistEntry } from "@/lib/types";
import { PriceCell } from "./PriceCell";

export interface WatchlistRowProps {
  entry: WatchlistEntry;
  selected: boolean;
  onSelect: (ticker: string) => void;
}

/** One dense 28px watchlist row (D-09): ticker, sparkline, price with marker, Day %. */
export function WatchlistRow({ entry, selected, onSelect }: WatchlistRowProps) {
  const snapshot = usePriceStream();
  const { ticker } = entry;
  const live = snapshot.connection === "open";
  const tick = snapshot.latest[ticker];
  const price = tick?.price ?? entry.price;

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
      <div data-testid="sparkline-cell" className="h-5 min-w-0 flex-1" />
      <div className="w-[88px] shrink-0 text-right">
        <PriceCell
          price={price}
          live={live}
          flash={snapshot.flash[ticker]}
          marker={snapshot.marker[ticker]}
        />
      </div>
      <div data-testid="day-cell" className="w-[72px] shrink-0 text-right" />
    </div>
  );
}
