"use client";

import { useEffect, useRef, useState } from "react";
import type { PriceMap } from "@/lib/types";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

export interface PricePoint {
  time: number; // Unix seconds (float)
  value: number;
}

/** Ticks kept per ticker (~30 min at 500ms). */
export const MAX_HISTORY = 3600;
const MANUAL_RETRY_MS = 3000;

/** EventSource.readyState → indicator state (TEAM_CONTRACT §2 item 30). */
export function statusFromReadyState(readyState: number): ConnectionStatus {
  if (readyState === 1) return "connected"; // OPEN
  if (readyState === 0) return "reconnecting"; // CONNECTING
  return "disconnected"; // CLOSED
}

/**
 * Subscribes to `/api/stream/prices`. `history` is a stable, mutable map of
 * per-ticker ticks accumulated since page load; `version` increments on each
 * event so consumers can re-render.
 */
export function usePriceStream(url = "/api/stream/prices") {
  const [prices, setPrices] = useState<PriceMap>({});
  const [status, setStatus] = useState<ConnectionStatus>("reconnecting");
  const [version, setVersion] = useState(0);
  const historyRef = useRef<Record<string, PricePoint[]>>({});

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      setStatus("disconnected");
      return;
    }
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = () => {
      es = new EventSource(url);
      setStatus(statusFromReadyState(es.readyState));

      es.onopen = () => {
        if (es) setStatus(statusFromReadyState(es.readyState));
      };

      es.onerror = () => {
        if (!es) return;
        const s = statusFromReadyState(es.readyState);
        setStatus(s);
        // The browser retries on its own while CONNECTING; once CLOSED it gives up,
        // so open a fresh connection after a pause.
        if (s === "disconnected" && !disposed && !retryTimer) {
          es.close();
          retryTimer = setTimeout(() => {
            retryTimer = null;
            if (!disposed) connect();
          }, MANUAL_RETRY_MS);
        }
      };

      es.onmessage = (event: MessageEvent<string>) => {
        let data: PriceMap;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        const history = historyRef.current;
        for (const [ticker, update] of Object.entries(data)) {
          const arr = (history[ticker] ??= []);
          const last = arr[arr.length - 1];
          if (!last || last.time !== update.timestamp) {
            arr.push({ time: update.timestamp, value: update.price });
            if (arr.length > MAX_HISTORY) arr.splice(0, arr.length - MAX_HISTORY);
          }
        }
        setPrices((prev) => ({ ...prev, ...data }));
        setStatus("connected");
        setVersion((v) => v + 1);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [url]);

  return { prices, status, history: historyRef.current, version };
}
