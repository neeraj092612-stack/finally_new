import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConnectionIndicator } from "@/components/ConnectionIndicator";

function dot(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-testid="connection-dot"]') as HTMLElement;
}

describe("ConnectionIndicator", () => {
  it("shows a green dot with LIVE while open", () => {
    const { container } = render(<ConnectionIndicator connection="open" hasOpened />);
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(dot(container)).toHaveClass("bg-up");
    expect(screen.getByRole("status")).toHaveAttribute("title", "Price stream connected");
  });

  it("shows a pulsing yellow dot with CONNECTING before the first open", () => {
    const { container } = render(<ConnectionIndicator connection="connecting" hasOpened={false} />);
    expect(screen.getByText("CONNECTING")).toBeInTheDocument();
    expect(dot(container)).toHaveClass("bg-warn");
    expect(dot(container)).toHaveClass("dot-pulse");
    expect(screen.getByRole("status")).toHaveAttribute("title", "Price stream reconnecting");
  });

  it("shows RECONNECTING while connecting after a previous open", () => {
    const { container } = render(<ConnectionIndicator connection="connecting" hasOpened />);
    expect(screen.getByText("RECONNECTING")).toBeInTheDocument();
    expect(dot(container)).toHaveClass("bg-warn");
    expect(dot(container)).toHaveClass("dot-pulse");
  });

  it("shows a static red dot with OFFLINE when closed", () => {
    const { container } = render(<ConnectionIndicator connection="closed" hasOpened />);
    expect(screen.getByText("OFFLINE")).toBeInTheDocument();
    expect(dot(container)).toHaveClass("bg-down");
    expect(dot(container)).not.toHaveClass("dot-pulse");
    expect(screen.getByRole("status")).toHaveAttribute(
      "title",
      "Price stream disconnected. Retrying.",
    );
  });

  it("announces changes politely via an aria-live status region", () => {
    render(<ConnectionIndicator connection="open" hasOpened />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});
