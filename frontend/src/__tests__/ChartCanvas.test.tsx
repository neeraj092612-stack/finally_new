import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TickPoint } from "@/lib/types";

// jsdom has no canvas: replace Lightweight Charts with a recording fake.
const lw = vi.hoisted(() => {
  const series = { setData: vi.fn(), update: vi.fn() };
  const timeScale = { fitContent: vi.fn() };
  const chart = {
    addSeries: vi.fn((_definition: unknown, _options: unknown) => series),
    timeScale: vi.fn(() => timeScale),
    remove: vi.fn(),
  };
  return {
    series,
    timeScale,
    chart,
    createChart: vi.fn((_el: unknown, _options: unknown) => chart),
    AreaSeries: { type: "Area" },
    ColorType: { Solid: "solid" },
    CrosshairMode: { Normal: 0 },
    LineStyle: { Dashed: 2 },
  };
});

vi.mock("lightweight-charts", () => ({
  createChart: lw.createChart,
  AreaSeries: lw.AreaSeries,
  ColorType: lw.ColorType,
  CrosshairMode: lw.CrosshairMode,
  LineStyle: lw.LineStyle,
}));

// Control the price store directly so the guard for out-of-order ticks is reachable.
const store = vi.hoisted(() => {
  const buffers = new Map<string, TickPoint[]>();
  const listeners = new Map<string, Set<(tick: TickPoint) => void>>();
  const unsubscribes: string[] = [];
  return {
    buffers,
    listeners,
    unsubscribes,
    getTicks: vi.fn((ticker: string): readonly TickPoint[] => buffers.get(ticker) ?? []),
    onTick: vi.fn((ticker: string, cb: (tick: TickPoint) => void) => {
      let set = listeners.get(ticker);
      if (!set) {
        set = new Set();
        listeners.set(ticker, set);
      }
      set.add(cb);
      return () => {
        unsubscribes.push(ticker);
        listeners.get(ticker)?.delete(cb);
      };
    }),
    emit(ticker: string, tick: TickPoint) {
      for (const cb of [...(listeners.get(ticker) ?? [])]) cb(tick);
    },
  };
});

vi.mock("@/lib/priceStore", () => ({
  getTicks: store.getTicks,
  onTick: store.onTick,
}));

import ChartCanvas from "@/components/ChartCanvas";

function seed(ticker: string, ticks: TickPoint[]) {
  store.buffers.set(ticker, ticks);
}

beforeEach(() => {
  vi.clearAllMocks();
  store.buffers.clear();
  store.listeners.clear();
  store.unsubscribes.length = 0;
  seed("AAPL", [
    { ts: 203.1, price: 190 },
    { ts: 204.2, price: 191 },
  ]);
  seed("MSFT", [{ ts: 300.5, price: 410 }]);
});

