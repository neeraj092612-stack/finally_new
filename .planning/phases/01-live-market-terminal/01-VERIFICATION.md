---
phase: 01-live-market-terminal
verified: 2026-10-20T23:30:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - ".env.example"
  - ".planning/phases/01-live-market-terminal/01-01-PLAN.md"
  - ".planning/phases/01-live-market-terminal/01-01-SUMMARY.md"
  - ".planning/phases/01-live-market-terminal/01-02-PLAN.md"
  - ".planning/phases/01-live-market-terminal/01-02-SUMMARY.md"
  - ".planning/phases/01-live-market-terminal/01-03-PLAN.md"
  - ".planning/phases/01-live-market-terminal/01-03-SUMMARY.md"
  - ".planning/phases/01-live-market-terminal/01-04-PLAN.md"
  - ".planning/phases/01-live-market-terminal/01-04-SUMMARY.md"
  - ".planning/phases/01-live-market-terminal/01-05-PLAN.md"
  - ".planning/phases/01-live-market-terminal/01-05-SUMMARY.md"
  - ".planning/phases/01-live-market-terminal/01-06-PLAN.md"
  - ".planning/phases/01-live-market-terminal/01-06-SUMMARY.md"
  - ".planning/phases/01-live-market-terminal/01-07-PLAN.md"
  - ".planning/phases/01-live-market-terminal/01-07-SUMMARY.md"
  - ".planning/phases/01-live-market-terminal/01-08-PLAN.md"
  - ".planning/phases/01-live-market-terminal/01-08-SUMMARY.md"
  - ".planning/phases/01-live-market-terminal/01-09-PLAN.md"
  - ".planning/phases/01-live-market-terminal/01-09-SUMMARY.md"
  - ".planning/phases/01-live-market-terminal/01-10-PLAN.md"
  - ".planning/phases/01-live-market-terminal/01-10-SUMMARY.md"
  - ".planning/phases/01-live-market-terminal/01-11-PLAN.md"
  - ".planning/phases/01-live-market-terminal/01-11-SUMMARY.md"
  - ".planning/phases/01-live-market-terminal/01-12-PLAN.md"
  - ".planning/phases/01-live-market-terminal/01-12-SUMMARY.md"
  - ".planning/phases/01-live-market-terminal/01-13-PLAN.md"
  - ".planning/phases/01-live-market-terminal/01-13-SUMMARY.md"
  - ".planning/phases/01-live-market-terminal/01-14-PLAN.md"
  - ".planning/phases/01-live-market-terminal/01-14-SUMMARY.md"
  - "Dockerfile"
  - "backend/app/db/__init__.py"
  - "backend/app/main.py"
  - "backend/app/market/massive_client.py"
  - "backend/app/market/simulator.py"
  - "backend/app/market/stream.py"
  - "backend/app/services/portfolio.py"
  - "backend/app/services/watchlist.py"
  - "frontend/src/components/AppShell.tsx"
  - "frontend/src/components/ChartCanvas.tsx"
  - "frontend/src/components/Header.tsx"
  - "frontend/src/components/WatchlistRow.tsx"
  - "frontend/src/lib/priceStore.ts"
  - "scripts/start_mac.sh"
  - "scripts/start_windows.ps1"
