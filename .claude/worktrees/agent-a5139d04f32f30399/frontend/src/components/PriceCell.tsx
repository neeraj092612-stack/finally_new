import { formatPrice, MISSING } from "@/lib/format";

export interface PriceCellProps {
  price: number | null;
  /** Latest flash event from the price store; `seq` changes on every new non-flat tick. */
  flash?: { seq: number; dir: "up" | "down" };
  /** Last non-flat direction; persists through flat ticks (D-07). */
  marker?: "up" | "down";
  /** True only while the price stream is OPEN. */
  live: boolean;
}

const UP_TRIANGLE = "4,0 8,8 0,8";
const DOWN_TRIANGLE = "0,0 8,0 4,8";

/**
 * Formatted price with a flash and an up/down marker. The span is keyed by the flash
 * sequence, so a new tick remounts it and restarts the CSS animation without timers (D-05).
 * Deliberately not a live region: 500ms updates would flood screen readers.
 */
export function PriceCell({ price, flash, marker, live }: PriceCellProps) {
  if (price === null) {
    return <span className="font-mono text-body tabular-nums text-muted">{MISSING}</span>;
  }

  const flashClass = live && flash ? (flash.dir === "up" ? "flash-up" : "flash-down") : "";
  const colorClass = live ? "text-text" : "text-muted";

  return (
    <span className="inline-flex items-center justify-end gap-1 font-mono text-body font-normal tabular-nums">
      <span key={flash?.seq ?? 0} className={`${colorClass} ${flashClass}`.trim()}>
        {formatPrice(price)}
      </span>
      {marker ? (
        <svg
          data-testid="price-marker"
          data-direction={marker}
          width="8"
          height="8"
          viewBox="0 0 8 8"
          aria-hidden="true"
          className={`shrink-0 ${marker === "up" ? "fill-up" : "fill-down"}`}
        >
          <polygon points={marker === "up" ? UP_TRIANGLE : DOWN_TRIANGLE} />
        </svg>
      ) : null}
    </span>
  );
}
