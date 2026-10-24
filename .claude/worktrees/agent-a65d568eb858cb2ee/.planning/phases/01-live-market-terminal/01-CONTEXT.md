# Phase 1: Live Market Terminal - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning

<domain>
## Phase Boundary

One start script (macOS/Linux or Windows) builds and runs a single Docker container on port 8000. Opening http://localhost:8000 shows a dark, dense terminal page: a header with live total value, $10,000 cash and a connection dot; a watchlist of the 10 default tickers streaming live prices that flash, with ▲/▼ markers, day change % and sparklines; and a main chart of the selected ticker. Backend: FastAPI app with lifespan-managed SQLite (schema, seed, startup snapshot), market data source startup, `GET /api/health`, `GET /api/portfolio`, `GET /api/watchlist`, the mounted SSE stream, and static frontend serving. Includes the market data fixes MKT-01/03/04/05, `.env.example`, Dockerfile and start/stop scripts.

Not in this phase: trading, watchlist add/remove, positions table, heatmap, P&L chart, trade bar, chat (Phases 2–3). Their panels exist only as placeholders.

</domain>

<decisions>
## Implementation Decisions

### Page layout & panels
- **D-01:** Desktop layout is a 3-column grid: watchlist in the left column (trade bar slot beneath it); center column has the main chart on top, then heatmap and P&L chart side by side, then the positions table; AI chat docked in the right column; header spans the full width on top.
- **D-02:** Build the final grid now. Panels not delivered in Phase 1 (positions, heatmap, P&L chart, trade bar, chat) render as titled placeholders with empty states (e.g. "No positions yet", "Chat — coming soon"), so the layout does not shift in later phases.
- **D-03:** Panel chrome is terminal-style: small uppercase title bar per panel (e.g. `WATCHLIST`, `CHART · AAPL`), 1px muted gray borders, tight padding, no rounded cards or shadows.
- **D-04:** Below desktop width (tablet), columns stack vertically and the chat panel is collapsible. Functional, not optimized.

### Price flash & tick feedback
- **D-05:** On each price change, only the price cell flashes: brief green (up) or red (down) background tint fading over ~500ms via CSS transition.
- **D-06:** Fix flat-direction ticks in the backend: compute `direction` (and `change`/`change_percent`) from the unrounded price, reporting `"flat"` only when the price truly did not change. Displayed/serialized prices remain 2 dp per the SSE contract. — **Reversibility:** reversible — internal to `PriceCache`/`PriceUpdate`; covered by existing market tests that must be updated.
- **D-07:** Each watchlist row shows a small green ▲ / red ▼ next to the price for the last tick direction.
- **D-08:** The header total value does not flash; it updates quietly and is colored by overall P&L versus the $10,000 start (green above, red below, neutral at par).

### Watchlist rows
- **D-09:** Single dense line per ticker, columns in order: Ticker · Sparkline · Price (+ ▲/▼) · Day %.
- **D-10:** Sparklines show a rolling window of the last ~5 minutes (~600 ticks at 500ms), hand-rolled SVG polylines.
- **D-11:** Sparkline stroke is green if the last point is above the first point in the window, red if below.
- **D-12:** The ticker shown in the main chart is marked with a yellow (`#ecad0a`) left accent bar plus a subtle lighter row background. Clicking a row selects it.
- **D-13:** Day % is colored green/red by sign. Rows with no price yet show placeholders (e.g. `—`) rather than zeros.

### Main chart
- **D-14:** Lightweight Charts area series: blue (`#209dd7`) line with a soft gradient fill, built from raw SSE ticks accumulated since page load for the selected ticker.
- **D-15:** On load the selected ticker is the first watchlist entry (AAPL on a fresh install). Selection is not persisted.
- **D-16:** The chart panel title/strip shows ticker, live price, change since page load (abs and %), and session high/low; crosshair with price label on hover.
- **D-17:** Time axis keeps all ticks since page load and auto-fits to width; the user can scroll/zoom.

### Carried forward from PROJECT.md (locked, not re-discussed)
- **D-18:** `day_change_percent` baseline = first price seen since server start (simulator); previous close in Massive mode.
- **D-19:** Connection dot maps `EventSource.readyState`: OPEN green, CONNECTING yellow, CLOSED red.
- **D-20:** Chart and sparkline history is browser-only; a page refresh empties it.
- **D-21:** DB init, market data start, and the startup portfolio snapshot run in the FastAPI lifespan; DB location from `DB_PATH` (default `db/finally.db`, `/app/db/finally.db` in Docker).
- **D-22:** Start scripts warn and run without `--env-file` if `.env` is missing; `.env.example` is committed.
- **D-23:** Write each §13.2 decision implemented in this phase back into `planning/PLAN.md`.

