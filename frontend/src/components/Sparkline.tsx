import type { PricePoint } from "@/hooks/usePriceStream";

interface SparklineProps {
  points: PricePoint[];
  width?: number;
  height?: number;
  maxPoints?: number;
}

/** Hand-rolled SVG polyline of the most recent ticks. */
export default function Sparkline({ points, width = 80, height = 24, maxPoints = 120 }: SparklineProps) {
  const data = points.slice(-maxPoints);
  if (data.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden="true" data-testid="sparkline">
        <line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke="var(--color-line-strong)" strokeDasharray="2 3" />
      </svg>
    );
  }
  let min = Infinity;
  let max = -Infinity;
  for (const p of data) {
    if (p.value < min) min = p.value;
    if (p.value > max) max = p.value;
  }
  const range = max - min || 1;
  const pad = 2;
  const step = (width - pad * 2) / (data.length - 1);
  const coords = data
    .map((p, i) => {
      const x = pad + i * step;
      const y = pad + (height - pad * 2) * (1 - (p.value - min) / range);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = data[data.length - 1].value >= data[0].value;
  const color = up ? "var(--color-up)" : "var(--color-down)";
  return (
    <svg width={width} height={height} aria-hidden="true" data-testid="sparkline">
      <polyline points={coords} fill="none" stroke={color} strokeWidth={1.25} strokeLinejoin="round" />
    </svg>
  );
}
