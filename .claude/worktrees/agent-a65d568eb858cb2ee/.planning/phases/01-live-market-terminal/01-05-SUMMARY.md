---
phase: 01-live-market-terminal
plan: 05
subsystem: ui
tags: [sse, eventsource, usesyncexternalstore, react, vitest, typescript, formatters]

requires:
  - phase: 01-live-market-terminal
    provides: "Plan 01-02 frontend toolchain and Vitest harness with FakeEventSource; plan 01-03 SSE payload with reference_price and day_change_percent"
provides:
  - "Module-singleton SSE price store (connectPriceStream, disconnectPriceStream, subscribe, getSnapshot, getServerSnapshot, getTicks, onTick, setWatchedTickers, usePriceStream)"
  - "ConnectionIndicator component (LIVE / CONNECTING / RECONNECTING / OFFLINE)"
  - "Shared types (PriceTick, WatchlistEntry, Position, Portfolio, SessionStats, PriceStoreSnapshot and others)"
  - "Formatters (formatUsd, formatPrice, formatSignedPercent, formatSignedChange, MISSING)"
  - "Same-origin fetchers fetchPortfolio and fetchWatchlist with ApiRequestError"
affects: [01-08-header, 01-10-watchlist, 01-14-chart]

actuals:
  tokens: 21000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Module-level singleton store consumed through useSyncExternalStore with a constant server snapshot"
    - "Copy-on-write snapshot rebuilt only when a ticker changed, so getSnapshot is referentially stable"
    - "Timestamp de-dupe of the resent-all-tickers SSE payload; no flash on first observation"
    - "Running session stats and chunked buffer trimming (cap 50,000, drop 1,000)"

key-files:
  created:
    - frontend/src/lib/types.ts
    - frontend/src/lib/priceStore.ts
    - frontend/src/lib/format.ts
    - frontend/src/lib/api.ts
    - frontend/src/components/ConnectionIndicator.tsx
    - frontend/src/__tests__/priceStore.test.ts
    - frontend/src/__tests__/ConnectionIndicator.test.tsx
    - frontend/src/__tests__/format.test.ts
    - frontend/src/__tests__/api.test.ts
  modified: []

key-decisions:
  - "Connection state stays 'closed' (red OFFLINE) until the recreated EventSource opens, rather than flipping to yellow when the retry timer fires, to avoid red/yellow flicker"
  - "A non-finite timestamp is dropped alongside a non-finite price (extra guard beyond the plan, same threat T-01-08)"
  - "Formatters return the MISSING dash for non-finite input and collapse values that round to 0.00 to an unsigned zero (no '-0.00%')"

patterns-established:
  - "Handlers of a replaced EventSource ignore events (source !== es guard) so StrictMode connect/disconnect/connect leaves one live stream"
  - "TDD skeleton commit: RED commits carry type files and API-surface stubs so tests fail on behavioral assertions rather than import errors"

requirements-completed: [UI-01, UI-02]

coverage:
  - id: D1
    description: "One shared EventSource to /api/stream/prices; StrictMode connect/disconnect/connect leaves exactly one live stream"
    requirement: UI-01
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/priceStore.test.ts#connection lifecycle"
        status: pass
    human_judgment: false
  - id: D2
    description: "Connection indicator shows green LIVE / pulsing yellow CONNECTING or RECONNECTING / red OFFLINE with role=status and aria-live=polite, and the store re-opens after CLOSED with 2s x1.5 backoff capped at 10s"
    requirement: UI-01
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/ConnectionIndicator.test.tsx"
        status: pass
      - kind: unit
        ref: "frontend/src/__tests__/priceStore.test.ts#recreates the EventSource after 2000 ms on CLOSED"
        status: pass
    human_judgment: false
  - id: D3
    description: "Store ingest rules: timestamp de-dupe, no first-observation flash, flash seq and persistent marker on non-flat ticks, session stats, 50k buffers, watched filter, malformed input ignored"
    requirement: UI-02
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/priceStore.test.ts#ingest rules"
        status: pass
      - kind: unit
        ref: "frontend/src/__tests__/priceStore.test.ts#tick buffers"
        status: pass
    human_judgment: false
  - id: D4
    description: "Formatters and API fetchers return the UI-SPEC number formats and PLAN section 8 shapes, throwing ApiRequestError with envelope code and message"
    requirement: UI-02
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/format.test.ts"
        status: pass
      - kind: unit
        ref: "frontend/src/__tests__/api.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual appearance of the indicator (pulse animation, colors) in the real header"
    verification: []
    human_judgment: true
    rationale: "The bg-up / bg-warn / bg-down tokens and the dot-pulse keyframes are defined by plan 01-04 and the placement by plan 01-08; this plan only asserts class names, not rendered look"

duration: 14min
completed: 2026-10-20
plan_head_before: 7342d6cbbf4ef7aa990f965d1f6c073cdb9e9b89
plan_head_after: 986449fa701da40a0f3807e4a8ca0cba25d9e50e
status: complete
---

# Phase 01 Plan 05: Client Data Layer Summary

**Single-EventSource price store (useSyncExternalStore) with timestamp-deduped flash/marker state, 50k tick buffers, 2s-to-10s reconnect backoff, plus the connection indicator, Intl formatters and envelope-aware API fetchers**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-20T13:40:00Z
- **Completed:** 2026-10-20T13:54:00Z
- **Tasks:** 2
- **Files modified:** 9 (all new)

