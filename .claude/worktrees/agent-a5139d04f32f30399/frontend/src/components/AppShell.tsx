"use client";

import { useEffect, useState } from "react";
import { connectPriceStream, disconnectPriceStream } from "@/lib/priceStore";
import { useWatchlist } from "@/lib/useWatchlist";
import { Header } from "./Header";
import { MainChartPanel } from "./MainChartPanel";
import { PlaceholderPanel } from "./PlaceholderPanel";
import { WatchlistPanel } from "./WatchlistPanel";

const COLUMN_LABEL =
  "text-label font-semibold uppercase tracking-[0.06em] text-muted";

/** Terminal grid (D-01) with tablet stacking (D-04). Later plans fill the panels in place. */
export function AppShell() {
  const [chatOpen, setChatOpen] = useState(false);
  const watchlist = useWatchlist();
  // AppShell owns the selected ticker (D-15): never persisted, AAPL (first entry) on load.
  const [selected, setSelected] = useState<string | null>(null);

  // The only place the app opens the price stream; browser globals stay inside the effect.
  useEffect(() => {
    connectPriceStream();
    return disconnectPriceStream;
  }, []);

  const { status, entries } = watchlist;
  useEffect(() => {
    if (status !== "ready") return;
    setSelected((current) =>
      current !== null && entries.some((entry) => entry.ticker === current)
        ? current
        : (entries[0]?.ticker ?? null),
    );
  }, [status, entries]);

  return (
    <div className="flex min-h-[720px] flex-col desk:h-screen">
      <Header />

      <main className="flex flex-col gap-1 p-1 desk:min-h-0 desk:flex-1 desk:flex-row">
        {/* Left column: WATCHLIST over TRADE */}
        <div className="contents desk:flex desk:w-[352px] desk:shrink-0 desk:flex-col desk:gap-1">
          <WatchlistPanel
            {...watchlist}
            selected={selected}
            onSelect={setSelected}
            className="order-2 desk:order-none desk:min-h-[332px] desk:flex-1"
          />
          <PlaceholderPanel
            title="TRADE"
            ariaLabel="Trade"
            heading="Trading — coming soon"
            body="Buy and sell shares from this panel."
            className="order-7 h-24 shrink-0 desk:order-none"
          />
        </div>

        {/* Center column: CHART over HEATMAP | P&L over POSITIONS */}
        <div className="contents desk:flex desk:min-w-[528px] desk:flex-1 desk:flex-col desk:gap-1">
          <MainChartPanel ticker={selected} />
          <div className="contents desk:flex desk:h-[220px] desk:shrink-0 desk:gap-1">
            <PlaceholderPanel
              title="HEATMAP"
              ariaLabel="Heatmap"
              heading="No positions to map"
              body="The heatmap fills in as you build a portfolio."
              className="order-4 h-[220px] shrink-0 desk:order-none desk:flex-1"
            />
            <PlaceholderPanel
              title="P&L"
              ariaLabel="P&L"
              heading="No P&L history yet"
              body="Portfolio value over time appears here after your first trade."
              className="order-5 h-[220px] shrink-0 desk:order-none desk:flex-1"
            />
          </div>
          <PlaceholderPanel
            title="POSITIONS"
            ariaLabel="Positions"
            heading="No positions yet"
            body="Positions appear here once you buy shares."
            className="order-6 h-[200px] shrink-0 desk:order-none"
            header={
              <div className={`flex h-6 shrink-0 items-center gap-2 bg-surface px-2 ${COLUMN_LABEL}`}>
                <span className="flex-1">TICKER</span>
                <span className="flex-1 text-right">QTY</span>
                <span className="flex-1 text-right">AVG COST</span>
                <span className="flex-1 text-right">PRICE</span>
                <span className="flex-1 text-right">P&L</span>
                <span className="flex-1 text-right">% CHG</span>
              </div>
            }
          />
        </div>

        {/* Right column: AI CHAT, collapsed by default below 1200px (D-04) */}
        <PlaceholderPanel
          title="AI CHAT"
          ariaLabel="AI chat"
          heading="Chat — coming soon"
          body="FinAlly, your AI trading assistant, will analyze your portfolio and place trades here."
          className={`order-8 desk:order-none desk:h-auto desk:w-80 desk:shrink-0 ${
            chatOpen ? "h-80" : ""
          }`}
          collapsedBelowDesk={!chatOpen}
          actions={
            <button
              type="button"
              aria-expanded={chatOpen}
              onClick={() => setChatOpen((open) => !open)}
              className={`flex h-7 items-center gap-1 px-1 hover:text-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary desk:hidden ${COLUMN_LABEL}`}
            >
              {chatOpen ? "Hide chat" : "Show chat"}
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
                className={chatOpen ? "rotate-180" : ""}
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
          }
        />
      </main>
    </div>
  );
}
