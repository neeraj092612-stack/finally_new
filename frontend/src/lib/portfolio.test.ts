import { describe, expect, it } from "vitest";
import { portfolio, priceUpdate } from "@/test/fixtures";
import { dayChangeBaseline, dayChangePercent, pnlSeries, revaluePortfolio, toChartPoints } from "./portfolio";
import { squarify } from "./treemap";
import { formatMoney, formatPercent, formatSignedMoney } from "./format";

describe("revaluePortfolio", () => {
  it("re-prices positions with live SSE prices and recomputes totals", () => {
    const live = revaluePortfolio(portfolio, { AAPL: priceUpdate("AAPL", 200) });
    const p = live.positions[0];
    expect(p.current_price).toBe(200);
    expect(p.market_value).toBe(2000);
    expect(p.unrealized_pnl).toBe(87.6); // 2000 - 1912.40
    expect(p.unrealized_pnl_percent).toBe(4.58);
    expect(live.positions_value).toBe(2000);
    expect(live.total_value).toBe(10087.6);
    expect(live.unrealized_pnl).toBe(87.6);
  });

  it("keeps the server price when there is no live price", () => {
    const live = revaluePortfolio(portfolio, {});
    expect(live.positions[0].current_price).toBe(196.24);
    expect(live.total_value).toBe(10050);
  });

  it("handles a loss", () => {
    const live = revaluePortfolio(portfolio, { AAPL: priceUpdate("AAPL", 180) });
    expect(live.positions[0].unrealized_pnl).toBe(-112.4);
    expect(live.positions[0].unrealized_pnl_percent).toBeLessThan(0);
  });

  it("handles an empty portfolio", () => {
    const live = revaluePortfolio({ ...portfolio, positions: [], positions_value: 0, total_value: 8087.6 }, {});
    expect(live.total_value).toBe(8087.6);
    expect(live.unrealized_pnl).toBe(0);
  });
});

describe("chart points", () => {
  it("collapses sub-second ticks into strictly ascending integer seconds", () => {
    const pts = toChartPoints([
      { time: 100.1, value: 1 },
      { time: 100.6, value: 2 },
      { time: 101.1, value: 3 },
    ]);
    expect(pts).toEqual([
      { time: 100, value: 2 },
      { time: 101, value: 3 },
    ]);
  });

  it("appends a live point after the snapshots", () => {
    const pts = pnlSeries(
      [
        { total_value: 10000, recorded_at: "2026-10-04T14:00:00Z" },
        { total_value: 10010, recorded_at: "2026-10-04T14:03:22Z" },
      ],
      10025,
      Date.parse("2026-10-04T14:10:00Z") / 1000,
    );
    expect(pts).toHaveLength(3);
    expect(pts[2].value).toBe(10025);
    expect(pts[2].time).toBeGreaterThan(pts[1].time);
  });

  it("keeps the live point after the last snapshot even if the clock is behind", () => {
    const pts = pnlSeries([{ total_value: 10000, recorded_at: "2026-10-04T14:00:00Z" }], 10001, 0);
    expect(pts).toHaveLength(2);
    expect(pts[1].time).toBe(pts[0].time + 1);
  });
});

describe("day change", () => {
  it("derives the baseline from the server percent and reapplies it to live prices", () => {
    const base = dayChangeBaseline(110, 10)!;
    expect(base).toBeCloseTo(100);
    expect(dayChangePercent(120, base)).toBe(20);
  });

  it("returns null without a price", () => {
    expect(dayChangeBaseline(null, null)).toBeNull();
  });
});

describe("squarify", () => {
  it("fills the box with rects whose areas are proportional to value", () => {
    const rects = squarify(
      [
        { id: "A", value: 6 },
        { id: "B", value: 3 },
        { id: "C", value: 1 },
      ],
      100,
      50,
    );
    expect(rects).toHaveLength(3);
    const area = (id: string) => {
      const r = rects.find((x) => x.id === id)!;
      return r.w * r.h;
    };
    expect(area("A")).toBeCloseTo(3000);
    expect(area("B")).toBeCloseTo(1500);
    expect(area("C")).toBeCloseTo(500);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-9);
      expect(r.y).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(100 + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(50 + 1e-9);
    }
  });

  it("drops non-positive values and handles empty input", () => {
    expect(squarify([], 100, 100)).toEqual([]);
    expect(squarify([{ id: "A", value: 0 }], 100, 100)).toEqual([]);
  });
});

describe("format", () => {
  it("formats money and percents", () => {
    expect(formatMoney(10000)).toBe("$10,000.00");
    expect(formatMoney(null)).toBe("—");
    expect(formatSignedMoney(-12.345)).toBe("-$12.35");
    expect(formatSignedMoney(5)).toBe("+$5.00");
    expect(formatPercent(0.65)).toBe("+0.65%");
    expect(formatPercent(-1.2)).toBe("-1.20%");
  });
});
