---
phase: 01-live-market-terminal
plan: 07
subsystem: market-data
tags: [fastapi, sse, massive, polygon, tdd, fail-soft, pytest]

requires:
  - phase: 01-live-market-terminal
    provides: "01-01 create_app calling create_stream_router(cache) once; 01-03 PriceCache.update(reference_price=) and PriceUpdate.day_change_percent"
provides:
  - "create_stream_router builds a fresh APIRouter per call (one route per app); public generate_events"
  - "parse_snapshot / ParsedSnapshot / NS_PER_SECOND reading the real Massive TickerSnapshot fields"
  - "Fail-soft MassiveDataSource poller: redacted logging, one error per streak, exponential backoff capped at 120 s"
  - "Massive previous-close day-change baseline via cache.update(reference_price=prev_day.close)"
affects: [01-06, phase-02-watchlist-add-remove, frontend-watchlist-day-change]

actuals:
  tokens: 7000
  tasks: 2
  commits: 4

plan_head_before: 7342d6cbbf4ef7aa990f965d1f6c073cdb9e9b89
plan_head_after: 6998e4b663415a4ee6368bc0b80f69310d43ab9f

tech-stack:
  added: []
  patterns:
    - "Router built inside its factory function, never at module level"
    - "Pure parse function tested against real vendor models (TickerSnapshot.from_dict), not MagicMock"
    - "Exception text redacted of the API key before logging; first failure of a streak at error, rest at debug"

key-files:
  created:
    - backend/tests/market/test_stream_router.py
  modified:
    - backend/app/market/stream.py
    - backend/app/market/massive_client.py
    - backend/tests/market/test_massive.py

key-decisions:
  - "Kept _fetch_snapshots() argument-less (plan wording) and snapshot list(self._tickers) inside it, rather than the design doc's passed-in requested list"
  - "Backoff cap is 120 s (plan) not the 300 s in MARKET_DATA_DESIGN 10.3; exponent bounded at 10 so a long outage cannot overflow float math"
  - "_poll_once returns True when there is nothing to poll (no tickers or no client): it is not a failure and must not touch the failure streak"
  - "Preserved CRLF line endings on files that were stored CRLF in the index so diffs show only real changes"

patterns-established:
  - "Tests drive the SSE generator with a FakeRequest whose is_disconnected() is controllable, no HTTP server needed"

requirements-completed: [MKT-01, MKT-03, MKT-05, PLAT-06]

duration: 25min
completed: 2026-10-20
status: complete

coverage:
  - id: D1
    description: "Each create_stream_router call returns a distinct router with exactly one /api/stream/prices route; each create_app registers the stream route once"
    requirement: "MKT-03"
    verification:
      - kind: unit
        ref: "backend/tests/market/test_stream_router.py#TestCreateStreamRouter"
        status: pass
    human_judgment: false
  - id: D2
    description: "SSE generator emits retry first, nothing but retry on an empty cache, every watched ticker per event with reference_price/day_change_percent, and concurrent generators are independent"
    requirement: "PLAT-06"
    verification:
      - kind: unit
        ref: "backend/tests/market/test_stream_router.py#TestGenerateEvents"
        status: pass
    human_judgment: false
  - id: D3
    description: "parse_snapshot reads real TickerSnapshot fields (price fallback chain, ns timestamps, prev_day.close baseline) so Massive snapshots no longer drop every price"
    requirement: "MKT-01"
    verification:
      - kind: unit
        ref: "backend/tests/market/test_massive.py#TestParseSnapshot"
        status: pass
      - kind: unit
        ref: "backend/tests/market/test_massive.py#TestPollOnce"
        status: pass
    human_judgment: false
  - id: D4
    description: "Massive day change is measured against the previous close (cache.get('AAPL').day_change_percent == 0.65 for the design example)"
    requirement: "MKT-05"
    verification:
      - kind: unit
        ref: "backend/tests/market/test_massive.py#TestPollOnce::test_poll_writes_price_and_previous_close_baseline"
        status: pass
    human_judgment: false
  - id: D5
    description: "Failing polls never raise, never log the API key, log one error per streak, and back off up to 120 s; start() survives a failing first poll with the cache left unpriced"
    verification:
      - kind: unit
        ref: "backend/tests/market/test_massive.py#TestFailureHandling"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live Massive prices with a real API key (paid plan with the full-market snapshot endpoint)"
    verification: []
    human_judgment: true
    rationale: "No Massive key is available (RESEARCH OQ-3); correctness is proven against real TickerSnapshot models only, so live prices need a manual check"
---

# Phase 1 Plan 07: Stream router factory and Massive snapshot parsing Summary

**Per-call SSE router (no more duplicate routes) and a Massive poller that parses real `TickerSnapshot` fields with a previous-close day-change baseline, redacted logging and capped exponential backoff**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-10-20
- **Tasks:** 2 (both TDD)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `create_stream_router` now constructs its `APIRouter` inside the factory, so every call returns a distinct router with one route and each `create_app` registers `/api/stream/prices` exactly once (MKT-03, PLAT-06). `_generate_events` is public as `generate_events(price_cache, request, interval=0.5)`.
- `parse_snapshot` replaces the broken `snap.last_trade.timestamp` read (an attribute that does not exist on the real `LastTrade` model, so every Massive snapshot was skipped) with the design 10.2 chain: `last_trade.price`, `min.close`, `day.close`, `prev_day.close`, with `sip_timestamp`/`updated` nanosecond timestamps (MKT-01).
- Each poll writes `reference_price = prev_day.close`, so `day_change_percent` uses the previous close in Massive mode (MKT-05, D-18).
- Poller hardened: failures are caught, the API key is replaced by `***` in logged text, only the first failure of a streak logs at error, a recovery logs at info, the delay doubles per failure up to 120 s, and a ticker removed during an in-flight fetch is not written back.

