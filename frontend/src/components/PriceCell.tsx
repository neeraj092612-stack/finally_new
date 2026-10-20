/** Price cell (API-surface stub; implemented in the GREEN step). */
export interface PriceCellProps {
  price: number | null;
  flash?: { seq: number; dir: "up" | "down" };
  marker?: "up" | "down";
  live: boolean;
}

export function PriceCell(_props: PriceCellProps) {
  return null;
}
