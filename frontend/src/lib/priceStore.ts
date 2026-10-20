/** Module-singleton SSE price store (RED skeleton: API surface only, no behavior yet). */
import type { PriceStoreSnapshot, TickPoint } from "./types";

const INITIAL: PriceStoreSnapshot = {
  version: 0,
  connection: "connecting",
  hasOpened: false,
  latest: {},
  flash: {},
  marker: {},
  session: {},
};

export function connectPriceStream(url = "/api/stream/prices"): void {
  new EventSource(url);
}

export function disconnectPriceStream(): void {}

export function subscribe(_listener: () => void): () => void {
  return () => {};
}

export function getSnapshot(): PriceStoreSnapshot {
  return INITIAL;
}

export function getServerSnapshot(): PriceStoreSnapshot {
  return INITIAL;
}

export function getTicks(_ticker: string): readonly TickPoint[] {
  return [];
}

export function onTick(_ticker: string, _cb: (tick: TickPoint) => void): () => void {
  return () => {};
}

export function setWatchedTickers(_tickers: string[] | null): void {}

export function usePriceStream(): PriceStoreSnapshot {
  return INITIAL;
}

export function __resetPriceStoreForTests(): void {}
