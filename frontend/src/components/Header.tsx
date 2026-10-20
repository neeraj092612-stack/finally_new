"use client";

import { formatUsd, MISSING } from "@/lib/format";
import { usePortfolio } from "@/lib/usePortfolio";
import { usePriceStream } from "@/lib/priceStore";
import type { Portfolio, PriceTick } from "@/lib/types";
import { ConnectionIndicator } from "./ConnectionIndicator";

/** Starting balance in cents; the live total is colored against it (D-08). */
const START_CENTS = 1_000_000;
const UNAVAILABLE = "Portfolio unavailable. Reload to retry.";
const CAPTION = "text-label font-semibold uppercase tracking-[0.06em] text-muted";

/** Cash plus every position at its live price, falling back to the fetched price. */
function liveTotal(portfolio: Portfolio, latest: Record<string, PriceTick>): number {
  let total = portfolio.cash_balance;
  for (const position of portfolio.positions) {
    const price = latest[position.ticker]?.price ?? position.current_price;
    total += position.quantity * price;
  }
  return total;
}

function totalColor(total: number): string {
  const cents = Math.round(total * 100);
  if (cents > START_CENTS) return "text-up";
  if (cents < START_CENTS) return "text-down";
  return "text-text";
}

/** 48px terminal header: wordmark, live total value, cash, connection dot (UI-SPEC "Layout and Panels"). */
export function Header() {
  const { connection, hasOpened, latest } = usePriceStream();
  const portfolio = usePortfolio();

  const ready = portfolio.status === "ready" && portfolio.data !== null;
  const total = ready ? liveTotal(portfolio.data as Portfolio, latest) : null;
  const totalText = total === null ? MISSING : formatUsd(total);
  const totalClass = total === null ? "text-muted" : totalColor(total);
  const cashText = ready ? formatUsd((portfolio.data as Portfolio).cash_balance) : MISSING;
  const cashClass = ready ? "text-text" : "text-muted";

  return (
    <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-6 gap-y-1 border-b border-border bg-surface px-2">
      <span className="text-heading font-semibold text-text">
        Fin<span className="text-accent">Ally</span>
      </span>

      <div className="flex shrink-0 flex-col whitespace-nowrap">
        <span className={CAPTION}>TOTAL VALUE</span>
        <span
          data-testid="total-value"
          className={`font-mono text-display font-semibold tabular-nums ${totalClass}`}
        >
          {totalText}
        </span>
      </div>

      <div className="flex shrink-0 flex-col whitespace-nowrap">
        <span className={CAPTION}>CASH</span>
        <span
          data-testid="cash-value"
          className={`font-mono text-heading font-semibold tabular-nums ${cashClass}`}
        >
          {cashText}
        </span>
      </div>

      {portfolio.status === "error" ? (
        <span
          title={UNAVAILABLE}
          className="text-label font-semibold uppercase tracking-[0.06em] text-down"
        >
          {UNAVAILABLE}
        </span>
      ) : null}

      <div className="ml-auto">
        <ConnectionIndicator connection={connection} hasOpened={hasOpened} />
      </div>
    </header>
  );
}
