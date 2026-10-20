/** Watchlist row (API-surface stub; implemented in the GREEN step). */
import type { WatchlistEntry } from "@/lib/types";

export interface WatchlistRowProps {
  entry: WatchlistEntry;
  selected: boolean;
  onSelect: (ticker: string) => void;
}

export function WatchlistRow(_props: WatchlistRowProps) {
  return null;
}
