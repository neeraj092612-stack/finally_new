import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetPriceStoreForTests,
  connectPriceStream,
  disconnectPriceStream,
  getServerSnapshot,
  getSnapshot,
  getTicks,
  onTick,
  setWatchedTickers,
  subscribe,
} from "@/lib/priceStore";
import type { Direction, PriceTick } from "@/lib/types";

function tick(
  ticker: string,
  price: number,
  timestamp: number,
  direction: Direction,
  extra: Partial<PriceTick> = {},
): PriceTick {
  return {
    ticker,
    price,
    previous_price: price,
    timestamp,
    change: 0,
    change_percent: 0,
    direction,
    reference_price: null,
    day_change_percent: null,
    ...extra,
  };
}

function current(): FakeEventSource {
  const list = FakeEventSource.instances;
  return list[list.length - 1] as FakeEventSource;
}

beforeEach(() => {
  FakeEventSource.reset();
  __resetPriceStoreForTests();
});

afterEach(() => {
  disconnectPriceStream();
  vi.useRealTimers();
});

describe("connection lifecycle", () => {
  it("opens exactly one EventSource to /api/stream/prices when connected twice", () => {
    connectPriceStream();
    connectPriceStream();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(current().url).toBe("/api/stream/prices");
  });

  it("leaves exactly one live EventSource after connect, disconnect, connect (StrictMode)", () => {
    connectPriceStream();
    disconnectPriceStream();
    connectPriceStream();
    const live = FakeEventSource.instances.filter((i) => i.readyState !== FakeEventSource.CLOSED);
    expect(live).toHaveLength(1);
  });

  it("starts connecting with hasOpened false, then open with hasOpened true", () => {
    connectPriceStream();
    expect(getSnapshot().connection).toBe("connecting");
    expect(getSnapshot().hasOpened).toBe(false);
    current().emitOpen();
    expect(getSnapshot().connection).toBe("open");
    expect(getSnapshot().hasOpened).toBe(true);
  });

  it("reports connecting with hasOpened true when the browser is retrying after an open", () => {
    connectPriceStream();
    current().emitOpen();
    current().emitError(FakeEventSource.CONNECTING);
    expect(getSnapshot().connection).toBe("connecting");
    expect(getSnapshot().hasOpened).toBe(true);
  });

  it("recreates the EventSource after 2000 ms on CLOSED, then 3000 ms, capped at 10000 ms", () => {
    vi.useFakeTimers();
    connectPriceStream();
    current().emitError(FakeEventSource.CLOSED);
    expect(getSnapshot().connection).toBe("closed");
    expect(FakeEventSource.instances).toHaveLength(1);

    vi.advanceTimersByTime(1999);
    expect(FakeEventSource.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeEventSource.instances).toHaveLength(2);

    current().emitError(FakeEventSource.CLOSED);
    vi.advanceTimersByTime(2999);
    expect(FakeEventSource.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeEventSource.instances).toHaveLength(3);

    // 2000 -> 3000 -> 4500 -> 6750 -> 10000 (cap)
    const waits = [4500, 6750, 10000, 10000];
    let count = 3;
    for (const wait of waits) {
      current().emitError(FakeEventSource.CLOSED);
      vi.advanceTimersByTime(wait - 1);
      expect(FakeEventSource.instances).toHaveLength(count);
      vi.advanceTimersByTime(1);
      count += 1;
      expect(FakeEventSource.instances).toHaveLength(count);
    }
  });

  it("resets the reconnect delay to 2000 ms after an open", () => {
    vi.useFakeTimers();
    connectPriceStream();
    current().emitError(FakeEventSource.CLOSED);
    vi.advanceTimersByTime(2000);
    current().emitError(FakeEventSource.CLOSED);
    vi.advanceTimersByTime(3000);
    expect(FakeEventSource.instances).toHaveLength(3);

    current().emitOpen();
    current().emitError(FakeEventSource.CLOSED);
    vi.advanceTimersByTime(1999);
    expect(FakeEventSource.instances).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(FakeEventSource.instances).toHaveLength(4);
  });

  it("does not reconnect after disconnectPriceStream", () => {
    vi.useFakeTimers();
    connectPriceStream();
    current().emitError(FakeEventSource.CLOSED);
    disconnectPriceStream();
    vi.advanceTimersByTime(20000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});

describe("ingest rules", () => {
  beforeEach(() => {
    connectPriceStream();
    current().emitOpen();
  });

  it("stores the first observation without a flash or marker", () => {
    current().emitMessage({ AAPL: tick("AAPL", 190, 100, "up") });
    const snap = getSnapshot();
    expect(snap.latest.AAPL?.price).toBe(190);
    expect(snap.flash.AAPL).toBeUndefined();
    expect(snap.marker.AAPL).toBeUndefined();
  });

  it("flashes and marks a later non-flat tick, and ignores a later flat tick", () => {
    current().emitMessage({ AAPL: tick("AAPL", 190, 100, "up") });
    current().emitMessage({ AAPL: tick("AAPL", 189, 101, "down") });
    expect(getSnapshot().flash.AAPL).toEqual({ seq: 1, dir: "down" });
    expect(getSnapshot().marker.AAPL).toBe("down");

    current().emitMessage({ AAPL: tick("AAPL", 189, 102, "flat") });
    expect(getSnapshot().flash.AAPL).toEqual({ seq: 1, dir: "down" });
    expect(getSnapshot().marker.AAPL).toBe("down");
    expect(getSnapshot().latest.AAPL?.timestamp).toBe(102);
  });

  it("increments the flash sequence on each further non-flat tick", () => {
    current().emitMessage({ AAPL: tick("AAPL", 190, 100, "up") });
    current().emitMessage({ AAPL: tick("AAPL", 191, 101, "up") });
    current().emitMessage({ AAPL: tick("AAPL", 192, 102, "up") });
    expect(getSnapshot().flash.AAPL).toEqual({ seq: 2, dir: "up" });
  });

  it("ignores an entry whose timestamp is not newer and leaves the version unchanged", () => {
    current().emitMessage({ AAPL: tick("AAPL", 190, 100, "up") });
    current().emitMessage({ AAPL: tick("AAPL", 191, 101, "up") });
    const before = getSnapshot();
    current().emitMessage({ AAPL: tick("AAPL", 191, 101, "up") });
    current().emitMessage({ AAPL: tick("AAPL", 150, 99, "down") });
    expect(getSnapshot().version).toBe(before.version);
    expect(getSnapshot()).toBe(before);
    expect(getSnapshot().flash.AAPL?.seq).toBe(1);
  });

  it("does not re-flash tickers resent unchanged alongside a moving ticker", () => {
    current().emitMessage({ AAPL: tick("AAPL", 190, 100, "up"), MSFT: tick("MSFT", 400, 100, "up") });
    current().emitMessage({ AAPL: tick("AAPL", 191, 101, "up"), MSFT: tick("MSFT", 400, 100, "up") });
    expect(getSnapshot().flash.AAPL?.seq).toBe(1);
    expect(getSnapshot().flash.MSFT).toBeUndefined();
  });

  it("drops entries whose price is not a finite number", () => {
    current().emitMessage({
      AAPL: { ...tick("AAPL", 190, 100, "up"), price: "abc" },
      MSFT: { ...tick("MSFT", 400, 100, "up"), price: null },
      NVDA: { ...tick("NVDA", 900, 100, "up"), price: Number.POSITIVE_INFINITY },
      TSLA: tick("TSLA", 250, 100, "up"),
    });
    const snap = getSnapshot();
    expect(Object.keys(snap.latest)).toEqual(["TSLA"]);
  });

  it("ignores malformed JSON without throwing", () => {
    const es = current();
    expect(() => es.onmessage?.(new MessageEvent("message", { data: "{not json" }))).not.toThrow();
    expect(() => es.onmessage?.(new MessageEvent("message", { data: "null" }))).not.toThrow();
    expect(Object.keys(getSnapshot().latest)).toHaveLength(0);
  });

  it("filters to the watched set and accepts all when the set is null", () => {
    setWatchedTickers(["AAPL"]);
    current().emitMessage({ AAPL: tick("AAPL", 190, 100, "up"), MSFT: tick("MSFT", 400, 100, "up") });
    expect(Object.keys(getSnapshot().latest)).toEqual(["AAPL"]);
    expect(getTicks("MSFT")).toHaveLength(0);

    setWatchedTickers(null);
    current().emitMessage({ AAPL: tick("AAPL", 191, 101, "up"), MSFT: tick("MSFT", 401, 101, "up") });
    expect(Object.keys(getSnapshot().latest).sort()).toEqual(["AAPL", "MSFT"]);
  });

  it("tracks session first, high, low and last", () => {
    current().emitMessage({ AAPL: tick("AAPL", 190, 100, "up") });
    current().emitMessage({ AAPL: tick("AAPL", 195, 101, "up") });
    current().emitMessage({ AAPL: tick("AAPL", 185, 102, "down") });
    current().emitMessage({ AAPL: tick("AAPL", 188, 103, "up") });
    expect(getSnapshot().session.AAPL).toEqual({ first: 190, high: 195, low: 185, last: 188 });
  });

  it("carries the SSE day_change_percent on the latest tick", () => {
    current().emitMessage({
      AAPL: tick("AAPL", 190, 100, "up", { reference_price: 188.5, day_change_percent: 0.8 }),
    });
    expect(getSnapshot().latest.AAPL?.day_change_percent).toBe(0.8);
  });
});

describe("tick buffers", () => {
  it("caps a ticker at 50,000 points, drops the oldest chunk and keeps the true session first", () => {
    connectPriceStream();
    current().emitOpen();
    const total = 50_001;
    for (let i = 0; i < total; i++) {
      current().emitMessage({ AAPL: tick("AAPL", 100 + i, 1000 + i, "up") });
    }
    const ticks = getTicks("AAPL");
    expect(ticks.length).toBeLessThanOrEqual(50_000);
    expect(ticks.length).toBeGreaterThan(40_000);
    expect(ticks[ticks.length - 1]).toEqual({ ts: 1000 + total - 1, price: 100 + total - 1 });
    expect(getSnapshot().session.AAPL?.first).toBe(100);
    expect(getSnapshot().session.AAPL?.last).toBe(100 + total - 1);
  });

  it("returns accumulated ticks oldest first", () => {
    connectPriceStream();
    current().emitOpen();
    current().emitMessage({ AAPL: tick("AAPL", 190, 100, "up") });
    current().emitMessage({ AAPL: tick("AAPL", 191, 101, "up") });
    expect(getTicks("AAPL")).toEqual([
      { ts: 100, price: 190 },
      { ts: 101, price: 191 },
    ]);
    expect(getTicks("UNKNOWN")).toEqual([]);
  });
});

describe("subscriptions", () => {
  it("onTick delivers each new tick for its ticker and stops after unsubscribe", () => {
    connectPriceStream();
    current().emitOpen();
    const cb = vi.fn();
    const off = onTick("AAPL", cb);
    current().emitMessage({ AAPL: tick("AAPL", 190, 100, "up"), MSFT: tick("MSFT", 400, 100, "up") });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ ts: 100, price: 190 });
    off();
    current().emitMessage({ AAPL: tick("AAPL", 191, 101, "up") });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers once per accepted message and not for ignored ones", () => {
    connectPriceStream();
    current().emitOpen();
    const listener = vi.fn();
    const off = subscribe(listener);
    current().emitMessage({ AAPL: tick("AAPL", 190, 100, "up"), MSFT: tick("MSFT", 400, 100, "up") });
    expect(listener).toHaveBeenCalledTimes(1);
    current().emitMessage({ AAPL: tick("AAPL", 190, 100, "up") });
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    current().emitMessage({ AAPL: tick("AAPL", 191, 101, "up") });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns the identical snapshot object between calls with no change", () => {
    connectPriceStream();
    current().emitOpen();
    current().emitMessage({ AAPL: tick("AAPL", 190, 100, "up") });
    expect(getSnapshot()).toBe(getSnapshot());
  });

  it("returns a constant server snapshot in the initial state", () => {
    expect(getServerSnapshot()).toBe(getServerSnapshot());
    expect(getServerSnapshot().connection).toBe("connecting");
    expect(getServerSnapshot().hasOpened).toBe(false);
    expect(getServerSnapshot().latest).toEqual({});
  });
});
