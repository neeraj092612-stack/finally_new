"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePriceStream } from "@/hooks/usePriceStream";
import { api } from "@/lib/api";
import { pnlSeries, revaluePortfolio } from "@/lib/portfolio";
import type { Portfolio, Side, Snapshot, WatchlistEntry } from "@/lib/types";
import ChatPanel from "./ChatPanel";
import Header from "./Header";
import Heatmap from "./Heatmap";
import MainChart from "./MainChart";
import PnlChart from "./PnlChart";
import PositionsTable from "./PositionsTable";
import TradeBar from "./TradeBar";
import Watchlist from "./Watchlist";

const loadChatHistory = () => api.getChat().then((r) => r.messages);
const sendChat = (text: string) => api.sendChat(text).then((r) => r.message);

export default function Workstation() {
  const { prices, status, history, version } = usePriceStream();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  const refreshPortfolio = useCallback(async () => {
    try {
      const [p, h] = await Promise.all([api.getPortfolio(), api.getHistory()]);
      setPortfolio(p);
      setSnapshots(h.snapshots);
    } catch {
      // keep the last good state; the connection dot shows server trouble
    }
  }, []);

  const refreshWatchlist = useCallback(async () => {
    try {
      const { watchlist } = await api.getWatchlist();
      setWatchlist(watchlist);
    } catch {
      // keep the last good state
    }
  }, []);

  useEffect(() => {
    refreshPortfolio();
    refreshWatchlist();
  }, [refreshPortfolio, refreshWatchlist]);

  // Default selection: first watchlist ticker; drop selection if it was removed.
  useEffect(() => {
    if (!watchlist.length) return;
    if (!selected || !watchlist.some((w) => w.ticker === selected)) setSelected(watchlist[0].ticker);
  }, [watchlist, selected]);

  // A ticker loaded before it had a price has no day-change baseline yet;
  // refetch once its first live price arrives so the backend baseline is used.
  const baselineRequested = useRef(new Set<string>());
  useEffect(() => {
    const missing = watchlist.filter(
      (w) => w.price == null && prices[w.ticker] && !baselineRequested.current.has(w.ticker),
    );
    if (!missing.length) return;
    missing.forEach((w) => baselineRequested.current.add(w.ticker));
    refreshWatchlist();
  }, [watchlist, prices, refreshWatchlist]);

  const live = useMemo(() => (portfolio ? revaluePortfolio(portfolio, prices) : null), [portfolio, prices]);

  const pnlPoints = useMemo(
    () => pnlSeries(snapshots, live?.total_value ?? null, Math.floor(Date.now() / 1000)),
    // `version` advances the live point on every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshots, live?.total_value, version],
  );

  const handleTrade = useCallback(
    async (ticker: string, quantity: number, side: Side) => {
      const res = await api.trade(ticker, quantity, side);
      setPortfolio(res.portfolio);
      refreshPortfolio();
      return res.trade;
    },
    [refreshPortfolio],
  );

  const handleAdd = useCallback(
    async (ticker: string) => {
      const entry = await api.addTicker(ticker);
      // select only once the refreshed list contains it, or the default-selection effect resets it
      await refreshWatchlist();
      setSelected(entry.ticker);
    },
    [refreshWatchlist],
  );

  const handleRemove = useCallback(
    async (ticker: string) => {
      await api.removeTicker(ticker);
      await refreshWatchlist();
    },
    [refreshWatchlist],
  );

  const handleChatActions = useCallback(() => {
    refreshPortfolio();
    refreshWatchlist();
  }, [refreshPortfolio, refreshWatchlist]);

  const selectedPoints = (selected && history[selected]) || [];

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <Header totalValue={live?.total_value ?? null} cash={live?.cash_balance ?? null} status={status} />

      <main
        className={`grid flex-1 gap-1.5 p-1.5 lg:min-h-0 ${
          chatCollapsed
            ? "grid-cols-1 md:grid-cols-[330px_1fr] lg:grid-cols-[330px_1fr_40px]"
            : "grid-cols-1 md:grid-cols-[330px_1fr] lg:grid-cols-[330px_1fr_340px] xl:grid-cols-[340px_1fr_380px]"
        }`}
      >
        <div className="h-[420px] md:row-span-2 md:h-auto lg:row-span-1 lg:min-h-0">
          <Watchlist
            entries={watchlist}
            prices={prices}
            history={history}
            selected={selected}
            onSelect={setSelected}
            onAdd={handleAdd}
            onRemove={handleRemove}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5 lg:min-h-0">
          <div className="h-[300px] lg:h-auto lg:min-h-[220px] lg:flex-[1.15]">
            <MainChart
              ticker={selected}
              points={selectedPoints}
              version={version}
              latest={selected ? prices[selected] : undefined}
            />
          </div>
          <TradeBar
            selectedTicker={selected}
            livePrice={selected ? (prices[selected]?.price ?? null) : null}
            onTrade={handleTrade}
          />
          <div className="grid gap-1.5 md:grid-cols-2 lg:min-h-[180px] lg:flex-1">
            <div className="h-[240px] lg:h-auto lg:min-h-0">
              <Heatmap positions={live?.positions ?? []} />
            </div>
            <div className="h-[240px] lg:h-auto lg:min-h-0">
              <PnlChart points={pnlPoints} />
            </div>
          </div>
          <div className="h-[240px] lg:h-auto lg:min-h-[140px] lg:flex-[0.8]">
            <PositionsTable positions={live?.positions ?? []} onSelect={setSelected} />
          </div>
        </div>

        <div className="h-[520px] md:col-span-2 lg:col-span-1 lg:h-auto lg:min-h-0">
          <ChatPanel
            loadHistory={loadChatHistory}
            send={sendChat}
            onActions={handleChatActions}
            collapsed={chatCollapsed}
            onToggle={() => setChatCollapsed((c) => !c)}
          />
        </div>
      </main>
    </div>
  );
}