covered_digest: "v3:sha256:4f8dcdca38f1afe6a1c0ce688f0cf78b88935cf87adfadf3fc01fe22f2d89a63"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open http://localhost:8000 in a browser against the running finally-phase1-test container and watch the WATCHLIST for 10-20 seconds"
    expected: "All 10 tickers (AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX) show prices updating about twice a second; each price briefly flashes green on an uptick or red on a downtick and the highlight fades in about 500ms; the up/down triangle marker persists after the flash; Day % is shown per row"
    why_human: "CSS animation timing and perceived flash/fade quality cannot be observed with grep or jsdom. Unit tests only prove the flash-up/flash-down class is applied and the span remounts per tick."
  - test: "Watch the sparkline column right after a fresh page load, then after 1-2 minutes"
    expected: "Sparklines start as a dashed baseline, then draw a polyline that fills in progressively from page load (green when up, red when down vs. first point)"
    why_human: "Progressive visual fill-in over time is a rendered-browser behavior."
  - test: "Click several watchlist rows (and use ArrowUp/ArrowDown), watching the CHART panel"
    expected: "Chart title becomes CHART - TICKER; the Lightweight Charts area series draws the price since page load and extends live; the strip shows price, change since load, H and L; switching tickers fits the new series; scrolling/zooming is not undone by live ticks"
    why_human: "Canvas drawing by Lightweight Charts is not testable in jsdom (the chart library is mocked in unit tests)."
  - test: "Check the connection dot while streaming, then run `docker pause`/`docker stop` is NOT allowed on the test container, so instead use browser DevTools > Network > Offline, then back online"
    expected: "Dot is green with LIVE while streaming, yellow with RECONNECTING while the stream retries, red with OFFLINE if the EventSource closes"
    why_human: "Real EventSource readyState transitions need a browser; unit tests drive a fake EventSource."
  - test: "Judge overall look at desktop width (>=1200px) and at tablet width (~900px)"
    expected: "Dark (~#0d1117) dense Bloomberg-style grid with the specified accent colors; the placeholder panels (TRADE, HEATMAP, P&L, POSITIONS, AI CHAT) are visibly labelled as coming later; below 1200px the layout stacks and AI CHAT collapses behind the Show chat toggle"
    why_human: "Visual density and responsive layout quality are subjective and need eyes."
  - test: "Note the chart time axis labels vs. the crosshair tooltip time (review finding WR-03)"
    expected: "Axis labels and crosshair time should show the same timezone; if the axis shows UTC and the crosshair local time, record as a follow-up polish item"
    why_human: "Rendered axis text only exists in a real browser canvas."
  - test: "Optional, requires a paid Massive key: set MASSIVE_API_KEY in .env, restart through the start script, and open the page"
    expected: "The same 10 tickers show real prices and Day % measured against the previous close, instead of simulated ones"
    why_human: "Needs an external service and a credential. The parsing, previous-close baseline and fail-soft polling are covered by unit tests with fake snapshots only."
---

# Phase 1: Live Market Terminal Verification Report

**Phase Goal:** User starts the app with one script, opens http://localhost:8000, and watches the 10 default tickers stream live with flashing prices, sparklines and a main chart, next to a $10,000 portfolio
**Verified:** 2026-10-20T23:30:00Z
**Status:** human_needed
**Re-verification:** No, initial verification

All automated and programmatic checks pass. No gaps were found. The only open items are browser-visual checks that the end-of-phase human-verify mode defers to a person.

