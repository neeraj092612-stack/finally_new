import type { ChatMessage, Portfolio, PriceUpdate, WatchlistEntry } from "@/lib/types";

export function priceUpdate(ticker: string, price: number, previous = price, timestamp = 1791100800): PriceUpdate {
  const change = +(price - previous).toFixed(4);
  return {
    ticker,
    price,
    previous_price: previous,
    timestamp,
    change,
    change_percent: previous ? +((change / previous) * 100).toFixed(4) : 0,
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
}

export const watchlistEntries: WatchlistEntry[] = [
  {
    ticker: "AAPL",
    price: 191.24,
    previous_price: 191.1,
    direction: "up",
    day_change_percent: 0.65,
    added_at: "2026-10-04T14:00:00Z",
  },
  {
    ticker: "MSFT",
    price: 410,
    previous_price: 411,
    direction: "down",
    day_change_percent: -1.2,
    added_at: "2026-10-04T14:00:01Z",
  },
];

export const portfolio: Portfolio = {
  cash_balance: 8087.6,
  positions_value: 1962.4,
  total_value: 10050,
  unrealized_pnl: 50,
  positions: [
    {
      ticker: "AAPL",
      quantity: 10,
      avg_cost: 191.24,
      current_price: 196.24,
      market_value: 1962.4,
      unrealized_pnl: 50,
      unrealized_pnl_percent: 2.61,
    },
  ],
};

export const chatHistory: ChatMessage[] = [
  {
    id: "1",
    role: "user",
    content: "Buy 5 shares of PYPL",
    created_at: "2026-10-04T14:05:09Z",
    actions: null,
  },
  {
    id: "2",
    role: "assistant",
    content: "Added PYPL to your watchlist and bought 5 shares.",
    created_at: "2026-10-04T14:05:10Z",
    actions: {
      watchlist_changes: [{ ticker: "PYPL", action: "add", status: "executed", error: null }],
      trades: [
        { ticker: "PYPL", side: "buy", quantity: 5, status: "executed", price: 71.3, error: null },
        {
          ticker: "TSLA",
          side: "buy",
          quantity: 500,
          status: "failed",
          price: null,
          error: { code: "insufficient_cash", message: "Need $125,000.00 but only $9,643.50 is available." },
        },
      ],
    },
  },
];

/** Controllable EventSource stand-in; instances are recorded for tests to drive. */
export class MockEventSource {
  static instances: MockEventSource[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readyState = 0;
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  closed = false;

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  open() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  error(readyState: 0 | 2) {
    this.readyState = readyState;
    this.onerror?.(new Event("error"));
  }

  emit(data: unknown) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }

  static latest() {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }
}
