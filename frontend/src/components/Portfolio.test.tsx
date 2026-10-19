import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { Position } from "@/lib/types";
import { portfolio } from "@/test/fixtures";
import Header from "./Header";
import Heatmap, { heatColor, pnlState } from "./Heatmap";
import PnlChart from "./PnlChart";
import PositionsTable from "./PositionsTable";
import TradeBar from "./TradeBar";

const losing: Position = {
  ticker: "TSLA",
  quantity: 3,
  avg_cost: 250,
  current_price: 240,
  market_value: 720,
  unrealized_pnl: -30,
  unrealized_pnl_percent: -4,
};

describe("Header", () => {
  it("shows formatted total value and cash", () => {
    render(<Header totalValue={10050} cash={8087.6} status="connected" />);
    expect(screen.getByTestId("header-total-value")).toHaveTextContent("$10,050.00");
    expect(screen.getByTestId("header-cash")).toHaveTextContent("$8,087.60");
    expect(screen.getByTestId("connection-status")).toHaveAttribute("data-status", "connected");
  });
});

describe("PositionsTable", () => {
  it("renders a row per position with quantity", () => {
    render(<PositionsTable positions={[...portfolio.positions, losing]} />);
    const row = screen.getByTestId("position-row-AAPL");
    expect(row).toHaveAttribute("data-quantity", "10");
    expect(row).toHaveTextContent("191.24");
    expect(row).toHaveTextContent("+$50.00");
    expect(row).toHaveTextContent("+2.61%");
    expect(screen.getByTestId("position-row-TSLA")).toHaveTextContent("-$30.00");
  });

  it("shows an empty state", () => {
    render(<PositionsTable positions={[]} />);
    expect(screen.getByTestId("positions-table")).toHaveTextContent("No open positions");
  });
});

describe("Heatmap", () => {
  it("renders a cell per position coloured by P&L", () => {
    render(<Heatmap positions={[...portfolio.positions, losing]} />);
    expect(screen.getByTestId("heatmap")).toBeInTheDocument();
    expect(screen.getByTestId("heatmap-cell-AAPL")).toHaveAttribute("data-pnl", "positive");
    expect(screen.getByTestId("heatmap-cell-TSLA")).toHaveAttribute("data-pnl", "negative");
  });

  it("maps P&L to state and colour", () => {
    expect(pnlState(0)).toBe("flat");
    expect(heatColor(2)).toMatch(/^rgba\(34, 197, 94/);
    expect(heatColor(-2)).toMatch(/^rgba\(239, 68, 68/);
  });
});

describe("PnlChart", () => {
  it("exposes the number of plotted points", () => {
    render(
      <PnlChart
        points={[
          { time: 1, value: 10000 },
          { time: 2, value: 10010 },
        ]}
      />,
    );
    expect(screen.getByTestId("pnl-chart")).toHaveAttribute("data-points", "2");
  });
});

describe("TradeBar", () => {
  const trade = {
    id: "t1",
    ticker: "AAPL",
    side: "buy" as const,
    quantity: 10,
    price: 191.24,
    executed_at: "2026-10-04T14:03:22Z",
  };

  it("prefills the selected ticker and submits a buy", async () => {
    const onTrade = vi.fn().mockResolvedValue(trade);
    render(<TradeBar selectedTicker="AAPL" livePrice={191.24} onTrade={onTrade} />);
    expect(screen.getByTestId("trade-ticker-input")).toHaveValue("AAPL");
    await userEvent.type(screen.getByTestId("trade-quantity-input"), "10");
    await userEvent.click(screen.getByTestId("trade-buy-button"));
    expect(onTrade).toHaveBeenCalledWith("AAPL", 10, "buy");
    expect(await screen.findByTestId("trade-confirmation")).toHaveTextContent("Bought 10 AAPL @ $191.24");
  });

  it("rejects non-integer quantities locally", async () => {
    const onTrade = vi.fn();
    render(<TradeBar selectedTicker="AAPL" livePrice={191.24} onTrade={onTrade} />);
    await userEvent.type(screen.getByTestId("trade-quantity-input"), "1.5");
    await userEvent.click(screen.getByTestId("trade-sell-button"));
    expect(onTrade).not.toHaveBeenCalled();
    expect(screen.getByTestId("trade-error")).toHaveTextContent("whole number");
  });

  it("shows the API error message", async () => {
    const onTrade = vi
      .fn()
      .mockRejectedValue(new ApiError("insufficient_shares", "You only hold 0 shares of AAPL.", 400));
    render(<TradeBar selectedTicker="AAPL" livePrice={191.24} onTrade={onTrade} />);
    await userEvent.type(screen.getByTestId("trade-quantity-input"), "5");
    await userEvent.click(screen.getByTestId("trade-sell-button"));
    expect(onTrade).toHaveBeenCalledWith("AAPL", 5, "sell");
    expect(await screen.findByTestId("trade-error")).toHaveTextContent("You only hold 0 shares of AAPL.");
  });
});
