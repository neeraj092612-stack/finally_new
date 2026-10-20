import { describe, expect, it } from "vitest";
import { collapseBySecond, toChartTime } from "@/lib/chartData";

describe("toChartTime", () => {
  it("floors a Unix-seconds float to integer seconds", () => {
    expect(toChartTime(1791100800.92)).toBe(1791100800);
    expect(toChartTime(1791100800)).toBe(1791100800);
  });
});

describe("collapseBySecond", () => {
  it("keeps the latest price per second, in ascending order", () => {
    expect(
      collapseBySecond([
        { ts: 100.1, price: 1 },
        { ts: 100.9, price: 2 },
        { ts: 101.2, price: 3 },
      ]),
    ).toEqual([
      { time: 100, value: 2 },
      { time: 101, value: 3 },
    ]);
  });

  it("drops a tick whose second is earlier than the previous output time", () => {
    expect(
      collapseBySecond([
        { ts: 105.5, price: 1 },
        { ts: 104.2, price: 2 },
        { ts: 106.0, price: 3 },
      ]),
    ).toEqual([
      { time: 105, value: 1 },
      { time: 106, value: 3 },
    ]);
  });

  it("returns an empty array for no ticks", () => {
    expect(collapseBySecond([])).toEqual([]);
  });

  it("produces strictly ascending unique times", () => {
    const ticks = Array.from({ length: 40 }, (_, i) => ({ ts: 200 + i * 0.5, price: i }));
    const times = collapseBySecond(ticks).map((p) => p.time);
    expect(times).toEqual([...new Set(times)].sort((a, b) => a - b));
    expect(times).toHaveLength(20);
  });
});
