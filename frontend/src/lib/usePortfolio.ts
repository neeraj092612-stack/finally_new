import { useEffect, useState } from "react";
import { fetchPortfolio } from "./api";
import type { Portfolio } from "./types";

export interface PortfolioState {
  status: "loading" | "error" | "ready";
  data: Portfolio | null;
}

const LOADING: PortfolioState = { status: "loading", data: null };

/** GET /api/portfolio once on mount; the result is ignored if the component unmounts first. */
export function usePortfolio(): PortfolioState {
  const [state, setState] = useState<PortfolioState>(LOADING);

  useEffect(() => {
    let cancelled = false;
    fetchPortfolio().then(
      (data) => {
        if (!cancelled) setState({ status: "ready", data });
      },
      () => {
        // The cause is deliberately dropped: the header shows a fixed caption (T-01-29).
        if (!cancelled) setState({ status: "error", data: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
