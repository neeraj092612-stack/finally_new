import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PriceCell } from "@/components/PriceCell";

describe("PriceCell", () => {
  it("shows the formatted price with a flash-up class and an up marker", () => {
    render(<PriceCell price={190.24} live flash={{ seq: 1, dir: "up" }} marker="up" />);
    const price = screen.getByText("190.24");
    expect(price).toHaveClass("flash-up");
    expect(price).not.toHaveClass("flash-down");
    expect(price).toHaveClass("text-text");
    const marker = screen.getByTestId("price-marker");
    expect(marker).toHaveAttribute("data-direction", "up");
    expect(marker).toHaveClass("fill-up");
  });

  it("remounts the price span with flash-down when the flash sequence changes", () => {
    const { rerender } = render(
      <PriceCell price={190.24} live flash={{ seq: 1, dir: "up" }} marker="up" />,
    );
    const first = screen.getByText("190.24");
    rerender(<PriceCell price={190.1} live flash={{ seq: 2, dir: "down" }} marker="down" />);
    const second = screen.getByText("190.10");
    expect(second).not.toBe(first);
    expect(second).toHaveClass("flash-down");
    expect(second).not.toHaveClass("flash-up");
    expect(screen.getByTestId("price-marker")).toHaveAttribute("data-direction", "down");
    expect(screen.getByTestId("price-marker")).toHaveClass("fill-down");
  });

  it("keeps the same span when the price changes without a new flash", () => {
    const { rerender } = render(<PriceCell price={190.24} live flash={{ seq: 3, dir: "up" }} />);
    const first = screen.getByText("190.24");
    rerender(<PriceCell price={190.24} live flash={{ seq: 3, dir: "up" }} />);
    expect(screen.getByText("190.24")).toBe(first);
  });

  it("does not flash on the first observation (no flash entry)", () => {
    render(<PriceCell price={190.24} live />);
    const price = screen.getByText("190.24");
    expect(price).not.toHaveClass("flash-up");
    expect(price).not.toHaveClass("flash-down");
    expect(screen.queryByTestId("price-marker")).not.toBeInTheDocument();
  });

  it("suppresses the flash and mutes the price while not live", () => {
    render(<PriceCell price={190.24} live={false} flash={{ seq: 1, dir: "up" }} marker="up" />);
    const price = screen.getByText("190.24");
    expect(price).not.toHaveClass("flash-up");
    expect(price).not.toHaveClass("flash-down");
    expect(price).toHaveClass("text-muted");
    expect(price).not.toHaveClass("text-text");
  });

  it("shows a muted dash and no marker when there is no price", () => {
    render(<PriceCell price={null} live flash={{ seq: 1, dir: "up" }} marker="up" />);
    const dash = screen.getByText("—");
    expect(dash).toHaveClass("text-muted");
    expect(dash).not.toHaveClass("flash-up");
    expect(screen.queryByTestId("price-marker")).not.toBeInTheDocument();
  });

  it("formats thousands separators and never announces ticks via aria-live", () => {
    const { container } = render(<PriceCell price={1234.5} live />);
    expect(screen.getByText("1,234.50")).toBeInTheDocument();
    expect(container.querySelector("[aria-live]")).toBeNull();
  });
});
