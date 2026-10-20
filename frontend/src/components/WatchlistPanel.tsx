"use client";

import { useRef } from "react";
import type { KeyboardEvent } from "react";
import type { WatchlistEntry } from "@/lib/types";
import type { WatchlistStatus } from "@/lib/useWatchlist";
import { Panel } from "./Panel";
import { WatchlistRow } from "./WatchlistRow";

export interface WatchlistPanelProps {
  status: WatchlistStatus;
  entries: WatchlistEntry[];
  retry: () => void;
  selected: string | null;
  onSelect: (ticker: string) => void;
  className?: string;
}

const SKELETON_ROWS = Array.from({ length: 10 }, (_, i) => i);

const COLUMN_LABEL = "text-label font-semibold uppercase tracking-[0.06em] text-muted";

/** Live watchlist (UI-02): column header, then skeleton, error, empty or the listbox of rows. */
export function WatchlistPanel({
  status,
  entries,
  retry,
  selected,
  onSelect,
  className = "",
}: WatchlistPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const current = entries.findIndex((entry) => entry.ticker === selected);
    const nextIndex =
      event.key === "ArrowDown"
        ? Math.min(current + 1, entries.length - 1)
        : Math.max(current - 1, 0);
    const next = entries[nextIndex];
    if (!next || next.ticker === selected) return;
    onSelect(next.ticker);
    // Roving tabindex: move DOM focus with the selection.
    listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[nextIndex]?.focus();
  }

  return (
    <Panel title="WATCHLIST" ariaLabel="Watchlist" className={className} bodyClassName="flex flex-col">
      <div className={`flex h-6 shrink-0 items-center gap-2 bg-surface px-2 ${COLUMN_LABEL}`}>
        <span className="w-16">TICKER</span>
        <span className="flex-1">TREND</span>
        <span className="w-[88px] text-right">PRICE</span>
        <span className="w-[72px] text-right">DAY %</span>
      </div>

      {status === "loading" ? (
        <div>
          {SKELETON_ROWS.map((i) => (
            <div key={i} data-testid="skeleton-row" className="flex h-7 items-center gap-2 px-2">
              <div className="skeleton-pulse h-3 w-16 bg-surface-2" />
              <div className="skeleton-pulse h-3 flex-1 bg-surface-2" />
              <div className="skeleton-pulse h-3 w-[88px] bg-surface-2" />
              <div className="skeleton-pulse h-3 w-[72px] bg-surface-2" />
            </div>
          ))}
        </div>
      ) : null}

      {status === "error" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
          <p className="text-heading font-semibold text-muted">Couldn&apos;t load the watchlist</p>
          <p className="max-w-60 text-body text-muted">
            Check that the FinAlly server is running, then retry.
          </p>
          <button
            type="button"
            onClick={retry}
            className="border border-primary px-2 py-1 text-body text-primary hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          >
            Retry watchlist
          </button>
        </div>
      ) : null}

      {status === "ready" && entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 p-4 text-center">
          <p className="text-heading font-semibold text-muted">No tickers watched</p>
          <p className="max-w-60 text-body text-muted">Tickers you add will stream here.</p>
        </div>
      ) : null}

      {status === "ready" && entries.length > 0 ? (
        <div
          ref={listRef}
          role="listbox"
          aria-label="Watchlist"
          onKeyDown={handleKeyDown}
          className="min-h-0 flex-1 desk:overflow-y-auto"
        >
          {entries.map((entry) => (
            <WatchlistRow
              key={entry.ticker}
              entry={entry}
              selected={entry.ticker === selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
