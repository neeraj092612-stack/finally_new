import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { PriceMap } from "@/lib/types";
import { priceUpdate, watchlistEntries } from "@/test/fixtures";
import Watchlist from "./Watchlist";

function setup(prices: PriceMap = {}, overrides: Partial<React.ComponentProps<typeof Watchlist>> = {}) {
  const props: React.ComponentProps<typeof Watchlist> = {
    entries: watchlistEntries,
    prices,
    history: {},
    selected: "AAPL",
    onSelect: vi.fn(),
    onAdd: vi.fn().mockResolvedValue(undefined),
    onRemove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const utils = render(<Watchlist {...props} />);
  return { ...utils, props };
}

describe("Watchlist", () => {
  afterEach(() => vi.useRealTimers());

  it("renders a row per ticker with price and day change", () => {
    setup();
    expect(screen.getByTestId("watchlist")).toBeInTheDocument();
    expect(screen.getByTestId("watchlist-row-AAPL")).toBeInTheDocument();
    expect(screen.getByTestId("watchlist-price-AAPL")).toHaveTextContent("191.24");
    expect(screen.getByTestId("watchlist-row-AAPL")).toHaveTextContent("+0.65%");
    expect(screen.getByTestId("watchlist-row-MSFT")).toHaveTextContent("-1.20%");
  });

  it("shows live SSE prices over the REST snapshot", () => {
    setup({ AAPL: priceUpdate("AAPL", 200, 199) });
    expect(screen.getByTestId("watchlist-price-AAPL")).toHaveTextContent("200.00");
  });

  it("flashes green on an uptick and red on a downtick, then fades", () => {
    vi.useFakeTimers();
    const { rerender, props } = setup({ AAPL: priceUpdate("AAPL", 191.24) });
    const cell = () => screen.getByTestId("watchlist-price-AAPL");
    expect(cell()).not.toHaveClass("flash-up");

    rerender(<Watchlist {...props} prices={{ AAPL: priceUpdate("AAPL", 192, 191.24) }} />);
    expect(cell()).toHaveClass("flash-up");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(cell()).not.toHaveClass("flash-up");

    rerender(<Watchlist {...props} prices={{ AAPL: priceUpdate("AAPL", 190, 192) }} />);
    expect(cell()).toHaveClass("flash-down");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(cell()).not.toHaveClass("flash-down");
  });

  it("does not flash when the price is unchanged", () => {
    const { rerender, props } = setup({ AAPL: priceUpdate("AAPL", 191.24) });
    rerender(<Watchlist {...props} prices={{ AAPL: priceUpdate("AAPL", 191.24, 191.24, 2) }} />);
    const cell = screen.getByTestId("watchlist-price-AAPL");
    expect(cell).not.toHaveClass("flash-up");
    expect(cell).not.toHaveClass("flash-down");
  });

  it("selects a ticker when its row is clicked", () => {
    const { props } = setup();
    fireEvent.click(screen.getByTestId("watchlist-row-MSFT"));
    expect(props.onSelect).toHaveBeenCalledWith("MSFT");
  });

  it("adds a normalized ticker and clears the input", async () => {
    const { props } = setup();
    const input = screen.getByTestId("watchlist-add-input");
    await userEvent.type(input, " pypl ");
    await userEvent.click(screen.getByTestId("watchlist-add-button"));
    expect(props.onAdd).toHaveBeenCalledWith("PYPL");
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("shows the API error when adding fails", async () => {
    setup({}, { onAdd: vi.fn().mockRejectedValue(new ApiError("invalid_ticker", "Ticker '1X' is not valid.", 400)) });
    await userEvent.type(screen.getByTestId("watchlist-add-input"), "1x");
    await userEvent.click(screen.getByTestId("watchlist-add-button"));
    expect(await screen.findByTestId("watchlist-error")).toHaveTextContent("Ticker '1X' is not valid.");
  });

  it("removes a ticker without selecting it", async () => {
    const { props } = setup();
    await userEvent.click(screen.getByTestId("watchlist-remove-MSFT"));
    expect(props.onRemove).toHaveBeenCalledWith("MSFT");
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it("shows the position_open error inline", async () => {
    setup(
      {},
      {
        onRemove: vi
          .fn()
          .mockRejectedValue(new ApiError("position_open", "Sell your AAPL position before removing it.", 409)),
      },
    );
    await userEvent.click(screen.getByTestId("watchlist-remove-AAPL"));
    expect(await screen.findByTestId("watchlist-error")).toHaveTextContent("Sell your AAPL position");
  });
});
