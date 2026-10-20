/**
 * Module-singleton SSE price store. One EventSource feeds every live panel, so the
 * page opens a single connection and every panel agrees on flash and marker rules.
 * History lives only in the browser (D-20); nothing here touches window, EventSource
 * or fetch at module load, because the static prerender imports this module at build time.
 */
import { useSyncExternalStore } from "react";
import type { PriceStoreSnapshot, PriceTick, SessionStats, TickPoint } from "./types";

const DEFAULT_URL = "/api/stream/prices";
/** Per-ticker buffer cap; the oldest TRIM_CHUNK points go when it is exceeded. */
const MAX_TICKS = 50_000;
const TRIM_CHUNK = 1_000;
const INITIAL_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 10_000;
const BACKOFF_FACTOR = 1.5;
/** EventSource.readyState values; literals so no global is touched at module load. */
const READY_CONNECTING = 0;
const READY_CLOSED = 2;

const INITIAL_SNAPSHOT: PriceStoreSnapshot = Object.freeze({
  version: 0,
  connection: "connecting",
  hasOpened: false,
  latest: Object.freeze({}),
  flash: Object.freeze({}),
  marker: Object.freeze({}),
  session: Object.freeze({}),
}) as PriceStoreSnapshot;

const EMPTY_TICKS: readonly TickPoint[] = Object.freeze([]);

// --- State ---

let snapshot: PriceStoreSnapshot = INITIAL_SNAPSHOT;
const listeners = new Set<() => void>();
const tickListeners = new Map<string, Set<(tick: TickPoint) => void>>();
const buffers = new Map<string, TickPoint[]>();
let watched: Set<string> | null = null;

let source: EventSource | null = null;
let streamUrl = DEFAULT_URL;
let wanted = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let backoff = INITIAL_BACKOFF_MS;

// --- Public API ---

/** Open the price stream; idempotent while a stream exists or a reconnect is pending. */
export function connectPriceStream(url: string = DEFAULT_URL): void {
  if (typeof window === "undefined") return;
  streamUrl = url;
  wanted = true;
  if (source) return;
  clearReconnectTimer();
  openStream();
}

/** Close the stream and cancel any pending reconnect. */
export function disconnectPriceStream(): void {
  wanted = false;
  clearReconnectTimer();
  if (source) {
    source.close();
    source = null;
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): PriceStoreSnapshot {
  return snapshot;
}

/** Constant initial snapshot for the static prerender. */
export function getServerSnapshot(): PriceStoreSnapshot {
  return INITIAL_SNAPSHOT;
}

/** Every tick since page load, oldest first (capped at 50,000). Do not mutate. */
export function getTicks(ticker: string): readonly TickPoint[] {
  return buffers.get(ticker) ?? EMPTY_TICKS;
}

/** Call back for each accepted tick of one ticker; returns an unsubscribe. */
export function onTick(ticker: string, cb: (tick: TickPoint) => void): () => void {
  let set = tickListeners.get(ticker);
  if (!set) {
    set = new Set();
    tickListeners.set(ticker, set);
  }
  set.add(cb);
  return () => {
    tickListeners.get(ticker)?.delete(cb);
  };
}

/** Restrict ingestion to these tickers; null accepts everything. */
export function setWatchedTickers(tickers: string[] | null): void {
  watched = tickers === null ? null : new Set(tickers);
}

export function usePriceStream(): PriceStoreSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Reset every module-level value (tests only). */
export function __resetPriceStoreForTests(): void {
  disconnectPriceStream();
  snapshot = INITIAL_SNAPSHOT;
  listeners.clear();
  tickListeners.clear();
  buffers.clear();
  watched = null;
  streamUrl = DEFAULT_URL;
  backoff = INITIAL_BACKOFF_MS;
}

// --- Internals ---

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function emit(): void {
  for (const listener of [...listeners]) listener();
}

function update(patch: Partial<Omit<PriceStoreSnapshot, "version">>): void {
  snapshot = { ...snapshot, ...patch, version: snapshot.version + 1 };
  emit();
}

function openStream(): void {
  const es = new EventSource(streamUrl);
  source = es;

  es.onopen = () => {
    if (source !== es) return;
    backoff = INITIAL_BACKOFF_MS;
    update({ connection: "open", hasOpened: true });
  };

  es.onerror = () => {
    if (source !== es) return;
    if (es.readyState === READY_CONNECTING) {
      // The browser is retrying on its own (the stream sends `retry: 1000`).
      update({ connection: "connecting" });
      return;
    }
    if (es.readyState === READY_CLOSED) {
      es.close();
      source = null;
      update({ connection: "closed" });
      if (wanted) {
        const delay = backoff;
        backoff = Math.min(backoff * BACKOFF_FACTOR, MAX_BACKOFF_MS);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (wanted && !source) openStream();
        }, delay);
      }
    }
  };

  es.onmessage = (event: MessageEvent) => {
    if (source !== es) return;
    ingest(event.data);
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function ingest(raw: unknown): void {
  let payload: unknown;
  try {
    payload = JSON.parse(String(raw));
  } catch {
    return;
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return;

  let latest = snapshot.latest;
  let flash = snapshot.flash;
  let marker = snapshot.marker;
  let session = snapshot.session;
  let changed = false;
  const accepted: Array<[string, TickPoint]> = [];

  for (const [ticker, entry] of Object.entries(payload)) {
    if (watched !== null && !watched.has(ticker)) continue;
    if (typeof entry !== "object" || entry === null) continue;
    const tick = entry as PriceTick;
    if (!isFiniteNumber(tick.price) || !isFiniteNumber(tick.timestamp)) continue;

    // Every event resends all tickers; only a newer timestamp is a real new tick.
    const prev = latest[ticker];
    if (prev && !(tick.timestamp > prev.timestamp)) continue;

    if (!changed) {
      latest = { ...latest };
      flash = { ...flash };
      marker = { ...marker };
      session = { ...session };
      changed = true;
    }

    const point: TickPoint = { ts: tick.timestamp, price: tick.price };
    pushTick(ticker, point);
    latest[ticker] = { ...tick, ticker };
    session[ticker] = nextSession(session[ticker], tick.price);

    // No flash on the first observation; marker persists through flat ticks (OQ-1, D-07).
    if (prev && (tick.direction === "up" || tick.direction === "down")) {
      flash[ticker] = { seq: (flash[ticker]?.seq ?? 0) + 1, dir: tick.direction };
      marker[ticker] = tick.direction;
    }
    accepted.push([ticker, point]);
  }

  if (!changed) return;
  update({ latest, flash, marker, session });
  for (const [ticker, point] of accepted) {
    const set = tickListeners.get(ticker);
    if (!set) continue;
    for (const cb of [...set]) {
      try {
        cb(point);
      } catch {
        // A faulty subscriber must not break ingestion for the others.
      }
    }
  }
}

function pushTick(ticker: string, point: TickPoint): void {
  let buffer = buffers.get(ticker);
  if (!buffer) {
    buffer = [];
    buffers.set(ticker, buffer);
  }
  buffer.push(point);
  // Trim in one chunk so the cost is not O(n) per tick.
  if (buffer.length > MAX_TICKS) buffer.splice(0, TRIM_CHUNK);
}

function nextSession(prev: SessionStats | undefined, price: number): SessionStats {
  if (!prev) return { first: price, high: price, low: price, last: price };
  return {
    first: prev.first,
    high: Math.max(prev.high, price),
    low: Math.min(prev.low, price),
    last: price,
  };
}