Note on MVP mode: ROADMAP.md marks this phase `Mode: mvp`, but the goal text is not in the "As a ..., I want to ..., so that ..." User Story form. I did not refuse to verify. I applied standard goal-backward verification against the five roadmap success criteria. Consider rewording the goal as a user story or dropping the mode flag so a later MVP-mode audit does not trip on the format guard.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `start_mac.sh` / `start_windows.ps1` build the image if needed (or on `--build`), run one container on 8000 with the `finally-data` volume and print the URL; re-running is harmless; starts with a warning when `.env` is missing; stop script removes the container but keeps the data | VERIFIED | Read all four scripts. Both start scripts: docker/daemon checks, build when `--build`/-Build or no image, `docker rm -f` then `docker run -d --name -v finally-data:/app/db -p 127.0.0.1:8000:8000`, `--env-file .env` only when the file exists, otherwise a WARNING and run without it, health-wait loop, print `http://localhost:$PORT`. Stop scripts `docker rm -f` only the container, never `docker volume rm`, and exit 0 when absent. A container started by the script is up and healthy right now (`finally-phase1-test`, `127.0.0.1:8000->8000/tcp ... (healthy)`). The orchestrator additionally ran the PowerShell start/stop sequence. Minor: see WR-07 (script exits 0 and says "starting" if the container crashed). |
| 2 | Page shows a dark terminal header with $10,000.00 cash, total value, and a connection dot: green streaming, yellow reconnecting, red disconnected | VERIFIED (visual items routed to human) | Live `GET /api/portfolio` returns `cash_balance 10000.0, total_value 10000.0`. `Header.tsx` fetches the portfolio, formats via `formatUsd`, computes a live total from SSE prices (`liveTotal`), and renders `ConnectionIndicator`. `ConnectionIndicator.tsx` maps open -> `bg-up` LIVE, connecting -> `bg-warn` RECONNECTING/CONNECTING, closed -> `bg-down` OFFLINE; `priceStore.ts` maps `EventSource.readyState` CONNECTING/CLOSED with 2s-10s backoff reopen. `GET /` returns 200 text/html (15,307 bytes) containing `FinAlly`, `TOTAL VALUE`, `WATCHLIST`, `CONNECTING`; all referenced `_next/static` JS and CSS assets return 200. Header/ConnectionIndicator/priceStore unit tests pass. |
| 3 | Watchlist shows the 10 default tickers with prices updating ~500ms, flash green/red fading ~500ms, a day change %, and sparklines that fill in from page load | VERIFIED (animation quality routed to human) | `GET /api/watchlist` returns exactly AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX in order, each priced with `day_change_percent`. A 3s read of `/api/stream/prices` showed `retry: 1000` then `data:` events carrying every ticker with `reference_price`/`day_change_percent`. `generate_events` loops at 0.5s on cache version change. Frontend: `priceStore.ingest` dedupes by timestamp, bumps per-ticker `flash.seq` and persists `marker`; `PriceCell` keys the span on `flash.seq` so a new tick remounts it and restarts the `flash-up`/`flash-down` CSS animation; `WatchlistRow` binds price, Day % (SSE value, REST fallback) and `Sparkline` fed by `sparklineWindow(getTicks(ticker))` (hand-rolled SVG polyline, dashed baseline until 2 points). 163 frontend tests pass including PriceCell, WatchlistPanel, sparkline, priceStore. |
| 4 | Clicking a watchlist ticker shows it in the main chart as price over time since page load | VERIFIED (canvas rendering routed to human) | `AppShell` owns `selected` (AAPL default via effect on first entry), passes `onSelect` to `WatchlistPanel`; row click/Enter/Space and Arrow keys call it; `MainChartPanel` receives `ticker`, renders `ChartStrip` and `ChartClient` (dynamic, `ssr:false`) -> `ChartCanvas` (Lightweight Charts v5 `AreaSeries`). On ticker change it `setData(collapseBySecond(getTicks(ticker)))` + `fitContent`, then `onTick` appends live points. Tick buffers are filled from SSE since page load (cap 50,000). Only Lightweight Charts is used. AppShell, MainChartPanel, ChartCanvas, chartData tests pass. |
| 5 | `GET /api/health` returns `{"status":"ok"}`; DB created and seeded at `DB_PATH` on first start and survives restart; with `MASSIVE_API_KEY` the same watchlist shows real Massive prices with day change vs previous close | VERIFIED (live Massive run needs human + credential) | Live `/api/health` -> `{"status":"ok"}`. `Settings.from_env` honours `DB_PATH` (default `<repo>/db/finally.db`; Dockerfile sets `/app/db/finally.db`). `init_db` creates schema and, only when the profile row is newly inserted, seeds cash 10000 and the 10 tickers. Tests `test_database_is_created_and_seeded`, `test_restart_on_same_db_does_not_reseed`, `test_each_start_records_one_portfolio_snapshot`, `test_user_deleted_ticker_is_not_reseeded` pass. 01-11 SUMMARY records snapshots 1 -> 2 across `docker restart` on a named volume (consistent with the orchestrator's gates). Massive path: `parse_snapshot` uses `last_trade.price` with minute/day/prev-day fallbacks, `sip_timestamp` ns -> s, `prev_day.close` as `reference_price`; `_poll_once` re-reads the watched set after the await and fails soft with backoff. Unit tests in `test_massive.py` pass against fake snapshots. Real-key behavior is untested end to end. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified; visual follow-ups are listed under Human Verification Required)

### Deferred Items

None. Gaps in this phase would have belonged to Phases 2 and 3 (trading, positions, heatmap, chat), which are placeholder panels here by design.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/main.py` | FastAPI factory + lifespan: init DB, start source with watchlist, startup snapshot, routers before static mount | VERIFIED | Lifespan order DB -> `list_tickers` -> `source.start(tickers)` -> `record_snapshot` -> yield -> `source.stop()`. Routers (health, watchlist, portfolio, stream) registered, JSON `/api/{path}` catch-all, `StaticFiles(html=True)` mounted last and guarded for a missing dir. |
| `backend/app/db/` | Schema, lazy init, seed | VERIFIED | All six PLAN section 7 tables; seed tied to profile insert; WAL mode. |
| `backend/app/services/{portfolio,watchlist}.py`, `app/api/{health,portfolio,watchlist}.py` | Real queries against SQLite + PriceCache | VERIFIED | Real `SELECT`s per request with own connection; values built from `cache`; unpriced tickers give `null` not 0. |
| `backend/app/market/{stream,massive_client,simulator,cache,models}.py` | MKT-01/03/04/05 fixes | VERIFIED | Router built inside `create_stream_router` (no module-level router; tests assert one route per app). Simulator `_pending` queue merged at `start()`. `reference_price` baseline in cache/model/SSE. |
| `frontend/src/components/*`, `frontend/src/lib/*` | Terminal grid, header, watchlist, chart, SSE store | VERIFIED | All substantive and wired from `AppShell`; no stubs among the Phase 1 panels. TRADE/HEATMAP/P&L/POSITIONS/AI CHAT are deliberate `PlaceholderPanel`s (Phases 2-3). |
| `Dockerfile`, `.dockerignore`, `.env.example` | Multi-stage Node 20 -> Python 3.12 + uv; env template | VERIFIED | `node:20-slim` build stage -> `python:3.12-slim` with uv 0.11.7, `uv sync --frozen`, static copied to `/app/static`, HEALTHCHECK, single uvicorn worker. `.env.example` has `OPENROUTER_API_KEY`, `MASSIVE_API_KEY`, `LLM_MOCK`. |
| `scripts/{start,stop}_{mac.sh,windows.ps1}` | Idempotent start/stop wrappers | VERIFIED | See truth 1. |
| `planning/PLAN.md` write-back | Phase 1 decisions recorded | VERIFIED | Commit feadd9fa; sections cover `DB_PATH`/`STATIC_DIR`, `day_change_percent` baseline, additive SSE keys, loopback port publishing, `.env.example`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AppShell` | price stream | `connectPriceStream()` in `useEffect` -> `EventSource('/api/stream/prices')` | WIRED | Single connection for the whole page. |
| `priceStore` | `WatchlistRow`, `Header`, `MainChartPanel`, `ChartStrip` | `useSyncExternalStore` / `getTicks` / `onTick` | WIRED | |
| `useWatchlist` | `GET /api/watchlist` | `fetchWatchlist()` | WIRED | Also scopes ingestion via `setWatchedTickers`. |
| `usePortfolio` | `GET /api/portfolio` | `fetchPortfolio()` | WIRED | Header shows fixed error caption on failure. |
| `main.py` lifespan | `MarketDataSource` + `PriceCache` | `create_market_data_source(cache)` shared with stream, watchlist and portfolio routers | WIRED | One cache instance. |
| `main.py` | static export | `StaticFiles` at `/` after API routers | WIRED | Live `/` serves the page; `/api/nope` returns JSON 404 envelope. |
| `Dockerfile` | frontend build | `COPY --from=frontend /build/out ./static` + `STATIC_DIR=/app/static` | WIRED | |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `WatchlistRow` | `tick.price`, `dayPct`, sparkline values | SSE `/api/stream/prices` <- `PriceCache` <- `SimulatorDataSource`/`MassiveDataSource` | Yes (live stream observed changing across reads) | FLOWING |
| `Header` | `portfolio.data`, `latest` | `GET /api/portfolio` <- SQLite `users_profile`/`positions`; SSE for live total | Yes (`cash_balance 10000.0` from seeded row) | FLOWING |
| `ChartCanvas` | tick buffer | `priceStore.getTicks` / `onTick` | Yes | FLOWING |
| `GET /api/watchlist` | entries | SQLite `watchlist` + `PriceCache.get` | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Health | `curl 127.0.0.1:8000/api/health` | `{"status":"ok"}` | PASS |
| Watchlist | `curl .../api/watchlist` | 10 tickers in seed order, priced, with `day_change_percent` | PASS |
| Portfolio | `curl .../api/portfolio` | cash 10000.0, total 10000.0, `positions: []` | PASS |
| SSE | `curl -N .../api/stream/prices` (3s) | `retry: 1000`, then `data:` with every ticker incl. `reference_price` | PASS |
| Static page | `curl .../` | 200 text/html, contains FinAlly / WATCHLIST / TOTAL VALUE; all `_next/static` assets 200 | PASS |
| API 404 envelope | `curl .../api/nope` | 404 `{"error":{"code":"not_found",...}}` | PASS |
| Backend suite | `uv run --no-sync pytest -q` | 171 passed | PASS |
| Backend lint | `ruff check app tests` | All checks passed | PASS |
| Frontend suite | `npm test` | 163 passed | PASS |
| Frontend typecheck | `npm run typecheck` | clean | PASS |

I ran these myself; nothing was started, stopped or rebuilt on the test container.

### Probe Execution

Step 7c: SKIPPED. No `probe-*.sh` files exist and no plan declares probe-based verification.

### Requirements Coverage

All 18 phase requirement IDs appear in at least one PLAN's `requirements:` frontmatter; there are no orphaned IDs. Union of plan-declared IDs: PLAT-01/02/03/05/06/07, UI-01, UI-02, UI-04, MKT-01/03/04/05, WATCH-01, PORT-01, DEP-01/02/03. REQUIREMENTS.md maps exactly these 18 to Phase 1, and no other Phase 1 IDs exist there.

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| MKT-01 | 01-07 | Massive snapshot parsing with real `LastTrade` fields | SATISFIED | `parse_snapshot` (`sip_timestamp` ns, fallbacks); `test_massive.py` |
| MKT-03 | 01-07 | SSE router creation not duplicated | SATISFIED | Router built per call; `test_each_call_builds_its_own_router_with_one_route`, `test_no_module_level_router_remains` |
| MKT-04 | 01-03 | Pre-start simulator adds not dropped | SATISFIED | `_pending` queue; five pre-start tests in `test_simulator_source.py` |
| MKT-05 | 01-03, 01-06, 01-07 | `day_change_percent` baseline | SATISFIED | Cache/model `reference_price`; first price (simulator) / `prev_day.close` (Massive); live values observed |
| PLAT-01 | 01-01, 01-06 | Lifespan inits DB, starts source, startup snapshot | SATISFIED | `main.py` lifespan; `test_each_start_records_one_portfolio_snapshot` |
| PLAT-02 | 01-01, 01-09, 01-11 | `DB_PATH` + persistence | SATISFIED | `config.py`, Dockerfile env, restart tests, volume persistence evidence |
| PLAT-03 | 01-01, 01-09 | Seed profile + 10 tickers | SATISFIED | `init_db`; live watchlist/portfolio |
| PLAT-05 | 01-01 | `GET /api/health` | SATISFIED | Live response |
| PLAT-06 | 01-01, 01-07 | SSE mounted and streaming | SATISFIED | Live stream read |
| PLAT-07 | 01-01, 01-09, 01-11 | Static mount after API routes | SATISFIED | `main.py`; `test_api_routes_win_over_static_mount`; live `/` |
| PORT-01 | 01-06 | `GET /api/portfolio` | SATISFIED | `build_portfolio`; live response in PLAN section 8 shape |
| WATCH-01 | 01-06, 01-10, 01-12 | Watchlist with price, previous price, direction, day %, ordered, nulls when unpriced | SATISFIED | `watchlist_entry`/`list_entries`; live response |
| UI-01 | 01-02, 01-04, 01-05, 01-08 | Dark dense page, live header, connection dot | SATISFIED (visual check pending) | Header, ConnectionIndicator, tests |
| UI-02 | 01-03, 01-05, 01-10, 01-12 | Flashing prices, day %, sparklines | SATISFIED (animation check pending) | PriceCell, Sparkline, tests |
| UI-04 | 01-12, 01-14 | Click ticker -> main chart | SATISFIED (canvas check pending) | AppShell/MainChartPanel/ChartCanvas |
| DEP-01 | 01-11 | Multi-stage Dockerfile | SATISFIED | Dockerfile read; healthy running image |
| DEP-02 | 01-11, 01-13 | `.env.example` | SATISFIED | File contains the three variables |
| DEP-03 | 01-13 | Start/stop scripts | SATISFIED | See truth 1 |

Bookkeeping note (not a gap): the REQUIREMENTS.md traceability table and checkboxes still show these 18 IDs as Pending, and ROADMAP.md still has the Phase 1 box unchecked. The orchestrator should update them when it closes the phase.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX` markers anywhere in `backend/app`, `frontend/src`, `frontend/app`, `scripts`, `Dockerfile` or `.env.example`. No blocker stubs: the `PlaceholderPanel` usages are the intended empty states for Phase 2-3 features and are not part of Phase 1 requirements.

The 01-REVIEW.md warnings (0 critical, 7 warning, 6 info) were reviewed against the Phase 1 goal. None blocks it; they remain `open` in 01-REVIEW-DISPOSITION.md.

| Item | Severity | Impact on Phase 1 goal |
|------|----------|------------------------|
| WR-01 unhandled exceptions bypass the error envelope; WR-02 405 loses `Allow` header | Warning | PLAT-04 belongs to Phase 2; no Phase 1 requirement affected |
| WR-03 chart time axis UTC vs crosshair local | Warning | Cosmetic; included in human checks |
| WR-04 weak smoke test (`missing` param inverted) | Warning | Test quality only; the guard it targets is read in `main.py` |
| WR-05 container runs as root | Warning | Hardening; loopback-only publishing mitigates |
| WR-06 lifespan leaks source if snapshot fails | Warning | Failure-path only |
| WR-07 start scripts exit 0 and say "starting" if the container crashed | Warning | Touches SC1 edge case only; happy path and health wait work |
| IN-01..IN-06 | Info | None |

### Human Verification Required

See the `human_verification` list in the frontmatter (7 items): flash/fade visual check, sparkline progressive fill-in, main chart drawing and ticker switching, connection dot state transitions in a real browser, overall look and tablet stacking, the WR-03 axis timezone check, and an optional real-Massive-key run. The container `finally-phase1-test` is already up on http://127.0.0.1:8000 for these. Do not use `docker stop`/`pause` on it for the connection dot check; use the browser's offline toggle instead.

### Gaps Summary

No gaps. The backend, SSE stream, seeded SQLite, static serving, Docker image and start/stop scripts are implemented and exercised against a live container started through the project's own script. The frontend panels for header, watchlist (flash, Day %, sparklines) and main chart are real, wired to the shared SSE store and fed by live data. Backend (171) and frontend (163) suites, ruff and typecheck all pass on the merged tree. Status is `human_needed` rather than `passed` only because the visual/animation behaviors and the real-Massive run cannot be proven programmatically.

---

_Verified: 2026-10-20T23:30:00Z_
_Verifier: Claude (gsd-verifier)_
