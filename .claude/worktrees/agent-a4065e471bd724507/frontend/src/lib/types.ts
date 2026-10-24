/** Shared wire and store types for the live market terminal. */

export type Direction = "up" | "down" | "flat";

export type ConnectionState = "connecting" | "open" | "closed";

/** One ticker entry of the SSE `data:` payload (PLAN section 8 plus plan 01-03 keys). */
export interface PriceTick {
  ticker: string;
  price: number;
  previous_price: number;
  /** Unix seconds (float). */
  timestamp: number;
  change: number;
  change_percent: number;
  direction: Direction;
  reference_price: number | null;
  day_change_percent: number | null;
}

/** One accumulated point of a ticker's browser-side price history. */
export interface TickPoint {
  ts: number;
  price: number;
}

/** One element of GET /api/watchlist (price fields are null until first priced). */
export interface WatchlistEntry {
  ticker: string;
  price: number | null;
  previous_price: number | null;
  direction: Direction | null;
  day_change_percent: number | null;
  added_at: string;
}

export interface Position {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
}

/** GET /api/portfolio response. */
export interface Portfolio {
  cash_balance: number;
  positions_value: number;
  total_value: number;
  unrealized_pnl: number;
  positions: Position[];
}

/** Running since-page-load statistics for one ticker. */
export interface SessionStats {
  first: number;
  high: number;
  low: number;
  last: number;
}

export interface PriceStoreSnapshot {
  version: number;
  connection: ConnectionState;
  hasOpened: boolean;
  latest: Record<string, PriceTick>;
  flash: Record<string, { seq: number; dir: "up" | "down" }>;
  marker: Record<string, "up" | "down">;
  session: Record<string, SessionStats>;
}
