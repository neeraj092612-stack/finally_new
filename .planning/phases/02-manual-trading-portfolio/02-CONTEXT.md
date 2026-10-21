# Phase 2: Manual Trading & Portfolio - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning

<domain>
## Phase Boundary

The user manages the watchlist and trades from the UI, and every trade immediately shows up across the portfolio views. Backend: `POST /api/watchlist`, `DELETE /api/watchlist/{ticker}` (registering/unregistering with the market data source, MKT-02), `POST /api/portfolio/trade` (rule order, atomic, serialized), `GET /api/portfolio/history`, and full PLAT-04 error-envelope coverage. Frontend: watchlist add/remove controls, the trade bar, the positions table, the heatmap and the P&L chart replace their Phase 1 placeholders in the existing grid.

Not in this phase: chat panel and chat endpoints, `LLM_MOCK`, refresh-after-chat-actions (UI-10), Playwright E2E (all Phase 3). The trade service built here must be the single code path Phase 3's chat actions reuse.

</domain>

<decisions>
## Implementation Decision numbering

Decision IDs continue from Phase 1 (D-01–D-23) so code comments citing either phase stay unambiguous.

## Implementation Decisions

### Trade bar
- **D-24:** The ticker field follows the app selection: selecting a watchlist row, position row or heatmap tile fills it. The user can still type any ticker (the backend rejects unwatched/unpriced ones with its own error message).
- **D-25:** Fills and errors are reported on one inline status line beneath the Buy/Sell buttons: green for a fill (e.g. `Bought 10 AAPL @ $191.24`), red for an error showing the `message` from the `{"error": {...}}` body verbatim. The next trade or error replaces it. No toast, no confirmation dialog.
- **D-26:** The trade bar shows a live estimate (`≈ $1,912.40` = quantity × streamed price) plus context: available cash for buys and shares held for the entered ticker. It updates with the price stream.
- **D-27:** After a successful trade, ticker and quantity stay in place so a repeat trade is one click.
- **D-28:** The UI updates from the `portfolio` object in the trade response (PORT-06); no second request. History for the P&L chart is refetched after each trade (or the new snapshot appended) so the trade's point appears immediately.

### Watchlist add/remove
- **D-29:** An add-ticker input is pinned as a footer row of the WATCHLIST panel (Enter or a small button submits). Input is normalized by the backend; the UI does not pre-validate beyond trimming empties.
- **D-30:** Removal uses a small × that appears on row hover or keyboard focus at the right edge of the row. No confirmation. The × must not trigger row selection.
- **D-31:** Add and remove errors (`invalid_ticker`, `position_open`, `not_watched`) appear on one panel-level error line directly above the add input, cleared by the next watchlist action.
- **D-32:** If the ticker shown in the main chart is removed, selection falls back to the first watchlist entry (the existing AppShell fallback logic).
- **D-33:** A removed ticker disappears from the SSE payload and is pruned from the client price store, so its sparkline/chart history is dropped (resolves Phase 1 review IN-03).

### Positions table & heatmap
- **D-34:** Clicking a positions-table row or a heatmap tile selects that ticker app-wide (main chart and trade bar), with the same selection as the watchlist. Held tickers are always watched, so selection never targets an unwatched ticker.
- **D-35:** Positions table current price, unrealized P&L and % update live from streamed prices (client-side recalculation from `quantity`/`avg_cost`); P&L and % are colored green/red by sign.
- **D-36:** The heatmap tile color is graded by unrealized P&L %: green or red intensity scales with magnitude, capped at about ±5%, with near-neutral gray close to 0%.
- **D-37:** Tiles show the ticker (bold) and signed P&L %. Labels are hidden on tiles too small to fit them; a native tooltip/title gives full details (quantity, value, P&L).
- **D-38:** Heatmap covers positions only, with no cash tile. Weight = position market value / total positions value, recomputed from live prices.
- **D-39:** Treemap is hand-rolled (CSS/flex or SVG, per PLAN.md §10); squarified layout is preferred for readable tiles. Empty state keeps the Phase 1 "No positions to map" copy.

