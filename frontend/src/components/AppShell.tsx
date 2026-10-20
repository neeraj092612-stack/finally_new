"use client";

import { Panel } from "./Panel";

const SKELETON_ROWS = Array.from({ length: 10 }, (_, i) => i);

/** Terminal grid (D-01) with tablet stacking (D-04). Later plans fill the panels in place. */
export function AppShell() {
  return (
    <div className="flex min-h-[720px] flex-col desk:h-screen">
      {/* Plan 01-08 replaces this static bar with the live Header. */}
      <header className="flex h-12 shrink-0 items-center border-b border-border bg-surface px-2">
        <span className="text-heading font-semibold">
          Fin<span className="text-accent">Ally</span>
        </span>
      </header>

      <main className="flex flex-col gap-1 p-1 desk:min-h-0 desk:flex-1 desk:flex-row">
        {/* Left column: WATCHLIST over TRADE */}
        <div className="contents desk:flex desk:w-[352px] desk:shrink-0 desk:flex-col desk:gap-1">
          <Panel
            title="WATCHLIST"
            ariaLabel="Watchlist"
            className="order-2 desk:order-none desk:min-h-[332px] desk:flex-1"
          >
            <div className="flex h-6 items-center gap-2 bg-surface px-2 text-label font-semibold uppercase tracking-[0.06em] text-muted">
              <span className="w-16">TICKER</span>
              <span className="flex-1">TREND</span>
              <span className="w-[88px] text-right">PRICE</span>
              <span className="w-[72px] text-right">DAY %</span>
            </div>
            <div>
              {SKELETON_ROWS.map((i) => (
                <div
                  key={i}
                  data-testid="skeleton-row"
                  className="flex h-7 items-center gap-2 px-2"
                >
                  <div className="skeleton-pulse h-3 w-16 bg-surface-2" />
                  <div className="skeleton-pulse h-3 flex-1 bg-surface-2" />
                  <div className="skeleton-pulse h-3 w-[88px] bg-surface-2" />
                  <div className="skeleton-pulse h-3 w-[72px] bg-surface-2" />
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            title="TRADE"
            ariaLabel="Trade"
            className="order-7 h-24 shrink-0 desk:order-none"
          />
        </div>

        {/* Center column: CHART over HEATMAP | P&L over POSITIONS */}
        <div className="contents desk:flex desk:min-w-[528px] desk:flex-1 desk:flex-col desk:gap-1">
          <Panel
            title="CHART"
            ariaLabel="Chart"
            className="order-3 h-80 shrink-0 desk:order-none desk:h-auto desk:min-h-[280px] desk:flex-1"
            bodyClassName="relative"
          >
            <div className="absolute inset-0 flex items-center justify-center text-body text-muted">
              Select a ticker to see its chart.
            </div>
          </Panel>
          <div className="contents desk:flex desk:h-[220px] desk:shrink-0 desk:gap-1">
            <Panel
              title="HEATMAP"
              ariaLabel="Heatmap"
              className="order-4 h-[220px] shrink-0 desk:order-none desk:flex-1"
            />
            <Panel
              title="P&L"
              ariaLabel="P&L"
              className="order-5 h-[220px] shrink-0 desk:order-none desk:flex-1"
            />
          </div>
          <Panel
            title="POSITIONS"
            ariaLabel="Positions"
            className="order-6 h-[200px] shrink-0 desk:order-none"
          />
        </div>

        {/* Right column: AI CHAT */}
        <Panel
          title="AI CHAT"
          ariaLabel="AI chat"
          className="order-8 desk:order-none desk:w-80 desk:shrink-0"
        />
      </main>
    </div>
  );
}
