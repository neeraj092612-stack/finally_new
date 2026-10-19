// API shapes — mirror planning/PLAN.md §8 exactly.

export type Direction = "up" | "down" | "flat";
export type Side = "buy" | "sell";

export interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  timestamp: number; // Unix seconds (float)
  change: number;
  change_percent: number;
  direction: Direction;
}

export type PriceMap = Record<string, PriceUpdate>;

export interface Position {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
}

export interface Portfolio {
  cash_balance: number;
  positions_value: number;
  total_value: number;
  unrealized_pnl: number;
  positions: Position[];
}

export interface Trade {
  id: string;
  ticker: string;
  side: Side;
  quantity: number;
  price: number;
  executed_at: string;
}

export interface TradeResponse {
  trade: Trade;
  portfolio: Portfolio;
}

export interface Snapshot {
  total_value: number;
  recorded_at: string;
}

export interface WatchlistEntry {
  ticker: string;
  price: number | null;
  previous_price: number | null;
  direction: Direction | null;
  day_change_percent: number | null;
  added_at: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

export type ActionStatus = "executed" | "failed";

export interface WatchlistChangeResult {
  ticker: string;
  action: "add" | "remove";
  status: ActionStatus;
  error: ApiErrorBody | null;
}

export interface TradeResult {
  ticker: string;
  side: Side;
  quantity: number;
  status: ActionStatus;
  price: number | null;
  error: ApiErrorBody | null;
}

export interface ChatActions {
  watchlist_changes: WatchlistChangeResult[];
  trades: TradeResult[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  actions: ChatActions | null;
}
