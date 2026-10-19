import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Lightweight Charts draws to canvas, which jsdom lacks; stub the API surface we use.
vi.mock("lightweight-charts", () => {
  const series = () => ({ setData: vi.fn(), update: vi.fn() });
  return {
    ColorType: { Solid: "solid" },
    AreaSeries: "Area",
    LineSeries: "Line",
    BaselineSeries: "Baseline",
    createChart: vi.fn(() => ({
      addSeries: vi.fn(series),
      remove: vi.fn(),
      applyOptions: vi.fn(),
      timeScale: () => ({ resetTimeScale: vi.fn(), fitContent: vi.fn() }),
    })),
  };
});

afterEach(() => {
  cleanup();
});
