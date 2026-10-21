# Phase 2: Manual Trading & Portfolio - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-20
**Phase:** 02-manual-trading-portfolio
**Areas discussed:** Trade bar flow, Watchlist add/remove, Positions & heatmap, P&L chart

---

## Trade bar flow

| Option | Description | Selected |
|--------|-------------|----------|
| Follows selection | Watchlist click fills ticker; user can still type | ✓ |
| Independent field | User always types the ticker | |
| Locked to selection | Always trades the selected ticker | |

| Option | Description | Selected |
|--------|-------------|----------|
| Inline status line | One-line green fill / red error under the buttons | ✓ |
| Toast | Temporary corner popup | |
| Silent | Rely on visible changes | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, live estimate | qty × live price plus cash / shares held | ✓ |
| No | Ticker, qty, buttons only | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both | Ticker and qty stay after a trade | ✓ |
| Clear quantity | | |
| Clear both | | |

**User's choice:** All recommended options.

---

## Watchlist add/remove

| Option | Description | Selected |
|--------|-------------|----------|
| Panel footer row | Add input pinned to the bottom of WATCHLIST | ✓ |
| Panel title bar | + icon opens an input | |
| Top of list | Input row above the first ticker | |

| Option | Description | Selected |
|--------|-------------|----------|
| Hover × on row | Appears on hover/focus, no confirmation | ✓ |
| Always-visible × | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Panel-level line | Same error line as add errors | ✓ |
| On the row | Red message replaces the row briefly | |

| Option | Description | Selected |
|--------|-------------|----------|
| Select first entry | Existing AppShell fallback | ✓ |
| Select neighbor | | |
| Empty chart | | |

**User's choice:** All recommended options.

---

## Positions & heatmap

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, both | Rows and tiles select ticker app-wide | ✓ |
| Positions only | | |
| Neither | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Graded by P&L % | Intensity capped ~±5%, gray near 0 | ✓ |
| Binary green/red | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Ticker + P&L % | Hidden on small tiles; tooltip details | ✓ |
| Ticker + P&L % + value | | |
| Ticker only | | |

| Option | Description | Selected |
|--------|-------------|----------|
| No, positions only | Weights share of positions value | ✓ |
| Yes, gray cash tile | | |

**User's choice:** All recommended options.

---

## P&L chart

| Option | Description | Selected |
|--------|-------------|----------|
| Baseline at $10,000 | Green above / red below, dashed reference | ✓ |
| Single-color line | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Trailing live segment | One moving "now" point, ~1/s | ✓ |
| Append live history | Accumulate per second since load | |

| Option | Description | Selected |
|--------|-------------|----------|
| Real time, fit content | Gaps as straight segments | ✓ |
| Evenly spaced points | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Show the chart anyway | Startup snapshot + live point | ✓ |
| Keep the placeholder | | |

**User's choice:** All recommended options.

---

## Claude's Discretion

- Fixing Phase 1 review warnings WR-01, WR-02, WR-06, WR-07, IN-05 (others optional)
- In-flight button states, Enter-key behavior, quantity default/validation
- Auto-selecting a newly added ticker
- Positions table sort, totals row, price flash in table
- Heatmap color ramp values and label thresholds
- Frontend state shape for shared selection and portfolio

## Deferred Ideas

None.
