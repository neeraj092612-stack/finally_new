---
status: complete
phase: 01-live-market-terminal
source: [01-VERIFICATION.md]
started: 2026-10-20T23:16:05.821Z
updated: 2026-10-21T01:08:02.447Z
---

## Current Test

[testing complete]

## Tests

### 1. Open http://localhost:8000 in a browser against the running finally-phase1-test container and watch the WATCHLIST for 10-20 seconds
expected: All 10 tickers (AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX) show prices updating about twice a second; each price briefly flashes green on an uptick or red on a downtick and the highlight fades in about 500ms; the up/down triangle marker persists after the flash; Day % is shown per row
result: pass

### 2. Watch the sparkline column right after a fresh page load, then after 1-2 minutes
expected: Sparklines start as a dashed baseline, then draw a polyline that fills in progressively from page load (green when up, red when down vs. first point)
result: pass

### 3. Click several watchlist rows (and use ArrowUp/ArrowDown), watching the CHART panel
expected: Chart title becomes CHART - TICKER; the Lightweight Charts area series draws the price since page load and extends live; the strip shows price, change since load, H and L; switching tickers fits the new series; scrolling/zooming is not undone by live ticks
result: pass

### 4. Check the connection dot while streaming, then run `docker pause`/`docker stop` is NOT allowed on the test container, so instead use browser DevTools > Network > Offline, then back online
expected: Dot is green with LIVE while streaming, yellow with RECONNECTING while the stream retries, red with OFFLINE if the EventSource closes
result: pass

### 5. Judge overall look at desktop width (>=1200px) and at tablet width (~900px)
expected: Dark (~#0d1117) dense Bloomberg-style grid with the specified accent colors; the placeholder panels (TRADE, HEATMAP, P&L, POSITIONS, AI CHAT) are visibly labelled as coming later; below 1200px the layout stacks and AI CHAT collapses behind the Show chat toggle
result: pass

### 6. Note the chart time axis labels vs. the crosshair tooltip time (review finding WR-03)
expected: Axis labels and crosshair time should show the same timezone; if the axis shows UTC and the crosshair local time, record as a follow-up polish item
result: pass

### 7. Optional, requires a paid Massive key: set MASSIVE_API_KEY in .env, restart through the start script, and open the page
expected: The same 10 tickers show real prices and Day % measured against the previous close, instead of simulated ones
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
