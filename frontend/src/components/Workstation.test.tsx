import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";
import { MockEventSource, portfolio, priceUpdate, watchlistEntries } from "@/test/fixtures";
import Workstation from "./Workstation";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function mockServer(overrides: Record<string, () => Response> = {}) {
  const routes: Record<string, () => Response> = {
    "GET /api/portfolio": () => json(portfolio),
    "GET /api/portfolio/history": () =>
      json({ snapshots: [{ total_value: 10000, recorded_at: "2026-10-04T14:00:00Z" }] }),
    "GET /api/watchlist": () => json({ watchlist: watchlistEntries }),
    "GET /api/chat": () => json({ messages: [] }),
    ...overrides,
  };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    const handler = routes[key];
    if (!handler) return json({ error: { code: "not_found", message: `No route ${key}` } }, 404);
    return handler();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Workstation", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("loads portfolio and watchlist and revalues the header from live prices", async () => {
    mockServer();
    render(<Workstation />);
    expect(await screen.findByTestId("watchlist-row-AAPL")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("header-total-value")).toHaveTextContent("$10,050.00"));
    expect(screen.getByTestId("header-cash")).toHaveTextContent("$8,087.60");
    expect(screen.getByTestId("main-chart")).toHaveAttribute("data-ticker", "AAPL");
    expect(screen.getByTestId("pnl-chart")).toHaveAttribute("data-points", "2");

    act(() => {
      MockEventSource.latest().open();
      MockEventSource.latest().emit({ AAPL: priceUpdate("AAPL", 200, 196.24) });
    });
    // 8087.60 + 10 × 200
    expect(screen.getByTestId("header-total-value")).toHaveTextContent("$10,087.60");
    expect(screen.getByTestId("connection-status")).toHaveAttribute("data-status", "connected");
  });

  it("refetches the portfolio after a trade", async () => {
    const fetchMock = mockServer({
      "POST /api/portfolio/trade": () =>
        json({
          trade: { id: "t", ticker: "AAPL", side: "buy", quantity: 1, price: 196.24, executed_at: "2026-10-04T14:05:00Z" },
          portfolio,
        }),
    });
    render(<Workstation />);
    await screen.findByTestId("watchlist-row-AAPL");
    await userEvent.type(screen.getByTestId("trade-quantity-input"), "1");
    await userEvent.click(screen.getByTestId("trade-buy-button"));
    await screen.findByTestId("trade-confirmation");
    const portfolioCalls = fetchMock.mock.calls.filter(([u]) => u === "/api/portfolio").length;
    expect(portfolioCalls).toBeGreaterThanOrEqual(2);
  });

  it("selects a newly added ticker", async () => {
    const pypl = { ...watchlistEntries[0], ticker: "PYPL", added_at: "2026-10-04T15:00:00Z" };
    let list = watchlistEntries;
    mockServer({
      "GET /api/watchlist": () => json({ watchlist: list }),
      "POST /api/watchlist": () => {
        list = [...watchlistEntries, pypl];
        return json(pypl, 201);
      },
    });
    render(<Workstation />);
    await userEvent.type(await screen.findByTestId("watchlist-add-input"), "pypl{enter}");
    await screen.findByTestId("watchlist-row-PYPL");
    await waitFor(() => expect(screen.getByTestId("main-chart")).toHaveAttribute("data-ticker", "PYPL"));
  });

  it("selects a watchlist row for the main chart", async () => {
    mockServer();
    render(<Workstation />);
    await userEvent.click(await screen.findByTestId("watchlist-row-MSFT"));
    expect(screen.getByTestId("main-chart")).toHaveAttribute("data-ticker", "MSFT");
    expect(screen.getByTestId("trade-ticker-input")).toHaveValue("MSFT");
  });
});

describe("api client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("turns the error envelope into an ApiError", async () => {
    mockServer({
      "POST /api/portfolio/trade": () =>
        json({ error: { code: "insufficient_cash", message: "Need $1,912.40 but only $850.00 is available." } }, 400),
    });
    const err = await api.trade("AAPL", 10, "buy").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("insufficient_cash");
    expect(err.status).toBe(400);
    expect(err.message).toBe("Need $1,912.40 but only $850.00 is available.");
  });

  it("handles 204 on delete", async () => {
    mockServer({ "DELETE /api/watchlist/AAPL": () => new Response(null, { status: 204 }) });
    await expect(api.removeTicker("AAPL")).resolves.toBeUndefined();
  });
});