## TDD Gate Compliance

Both tasks followed RED then GREEN; no REFACTOR commit was needed. `workflow.tdd_mode` is not enabled in `.planning/config.json` and the plan is `type: execute`, so the machine `check tdd-red-evidence` classifier was not run; the RED evidence below is a semantic assessment of the real pytest output.

- **Task 1 RED** (`12e1bb00`): 8 of 8 new tests failed for the planned reasons. `test_each_call_builds_its_own_router_with_one_route` failed on `assert first is not second` (the same module-level router object came back twice); `test_each_app_registers_the_stream_route_once` failed with `3 == 1` routes; the generator tests failed with `AttributeError: no attribute 'generate_events'` (the planned rename). Collected and executed, not load errors.
- **Task 1 GREEN** (`ef9b8fae`): 114 tests passed, ruff clean.
- **Task 2 RED** (`91476b02`): 19 failed, 10 passed (the unchanged ticker/lifecycle behaviors). The log captured the live defect verbatim: `Skipping snapshot for AAPL: 'LastTrade' object has no attribute 'timestamp'`.
- **Task 2 GREEN** (`6998e4b6`): 29 passed in `test_massive.py`; full suite 130 passed, ruff clean.

## Task Commits

1. **Task 1: one stream route per app (MKT-03)** - `12e1bb00` (test), `ef9b8fae` (feat)
2. **Task 2: Massive parsing, previous-close baseline, fail-soft polling** - `91476b02` (test), `6998e4b6` (feat)

**Plan metadata:** the docs commit that adds this SUMMARY.

## Files Created/Modified

- `backend/app/market/stream.py` - router built inside `create_stream_router`; public `generate_events`
- `backend/tests/market/test_stream_router.py` - router-factory and generator tests driven by a controllable `FakeRequest`
- `backend/app/market/massive_client.py` - `NS_PER_SECOND`, `ParsedSnapshot`, `_positive`, `parse_snapshot`, `_next_delay`, `_record_failure`, bool-returning `_poll_once`
- `backend/tests/market/test_massive.py` - rewritten on real `TickerSnapshot.from_dict` models

## Decisions Made

- `_fetch_snapshots()` stays argument-less as the plan states and copies `self._tickers` inside, so the worker thread never iterates a list that `add_ticker` is appending to.
- Backoff cap is 120 s per the plan (the design doc's 10.3 sketch says 300 s); the exponent is bounded so `2**n` cannot overflow after a very long outage.
- `_poll_once` returns `True` when there is nothing to poll, so an empty watchlist never counts as a failure.
- Files stored CRLF in the index were committed CRLF (`core.autocrlf=false` for those adds) so the diff of `stream.py` is 8 lines instead of a whole-file rewrite.

## Deviations from Plan

None - plan executed exactly as written. One process note: the first GREEN commit for `stream.py` had flipped the whole file from CRLF to LF (an 87/87 line diff); I amended my own unpushed commit to restore CRLF before moving on (`ef9b8fae` is the amended hash).

## Issues Encountered

- The `git commit` output shows `failed to delete .../.git/worktrees/agent-...: Permission denied` for two sibling worktrees. This is git's housekeeping pruning other agents' worktree metadata on Windows and does not affect these commits.

## Known Stubs

None.

## Threat Flags

None. T-01-11 (key redaction), T-01-13 (backoff cap, one error per streak) and T-01-14 (only positive numeric prices, malformed snapshot skipped) are implemented and covered by `TestFailureHandling` and `TestParseSnapshot`.

## User Setup Required

None - no external service configuration required. Live Massive verification needs a paid key and remains a manual check.

## Next Phase Readiness

- `create_stream_router(cache)` keeps its call signature, so `backend/app/main.py` (plan 01-06) needs no change.
- Massive mode now yields real prices and `day_change_percent`; the watchlist API can read `reference_price`/`day_change_percent` straight from the cache.
- Not verified against the live API: the free Stocks Basic plan is documented as lacking the full-market snapshot endpoint, so a free key is expected to fail soft (empty prices, backoff) rather than show data.

## Self-Check: PASSED

- Files exist: `backend/app/market/stream.py`, `backend/app/market/massive_client.py`, `backend/tests/market/test_stream_router.py`, `backend/tests/market/test_massive.py`
- Commits are ancestors of HEAD: `12e1bb00`, `ef9b8fae`, `91476b02`, `6998e4b6`
- Acceptance criteria re-run: all grep checks pass (`async def generate_events` present, `^router = APIRouter` absent, `TickerSnapshot.from_dict` present in tests, `last_trade.timestamp` absent from source and tests, `def parse_snapshot` and `reference_price=` present, key-redaction test asserts `test-secret-key` absent from `caplog.text`).
- Plan verification: `cd backend && uv run --no-sync pytest -q` -> 130 passed; `uv run --no-sync ruff check app/ tests/` -> All checks passed.

---
*Phase: 01-live-market-terminal*
*Completed: 2026-10-20*
