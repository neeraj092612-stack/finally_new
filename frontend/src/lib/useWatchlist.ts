"use client";

/** Watchlist data hook: loads GET /api/watchlist and scopes the price store to it. */
import { useCallback, useEffect, useState } from "react";
import { fetchWatchlist } from "./api";
import { setWatchedTickers } from "./priceStore";
import type { WatchlistEntry } from "./types";

export type WatchlistStatus = "loading" | "error" | "ready";

export interface UseWatchlistResult {
  status: WatchlistStatus;
  entries: WatchlistEntry[];
  retry: () => void;
}

interface WatchlistState {
  status: WatchlistStatus;
  entries: WatchlistEntry[];
}

const LOADING: WatchlistState = { status: "loading", entries: [] };

export function useWatchlist(): UseWatchlistResult {
  const [state, setState] = useState<WatchlistState>(LOADING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchWatchlist()
      .then((entries) => {
        if (cancelled) return;
        // Only watched tickers are ingested by the store from here on (UI-SPEC Data Binding).
        setWatchedTickers(entries.map((entry) => entry.ticker));
        setState({ status: "ready", entries });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", entries: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState(LOADING);
    setAttempt((n) => n + 1);
  }, []);

  return { status: state.status, entries: state.entries, retry };
}
