import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, fetchPortfolio, fetchWatchlist } from "@/lib/api";
import type { Portfolio, WatchlistEntry } from "@/lib/types";

function stubFetch(response: Response) {
  const fn = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPortfolio", () => {
  it("returns the parsed portfolio from /api/portfolio", async () => {
    const portfolio: Portfolio = {
      cash_balance: 10000,
      positions_value: 0,
      total_value: 10000,
      unrealized_pnl: 0,
      positions: [],
    };
    const fn = stubFetch(json(portfolio));
    await expect(fetchPortfolio()).resolves.toEqual(portfolio);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0]?.[0]).toBe("/api/portfolio");
  });

  it("throws ApiRequestError with the envelope code and message on a 404", async () => {
    stubFetch(
      json({ error: { code: "not_found", message: "No API endpoint at this path." } }, 404),
    );
    const err = await fetchPortfolio().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    const apiErr = err as ApiRequestError;
    expect(apiErr.status).toBe(404);
    expect(apiErr.code).toBe("not_found");
    expect(apiErr.message).toBe("No API endpoint at this path.");
  });

  it("throws ApiRequestError with a null code on a non-JSON 500", async () => {
    stubFetch(new Response("<html>boom</html>", { status: 500 }));
    const err = await fetchPortfolio().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    const apiErr = err as ApiRequestError;
    expect(apiErr.status).toBe(500);
    expect(apiErr.code).toBeNull();
    expect(apiErr.message.length).toBeGreaterThan(0);
  });
});

describe("fetchWatchlist", () => {
  it("returns the watchlist array from /api/watchlist", async () => {
    const entries: WatchlistEntry[] = [
      {
        ticker: "AAPL",
        price: 191.24,
        previous_price: 191.1,
        direction: "up",
        day_change_percent: 0.65,
        added_at: "2026-10-04T14:00:00Z",
      },
      {
        ticker: "PYPL",
        price: null,
        previous_price: null,
        direction: null,
        day_change_percent: null,
        added_at: "2026-10-04T14:01:00Z",
      },
    ];
    const fn = stubFetch(json({ watchlist: entries }));
    await expect(fetchWatchlist()).resolves.toEqual(entries);
    expect(fn.mock.calls[0]?.[0]).toBe("/api/watchlist");
  });

  it("throws ApiRequestError with the envelope code and message on a 404", async () => {
    stubFetch(
      json({ error: { code: "not_found", message: "No API endpoint at this path." } }, 404),
    );
    const err = await fetchWatchlist().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    const apiErr = err as ApiRequestError;
    expect(apiErr.status).toBe(404);
    expect(apiErr.code).toBe("not_found");
    expect(apiErr.message).toBe("No API endpoint at this path.");
  });

  it("throws ApiRequestError with a null code on a non-JSON 500", async () => {
    stubFetch(new Response("oops", { status: 500 }));
    const err = await fetchWatchlist().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect((err as ApiRequestError).status).toBe(500);
    expect((err as ApiRequestError).code).toBeNull();
  });
});