## Accomplishments
- `priceStore` opens exactly one EventSource to `/api/stream/prices`, tolerates the React StrictMode connect, disconnect, connect sequence, and reconnects after CLOSED at 2 s, 3 s, 4.5 s ... capped at 10 s, resetting on the next open.
- Ingest follows OQ-1 / D-07: entries with a stale timestamp are ignored (unchanged tickers never re-flash), the first observation never flashes, a later up/down tick bumps the flash sequence and persistent marker, a flat tick changes neither. Malformed JSON and non-finite prices are dropped (T-01-08).
- Per-ticker buffers hold every tick since page load up to 50,000, trimmed 1,000 at a time, while running first/high/low/last stay true to page load (T-01-10, D-20).
- `ConnectionIndicator` renders the four D-19 states with `role="status"` and `aria-live="polite"`.
- `formatUsd`, `formatPrice`, `formatSignedPercent`, `formatSignedChange` and `fetchPortfolio` / `fetchWatchlist` with `ApiRequestError` are ready for plans 01-08, 01-10 and 01-14.

## Task Commits

TDD tasks, RED then GREEN each:

1. **Task 1: price store and connection indicator**
   - RED: `205ffc4d` (test) - 28 tests, 24 failing on behavioral assertions
   - GREEN: `3f9bdb1e` (feat)
2. **Task 2: formatters and API fetchers**
   - RED: `65416caa` (test) - 14 failing on assertions
   - GREEN: `986449fa` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## Files Created/Modified
- `frontend/src/lib/types.ts` - wire and store types
- `frontend/src/lib/priceStore.ts` - SSE store singleton and `usePriceStream` hook
- `frontend/src/lib/format.ts` - number formatters and `MISSING`
- `frontend/src/lib/api.ts` - `fetchPortfolio`, `fetchWatchlist`, `ApiRequestError`
- `frontend/src/components/ConnectionIndicator.tsx` - dot plus label
- `frontend/src/__tests__/{priceStore,ConnectionIndicator,format,api}.test.*` - unit tests

## TDD Gate Compliance

RED and GREEN commits exist in order for both tasks (`test(01-05)` then `feat(01-05)`); no REFACTOR commit was needed.

- **RED semantic assessment:** each RED commit includes type files and API-surface skeletons (stubs that do nothing or return empty values) so that failures are assertion failures on the planned behavior (for example `expected 'connecting' to be 'open'`, `expected '' to be '$10,000.00'`, `expected Error: not implemented to be an instance of ApiRequestError`) rather than import or load errors. The first skeleton run produced `TypeError ... reading 'emitOpen'` from a missing EventSource instance; the skeleton was adjusted to construct the EventSource and re-run before committing. A few trivially-true cases (constant server snapshot, null JSON ignored, no reconnect after disconnect, stable snapshot object) pass against the skeleton by design.
- `workflow.tdd_mode` is not enabled in `.planning/config.json`, so the machine classifier `gsd_run check tdd-red-evidence` (TAP record) was not run; evidence is the vitest output above.

## Decisions Made
See `key-decisions` above. Otherwise the plan was followed as specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added finite-timestamp guard**
- **Found during:** Task 1 (store ingest)
- **Issue:** The plan guarded only non-finite prices, but a missing or non-numeric `timestamp` would defeat the timestamp de-dupe (`undefined > n` is false and a first entry would store a NaN timestamp).
- **Fix:** Entries whose `timestamp` is not a finite number are dropped like non-finite prices.
- **Files modified:** `frontend/src/lib/priceStore.ts`
- **Verification:** priceStore tests pass; covered by T-01-08 mitigation.
- **Committed in:** `3f9bdb1e`

**2. [Rule 2 - Missing Critical] Non-finite and negative-zero handling in formatters**
- **Found during:** Task 2
- **Issue:** `NaN` / `Infinity` would render as "NaN" and a tiny negative value would render "-0.00%".
- **Fix:** Non-finite input returns `MISSING`; values that round to 0.00 render unsigned.
- **Files modified:** `frontend/src/lib/format.ts`
- **Verification:** format tests (including rounds-to-zero cases) pass.
- **Committed in:** `986449fa`

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both are small hardening additions; no scope creep and no change to the planned API.

## Issues Encountered
- `npm --prefix frontend ci` exceeds the 120 s foreground limit on this machine and was run in the background; it finished with 0 vulnerabilities.
- Git prints `Permission denied` while pruning sibling worktree metadata on each commit; commits succeed and this is unrelated to the plan.

## Known Stubs
None. The RED skeletons were fully replaced in the GREEN commits.

## Threat Flags
None. No new network endpoints, auth paths or schema changes beyond the plan's threat model (T-01-08, T-01-10 mitigated).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plans 01-08 (header), 01-10 (watchlist) and 01-14 (chart) can import from `@/lib/priceStore`, `@/lib/format`, `@/lib/api`, `@/lib/types` and `@/components/ConnectionIndicator`.
- `ConnectionIndicator` references Tailwind tokens `bg-up`, `bg-warn`, `bg-down`, `text-muted` and the `dot-pulse` keyframe, which plan 01-04 must define in the theme; this plan only asserts the class names.
- Not run here by design: `next build` (the app directory is plan 01-04's); full suite (51 tests) and `tsc --noEmit` pass in this worktree.

## Self-Check: PASSED

- All nine created files exist on disk; commits `205ffc4d`, `3f9bdb1e`, `65416caa`, `986449fa` are ancestors of HEAD.
- `npm --prefix frontend test` passes (5 files, 51 tests); `npm --prefix frontend run typecheck` exits 0.

---
*Phase: 01-live-market-terminal*
*Completed: 2026-10-20*
