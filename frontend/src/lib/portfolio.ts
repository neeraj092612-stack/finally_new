import type { Portfolio, PriceMap, Snapshot } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Re-values a server portfolio with live SSE prices. Positions without a live
 * price keep the server's `current_price`. Order and shape are preserved.
 */
export function revaluePortfolio(portfolio: Portfolio, prices: PriceMap): Portfolio {
  const positions = portfolio.positions.map((p) => {
    const current_price = prices[p.ticker]?.price ?? p.current_price;
    const market_value = round2(p.quantity * current_price);
    const cost = p.quantity * p.avg_cost;
    const unrealized_pnl = round2(market_value - cost);
    const unrealized_pnl_percent = cost > 0 ? round2((unrealized_pnl / cost) * 100) : 0;
    return { ...p, current_price, market_value, unrealized_pnl, unrealized_pnl_percent };
  });
  const positions_value = round2(positions.reduce((s, p) => s + p.market_value, 0));
  const unrealized_pnl = round2(positions.reduce((s, p) => s + p.unrealized_pnl, 0));
  return {
    ...portfolio,
    positions,
    positions_value,
    unrealized_pnl,
    total_value: round2(portfolio.cash_balance + positions_value),
  };
}

export interface ChartPoint {
  time: number; // Unix seconds, integer, strictly ascending
  value: number;
}

/**
 * Converts samples to strictly ascending integer-second points, keeping the
 * last value within each second (Lightweight Charts rejects duplicate times).
 */
export function toChartPoints(samples: { time: number; value: number }[]): ChartPoint[] {
  const out: ChartPoint[] = [];
  for (const s of samples) {
    const time = Math.floor(s.time);
    const last = out[out.length - 1];
    if (last && time <= last.time) {
      // same second (or clock skew): overwrite the last point
      last.value = s.value;
    } else {
      out.push({ time, value: s.value });
    }
  }
  return out;
}

/** Snapshot history plus a live final point at `nowSeconds`. */
export function pnlSeries(
  snapshots: Snapshot[],
  liveTotal: number | null,
  nowSeconds: number,
): ChartPoint[] {
  const samples = snapshots
    .map((s) => ({ time: Date.parse(s.recorded_at) / 1000, value: s.total_value }))
    .filter((s) => Number.isFinite(s.time))
    .sort((a, b) => a.time - b.time);
  if (liveTotal != null) {
    const lastTime = samples.length ? samples[samples.length - 1].time : -Infinity;
    samples.push({ time: Math.max(nowSeconds, Math.floor(lastTime) + 1), value: liveTotal });
  }
  return toChartPoints(samples);
}

/**
 * Live day-change %: the baseline is derived from the server's
 * `day_change_percent` at its `price` (baseline = price / (1 + pct/100)).
 */
export function dayChangeBaseline(price: number | null, pct: number | null): number | null {
  if (price == null || pct == null) return null;
  const base = price / (1 + pct / 100);
  return Number.isFinite(base) && base > 0 ? base : null;
}

export function dayChangePercent(price: number, baseline: number): number {
  return round2(((price - baseline) / baseline) * 100);
}
