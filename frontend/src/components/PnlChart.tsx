"use client";

import { useEffect, useRef } from "react";
import {
  BaselineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { chartOptions } from "@/lib/chartTheme";
import type { ChartPoint } from "@/lib/portfolio";

const STARTING_VALUE = 10000;

export default function PnlChart({ points }: { points: ChartPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<ISeriesApi<"Baseline"> | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = (chartRef.current = createChart(containerRef.current, {
      ...chartOptions,
      timeScale: { ...chartOptions.timeScale, secondsVisible: false },
    }));
    seriesRef.current = chart.addSeries(BaselineSeries, {
      baseValue: { type: "price", price: STARTING_VALUE },
      topLineColor: "#22c55e",
      topFillColor1: "rgba(34, 197, 94, 0.25)",
      topFillColor2: "rgba(34, 197, 94, 0.02)",
      bottomLineColor: "#ef4444",
      bottomFillColor1: "rgba(239, 68, 68, 0.02)",
      bottomFillColor2: "rgba(239, 68, 68, 0.25)",
      lineWidth: 2,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    seriesRef.current?.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    chartRef.current?.timeScale().fitContent();
  }, [points]);

  return (
    <section className="panel flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="panel-title">Portfolio Value</h2>
        <span className="text-[10px] text-faint">vs $10,000 start</span>
      </div>
      <div className="relative min-h-0 flex-1">
        <div data-testid="pnl-chart" data-points={points.length} ref={containerRef} className="absolute inset-0" />
      </div>
    </section>
  );
}