### Claude's Discretion
- Exact pixel sizes, fonts (a monospace/tabular-numeral font is expected for prices), and spacing within the "dense terminal" brief.
- Header contents beyond total value, cash and connection dot (e.g. app name/logo, unrealized P&L).
- Number formatting details (thousands separators, sign display).
- Start script output wording and how it detects an existing image/container.
- Frontend state management approach and component structure.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product spec and contracts
- `planning/PLAN.md` — full spec; §2 (UX and visual design, color scheme), §3–4 (architecture, directory layout), §5 (env vars), §6 (market data, SSE format), §7 (schema and seed), §8 (API contracts — exact field names, error codes), §10 (frontend design and technical notes), §11 (Docker, volume, start/stop scripts), §13.2 (open questions this phase resolves)
- `.planning/PROJECT.md` — Key Decisions table (resolutions of PLAN.md §13.2)
- `.planning/REQUIREMENTS.md` — Phase 1 requirement IDs: MKT-01, MKT-03, MKT-04, MKT-05, PLAT-01–03, PLAT-05–07, PORT-01, WATCH-01, UI-01, UI-02, UI-04, DEP-01–03

### Existing market data code
- `planning/MARKET_DATA_SUMMARY.md` — summary of the completed market data component
- `planning/MARKET_DATA_DESIGN.md` — design incl. fixes G1–G9 not yet applied to code
- `backend/CLAUDE.md` — market data API usage (PriceCache, MarketDataSource, create_stream_router)
- `.planning/codebase/CONCERNS.md` — verified defects (Massive `last_trade.timestamp` → `sip_timestamp` ns; module-level SSE router; simulator drops pre-start adds; 2 dp rounding makes ticks flat)
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/TESTING.md` — current structure and conventions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/market/cache.py` `PriceCache`: thread-safe latest-price store with `version` counter; feeds SSE, portfolio valuation and watchlist. Needs a day-change baseline (first price / previous close) and raw-price direction (D-06, D-18).
- `backend/app/market/factory.py` `create_market_data_source(cache)`: selects simulator vs Massive from `MASSIVE_API_KEY`; call in lifespan, then `await source.start(watchlist_tickers)`.
- `backend/app/market/stream.py` `create_stream_router(cache)`: SSE endpoint `/api/stream/prices`; move the module-level `APIRouter` inside the factory (MKT-03).
- `backend/app/market/seed_prices.py`: default tickers and seed prices — matches the DB seed watchlist.
- `backend/app/market/massive_client.py`: fix snapshot parsing (`last_trade.sip_timestamp` ns, fallback `updated`) and use `prev_day.close` as the day-change baseline (MKT-01, D-18).
- `test/node_modules`: Playwright already installed (for later E2E).

### Established Patterns
- Python: `from __future__ import annotations`, dataclasses, module loggers, ruff (line length 100, E/F/I/N/W), pytest with `asyncio_mode = "auto"`, tests under `backend/tests/<area>/`.
- Market data is push-based: sources write to the cache; consumers only read the cache.

### Integration Points
- New `backend/app/main.py` (FastAPI app + lifespan) wires DB, market source, SSE router, API routers, then static mount of the Next.js export.
- New `backend/app/db/` (or `backend/db/` per PLAN.md §4) for schema/seed SQL.
- New `frontend/` Next.js project (static export) consuming `/api/stream/prices`, `/api/portfolio`, `/api/watchlist`.
- New root `Dockerfile`, `.dockerignore`, `.env.example`, `scripts/start_*.{sh,ps1}`, `scripts/stop_*.{sh,ps1}`.

</code_context>

<specifics>
## Specific Ideas

- Bloomberg-terminal feel: dense, titled panels, every pixel earns its place (PLAN.md §2).
- Colors: background ~`#0d1117`, muted gray borders, accent yellow `#ecad0a` (selection), blue `#209dd7` (main chart line), purple `#753991` (submit buttons, later phases).
- Watchlist row reference:
  ```
  TICKER  SPARK        PRICE     DAY%
  AAPL   ╱╲╱─╱╲╱   190.24 ▲  +0.65%
  GOOGL  ╲╱╲╲╱─╲   174.88 ▼  -0.07%
  ```
- Layout reference:
  ```
  ┌ HEADER: FinAlly  Total $10,000  Cash $10,000  ● ┐
  ├──────────┬─────────────────────┬──────────┤
  │WATCHLIST │ MAIN CHART (AAPL)   │  AI CHAT │
  │          ├──────────┬──────────┤          │
  │          │ HEATMAP  │ P&L      │          │
  │          ├──────────┴──────────┤          │
  │          │ POSITIONS TABLE     │          │
  │[trade bar]│                     │          │
  └──────────┴─────────────────────┴──────────┘
  ```

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-live-market-terminal*
*Context gathered: 2026-10-20*
