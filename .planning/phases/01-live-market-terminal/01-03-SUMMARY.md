---
phase: 01-live-market-terminal
plan: 03
subsystem: market-data
tags: [python, fastapi, simulator, price-cache, sse, tdd]

requires:
  - phase: none
    provides: existing backend/app/market package (PriceCache, PriceUpdate, GBMSimulator, SimulatorDataSource)
provides:
  - "PriceUpdate.reference_price / raw_price / raw_previous_price fields and day_change_percent property"
  - "PriceCache.update(ticker, price, timestamp=None, reference_price=None) with carried first-price baseline"
  - "Direction and change computed from raw (unrounded) prices so sub-cent ticks report up/down (D-06)"
  - "SimulatorDataSource pre-start pending queue (MKT-04)"
  - "SSE/to_dict wire gains reference_price and day_change_percent (additive)"
affects: [01-06 watchlist endpoint, 01-07 massive reference_price, frontend flash and Day % column]

plan_head_before: 3d992ee5cc48b1b365b0a93b354828eb11e68983
plan_head_after: 309af0cc03287cb0315659bb498e88db88be6ed3

actuals:
  tokens: 9500
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Raw value kept internally on the frozen dataclass, display value rounded at the cache; raw fields never serialized"
    - "Cache carries the day-change baseline forward unless the source supplies one"

key-files:
  created: []
  modified:
    - backend/app/market/models.py
    - backend/app/market/cache.py
    - backend/app/market/simulator.py
    - backend/tests/market/test_cache.py
    - backend/tests/market/test_models.py
    - backend/tests/market/test_simulator.py
    - backend/tests/market/test_simulator_source.py

key-decisions:
  - "Rounding moved from GBMSimulator.step() to PriceCache.update(); the simulator emits unrounded prices so D-06 is not a no-op"
  - "PriceCache.version now reads under the lock (was unlocked)"
  - "models.py kept CRLF in the index like the rest of the package to avoid a whole-file diff"

patterns-established:
  - "Pre-start queue: sources accept add/remove before start() and merge with order-preserving dedupe"

requirements-completed: [MKT-04, MKT-05, UI-02]

coverage:
  - id: D1
    description: "Ticks report up/down on every real price move (sub-cent included); flat only when the raw price did not change"
    requirement: UI-02
    verification:
      - kind: unit
        ref: "backend/tests/market/test_cache.py#TestRawPriceDirection"
        status: pass
      - kind: unit
        ref: "backend/tests/market/test_models.py#TestPriceUpdateExtensions"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every cached ticker carries reference_price (first price since start, or explicit) and day_change_percent; to_dict has 9 keys and never raw fields"
    requirement: MKT-05
    verification:
      - kind: unit
        ref: "backend/tests/market/test_cache.py#TestReferencePrice"
        status: pass
      - kind: unit
        ref: "backend/tests/market/test_models.py#test_to_dict_has_exactly_nine_keys"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tickers added to SimulatorDataSource before start() are priced after start(); pending removals honored; re-add after start is a no-op"
    requirement: MKT-04
    verification:
      - kind: unit
        ref: "backend/tests/market/test_simulator_source.py#TestPreStartTickers"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-20
status: complete
---

# Phase 1 Plan 03: Market Data Core Fixes Summary

**Raw-price direction (D-06), first-price day-change baseline (D-18) and a pre-start ticker queue (MKT-04) for the price cache and simulator, TDD with 4 commits.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-10-20T17:23:36Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 7

## Accomplishments
- A raw move from 190.001 to 190.003 now reports `direction == "up"` even though both display prices are 190.00; "flat" means the raw price truly did not change. This unblocks the green/red flash on most 500ms ticks (UI-02).
- Every cached ticker exposes `reference_price` and `day_change_percent` (190.00 to 191.24 gives 0.65); an explicit `reference_price` (for Massive, plan 01-07) overrides the carried baseline, and None/0 yields `day_change_percent` None (MKT-05).
- `SimulatorDataSource` queues tickers added before `start()` and prices them at start; remove-before-start drops them; re-adding a simulated ticker writes no spurious tick (MKT-04).
- `PriceCache.remove()` bumps `version` only on a real removal; `timestamp=0.0` is no longer treated as missing.

