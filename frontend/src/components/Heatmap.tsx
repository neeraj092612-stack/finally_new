"use client";

import { useEffect, useRef, useState } from "react";
import { formatPercent, formatMoney } from "@/lib/format";
import { squarify } from "@/lib/treemap";
import type { Position } from "@/lib/types";

/** Colour intensity saturates at ±5%. */
const SATURATION_PCT = 5;

export function pnlState(pct: number): "positive" | "negative" | "flat" {
  if (pct > 0) return "positive";
  if (pct < 0) return "negative";
  return "flat";
}

export function heatColor(pct: number): string {
  const t = Math.min(Math.abs(pct) / SATURATION_PCT, 1);
  const alpha = 0.18 + 0.62 * t;
  if (pct > 0) return `rgba(34, 197, 94, ${alpha.toFixed(3)})`;
  if (pct < 0) return `rgba(239, 68, 68, ${alpha.toFixed(3)})`;
  return "rgba(125, 138, 156, 0.2)";
}

export default function Heatmap({ positions }: { positions: Position[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Lay out in percentages so cells render correctly even before measurement.
  const W = size.w || 100;
  const H = size.h || 100;
  const rects = squarify(
    positions.map((p) => ({ id: p.ticker, value: p.market_value })),
    W,
    H,
  );
  const byTicker = Object.fromEntries(positions.map((p) => [p.ticker, p]));
  const total = positions.reduce((s, p) => s + p.market_value, 0);

  return (
    <section className="panel flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="panel-title">Heatmap</h2>
        <span className="text-[10px] text-faint">size = weight · colour = P&amp;L</span>
      </div>
      <div className="min-h-0 flex-1 p-1.5">
        <div data-testid="heatmap" ref={ref} className="relative h-full w-full overflow-hidden">
          {rects.map((r) => {
            const p = byTicker[r.id];
            const pct = p.unrealized_pnl_percent;
            const compact = (r.w / W) * (size.w || 400) < 64 || (r.h / H) * (size.h || 200) < 34;
            return (
              <div
                key={r.id}
                data-testid={`heatmap-cell-${r.id}`}
                data-pnl={pnlState(pct)}
                title={`${r.id}  ${formatMoney(p.market_value)}  ${formatPercent(pct)}  (${((p.market_value / total) * 100).toFixed(1)}% of holdings)`}
                className="absolute flex flex-col items-center justify-center overflow-hidden border border-bg text-center leading-tight transition-colors duration-500"
                style={{
                  left: `${(r.x / W) * 100}%`,
                  top: `${(r.y / H) * 100}%`,
                  width: `${(r.w / W) * 100}%`,
                  height: `${(r.h / H) * 100}%`,
                  backgroundColor: heatColor(pct),
                }}
              >
                <span className="num text-xs font-semibold text-white">{r.id}</span>
                {!compact && <span className="num text-[10px] text-white/80">{formatPercent(pct)}</span>}
              </div>
            );
          })}
          {rects.length === 0 && (
            <div className="flex h-full items-center justify-center text-xs text-faint">No positions yet</div>
          )}
        </div>
      </div>
    </section>
  );
}
