import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/AppShell";

function region(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

// Single-line failure messages (RTL's DOM dump breaks TAP reporting of RED evidence).
function expectText(scope: ReturnType<typeof within>, text: string): void {
  expect(scope.queryAllByText(text).map((el) => el.textContent)).toContain(text);
}

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
