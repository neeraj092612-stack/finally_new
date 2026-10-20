"use client";

import { useEffect, useRef } from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { collapseBySecond, toChartTime } from "@/lib/chartData";
import { getTicks, onTick } from "@/lib/priceStore";

export interface ChartCanvasProps {
  ticker: string;
  /** True while the price stream is not OPEN: the last drawn series stays visible, dimmed. */
  dimmed: boolean;
}

const MONO = '"JetBrains Mono", ui-monospace, monospace';

function formatTime(time: Time): string {
  return new Date((time as number) * 1000).toLocaleTimeString("en-GB");
}

/**
 * Imperative Lightweight Charts v5 wrapper (D-14). The chart is created once per mount.
 * A ticker switch replaces the data and fits it once; live ticks only append or replace
 * the last point, so a user who scrolled or zoomed is never pulled back (D-17).
 */
export default function ChartCanvas({ ticker, dimmed }: ChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b949e",
        fontSize: 10,
        fontFamily: MONO,
      },
      grid: { vertLines: { color: "#21262d" }, horzLines: { color: "#21262d" } },
      rightPriceScale: { borderColor: "#30363d" },
      timeScale: {
        borderColor: "#30363d",
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 4,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#484f58", style: LineStyle.Dashed },
        horzLine: { color: "#484f58", style: LineStyle.Dashed },
      },
      // Local time; the timestamps are deliberately not pre-shifted.
      localization: { timeFormatter: formatTime },
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: "#209dd7",
      lineWidth: 2,
      topColor: "rgba(32,157,215,0.28)",
      bottomColor: "rgba(32,157,215,0)",
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: "#209dd7",
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chartRef.current = null;
      seriesRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const points = collapseBySecond(getTicks(ticker));
    series.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    chart.timeScale().fitContent();
    let lastTime = points.length > 0 ? points[points.length - 1].time : -Infinity;

    return onTick(ticker, (tick) => {
      const time = toChartTime(tick.ts);
      if (time < lastTime) return;
      lastTime = time;
      series.update({ time: time as UTCTimestamp, value: tick.price });
    });
  }, [ticker]);

  return (
    <div
      ref={containerRef}
      data-testid="chart-canvas"
      className="absolute inset-0"
      style={{ opacity: dimmed ? 0.5 : 1 }}
    />
  );
}
