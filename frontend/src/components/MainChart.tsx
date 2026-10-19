"use client";

import { useEffect, useRef } from "react";
import { AreaSeries, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import type { PricePoint } from "@/hooks/usePriceStream";
import { chartOptions } from "@/lib/chartTheme";
import { formatPercent, formatPrice, signClass } from "@/lib/format";
import { toChartPoints } from "@/lib/portfolio";
import type { PriceUpdate } from "@/lib/types";

interface MainChartProps {
  ticker: string | null;
  points: PricePoint[];
  version: number;
  latest: PriceUpdate | undefined;
}

export default function MainChart({ ticker, points, version, latest }: MainChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, chartOptions);
    seriesRef.current = chart.addSeries(AreaSeries, {
      lineColor: "#209dd7",
      topColor: "rgba(32, 157, 215, 0.35)",
      bottomColor: "rgba(32, 157, 215, 0.02)",
      lineWidth: 2,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const data = toChartPoints(points).map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));
    seriesRef.current?.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [ticker, points, version]);

  // Session change since page load (first tick seen in the browser).
  const first = points[0]?.value;
  const sessionPct = latest && first ? ((latest.price - first) / first) * 100 : null;

  return (
    <section className="panel flex h-full flex-col">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line px-3 py-2">
        <h2 className="panel-title">Chart</h2>
        <span className="num text-base font-semibold text-accent">{ticker ?? "—"}</span>
        {latest && (
          <>
            <span className="num text-base text-text">{formatPrice(latest.price)}</span>
            <span className={`num text-xs ${signClass(latest.change)}`}>
              {latest.change >= 0 ? "+" : ""}
              {latest.change.toFixed(2)} tick
            </span>
            <span className={`num text-xs ${signClass(sessionPct)}`}>{formatPercent(sessionPct)} session</span>
          </>
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        <div data-testid="main-chart" data-ticker={ticker ?? ""} ref={containerRef} className="absolute inset-0" />
        {points.length < 2 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-faint">
            {ticker ? "Collecting ticks…" : "Select a ticker"}
          </div>
        )}
      </div>
    </section>
  );
}
