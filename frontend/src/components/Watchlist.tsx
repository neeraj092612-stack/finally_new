"use client";

import { useMemo, useState } from "react";
import type { PricePoint } from "@/hooks/usePriceStream";
import { useFlash } from "@/hooks/useFlash";
import { ApiError } from "@/lib/api";
import { formatPercent, formatPrice, signClass } from "@/lib/format";
import { dayChangeBaseline, dayChangePercent } from "@/lib/portfolio";
import type { PriceMap, WatchlistEntry } from "@/lib/types";
import Sparkline from "./Sparkline";

interface WatchlistProps {
  entries: WatchlistEntry[];
  prices: PriceMap;
  history: Record<string, PricePoint[]>;
  selected: string | null;
  onSelect: (ticker: string) => void;
  onAdd: (ticker: string) => Promise<void>;
  onRemove: (ticker: string) => Promise<void>;
}

export default function Watchlist({
  entries,
  prices,
  history,
  selected,
  onSelect,
  onAdd,
  onRemove,
}: WatchlistProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const baselines = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const e of entries) out[e.ticker] = dayChangeBaseline(e.price, e.day_change_percent);
    return out;
  }, [entries]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ticker = input.trim().toUpperCase();
    if (!ticker) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(ticker);
      setInput("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add ticker.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (ticker: string) => {
    setError(null);
    try {
      await onRemove(ticker);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not remove ${ticker}.`);
    }
  };

  return (
    <section data-testid="watchlist" className="panel flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="panel-title">Watchlist</h2>
        <span className="num text-[10px] text-faint">{entries.length}</span>
      </div>

      <form onSubmit={submit} className="flex gap-1.5 border-b border-line px-3 py-2">
        <input
          data-testid="watchlist-add-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add ticker…"
          aria-label="Ticker to add"
          maxLength={10}
          className="num min-w-0 flex-1 rounded-sm border border-line bg-bg px-2 py-1 text-xs uppercase outline-none placeholder:normal-case placeholder:text-faint focus:border-blue"
        />
        <button
          data-testid="watchlist-add-button"
          type="submit"
          disabled={busy}
          className="rounded-sm bg-purple px-3 py-1 text-xs font-semibold text-white hover:bg-purple-hi disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {error && (
        <p data-testid="watchlist-error" role="alert" className="border-b border-line bg-down/10 px-3 py-1.5 text-xs text-down">
          {error}
        </p>
      )}

      <div className="grid grid-cols-[minmax(76px,1fr)_auto_auto_auto] items-center gap-x-2 px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-faint">
        <span>Symbol</span>
        <span className="w-20 text-right">Last</span>
        <span className="w-14 text-right">Chg%</span>
        <span className="w-16 text-right">Trend</span>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {entries.map((entry) => {
          const live = prices[entry.ticker];
          const price = live?.price ?? entry.price;
          const base = baselines[entry.ticker];
          const pct = price != null && base != null ? dayChangePercent(price, base) : entry.day_change_percent;
          return (
            <WatchlistRow
              key={entry.ticker}
              ticker={entry.ticker}
              price={price}
              changePercent={pct}
              points={history[entry.ticker] ?? []}
              selected={selected === entry.ticker}
              onSelect={onSelect}
              onRemove={remove}
            />
          );
        })}
        {entries.length === 0 && <li className="px-3 py-6 text-center text-xs text-faint">No tickers watched.</li>}
      </ul>
    </section>
  );
}

interface RowProps {
  ticker: string;
  price: number | null;
  changePercent: number | null;
  points: PricePoint[];
  selected: boolean;
  onSelect: (ticker: string) => void;
  onRemove: (ticker: string) => void;
}

function WatchlistRow({ ticker, price, changePercent, points, selected, onSelect, onRemove }: RowProps) {
  const flash = useFlash(price);
  return (
    <li
      data-testid={`watchlist-row-${ticker}`}
      data-selected={selected}
      onClick={() => onSelect(ticker)}
      className={`group relative grid cursor-pointer grid-cols-[minmax(76px,1fr)_auto_auto_auto] items-center gap-x-2 border-l-2 px-3 py-1.5 hover:bg-panel-2 ${
        selected ? "border-accent bg-panel-2" : "border-transparent"
      }`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="num text-[13px] font-semibold text-text">{ticker}</span>
        <button
          data-testid={`watchlist-remove-${ticker}`}
          type="button"
          aria-label={`Remove ${ticker}`}
          title={`Remove ${ticker}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(ticker);
          }}
          className="rounded-sm px-1 text-xs leading-none text-faint opacity-40 hover:bg-down/20 hover:text-down group-hover:opacity-100 focus:opacity-100"
        >
          ×
        </button>
      </span>
      <span data-testid={`watchlist-price-${ticker}`} className={`price-cell num w-20 px-1 text-right text-[13px] ${flash}`}>
        {formatPrice(price)}
      </span>
      <span className={`num w-14 text-right text-xs ${signClass(changePercent)}`}>{formatPercent(changePercent)}</span>
      <span className="flex w-16 justify-end">
        <Sparkline points={points} width={64} />
      </span>
    </li>
  );
}
