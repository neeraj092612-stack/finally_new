# Phase 1: Live Market Terminal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-20
**Phase:** 1-Live Market Terminal
**Areas discussed:** Page layout & empty panels, Price flash feel, Watchlist row design, Main chart style

---

## Page layout & empty panels

| Option | Description | Selected |
|--------|-------------|----------|
| 3-column | Watchlist left, chart over heatmap/P&L/positions center, chat docked right | ✓ |
| 2-column + drawer | Watchlist left, wide center, chat as overlay drawer | |
| You decide | Claude picks | |

| Option | Description | Selected |
|--------|-------------|----------|
| Final grid + placeholders | Titled empty-state panels; no layout shift later | ✓ |
| Hide until built | Show only working panels | |

| Option | Description | Selected |
|--------|-------------|----------|
| Thin titled panels | Uppercase title bars, 1px borders, tight padding | ✓ |
| Borderless cards | Rounded cards with shadows | |
| You decide | Claude picks | |

| Option | Description | Selected |
|--------|-------------|----------|
| Stack vertically | Columns stack, chat collapsible | ✓ |
| Horizontal scroll | Fixed desktop grid | |
| You decide | Claude picks | |

**User's choice:** 3-column grid with placeholders, thin titled panels, stack on tablet.

---

## Price flash feel

| Option | Description | Selected |
|--------|-------------|----------|
| Price cell only | Brief green/red tint fading ~500ms | ✓ |
| Whole row | Entire row tints | |
| Price text color | Text color fades, no background | |

| Option | Description | Selected |
|--------|-------------|----------|
| Direction from raw price | Compute direction unrounded; flat only if truly unchanged | ✓ |
| Skip flat ticks | Keep rounding, no flash on flat | |
| Bigger simulator moves | Increase per-tick volatility | |

| Option | Description | Selected |
|--------|-------------|----------|
| Small ▲/▼ arrow | Last-tick direction marker | ✓ |
| No marker | Flash + colored % only | |

| Option | Description | Selected |
|--------|-------------|----------|
| No, just update | Header total colored by P&L vs $10k, no flash | ✓ |
| Yes, flash too | Same flash as watchlist | |

**User's choice:** Cell-only flash, raw-price direction, arrows, quiet header.

---

## Watchlist row design

| Option | Description | Selected |
|--------|-------------|----------|
| Ticker · Sparkline · Price · Day % | One dense line | ✓ |
| Two-line rows | Sparkline on second line | |
| You decide | Claude picks | |

| Option | Description | Selected |
|--------|-------------|----------|
| Last ~5 minutes | Rolling ~600 ticks | ✓ |
| Everything since page load | Unbounded | |
| You decide | Claude picks | |

| Option | Description | Selected |
|--------|-------------|----------|
| By trend in window | Green/red by first vs last point | ✓ |
| Single accent color | Always blue | |

| Option | Description | Selected |
|--------|-------------|----------|
| Accent bar + tint | Yellow left border + lighter row | ✓ |
| Bold ticker only | Minimal | |
| You decide | Claude picks | |

**User's choice:** All recommended options.

---

## Main chart style

| Option | Description | Selected |
|--------|-------------|----------|
| Area line | Blue line with gradient fill from raw ticks | ✓ |
| Candles from ticks | 10s OHLC candles | |
| Plain line | Minimal | |

| Option | Description | Selected |
|--------|-------------|----------|
| First in watchlist | AAPL on fresh install | ✓ |
| Remember last selected | localStorage | |

| Option | Description | Selected |
|--------|-------------|----------|
| Title + stats strip | Ticker, price, change since load, session high/low, crosshair | ✓ |
| Crosshair only | Minimal | |
| You decide | Claude picks | |

| Option | Description | Selected |
|--------|-------------|----------|
| Show all, auto-fit | All ticks since load, scroll/zoom | ✓ |
| Rolling 5-minute view | Matches sparkline | |
| You decide | Claude picks | |

**User's choice:** All recommended options.

---

## Claude's Discretion

- Exact sizes, fonts (tabular numerals expected), spacing
- Header contents beyond total value, cash and connection dot
- Number formatting
- Start script output wording and image/container detection
- Frontend state management and component structure

## Deferred Ideas

None.
