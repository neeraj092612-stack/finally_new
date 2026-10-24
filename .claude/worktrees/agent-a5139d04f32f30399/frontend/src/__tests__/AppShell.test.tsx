import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/AppShell";
import { __resetPriceStoreForTests } from "@/lib/priceStore";
import type { Direction, WatchlistEntry } from "@/lib/types";

// jsdom has no canvas: the real chart is covered by ChartCanvas.test.tsx.
vi.mock("@/components/ChartClient", () => ({ default: () => null }));

beforeEach(() => {
  __resetPriceStoreForTests();
  FakeEventSource.reset();
  // The header fetches /api/portfolio; keep every AppShell test off the network.
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
});

afterEach(() => {
  __resetPriceStoreForTests();
  vi.unstubAllGlobals();
});

function region(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

// Single-line failure messages (RTL's DOM dump breaks TAP reporting of RED evidence).
function expectText(scope: ReturnType<typeof within>, text: string): void {
  expect(scope.queryAllByText(text).map((el: HTMLElement) => el.textContent)).toContain(text);
}

describe("AppShell price stream", () => {
  it("opens exactly one EventSource to /api/stream/prices", () => {
    render(<AppShell />);
    expect(FakeEventSource.instances.map((es) => es.url).join(",")).toBe("/api/stream/prices");
  });

  it("closes the EventSource on unmount", () => {
    const { unmount } = render(<AppShell />);
    const [source] = FakeEventSource.instances;
    unmount();
    expect(source.readyState).toBe(FakeEventSource.CLOSED);
  });

  it("drives the header dot from the stream: CONNECTING, LIVE, RECONNECTING, OFFLINE", () => {
    render(<AppShell />);
    const [source] = FakeEventSource.instances;
    const status = () => within(screen.getByRole("banner")).getByRole("status").textContent;

    expect(status()).toContain("CONNECTING");
    act(() => source.emitOpen());
    expect(status()).toContain("LIVE");
    act(() => source.emitError(FakeEventSource.CONNECTING));
    expect(status()).toContain("RECONNECTING");
    act(() => source.emitError(FakeEventSource.CLOSED));
    expect(status()).toContain("OFFLINE");
  });
});

describe("AppShell", () => {
  it("shows every panel title", () => {
    render(<AppShell />);
    const titles = ["WATCHLIST", "TRADE", "CHART", "HEATMAP", "P&L", "POSITIONS", "AI CHAT"];
    for (const title of titles) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
  });

  it.each([
    ["Trade", "Trading — coming soon", "Buy and sell shares from this panel."],
    ["Heatmap", "No positions to map", "The heatmap fills in as you build a portfolio."],
    ["P&L", "No P&L history yet", "Portfolio value over time appears here after your first trade."],
    ["Positions", "No positions yet", "Positions appear here once you buy shares."],
    [
      "AI chat",
      "Chat — coming soon",
      "FinAlly, your AI trading assistant, will analyze your portfolio and place trades here.",
    ],
  ])("%s panel shows its empty state", (panel, heading, body) => {
    render(<AppShell />);
    const scope = within(region(panel));
    expectText(scope, heading);
    expectText(scope, body);
  });

  it("positions panel shows the six column headers above the empty state", () => {
    render(<AppShell />);
    const scope = within(region("Positions"));
    for (const header of ["TICKER", "QTY", "AVG COST", "PRICE", "P&L", "% CHG"]) {
      expectText(scope, header);
    }
  });

  it("watchlist body renders 10 skeleton rows", () => {
    render(<AppShell />);
    expect(within(region("Watchlist")).getAllByTestId("skeleton-row")).toHaveLength(10);
  });

  it("chat toggle starts collapsed and expands on click", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    const toggle = screen.queryByRole("button", { name: "Show chat" });
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");

    await user.click(toggle as HTMLElement);

    const expanded = screen.queryByRole("button", { name: "Hide chat" });
    expect(expanded?.getAttribute("aria-expanded")).toBe("true");
  });
});

const TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"];

function makeEntries(tickers: string[] = TICKERS): WatchlistEntry[] {
  return tickers.map((ticker, i) => ({
    ticker,
    price: 100 + i,
    previous_price: 100 + i,
    direction: "flat" as Direction,
    day_change_percent: null,
    added_at: `2026-10-04T14:00:0${i}Z`,
  }));
}

const PORTFOLIO = {
  cash_balance: 10000,
  positions_value: 0,
  total_value: 10000,
  unrealized_pnl: 0,
  positions: [],
};

/** Routes the stubbed fetch by URL: the watchlist body is the only thing tests vary. */
function stubApi(entries: WatchlistEntry[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = String(url).includes("/api/watchlist") ? { watchlist: entries } : PORTFOLIO;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

function chartTitle(): HTMLElement {
  return within(region("Chart")).getByRole("heading", { level: 2 });
}

describe("AppShell watchlist selection", () => {
  it("renders the live watchlist with AAPL selected and the chart titled CHART · AAPL", async () => {
    stubApi(makeEntries());
    render(<AppShell />);

    const options = await within(region("Watchlist")).findAllByRole("option");
    expect(options.map((o) => o.getAttribute("data-ticker"))).toEqual(TICKERS);
    expect(within(region("Watchlist")).queryAllByTestId("skeleton-row")).toHaveLength(0);

    await waitFor(() => expect(options[0]).toHaveAttribute("aria-selected", "true"));
    expect(options.filter((o) => o.getAttribute("aria-selected") === "true")).toHaveLength(1);
    expect(chartTitle().textContent).toBe("CHART · AAPL");
    expect(within(chartTitle()).getByText("AAPL")).toHaveClass("text-accent");
  });

  it("selects a clicked row and retitles the chart", async () => {
    const user = userEvent.setup();
    stubApi(makeEntries());
    render(<AppShell />);
    await waitFor(() => expect(chartTitle().textContent).toBe("CHART · AAPL"));

    const msft = within(region("Watchlist")).getByRole("option", { name: /^MSFT/ });
    await user.click(msft);

    expect(msft).toHaveAttribute("aria-selected", "true");
    expect(chartTitle().textContent).toBe("CHART · MSFT");
    expect(within(chartTitle()).getByText("MSFT")).toHaveClass("text-accent");
  });

  it("shows No tickers watched and a plain CHART title for an empty watchlist", async () => {
    stubApi([]);
    render(<AppShell />);

    expect(await within(region("Watchlist")).findByText("No tickers watched")).toBeInTheDocument();
    expect(chartTitle().textContent).toBe("CHART");
    expect(within(region("Chart")).getByText("Select a ticker to see its chart.")).toBeInTheDocument();
  });

  it("moves the selection with the arrow keys and the chart title follows", async () => {
    const user = userEvent.setup();
    stubApi(makeEntries());
    render(<AppShell />);
    await waitFor(() => expect(chartTitle().textContent).toBe("CHART · AAPL"));

    const aapl = within(region("Watchlist")).getByRole("option", { name: /^AAPL/ });
    act(() => aapl.focus());
    await user.keyboard("{ArrowDown}");

    expect(chartTitle().textContent).toBe("CHART · GOOGL");
    const googl = within(region("Watchlist")).getByRole("option", { name: /^GOOGL/ });
    expect(googl).toHaveFocus();
  });

  it("keeps the header and every other panel's empty state", async () => {
    stubApi(makeEntries());
    render(<AppShell />);
    await waitFor(() => expect(chartTitle().textContent).toBe("CHART · AAPL"));

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expectText(within(region("Positions")), "No positions yet");
    expectText(within(region("Heatmap")), "No positions to map");
    expectText(within(region("Chart")), "Waiting for the first price…");
  });
});
