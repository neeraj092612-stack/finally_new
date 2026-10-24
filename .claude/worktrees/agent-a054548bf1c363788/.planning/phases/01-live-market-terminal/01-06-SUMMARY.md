---
phase: 01-live-market-terminal
plan: 06
subsystem: api
tags: [fastapi, sqlite, watchlist, portfolio, snapshots, tdd]

requires:
  - phase: 01-live-market-terminal
    provides: "01-01 server skeleton (config, db schema, services/watchlist.list_tickers, create_app lifespan, subprocess smoke harness)"
  - phase: 01-live-market-terminal
    provides: "01-03 PriceUpdate.reference_price/day_change_percent and the 9-key SSE payload"
provides:
  - "GET /api/watchlist: ordered entries with price, previous_price, direction, day_change_percent, added_at (nulls while unpriced)"
  - "GET /api/portfolio: PLAN section 8 shape with avg_cost fallback valuation"
  - "services.portfolio.build_portfolio and record_snapshot"
  - "One portfolio_snapshots row per backend start, written after the market source starts"
affects: [01-08 trade endpoint, 01-09 API tests, frontend header/watchlist/positions panels]

actuals:
  tokens: 14500
  tasks: 2
  commits: 4
plan_head_before: 7342d6cbbf4ef7aa990f965d1f6c073cdb9e9b89
plan_head_after: f1542ac18d2719f4046923e717d72bef538b8821

tech-stack:
  added: []
  patterns:
    - "Router factory create_*_router(settings, cache) with a per-request closing(connect(...)) connection in sync routes"
    - "Pure service functions taking (conn, cache) with no FastAPI imports"

key-files:
  created:
    - backend/app/api/watchlist.py
    - backend/app/api/portfolio.py
    - backend/app/services/portfolio.py
    - backend/tests/services/__init__.py
    - backend/tests/services/test_watchlist.py
    - backend/tests/services/test_portfolio.py
  modified:
    - backend/app/services/watchlist.py
    - backend/app/main.py
    - backend/tests/test_server_smoke.py

key-decisions:
  - "Each request opens its own SQLite connection via closing(connect(settings.db_path)); no yield dependency (sqlite3 connections are thread-bound)"
  - "build_portfolio rounds money and percents to 2 dp at the boundary; total_value = round(cash + rounded positions_value, 2)"
  - "Startup snapshot taken after await source.start(tickers) so cached prices exist for any held ticker"

patterns-established:
  - "Unpriced tickers surface as null price fields (never 0) on REST"
  - "Held tickers with no cached price are valued at avg_cost, keeping total_value stable"

requirements-completed: [WATCH-01, PORT-01, PLAT-01, MKT-05]

coverage:
  - id: D1
    description: "GET /api/watchlist returns the 10 defaults in order with 2 dp price, previous_price, direction, numeric day_change_percent and ISO added_at"
    requirement: WATCH-01
    verification:
      - kind: e2e
        ref: "backend/tests/test_server_smoke.py#test_watchlist_lists_defaults_with_live_prices"
        status: pass
      - kind: unit
        ref: "backend/tests/services/test_watchlist.py#test_list_entries_returns_seeded_tickers_in_order"
        status: pass
    human_judgment: false
  - id: D2
    description: "Unpriced watchlist entries carry null price fields, never 0; empty watchlist yields []; same-added_at rows keep insertion order"
    requirement: WATCH-01
    verification:
      - kind: unit
        ref: "backend/tests/services/test_watchlist.py#test_watchlist_entry_for_unpriced_ticker_has_null_price_fields_not_zero"
        status: pass
      - kind: unit
        ref: "backend/tests/services/test_watchlist.py#test_identical_added_at_rows_come_back_in_insertion_order"
        status: pass
    human_judgment: false
  - id: D3
    description: "SSE events carry the 9-key payload including reference_price and day_change_percent"
    requirement: MKT-05
    verification:
      - kind: e2e
        ref: "backend/tests/test_server_smoke.py#test_sse_streams_every_seeded_ticker"
        status: pass
    human_judgment: false
  - id: D4
    description: "GET /api/portfolio returns the PLAN section 8 shape; fresh DB is all cash; example values and avg_cost fallback are exact"
    requirement: PORT-01
    verification:
      - kind: unit
        ref: "backend/tests/services/test_portfolio.py#test_plan_section_8_example_is_valued_exactly"
        status: pass
      - kind: e2e
        ref: "backend/tests/test_server_smoke.py#test_portfolio_on_fresh_server_is_all_cash"
        status: pass
    human_judgment: false
  - id: D5
    description: "Each backend start records exactly one portfolio_snapshots row"
    requirement: PLAT-01
    verification:
      - kind: e2e
        ref: "backend/tests/test_server_smoke.py#test_each_start_records_one_portfolio_snapshot"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-10-20
