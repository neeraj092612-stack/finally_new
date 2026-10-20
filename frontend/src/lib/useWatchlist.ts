/** Watchlist data hook (API-surface stub; implemented in the GREEN step). */
import type { WatchlistEntry } from "./types";

export type WatchlistStatus = "loading" | "error" | "ready";

export interface UseWatchlistResult {
  status: WatchlistStatus;
  entries: WatchlistEntry[];
  retry: () => void;
}

export function useWatchlist(): UseWatchlistResult {
  return { status: "loading", entries: [], retry: () => {} };
}
