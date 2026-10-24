import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "@/components/Sparkline";
import {
  SPARK_MAX_POINTS,
  SPARK_WINDOW_SECONDS,
  sparklinePoints,
  sparklineTrend,
  sparklineWindow,
} from "@/lib/sparkline";
import type { TickPoint } from "@/lib/types";

function ticks(pairs: Array<[number, number]>): TickPoint[] {
  return pairs.map(([ts, price]) => ({ ts, price }));
}

describe("sparkline constants", () => {
  it("windows to 300 seconds and 600 points", () => {
    expect(SPARK_WINDOW_SECONDS).toBe(300);
    expect(SPARK_MAX_POINTS).toBe(600);
  });
});

describe("sparklineWindow", () => {
  it("returns an empty array for no ticks", () => {
    expect(sparklineWindow([])).toEqual([]);
  });

  it("keeps every tick when all are inside the window", () => {
    expect(sparklineWindow(ticks([[10, 1], [11, 2], [12, 3]]))).toEqual([1, 2, 3]);
  });

  it("drops ticks older than 300 s before the newest and keeps the boundary tick", () => {
    const window = sparklineWindow(ticks([[0, 1], [100, 2], [299, 3], [300, 4], [301, 5]]));
    // newest ts is 301, so ts >= 1 is kept; ts 0 is dropped.
    expect(window).toEqual([2, 3, 4, 5]);
  });

  it("keeps only the last 600 points", () => {
    const many = Array.from({ length: 1000 }, (_, i): [number, number] => [i * 0.1, i]);
    const window = sparklineWindow(ticks(many));
    expect(window).toHaveLength(600);
    expect(window[0]).toBe(400);
    expect(window[599]).toBe(999);
  });
});

describe("sparklinePoints", () => {
  it("scales an ascending series across the full width with 2px vertical padding", () => {
    expect(sparklinePoints([1, 2, 3], 80, 20)).toBe("0,18 40,10 80,2");
  });

  it("draws a flat series at mid-height", () => {
    expect(sparklinePoints([5, 5], 80, 20)).toBe("0,10 80,10");
  });

  it("draws exactly two points as a line", () => {
    expect(sparklinePoints([3, 1], 80, 20)).toBe("0,2 80,18");
  });

  it("returns an empty string below two points", () => {
    expect(sparklinePoints([7])).toBe("");
    expect(sparklinePoints([])).toBe("");
  });

  it("uses an 80 by 20 box by default and rounds to two decimals", () => {
    expect(sparklinePoints([0, 1, 3])).toBe("0,18 40,12.67 80,2");
  });
});

describe("sparklineTrend", () => {
  it("compares the last point with the first", () => {
    expect(sparklineTrend([1, 3])).toBe("up");
    expect(sparklineTrend([3, 1])).toBe("down");
    expect(sparklineTrend([2, 2])).toBe("flat");
    expect(sparklineTrend([1, 9, 1])).toBe("flat");
    expect(sparklineTrend([])).toBe("flat");
  });
});

describe("Sparkline", () => {
  it("draws a dashed baseline and no polyline with fewer than two values", () => {
    for (const values of [[], [190.5]]) {
      const { container, unmount } = render(<Sparkline values={values} />);
      expect(container.querySelector("polyline")).toBeNull();
      const baseline = container.querySelector("line");
      expect(baseline).not.toBeNull();
      expect(baseline).toHaveAttribute("stroke-dasharray");
      expect(baseline).toHaveClass("stroke-border");
      unmount();
    }
  });

  it("is a hidden svg scaled to its cell", () => {
    const { container } = render(<Sparkline values={[1, 2]} />);
    const svg = container.querySelector("svg") as SVGElement;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("viewBox", "0 0 80 20");
    expect(svg).toHaveAttribute("preserveAspectRatio", "none");
  });

  it("draws one polyline from the scaled points", () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} />);
    const lines = container.querySelectorAll("polyline");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveAttribute("points", "0,18 40,10 80,2");
    expect(lines[0]).toHaveAttribute("fill", "none");
    expect(container.querySelector("line")).toBeNull();
  });

  it("colors the stroke by trend: up, down, muted", () => {
    const up = render(<Sparkline values={[1, 3]} />);
    expect(up.container.querySelector("polyline")).toHaveClass("stroke-up");
    up.unmount();
    const down = render(<Sparkline values={[3, 1]} />);
    expect(down.container.querySelector("polyline")).toHaveClass("stroke-down");
    down.unmount();
    const flat = render(<Sparkline values={[2, 2]} />);
    expect(flat.container.querySelector("polyline")).toHaveClass("stroke-muted");
    expect(flat.container.querySelector("polyline")).toHaveAttribute("points", "0,10 80,10");
  });
});