status: complete
---

# Phase 01 Plan 06: Watchlist and Portfolio Reads Summary

**GET /api/watchlist (live price, direction, Day % with nulls while unpriced) and GET /api/portfolio (PLAN section 8 shape, avg_cost fallback) plus a portfolio snapshot on every server start**

## Performance

- **Duration:** 14 min
- **Completed:** 2026-10-20T17:50:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments
- `services/watchlist.py` gains `watchlist_entry` and `list_entries`, ordered by `added_at, rowid`, with null price fields when the ticker is not cached.
- `services/portfolio.py` provides `build_portfolio` (2 dp rounding at the boundary, positions ordered by ticker, avg_cost valuation fallback) and `record_snapshot`.
- Both routers are included in `create_app` ahead of the stream router and the static mount; the lifespan records one snapshot after the market source starts.
- 119 backend tests pass (full suite) and ruff is clean.

## Task Commits

1. **Task 1: GET /api/watchlist** - `0ddf646f` (test, RED), `78f929ce` (feat, GREEN)
2. **Task 2: GET /api/portfolio and startup snapshot** - `77bc1d31` (test, RED), `f1542ac1` (feat, GREEN)

**Plan metadata:** docs commit following this summary. No REFACTOR commits were needed.

## TDD Gate Compliance

- **RED (Task 1):** Service tests failed at collection with `ImportError: cannot import name 'list_entries'` (the planned symbols do not exist yet); the smoke test `test_watchlist_lists_defaults_with_live_prices` ran and failed with HTTP 404 on the absent route. Semantic assessment: both failures are for the intended reason (feature absent), not setup or fixture faults. The formal `check tdd-red-evidence` classifier was not run (pytest console output is not one of its supported report formats); evidence was inspected manually.
- **RED (Task 2):** `test_portfolio_on_fresh_server_is_all_cash` failed on the 404, and `test_each_start_records_one_portfolio_snapshot` failed with `assert 0 == 1` (no snapshot rows). Service tests failed at collection (missing `app.services.portfolio`). Same assessment.
- **GREEN:** full suite 119 passed after each feat commit; ruff clean.
- **REFACTOR:** none.

## Files Created/Modified
- `backend/app/services/watchlist.py` - `watchlist_entry`, `list_entries` added next to `list_tickers`
- `backend/app/api/watchlist.py` - `create_watchlist_router(settings, cache)`, `GET /api/watchlist`
- `backend/app/services/portfolio.py` - `build_portfolio`, `record_snapshot`
- `backend/app/api/portfolio.py` - `create_portfolio_router(settings, cache)`, `GET /api/portfolio`
- `backend/app/main.py` - router wiring and startup snapshot
- `backend/tests/services/{__init__,test_watchlist,test_portfolio}.py` - service tests
- `backend/tests/test_server_smoke.py` - watchlist, portfolio and snapshot smoke cases

## Decisions Made
- Per-request `closing(connect(...))` connections inside sync routes (thread-bound sqlite3).
- `total_value` computed from the rounded `positions_value` so the invariant `total_value == round(cash + positions_value, 2)` holds exactly in the response.
- Snapshot written after `await source.start(tickers)` per the plan.

## Deviations from Plan

None - plan executed exactly as written.

Environment note (not a deviation): the worktree's `uv sync --extra dev` resolved Python 3.13 from the machine's uv-managed interpreter (project requires >=3.12); all tests pass on it. Each `git commit` printed `failed to delete .git/worktrees/agent-...: Permission denied` for sibling worktree metadata; these are unrelated housekeeping errors and the commits succeeded.

## Issues Encountered
None

## Known Stubs
None. No hardcoded empty values reach any rendered output; `positions: []` is the real result for an empty portfolio.

## Threat Flags
None. T-01-27 mitigated: all SQL uses `?` placeholders with the `USER_ID` constant, and neither route reads request input.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Trade execution (01-08) can reuse `build_portfolio` and `record_snapshot` directly (the PLAN requires a snapshot after each trade).
- Frontend header, watchlist and positions panels can consume both endpoints now.

## Self-Check: PASSED

- Created files exist on disk (services/portfolio.py, api/portfolio.py, api/watchlist.py, tests/services/*).
- Commits `0ddf646f`, `78f929ce`, `77bc1d31`, `f1542ac1` are ancestors of HEAD; `git rev-list --count` from the plan base gives 4.
- `uv run --no-sync pytest -q`: 119 passed; `ruff check app/ tests/`: clean.

---
*Phase: 01-live-market-terminal*
*Completed: 2026-10-20*