## TDD Gate Compliance

| Task | RED | GREEN |
|------|-----|-------|
| 1 | `54f72e27` test(01-03) | `aaa60755` feat(01-03) |
| 2 | `33828ddd` test(01-03) | `309af0cc` feat(01-03) |

No REFACTOR commits (no cleanup needed).

**RED evidence (semantic assessment):** Task 1 RED: 17 tests failed (TypeError on the unknown constructor/`update` kwargs, AttributeError for `day_change_percent`/`reference_price`, wrong direction "flat" for the 190.001 to 190.003 case, `step()` returning values already rounded to 2 dp). Task 2 RED: 4 failed (`PYPL` absent from the cache after start, `get_tickers()` empty before start, dedupe/order wrong, re-add bumped `cache.version` from 1 to 2). Each failure was on the planned behavior, not on import or collection errors. A few new tests (remove-absent-keeps-version, identical-raw-is-flat, display rounding at the cache, remove-pending-before-start) passed at RED because HEAD already satisfied them; they are regression guards for the new implementation, not discriminating tests. The `gsd_run check tdd-red-evidence` classifier was not run: the plan is `type: execute` with `tdd="true"` tasks, not a `type: tdd` plan, and pytest's default output is not one of its supported report formats.

## Task Commits

1. **Task 1: Raw-price direction and day-change baseline** - `54f72e27` (test), `aaa60755` (feat)
2. **Task 2: Pre-start ticker queue** - `33828ddd` (test), `309af0cc` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## Files Created/Modified
- `backend/app/market/models.py` - `reference_price`, `raw_price`, `raw_previous_price` fields; `day_change_percent`; direction/change on raw values; 9-key `to_dict`
- `backend/app/market/cache.py` - `update(..., reference_price=None)`, baseline carry, raw tracking, `remove()` version fix, `timestamp is None` check
- `backend/app/market/simulator.py` - unrounded `step()`; `_pending` queue in `SimulatorDataSource`
- `backend/tests/market/test_cache.py`, `test_models.py`, `test_simulator.py`, `test_simulator_source.py` - new behavior tests; the rounding test in `test_simulator.py` was replaced by the unrounded-step test

## Decisions Made
- Rounding responsibility moved to the cache; the simulator emits raw floats.
- `PriceCache.version` getter takes the lock (the plan said to read version under the lock).
- `models.py` was LF-normalized by the write; restored to CRLF in the index (via `hash-object --no-filters`) so the GREEN diff stays small and consistent with the other files (`core.autocrlf=true` on this machine).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Fresh worktree had no `backend/.venv`; ran `uv sync --extra dev` once as the plan's environment rule prescribes (`.venv` is gitignored).
- `backend/CLAUDE.md` still documents the old `update(ticker, price, timestamp=None)` signature and the 7-key `PriceUpdate`; it is outside this plan's `files_modified`, so it was left for the orchestrator or a docs pass.

## Known Stubs

None.

## Threat Flags

None. T-01-24 mitigated as planned: baseline only from first cached price or an explicit source value, None/0 reference yields None, raw fields never serialized (test-asserted). T-01-25 accepted.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 01-06 can read `day_change_percent` for `GET /api/watchlist`; plan 01-07 can pass `reference_price=prev_day.close` from Massive; SSE already carries the two new keys through `to_dict()`.
- Full backend suite: 97 passed; `ruff check app/ tests/` clean.

## Self-Check: PASSED

- Files modified exist: models.py, cache.py, simulator.py and the four test files (verified on disk).
- Commits `54f72e27`, `aaa60755`, `33828ddd`, `309af0cc` are ancestors of HEAD.
- Acceptance greps: `reference_price`, `day_change_percent`, `raw_price` present in models.py; `test_prices_rounded_to_two_decimals` absent; `_pending` present in simulator.py.

---
*Phase: 01-live-market-terminal*
*Completed: 2026-10-20*