describe("ChartCanvas creation", () => {
  it("creates one auto-sized chart with one blue area series and fits the buffered data once", () => {
    render(<ChartCanvas ticker="AAPL" dimmed={false} />);

    expect(lw.createChart).toHaveBeenCalledTimes(1);
    expect(lw.createChart.mock.calls[0][1]).toMatchObject({ autoSize: true });
    expect(lw.chart.addSeries).toHaveBeenCalledTimes(1);
    const [definition, options] = lw.chart.addSeries.mock.calls[0];
    expect(definition).toBe(lw.AreaSeries);
    expect(options).toMatchObject({
      lineColor: "#209dd7",
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    expect(lw.series.setData).toHaveBeenCalledTimes(1);
    expect(lw.series.setData).toHaveBeenCalledWith([
      { time: 203, value: 190 },
      { time: 204, value: 191 },
    ]);
    expect(lw.timeScale.fitContent).toHaveBeenCalledTimes(1);
  });

  it("keeps the time scale options that let the user scroll and zoom without a re-fit", () => {
    render(<ChartCanvas ticker="AAPL" dimmed={false} />);
    expect(lw.createChart.mock.calls[0][1]).toMatchObject({
      timeScale: { timeVisible: true, secondsVisible: true, rightOffset: 4 },
    });
  });
});

describe("ChartCanvas live ticks", () => {
  it("appends with update and never calls setData or fitContent again", () => {
    render(<ChartCanvas ticker="AAPL" dimmed={false} />);
    lw.series.setData.mockClear();
    lw.timeScale.fitContent.mockClear();

    store.emit("AAPL", { ts: 205.4, price: 192 });
    expect(lw.series.update).toHaveBeenLastCalledWith({ time: 205, value: 192 });

    // Same second: the library replaces the point at that time.
    store.emit("AAPL", { ts: 205.8, price: 193 });
    expect(lw.series.update).toHaveBeenLastCalledWith({ time: 205, value: 193 });
    expect(lw.series.update).toHaveBeenCalledTimes(2);

    expect(lw.series.setData).not.toHaveBeenCalled();
    expect(lw.timeScale.fitContent).not.toHaveBeenCalled();
  });

  it("ignores a tick whose second is earlier than the last charted time", () => {
    render(<ChartCanvas ticker="AAPL" dimmed={false} />);
    store.emit("AAPL", { ts: 205.4, price: 192 });
    lw.series.update.mockClear();

    store.emit("AAPL", { ts: 203.0, price: 150 });
    expect(lw.series.update).not.toHaveBeenCalled();
  });

  it("does not update for a tick of another ticker", () => {
    render(<ChartCanvas ticker="AAPL" dimmed={false} />);
    store.emit("MSFT", { ts: 400.2, price: 411 });
    expect(lw.series.update).not.toHaveBeenCalled();
  });

  it("charts the first tick of an empty buffer with update", () => {
    seed("AAPL", []);
    render(<ChartCanvas ticker="AAPL" dimmed={false} />);
    expect(lw.series.setData).toHaveBeenCalledWith([]);
    store.emit("AAPL", { ts: 10.5, price: 100 });
    expect(lw.series.update).toHaveBeenCalledWith({ time: 10, value: 100 });
  });
});

describe("ChartCanvas ticker switch", () => {
  it("unsubscribes from the old ticker, sets the new data and fits once more without recreating the chart", () => {
    const { rerender } = render(<ChartCanvas ticker="AAPL" dimmed={false} />);
    rerender(<ChartCanvas ticker="MSFT" dimmed={false} />);

    expect(store.unsubscribes).toEqual(["AAPL"]);
    expect(lw.series.setData).toHaveBeenCalledTimes(2);
    expect(lw.series.setData).toHaveBeenLastCalledWith([{ time: 300, value: 410 }]);
    expect(lw.timeScale.fitContent).toHaveBeenCalledTimes(2);
    expect(lw.createChart).toHaveBeenCalledTimes(1);

    // The old ticker no longer drives the series.
    lw.series.update.mockClear();
    store.emit("AAPL", { ts: 999.1, price: 1 });
    expect(lw.series.update).not.toHaveBeenCalled();
    store.emit("MSFT", { ts: 301.2, price: 411 });
    expect(lw.series.update).toHaveBeenCalledWith({ time: 301, value: 411 });
  });

  it("does not refit or reset data when only dimmed changes", () => {
    const { rerender } = render(<ChartCanvas ticker="AAPL" dimmed={false} />);
    rerender(<ChartCanvas ticker="AAPL" dimmed />);
    expect(lw.series.setData).toHaveBeenCalledTimes(1);
    expect(lw.timeScale.fitContent).toHaveBeenCalledTimes(1);
    expect(lw.createChart).toHaveBeenCalledTimes(1);
  });
});

describe("ChartCanvas dimming and teardown", () => {
  it("sets the container opacity to 0.5 when dimmed and 1 otherwise", () => {
    const { rerender } = render(<ChartCanvas ticker="AAPL" dimmed />);
    expect(screen.getByTestId("chart-canvas")).toHaveStyle({ opacity: "0.5" });
    rerender(<ChartCanvas ticker="AAPL" dimmed={false} />);
    expect(screen.getByTestId("chart-canvas")).toHaveStyle({ opacity: "1" });
  });

  it("removes the chart and unsubscribes on unmount", () => {
    const { unmount } = render(<ChartCanvas ticker="AAPL" dimmed={false} />);
    unmount();
    expect(lw.chart.remove).toHaveBeenCalledTimes(1);
    expect(store.unsubscribes).toEqual(["AAPL"]);
  });
});
