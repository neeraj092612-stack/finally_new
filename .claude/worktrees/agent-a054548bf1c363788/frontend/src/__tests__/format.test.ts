import { describe, expect, it } from "vitest";
import {
  MISSING,
  formatPrice,
  formatSignedChange,
  formatSignedPercent,
  formatUsd,
} from "@/lib/format";

describe("formatUsd", () => {
  it("formats whole dollars with thousands separators and two decimals", () => {
    expect(formatUsd(10000)).toBe("$10,000.00");
    expect(formatUsd(1000000)).toBe("$1,000,000.00");
  });

  it("puts an ASCII hyphen before the dollar sign for negatives", () => {
    expect(formatUsd(-12.5)).toBe("-$12.50");
  });
});

describe("formatPrice", () => {
  it("formats with two decimals and thousands separators and no symbol", () => {
    expect(formatPrice(1234.5)).toBe("1,234.50");
    expect(formatPrice(190)).toBe("190.00");
  });
});

describe("formatSignedPercent", () => {
  it("prefixes positives with +", () => {
    expect(formatSignedPercent(0.65)).toBe("+0.65%");
  });

  it("uses an ASCII hyphen for negatives", () => {
    const out = formatSignedPercent(-0.07);
    expect(out).toBe("-0.07%");
    expect(out).not.toContain("−");
  });

  it("shows zero without a sign", () => {
    expect(formatSignedPercent(0)).toBe("0.00%");
  });

  it("treats a value that rounds to zero as zero", () => {
    expect(formatSignedPercent(0.001)).toBe("0.00%");
    expect(formatSignedPercent(-0.001)).toBe("0.00%");
  });
});

describe("formatSignedChange", () => {
  it("applies the same sign rules without a percent sign", () => {
    expect(formatSignedChange(1.24)).toBe("+1.24");
    expect(formatSignedChange(-0.5)).toBe("-0.50");
    expect(formatSignedChange(0)).toBe("0.00");
  });
});

describe("MISSING", () => {
  it("is an em dash", () => {
    expect(MISSING).toBe("—");
  });
});
