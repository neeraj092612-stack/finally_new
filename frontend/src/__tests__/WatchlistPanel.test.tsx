import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WatchlistPanel } from "@/components/WatchlistPanel";
import {
  __resetPriceStoreForTests,
  connectPriceStream,
  getTicks,
} from "@/lib/priceStore";
import type { Direction, WatchlistEntry } from "@/lib/types";
import { useWatchlist } from "@/lib/useWatchlist";

const TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"];

function makeEntries(): WatchlistEntry[] {
  return TICKERS.map((ticker, i) => ({
    ticker,
    price: ticker === "AAPL" ? 190.24 : 100 + i,
    previous_price: ticker === "AAPL" ? 189.0 : 100 + i,
    direction: "flat" as Direction,
    day_change_percent: ticker === "AAPL" ? 0.65 : null,
    added_at: `2026-10-04T14:00:0${i}Z`,
  }));
}

function jsonResponse(entries: WatchlistEntry[]): Response {
  return new Response(JSON.stringify({ watchlist: entries }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(entries: WatchlistEntry[] = makeEntries()) {
  const fetchMock = vi.fn(async () => jsonResponse(entries));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function Harness({
  selected = "AAPL",
  onSelect = () => {},
}: {
  selected?: string | null;
  onSelect?: (ticker: string) => void;
}) {
  const watchlist = useWatchlist();
  return <WatchlistPanel {...watchlist} selected={selected} onSelect={onSelect} />;
}

function tickPayload(
  ticker: string,
  price: number,
  timestamp: number,
  direction: Direction,
  dayChangePercent: number | null = null,
) {
  return {
    ticker,
    price,
    previous_price: price,
    timestamp,
    change: 0,
    change_percent: 0,
    direction,
    reference_price: null,
    day_change_percent: dayChangePercent,
  };
}

function openStream(): FakeEventSource {
  act(() => connectPriceStream());
  const es = FakeEventSource.instances[0];
  act(() => es.emitOpen());
  return es;
}

function send(es: FakeEventSource, ...ticks: ReturnType<typeof tickPayload>[]) {
  act(() => es.emitMessage(Object.fromEntries(ticks.map((t) => [t.ticker, t]))));
}

function row(ticker: string): HTMLElement {
  return screen
    .getAllByRole("option")
    .find((el) => el.getAttribute("data-ticker") === ticker) as HTMLElement;
}

async function renderReady(props: Parameters<typeof Harness>[0] = {}) {
  const view = render(<Harness {...props} />);
  await screen.findAllByRole("option");
  return view;
}

beforeEach(() => {
  __resetPriceStoreForTests();
  FakeEventSource.reset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  __resetPriceStoreForTests();
});

describe("WatchlistPanel states", () => {
  it("lists the watched tickers in order inside a labelled listbox with the selected row marked", async () => {
    stubFetch();
    await renderReady({ selected: "AAPL" });

    expect(screen.getByRole("listbox", { name: "Watchlist" })).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.getAttribute("data-ticker"))).toEqual(TICKERS);

    const aapl = row("AAPL");
    expect(aapl).toHaveAttribute("aria-selected", "true");
    expect(aapl).toHaveClass("bg-surface-2");
    expect(aapl.querySelector(".bg-accent")).not.toBeNull();
    expect(aapl).toHaveAttribute("tabindex", "0");

    const msft = row("MSFT");
    expect(msft).toHaveAttribute("aria-selected", "false");
    expect(msft.querySelector(".bg-accent")).toBeNull();
    expect(msft).toHaveAttribute("tabindex", "-1");
    expect(options.filter((o) => o.getAttribute("tabindex") === "0")).toHaveLength(1);
  });

  it("shows 10 skeleton rows and no options while the first fetch is pending", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    render(<Harness />);
    expect(screen.getAllByTestId("skeleton-row")).toHaveLength(10);
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("TICKER")).toBeInTheDocument();
  });

  it("shows the error state and a Retry watchlist action that refetches", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockImplementation(async () => jsonResponse(makeEntries()));
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness />);

    expect(await screen.findByText("Couldn't load the watchlist")).toBeInTheDocument();
    expect(screen.getByText("Check that the FinAlly server is running, then retry.")).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Retry watchlist" }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await screen.findAllByRole("option")).toHaveLength(10);
    expect(screen.queryByText("Couldn't load the watchlist")).not.toBeInTheDocument();
  });

  it("treats a non-2xx response as an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { code: "x", message: "boom" } }), { status: 500 })),
    );
    render(<Harness />);
    expect(await screen.findByText("Couldn't load the watchlist")).toBeInTheDocument();
  });

  it("shows the empty state for zero tickers", async () => {
    stubFetch([]);
    render(<Harness selected={null} />);
    expect(await screen.findByText("No tickers watched")).toBeInTheDocument();
    expect(screen.getByText("Tickers you add will stream here.")).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.queryAllByTestId("skeleton-row")).toHaveLength(0);
  });

  it("renders a single row with the same layout", async () => {
    stubFetch([makeEntries()[0]]);
    await renderReady();
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(row("AAPL")).toHaveClass("h-7");
  });

  it("truncates long symbols and exposes the full symbol in title", async () => {
    const entries = makeEntries();
    entries[1] = { ...entries[1], ticker: "BRK.B.LONGSYM" };
    stubFetch(entries);
    await renderReady();
    const symbol = within(row("BRK.B.LONGSYM")).getByText("BRK.B.LONGSYM");
    expect(symbol).toHaveClass("truncate");
    expect(symbol).toHaveAttribute("title", "BRK.B.LONGSYM");
  });

  it("scrolls the list body at desktop width while the header stays outside it", async () => {
    stubFetch();
    await renderReady();
    expect(screen.getByRole("listbox")).toHaveClass("desk:overflow-y-auto");
    expect(screen.getByRole("listbox")).not.toContainElement(screen.getByText("TICKER"));
  });
});

