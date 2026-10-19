import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionStatus } from "@/components/Header";
import { MockEventSource, priceUpdate } from "@/test/fixtures";
import { statusFromReadyState, usePriceStream } from "./usePriceStream";

function Probe() {
  const { status, prices, history } = usePriceStream();
  return (
    <div>
      <ConnectionStatus status={status} />
      <span data-testid="price">{prices.AAPL?.price ?? "none"}</span>
      <span data-testid="ticks">{history.AAPL?.length ?? 0}</span>
    </div>
  );
}

describe("statusFromReadyState", () => {
  it("maps each EventSource readyState", () => {
    expect(statusFromReadyState(0)).toBe("reconnecting");
    expect(statusFromReadyState(1)).toBe("connected");
    expect(statusFromReadyState(2)).toBe("disconnected");
  });
});

describe("connection status indicator", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const dot = () => screen.getByTestId("connection-status");

  it("is yellow (reconnecting) while CONNECTING", () => {
    render(<Probe />);
    expect(MockEventSource.latest().url).toBe("/api/stream/prices");
    expect(dot()).toHaveAttribute("data-status", "reconnecting");
  });

  it("is green (connected) once OPEN", () => {
    render(<Probe />);
    act(() => MockEventSource.latest().open());
    expect(dot()).toHaveAttribute("data-status", "connected");
  });

  it("goes back to reconnecting when the browser is retrying", () => {
    render(<Probe />);
    act(() => MockEventSource.latest().open());
    act(() => MockEventSource.latest().error(0));
    expect(dot()).toHaveAttribute("data-status", "reconnecting");
  });

  it("is red (disconnected) when CLOSED, then opens a new connection", () => {
    vi.useFakeTimers();
    render(<Probe />);
    const first = MockEventSource.latest();
    act(() => first.error(2));
    expect(dot()).toHaveAttribute("data-status", "disconnected");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(MockEventSource.instances).toHaveLength(2);
    act(() => MockEventSource.latest().open());
    expect(dot()).toHaveAttribute("data-status", "connected");
  });

  it("accumulates prices and per-ticker history from events", () => {
    render(<Probe />);
    const es = MockEventSource.latest();
    act(() => es.open());
    act(() => es.emit({ AAPL: priceUpdate("AAPL", 190, 189, 1000.1) }));
    act(() => es.emit({ AAPL: priceUpdate("AAPL", 191, 190, 1000.6) }));
    // an unchanged timestamp is not a new tick
    act(() => es.emit({ AAPL: priceUpdate("AAPL", 191, 190, 1000.6) }));
    expect(screen.getByTestId("price")).toHaveTextContent("191");
    expect(screen.getByTestId("ticks")).toHaveTextContent("2");
  });

  it("closes the stream on unmount", () => {
    const { unmount } = render(<Probe />);
    unmount();
    expect(MockEventSource.latest().closed).toBe(true);
  });
});