### P&L chart
- **D-40:** Lightweight Charts baseline series with base value $10,000: green above, red below, plus a dashed reference line at $10,000.
- **D-41:** Stored snapshots are fixed points. A single trailing live point at "now" shows the current total value from streamed prices, updated at most about once per second; it moves rather than accumulates.
- **D-42:** Time axis uses real timestamps and fits content. Gaps from restarts render as straight segments; no even spacing.
- **D-43:** The chart renders from the first load (startup snapshot(s) + live point), replacing the "No P&L history yet" placeholder.
- **D-44:** `GET /api/portfolio/history` orders by `recorded_at, rowid` because timestamps have one-second resolution (Phase 1 review IN-06). Lightweight Charts needs strictly increasing times, so the frontend must collapse or nudge points sharing a second.

### Carried forward (locked, not re-discussed)
- **D-45:** Position lifecycle: buys update `avg_cost` as a weighted average; partial sells keep `avg_cost`; a full sell deletes the position row (PLAN.md §13.2 item 17).
- **D-46:** Each trade is one SQLite transaction covering cash, position, trade log and snapshot, serialized by a process-wide async lock that Phase 3 chat trades will also use (item 19).
- **D-47:** Live total value and per-position values are recomputed client-side from SSE prices; REST data is refreshed from action responses (item 29). Refetch-after-chat-actions is Phase 3 (UI-10).
- **D-48:** Simulator accepts any well-formed ticker with a random seed price; Massive mode does not pre-validate symbols (item 11). An unpriced ticker shows `—` placeholders (D-13) and trades return `price_unavailable`.
- **D-49:** Write the §13.2 decisions implemented here (items 11, 17, 19, 21 as documented `docker volume rm`, 29) back into `planning/PLAN.md` (D-23).
- **D-50:** Phase 1 grid, panel chrome, colors and fonts (D-01–D-04, `01-UI-SPEC.md`) are reused; Buy/Sell and add-ticker submit buttons use purple `#753991` per PLAN.md, with Buy/Sell distinguishable (e.g. label/outline) at a glance.

### Claude's Discretion
- Fixing the open Phase 1 review warnings that touch this phase: WR-01 (uncaught exceptions must still return the JSON envelope), WR-02 (keep the 405 `Allow` header), WR-06 (lifespan source leak), WR-07 (start scripts exit 0 on a crashed container), IN-05 (missing profile row). Others (WR-03, WR-04, WR-05, IN-01, IN-02, IN-04) are optional and fixed only if cheap.
- Button disabled/pending state while a trade or watchlist request is in flight, and keyboard behavior (Enter in quantity field).
- Quantity input default and validation (positive whole numbers; the backend still returns `invalid_request`).
- Whether a newly added ticker becomes selected automatically.
- Positions table sort (backend returns by ticker; keep it unless there is a reason not to), optional totals row, and whether table prices flash.
- Exact heatmap color ramp values and label size thresholds.
- Frontend state shape for shared selection and portfolio (lifting state into AppShell or a small store).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product spec and contracts
- `planning/PLAN.md` §8: binding API contracts for `POST/DELETE /api/watchlist`, `POST /api/portfolio/trade` (rule order), `GET /api/portfolio/history`, error envelope and code/status table
- `planning/PLAN.md` §7: schema (`positions`, `trades`, `portfolio_snapshots`), §9 (auto-execution reuses these code paths), §10 (frontend elements, one charting library, hand-rolled treemap), §13.2 (items 11, 17, 18, 19, 21, 29)
- `.planning/PROJECT.md`: Key Decisions table (resolutions of §13.2)
- `.planning/REQUIREMENTS.md`: Phase 2 IDs MKT-02, PLAT-04, PORT-02–07, WATCH-02, WATCH-03, UI-03, UI-05–UI-08
- `.planning/ROADMAP.md`: Phase 2 success criteria