describe("WatchlistPanel selection", () => {
  it("calls onSelect with the clicked ticker", async () => {
    stubFetch();
    const onSelect = vi.fn();
    await renderReady({ onSelect });
    await userEvent.click(row("MSFT"));
    expect(onSelect).toHaveBeenCalledWith("MSFT");
  });

  it("selects on Enter and Space", async () => {
    stubFetch();
    const onSelect = vi.fn();
    await renderReady({ onSelect });
    act(() => row("AAPL").focus());
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith("AAPL");
    await userEvent.keyboard(" ");
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("moves the selection with ArrowDown and ArrowUp", async () => {
    stubFetch();
    const onSelect = vi.fn();
    await renderReady({ selected: "GOOGL", onSelect });
    act(() => row("GOOGL").focus());
    await userEvent.keyboard("{ArrowDown}");
    expect(onSelect).toHaveBeenLastCalledWith("MSFT");
    await userEvent.keyboard("{ArrowUp}");
    expect(onSelect).toHaveBeenLastCalledWith("AAPL");
  });
});

describe("WatchlistPanel live prices", () => {
  it("shows the REST price until an SSE price replaces it", async () => {
    stubFetch();
    await renderReady();
    expect(within(row("AAPL")).getByText("190.24")).toBeInTheDocument();

    const es = openStream();
    send(es, tickPayload("AAPL", 1234.5, 100, "up"));
    expect(within(row("AAPL")).getByText("1,234.50")).toBeInTheDocument();
    expect(within(row("AAPL")).queryByText("190.24")).not.toBeInTheDocument();
  });

  it("ignores SSE entries for tickers that are not on the watchlist", async () => {
    stubFetch();
    await renderReady();
    const es = openStream();
    send(es, tickPayload("ZZZZ", 50, 100, "up"), tickPayload("AAPL", 191, 100, "up"));
    expect(getTicks("ZZZZ")).toHaveLength(0);
    expect(getTicks("AAPL")).toHaveLength(1);
  });

  it("flashes only the price cell on a new non-flat tick and keeps the up marker", async () => {
    stubFetch();
    await renderReady();
    const es = openStream();
    send(es, tickPayload("AAPL", 191, 100, "flat"));
    send(es, tickPayload("AAPL", 192, 101, "up"));

    const aapl = row("AAPL");
    const price = within(aapl).getByText("192.00");
    expect(price).toHaveClass("flash-up");
    expect(aapl).not.toHaveClass("flash-up");
    expect(aapl.querySelectorAll(".flash-up")).toHaveLength(1);
    expect(within(aapl).getByTestId("price-marker")).toHaveAttribute("data-direction", "up");
  });

  it("does not flash a ticker's first tick, even when its direction is up", async () => {
    stubFetch();
    await renderReady();
    const es = openStream();
    send(es, tickPayload("MSFT", 410, 100, "up"));
    const price = within(row("MSFT")).getByText("410.00");
    expect(price).not.toHaveClass("flash-up");
    expect(price).not.toHaveClass("flash-down");
    expect(within(row("MSFT")).queryByTestId("price-marker")).not.toBeInTheDocument();
  });

  it("does not flash a flat tick that follows the first observation", async () => {
    stubFetch();
    await renderReady();
    const es = openStream();
    send(es, tickPayload("MSFT", 410, 100, "flat"));
    send(es, tickPayload("MSFT", 410, 101, "flat"));
    const price = within(row("MSFT")).getByText("410.00");
    expect(price).not.toHaveClass("flash-up");
    expect(price).not.toHaveClass("flash-down");
    expect(within(row("MSFT")).queryByTestId("price-marker")).not.toBeInTheDocument();
  });

  it("re-triggers the flash on a changing key but not on flat or resent ticks", async () => {
    stubFetch();
    await renderReady();
    const es = openStream();
    send(es, tickPayload("AAPL", 191, 100, "flat"));
    send(es, tickPayload("AAPL", 192, 101, "up"));
    const afterUp = within(row("AAPL")).getByText("192.00");

    // Same timestamp resent in a later event (the stream resends every ticker).
    send(es, tickPayload("AAPL", 192, 101, "up"));
    expect(within(row("AAPL")).getByText("192.00")).toBe(afterUp);

    // Flat tick: price cell is not remounted and the marker persists.
    send(es, tickPayload("AAPL", 192, 102, "flat"));
    expect(within(row("AAPL")).getByText("192.00")).toBe(afterUp);
    expect(within(row("AAPL")).getByTestId("price-marker")).toHaveAttribute("data-direction", "up");

    // A real down tick remounts the span with the down flash.
    send(es, tickPayload("AAPL", 191.5, 103, "down"));
    const afterDown = within(row("AAPL")).getByText("191.50");
    expect(afterDown).not.toBe(afterUp);
    expect(afterDown).toHaveClass("flash-down");
    expect(within(row("AAPL")).getByTestId("price-marker")).toHaveAttribute("data-direction", "down");
  });

  it("mutes prices and suppresses the flash when the stream is not open", async () => {
    stubFetch();
    await renderReady();
    const es = openStream();
    send(es, tickPayload("AAPL", 191, 100, "flat"));
    send(es, tickPayload("AAPL", 192, 101, "up"));
    expect(within(row("AAPL")).getByText("192.00")).toHaveClass("flash-up");

    act(() => es.emitError(2));
    const price = within(row("AAPL")).getByText("192.00");
    expect(price).toHaveClass("text-muted");
    expect(price).not.toHaveClass("flash-up");
  });

  it("shows a muted dash for Price when the REST entry has no price yet", async () => {
    const entries = makeEntries();
    entries[2] = { ...entries[2], price: null, previous_price: null, direction: null, day_change_percent: null };
    stubFetch(entries);
    await renderReady();
    const msft = row("MSFT");
    const dashes = within(msft).getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
    for (const dash of dashes) expect(dash).toHaveClass("text-muted");
    expect(within(msft).queryByText("0.00")).not.toBeInTheDocument();
  });
});
