/** Same-origin API fetchers; every non-2xx surfaces the PLAN section 8 error envelope. */
import type { Portfolio, WatchlistEntry } from "./types";

/** A non-2xx API response: `code` is the envelope code, or null when the body had none. */
export class ApiRequestError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

interface ErrorEnvelope {
  error?: { code?: unknown; message?: unknown };
}

async function toError(response: Response): Promise<ApiRequestError> {
  let code: string | null = null;
  let message = `Request failed (HTTP ${response.status}).`;
  try {
    const body = (await response.json()) as ErrorEnvelope | null;
    const envelope = body?.error;
    if (envelope && typeof envelope.message === "string" && envelope.message.length > 0) {
      message = envelope.message;
      if (typeof envelope.code === "string") code = envelope.code;
    }
  } catch {
    // Not JSON (for example a proxy error page): keep the generic message.
  }
  return new ApiRequestError(response.status, code, message);
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { Accept: "application/json" } });
  if (!response.ok) throw await toError(response);
  return (await response.json()) as T;
}

/** GET /api/portfolio. */
export function fetchPortfolio(): Promise<Portfolio> {
  return getJson<Portfolio>("/api/portfolio");
}

/** GET /api/watchlist, unwrapped to the entry array. */
export async function fetchWatchlist(): Promise<WatchlistEntry[]> {
  const body = await getJson<{ watchlist: WatchlistEntry[] }>("/api/watchlist");
  return body.watchlist;
}
