import { ColorType, type DeepPartial, type ChartOptions } from "lightweight-charts";

export const chartOptions: DeepPartial<ChartOptions> = {
  autoSize: true,
  layout: {
    background: { type: ColorType.Solid, color: "transparent" },
    textColor: "#7d8a9c",
    fontFamily: '"JetBrains Mono", "SF Mono", "Cascadia Mono", Consolas, monospace',
    fontSize: 10,
    attributionLogo: false,
  },
  grid: {
    vertLines: { color: "rgba(31, 41, 55, 0.6)" },
    horzLines: { color: "rgba(31, 41, 55, 0.6)" },
  },
  rightPriceScale: { borderColor: "#1f2937" },
  timeScale: { borderColor: "#1f2937", timeVisible: true, secondsVisible: true },
  crosshair: {
    vertLine: { color: "#4a5566", labelBackgroundColor: "#141c27" },
    horzLine: { color: "#4a5566", labelBackgroundColor: "#141c27" },
  },
  localization: {
    timeFormatter: (t: number) => new Date(t * 1000).toLocaleTimeString("en-US", { hour12: false }),
  },
};
