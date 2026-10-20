import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/Header";
import { __resetPriceStoreForTests, connectPriceStream } from "@/lib/priceStore";

function pendingFetch(): void {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
}

function currentSource(): FakeEventSource {
  const source = FakeEventSource.instances.at(-1);
  if (!source) throw new Error("no EventSource was created");
  return source;
}

const AAPL_POSITION = {
  ticker: "AAPL",
  quantity: 10,
  avg_cost: 191.24,
  current_price: 196.24,
  market_value: 1962.4,
  unrealized_pnl: 50,
  unrealized_pnl_percent: 2.61,
};

function portfolioBody(cash: number, positions: Array<typeof AAPL_POSITION> = []) {
  const positionsValue = positions.reduce((sum, p) => sum + p.market_value, 0);
  return {
    cash_balance: cash,
    positions_value: positionsValue,
    total_value: cash + positionsValue,
    unrealized_pnl: 0,
    positions,
  };
}

function stubFetchOk(body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))),
  );
}

function tick(ticker: string, price: number, timestamp: number) {
  return {
    [ticker]: {
      ticker,
      price,
      previous_price: price,
      timestamp,
      change: 0,
      change_percent: 0,
      direction: "flat",
      reference_price: null,
      day_change_percent: null,
    },
  };
}

// waitFor with a single-line timeout error (RTL's DOM dump breaks TAP reporting of RED evidence).
function eventually(assertion: () => void): Promise<void> {
  return waitFor(assertion, {
    timeout: 1000,
    onTimeout: (error) => new Error((error?.message ?? "timed out").split("\n")[0]),
  });
}

function textOf(testId: string): string {
  return screen.getByTestId(testId).textContent ?? "";
}

function classesOf(testId: string): string {
  return screen.getByTestId(testId).className;
}

describe("Header portfolio values", () => {
  beforeEach(() => {
    __resetPriceStoreForTests();
    FakeEventSource.reset();
  });

  afterEach(() => {
    __resetPriceStoreForTests();
    vi.unstubAllGlobals();
  });

  it("shows cash and total as $10,000.00 in the text color for an empty portfolio", async () => {
    stubFetchOk(portfolioBody(10000));
    render(<Header />);
    await eventually(() => expect(textOf("total-value")).toBe("$10,000.00"));
    expect(textOf("cash-value")).toBe("$10,000.00");
    expect(classesOf("total-value")).toContain("text-text");
  });

  it("colors the live total up above $10,000.00 and down below it", async () => {
    stubFetchOk(portfolioBody(8087.6, [AAPL_POSITION]));
    connectPriceStream();
    render(<Header />);
    act(() => currentSource().emitOpen());
    act(() => currentSource().emitMessage(tick("AAPL", 196.24, 1000)));
    await eventually(() => expect(textOf("total-value")).toBe("$10,050.00"));
    expect(classesOf("total-value")).toContain("text-up");

    act(() => currentSource().emitMessage(tick("AAPL", 180, 1001)));
    await eventually(() => expect(textOf("total-value")).toBe("$9,887.60"));
    expect(classesOf("total-value")).toContain("text-down");
    expect(textOf("cash-value")).toBe("$8,087.60");
  });

  it("falls back to the position current_price before any live tick", async () => {
    stubFetchOk(portfolioBody(8087.6, [AAPL_POSITION]));
    render(<Header />);
    await eventually(() => expect(textOf("total-value")).toBe("$10,050.00"));
  });

  it("shows a muted dash for both values while the portfolio is loading", () => {
    pendingFetch();
    render(<Header />);
    expect(textOf("total-value")).toBe("—");
    expect(textOf("cash-value")).toBe("—");
    expect(classesOf("total-value")).toContain("text-muted");
    expect(classesOf("cash-value")).toContain("text-muted");
  });

  it("shows a dash and the unavailable caption when the portfolio request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    render(<Header />);
    const caption = await screen.findByText("Portfolio unavailable. Reload to retry.");
    expect(caption.className).toContain("text-down");
    expect(caption.getAttribute("title")).toBe("Portfolio unavailable. Reload to retry.");
    expect(textOf("total-value")).toBe("—");
    expect(textOf("cash-value")).toBe("—");
  });

  it("shows the same caption for a non-2xx response without leaking the server message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: { code: "boom", message: "SECRET-TRACE" } }), {
            status: 500,
          }),
        ),
      ),
    );
    render(<Header />);
    await screen.findByText("Portfolio unavailable. Reload to retry.");
    expect(document.body.textContent).not.toContain("SECRET-TRACE");
  });

  it("never carries a flash class on the total value across live ticks", async () => {
    stubFetchOk(portfolioBody(8087.6, [AAPL_POSITION]));
    connectPriceStream();
    render(<Header />);
    act(() => currentSource().emitOpen());
    act(() => currentSource().emitMessage(tick("AAPL", 196.24, 1000)));
    await eventually(() => expect(textOf("total-value")).toBe("$10,050.00"));
    act(() => currentSource().emitMessage(tick("AAPL", 197, 1001)));
    await eventually(() => expect(textOf("total-value")).toBe("$10,057.60"));
    expect(classesOf("total-value")).not.toContain("flash");
  });
});

describe("Header wordmark and connection indicator", () => {
  beforeEach(() => {
    __resetPriceStoreForTests();
    FakeEventSource.reset();
    pendingFetch();
  });

  afterEach(() => {
    __resetPriceStoreForTests();
    vi.unstubAllGlobals();
  });

  it("shows Fin and Ally with Ally in the accent color", () => {
    render(<Header />);
    expect(screen.getByText("Fin")).toBeInTheDocument();
    expect(screen.getByText("Ally")).toHaveClass("text-accent");
  });

  it("reads CONNECTING before the stream opens", () => {
    connectPriceStream();
    render(<Header />);
    expect(screen.getByRole("status")).toHaveTextContent("CONNECTING");
  });

  it("reads LIVE after the stream opens", () => {
    connectPriceStream();
    render(<Header />);
    act(() => currentSource().emitOpen());
    expect(screen.getByRole("status")).toHaveTextContent("LIVE");
  });

  it("reads RECONNECTING when the browser is retrying after an open", () => {
    connectPriceStream();
    render(<Header />);
    act(() => currentSource().emitOpen());
    act(() => currentSource().emitError(FakeEventSource.CONNECTING));
    expect(screen.getByRole("status")).toHaveTextContent("RECONNECTING");
  });

  it("reads OFFLINE when the stream is closed", () => {
    connectPriceStream();
    render(<Header />);
    act(() => currentSource().emitOpen());
    act(() => currentSource().emitError(FakeEventSource.CLOSED));
    expect(screen.getByRole("status")).toHaveTextContent("OFFLINE");
  });
});
