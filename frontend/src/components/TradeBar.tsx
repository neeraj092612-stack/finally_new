"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { Side, Trade } from "@/lib/types";

interface TradeBarProps {
  /** Pre-fills the ticker field (e.g. when a watchlist row is selected). */
  selectedTicker: string | null;
  livePrice: number | null;
  onTrade: (ticker: string, quantity: number, side: Side) => Promise<Trade>;
}

export default function TradeBar({ selectedTicker, livePrice, onTrade }: TradeBarProps) {
  const [ticker, setTicker] = useState(selectedTicker ?? "");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [busy, setBusy] = useState<Side | null>(null);

  useEffect(() => {
    if (selectedTicker) setTicker(selectedTicker);
  }, [selectedTicker]);

  const submit = async (side: Side) => {
    setError(null);
    setConfirmation(null);
    const t = ticker.trim().toUpperCase();
    if (!t) {
      setError("Enter a ticker.");
      return;
    }
    const q = Number(quantity);
    if (!quantity.trim() || !Number.isInteger(q) || q <= 0) {
      setError("Quantity must be a positive whole number of shares.");
      return;
    }
    setBusy(side);
    try {
      const trade = await onTrade(t, q, side);
      setConfirmation(
        `${trade.side === "buy" ? "Bought" : "Sold"} ${trade.quantity} ${trade.ticker} @ $${formatPrice(trade.price)}`,
      );
      setQuantity("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Trade failed.");
    } finally {
      setBusy(null);
    }
  };

  const qty = Number(quantity);
  const estimate =
    livePrice != null && Number.isInteger(qty) && qty > 0 && ticker.trim().toUpperCase() === selectedTicker
      ? qty * livePrice
      : null;

  return (
    <section className="panel px-3 py-2">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit("buy");
        }}
      >
        <h2 className="panel-title mr-1">Trade</h2>
        <input
          data-testid="trade-ticker-input"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="Ticker"
          aria-label="Trade ticker"
          maxLength={10}
          className="num w-24 rounded-sm border border-line bg-bg px-2 py-1.5 text-xs uppercase outline-none placeholder:normal-case placeholder:text-faint focus:border-blue"
        />
        <input
          data-testid="trade-quantity-input"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Qty"
          aria-label="Quantity"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          className="num w-20 rounded-sm border border-line bg-bg px-2 py-1.5 text-xs outline-none placeholder:text-faint focus:border-blue"
        />
        <button
          data-testid="trade-buy-button"
          type="button"
          disabled={busy !== null}
          onClick={() => submit("buy")}
          className="rounded-sm bg-up/90 px-4 py-1.5 text-xs font-bold tracking-wide text-bg hover:bg-up disabled:opacity-50"
        >
          {busy === "buy" ? "…" : "BUY"}
        </button>
        <button
          data-testid="trade-sell-button"
          type="button"
          disabled={busy !== null}
          onClick={() => submit("sell")}
          className="rounded-sm bg-down/90 px-4 py-1.5 text-xs font-bold tracking-wide text-white hover:bg-down disabled:opacity-50"
        >
          {busy === "sell" ? "…" : "SELL"}
        </button>
        <span className="text-[10px] text-faint">Market order · instant fill</span>
        {estimate != null && <span className="num text-[11px] text-muted">≈ ${formatPrice(estimate)}</span>}
        <span className="ml-auto min-w-0 text-xs">
          {error && (
            <span data-testid="trade-error" role="alert" className="text-down">
              {error}
            </span>
          )}
          {confirmation && !error && (
            <span data-testid="trade-confirmation" className="num text-up">
              {confirmation}
            </span>
          )}
        </span>
      </form>
    </section>
  );
}
