import { sparklinePoints, sparklineTrend } from "@/lib/sparkline";

export interface SparklineProps {
  values: number[];
}

const WIDTH = 80;
const HEIGHT = 20;

const STROKE_BY_TREND = {
  up: "stroke-up",
  down: "stroke-down",
  flat: "stroke-muted",
} as const;

/** Hand-rolled SVG polyline sparkline (D-10, D-11); a dashed baseline until two points exist. */
export function Sparkline({ values }: SparklineProps) {
  const points = sparklinePoints(values, WIDTH, HEIGHT);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      width="100%"
      height={HEIGHT}
      aria-hidden="true"
      className="block"
    >
      {points === "" ? (
        <line
          x1={0}
          y1={HEIGHT / 2}
          x2={WIDTH}
          y2={HEIGHT / 2}
          strokeWidth={1}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
          className="stroke-border"
        />
      ) : (
        <polyline
          points={points}
          fill="none"
          strokeWidth={1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className={STROKE_BY_TREND[sparklineTrend(values)]}
        />
      )}
    </svg>
  );
}
