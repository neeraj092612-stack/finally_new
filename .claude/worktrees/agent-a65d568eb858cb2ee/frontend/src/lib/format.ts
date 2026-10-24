/** Number formatters shared by every panel (UI-SPEC "Typography" and "Copywriting Contract"). */

/** Placeholder shown where a value is not available yet. */
export const MISSING = "—";

const UNICODE_MINUS = /−/g;

const usdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const decimalFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function ascii(text: string): string {
  return text.replace(UNICODE_MINUS, "-");
}

/** True when the value displays as 0.00 after rounding to two decimals. */
function roundsToZero(n: number): boolean {
  return Math.round(Math.abs(n) * 100) === 0;
}

/** Money: `$10,000.00`, negatives as `-$12.50`. */
export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return MISSING;
  return ascii(usdFormat.format(roundsToZero(n) ? 0 : n));
}

/** Price without a currency symbol: `1,234.50`. */
export function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return MISSING;
  return ascii(decimalFormat.format(n));
}

/** Signed decimal: `+1.24`, `-0.50`, `0.00`. */
export function formatSignedChange(n: number): string {
  if (!Number.isFinite(n)) return MISSING;
  if (roundsToZero(n)) return decimalFormat.format(0);
  const body = decimalFormat.format(Math.abs(n));
  return n > 0 ? `+${body}` : `-${body}`;
}

/** Signed percent: `+0.65%`, `-0.07%`, `0.00%`. */
export function formatSignedPercent(n: number): string {
  const signed = formatSignedChange(n);
  return signed === MISSING ? MISSING : `${signed}%`;
}
