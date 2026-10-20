/** Watchlist panel (API-surface stub; implemented in the GREEN step). */
import type { WatchlistStatus } from "@/lib/useWatchlist";
import type { WatchlistEntry } from "@/lib/types";

export interface WatchlistPanelProps {
  status: WatchlistStatus;
  entries: WatchlistEntry[];
  retry: () => void;
  selected: string | null;
  onSelect: (ticker: string) => void;
}

export function WatchlistPanel(_props: WatchlistPanelProps) {
  return null;
}
