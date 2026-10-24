import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainChartPanel } from "@/components/MainChartPanel";
import { __resetPriceStoreForTests, connectPriceStream } from "@/lib/priceStore";
import type { Direction } from "@/lib/types";

// The dynamic import of the canvas is not under test here; a stub records the props.
vi.mock("@/components/ChartClient", () => ({
  default: ({ ticker, dimmed }: { ticker: string; dimmed: boolean }) => (
    <div data-testid="chart-client" data-ticker={ticker} data-dimmed={String(dimmed)} />
  ),
}));

function tickPayload(ticker: string, price: number, timestamp: number, direction: Direction) {
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

function panel(): HTMLElement {
  return screen.getByRole("region", { name: "Chart" });
}

function title(): HTMLElement {
  return within(panel()).getByRole("heading", { level: 2 });
}

beforeEach(() => {
  __resetPriceStoreForTests();
  FakeEventSource.reset();
});

afterEach(() => {
  __resetPriceStoreForTests();
});

describe("MainChartPanel without a ticker", () => {
  it("titles the panel CHART and asks for a selection", () => {
    render(<MainChartPanel ticker={null} />);
    expect(title().textContent).toBe("CHART");
    expect(within(panel()).getByText("Select a ticker to see its chart.")).toBeInTheDocument();
    expect(within(panel()).queryByTestId("chart-strip")).toBeNull();
  });
});

describe("MainChartPanel with a ticker and no ticks", () => {
  it("titles the panel CHART · AAPL with the ticker in the accent class", () => {
    render(<MainChartPanel ticker="AAPL" />);
    expect(title().textContent).toBe("CHART · AAPL");
    expect(within(title()).getByText("AAPL")).toHaveClass("text-accent");
  });

  it("shows the waiting overlay and a strip of dashes", () => {
    render(<MainChartPanel ticker="AAPL" />);
    expect(within(panel()).getByText("Waiting for the first price…")).toBeInTheDocument();
    expect(within(panel()).queryByText("Select a ticker to see its chart.")).toBeNull();
    const strip = within(panel()).getByTestId("chart-strip");
    expect(within(strip).getByText("AAPL")).toBeInTheDocument();
    expect(within(strip).getByTestId("strip-price").textContent).toBe("—");
    expect(within(strip).getByTestId("strip-change").textContent).toBe("—");
    expect(within(strip).getByTestId("strip-high").textContent).toBe("—");
    expect(within(strip).getByTestId("strip-low").textContent).toBe("—");
  });
});

describe("MainChartPanel strip with live ticks", () => {
  it("shows the live price, change since page load, and session high and low", () => {
    render(<MainChartPanel ticker="AAPL" />);
    const es = openStream();
    send(es, tickPayload("AAPL", 190.0, 100, "flat"));
    send(es, tickPayload("AAPL", 191.24, 101, "up"));
    send(es, tickPayload("AAPL", 189.9, 102, "down"));

    const strip = within(panel()).getByTestId("chart-strip");
    expect(within(strip).getByTestId("strip-price").textContent).toBe("189.90");
    const change = within(strip).getByTestId("strip-change");
    expect(change.textContent).toBe("-0.10 (-0.05%)");
    expect(change).toHaveClass("text-down");
    expect(within(strip).getByText("H")).toBeInTheDocument();
    expect(within(strip).getByTestId("strip-high").textContent).toBe("191.24");
    expect(within(strip).getByText("L")).toBeInTheDocument();
    expect(within(strip).getByTestId("strip-low").textContent).toBe("189.90");
    expect(within(panel()).queryByText("Waiting for the first price…")).toBeNull();
  });

  it("colors a positive change up and a zero change muted", () => {
    render(<MainChartPanel ticker="AAPL" />);
    const es = openStream();
    send(es, tickPayload("AAPL", 190.0, 100, "flat"));
    expect(within(panel()).getByTestId("strip-change")).toHaveClass("text-muted");
    send(es, tickPayload("AAPL", 191.9, 101, "up"));
    const change = within(panel()).getByTestId("strip-change");
    expect(change.textContent).toBe("+1.90 (+1.00%)");
    expect(change).toHaveClass("text-up");
  });

  it("never puts a flash class on the live price", () => {
    render(<MainChartPanel ticker="AAPL" />);
    const es = openStream();
    send(es, tickPayload("AAPL", 190.0, 100, "flat"));
    send(es, tickPayload("AAPL", 191.0, 101, "up"));
    const price = within(panel()).getByTestId("strip-price");
    expect(price.className).not.toMatch(/flash/);
    expect(panel().querySelector(".flash-up, .flash-down")).toBeNull();
  });

  it("ignores ticks of other tickers", () => {
    render(<MainChartPanel ticker="AAPL" />);
    const es = openStream();
    send(es, tickPayload("MSFT", 410, 100, "flat"));
    expect(within(panel()).getByText("Waiting for the first price…")).toBeInTheDocument();
    expect(within(panel()).getByTestId("strip-price").textContent).toBe("—");
  });
});

describe("MainChartPanel chart canvas", () => {
  it("mounts no canvas without a ticker", () => {
    render(<MainChartPanel ticker={null} />);
    expect(screen.queryByTestId("chart-client")).toBeNull();
  });

  it("mounts the canvas for the selected ticker, dimmed until the stream is open", () => {
    render(<MainChartPanel ticker="AAPL" />);
    const canvas = screen.getByTestId("chart-client");
    expect(canvas).toHaveAttribute("data-ticker", "AAPL");
    expect(canvas).toHaveAttribute("data-dimmed", "true");

    const es = openStream();
    expect(screen.getByTestId("chart-client")).toHaveAttribute("data-dimmed", "false");

    act(() => es.emitError(2));
    expect(screen.getByTestId("chart-client")).toHaveAttribute("data-dimmed", "true");
  });

  it("keeps the canvas mounted under the waiting overlay", () => {
    render(<MainChartPanel ticker="AAPL" />);
    expect(screen.getByText("Waiting for the first price…")).toBeInTheDocument();
    expect(screen.getByTestId("chart-client")).toBeInTheDocument();
  });
});
