/** Same-origin API fetchers (RED skeleton: no behavior yet). */
import type { Portfolio, WatchlistEntry } from "./types";

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

export async function fetchPortfolio(): Promise<Portfolio> {
  throw new Error("not implemented");
}

export async function fetchWatchlist(): Promise<WatchlistEntry[]> {
  throw new Error("not implemented");
}
