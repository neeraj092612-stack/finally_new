import type {
  ChatMessage,
  Portfolio,
  Side,
  Snapshot,
  TradeResponse,
  WatchlistEntry,
} from "./types";

/** Error thrown for any non-2xx API response; `message` is user-displayable. */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ApiError("network_error", "Cannot reach the server. Is it running?", 0);
  }
  if (!res.ok) {
    let code = "http_error";
    let message = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (body?.error?.message) {
        code = body.error.code ?? code;
        message = body.error.message;
      }
    } catch {
      // non-JSON error body; keep the generic message
    }
    throw new ApiError(code, message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  getPortfolio: () => request<Portfolio>("/api/portfolio"),
  getHistory: () => request<{ snapshots: Snapshot[] }>("/api/portfolio/history"),
  trade: (ticker: string, quantity: number, side: Side) =>
    request<TradeResponse>("/api/portfolio/trade", {
      method: "POST",
      body: JSON.stringify({ ticker, quantity, side }),
    }),
  getWatchlist: () => request<{ watchlist: WatchlistEntry[] }>("/api/watchlist"),
  addTicker: (ticker: string) =>
    request<WatchlistEntry>("/api/watchlist", {
      method: "POST",
      body: JSON.stringify({ ticker }),
    }),
  removeTicker: (ticker: string) =>
    request<void>(`/api/watchlist/${encodeURIComponent(ticker)}`, { method: "DELETE" }),
  getChat: () => request<{ messages: ChatMessage[] }>("/api/chat"),
  sendChat: (message: string) =>
    request<{ message: ChatMessage }>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};