### Phase 1 artifacts
- `.planning/phases/01-live-market-terminal/01-CONTEXT.md`: D-01–D-23 (layout, chrome, flash, watchlist row, chart)
- `.planning/phases/01-live-market-terminal/01-UI-SPEC.md`: design tokens, typography, spacing, panel chrome to reuse
- `.planning/phases/01-live-market-terminal/01-REVIEW.md` and `01-REVIEW-DISPOSITION.md`: open findings WR-01–07, IN-01–06 referenced above
- `.planning/phases/01-live-market-terminal/01-PATTERNS.md`: code patterns established in Phase 1

### Codebase maps
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/TESTING.md`, `.planning/codebase/CONCERNS.md`
- `backend/CLAUDE.md`: market data API usage (PriceCache, MarketDataSource add/remove)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/portfolio.py`: `build_portfolio(conn, cache)` (exact §8 shape) and `record_snapshot(conn, cache)`. The trade service builds on these. Note that `record_snapshot` opens its own `with conn:` transaction, so it must be folded into the trade's single transaction (D-46).
- `backend/app/services/watchlist.py`: `list_tickers`, `watchlist_entry` (shape for the POST response), `list_entries`.
- `backend/app/errors.py`: JSON error envelope and handlers; extend with the trade/watchlist codes and fix WR-01/WR-02.
- `backend/app/api/watchlist.py`, `backend/app/api/portfolio.py`: existing GET routers to extend with POST/DELETE and trade/history.
- `backend/app/market/`: `MarketDataSource.add_ticker/remove_ticker`, `PriceCache.remove`; the Massive in-flight-poll race (MKT-02) lives in `massive_client.py`.
- `frontend/src/components/AppShell.tsx`: owns the `selected` ticker and the placeholder panels (TRADE, HEATMAP, P&L, POSITIONS) to replace in place. The POSITIONS column header row already exists.
- `frontend/src/components/Panel.tsx`, `PriceCell.tsx`, `ChartCanvas.tsx`/`ChartClient.tsx` (Lightweight Charts wrapper), `lib/format.ts`, `lib/priceStore.ts`, `lib/api.ts`, `lib/types.ts`, `lib/usePortfolio.ts` (fetch-once; needs to accept trade-response updates), `lib/useWatchlist.ts`.

### Established Patterns
- Backend: services are plain functions taking `conn` and `cache`, and routers stay thin; `USER_ID` constant from `app.db`; `now_iso()` timestamps; ruff; pytest under `backend/tests/<area>/` with httpx TestClient.
- Frontend: Vitest + Testing Library tests in `frontend/src/__tests__/`; Tailwind tokens from the Phase 1 UI-SPEC; client-only browser globals inside effects.

### Integration Points
- The trade service is the one entry point both `POST /api/portfolio/trade` and Phase 3 chat call (lock + transaction inside it).
- Watchlist add/remove must update DB, market data source and price cache together; removal also prunes the client price store (D-33).
- The shared selection in AppShell feeds the watchlist, chart, trade bar, positions table and heatmap.

</code_context>

<specifics>
## Specific Ideas

- Trade bar reference:
  ```
  TRADE
  [AAPL ] [10  ]  ≈ $1,912.40 · Cash $8,087.60
  [ BUY ] [ SELL ]
  Bought 10 AAPL @ $191.24
  ```
- Watchlist footer: `[+ Add ticker…      ]` with an error line above it in red when needed.
- Heatmap tile: `AAPL` / `+2.61%`, deeper green the bigger the gain, capped around ±5%.
- P&L chart: baseline at $10,000 with a dashed line; green above and red below; the last point tracks live value.

</specifics>

<deferred>
## Deferred Ideas

None. The discussion stayed within phase scope.

</deferred>

---

*Phase: 02-manual-trading-portfolio*
*Context gathered: 2026-10-20*
