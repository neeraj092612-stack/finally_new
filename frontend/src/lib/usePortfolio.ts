import type { Portfolio } from "./types";

export interface PortfolioState {
  status: "loading" | "error" | "ready";
  data: Portfolio | null;
}

/** API-surface stub; the fetch-on-mount hook is implemented in the GREEN step. */
export function usePortfolio(): PortfolioState {
  return { status: "loading", data: null };
}
