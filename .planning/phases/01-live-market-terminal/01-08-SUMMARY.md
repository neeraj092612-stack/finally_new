---
phase: 01-live-market-terminal
plan: 08
subsystem: ui
tags: [react, nextjs, eventsource, header, portfolio, vitest, tailwind]

requires:
  - phase: 01-live-market-terminal
    provides: "Plan 01-04 AppShell/terminal grid and theme tokens; plan 01-05 price store, ConnectionIndicator, formatters, fetchPortfolio"
provides:
  - "Header component: FinAlly wordmark, live TOTAL VALUE, CASH, ConnectionIndicator"
  - "usePortfolio hook (loading/error/ready, fetched once on mount)"
  - "AppShell single top-level effect that opens and closes the one price EventSource"
affects: [01-10-watchlist, 01-14-chart]

actuals:
  tokens: 9500
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "App connects to the SSE price store from exactly one top-level effect (AppShell); panels only read via usePriceStream"
    - "Live derived value = fetched REST snapshot re-priced from the SSE store, falling back to the REST price"
    - "Fixed user-facing error caption; server error text is never rendered (T-01-29)"

key-files:
  created:
    - frontend/src/components/Header.tsx
    - frontend/src/lib/usePortfolio.ts
    - frontend/src/__tests__/Header.test.tsx
  modified:
    - frontend/src/components/AppShell.tsx
    - frontend/src/__tests__/AppShell.test.tsx

key-decisions:
  - "Header uses min-h-12 (not fixed h-12) with flex-wrap so groups may wrap on tablet per UI-SPEC while staying 48px on desktop"
  - "Header value groups are shrink-0 whitespace-nowrap so $1,000,000.00 at Display size never wraps or truncates"
  - "usePortfolio drops the rejection cause entirely; the header shows only the fixed caption"

patterns-established:
  - "Tests use single-line failure messages (an eventually() wrapper around waitFor) so RED evidence parses as TAP"

requirements-completed: [UI-01]

coverage:
  - id: D1
    description: "The page opens exactly one EventSource to /api/stream/prices from one AppShell effect and closes it on unmount"
    requirement: UI-01
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/AppShell.test.tsx#AppShell price stream"
        status: pass
    human_judgment: false
  - id: D2
    description: "Header connection dot reads CONNECTING / LIVE / RECONNECTING / OFFLINE following EventSource state"
    requirement: UI-01
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/Header.test.tsx#Header wordmark and connection indicator"
        status: pass
      - kind: unit
        ref: "frontend/src/__tests__/AppShell.test.tsx#drives the header dot from the stream"
        status: pass
    human_judgment: false
  - id: D3
    description: "TOTAL VALUE and CASH formatted as USD; total = cash + live positions, colored up/down/text vs $10,000.00 after rounding to cents, never flashing"
    requirement: UI-01
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/Header.test.tsx#Header portfolio values"
        status: pass
    human_judgment: false
  - id: D4
    description: "Muted dash while loading; dash plus 'Portfolio unavailable. Reload to retry.' caption (down color, also title) on failure, with no server text leaked"
    requirement: UI-01
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/Header.test.tsx#shows a dash and the unavailable caption when the portfolio request fails"
        status: pass
      - kind: unit
        ref: "frontend/src/__tests__/Header.test.tsx#shows the same caption for a non-2xx response without leaking the server message"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual fit of $1,000,000.00 at Display size inside the header group (no wrap or truncation) and overall header look"
    verification: []
    human_judgment: true
    rationale: "Backstop held-out visual test per the plan must_haves; jsdom has no layout engine. Implemented with shrink-0 whitespace-nowrap, not machine-verified"

duration: 25min
completed: 2026-10-20
plan_head_before: 0fc4be688115d5299bfa5e6a074837325ef52b42
plan_head_after: 56fa0c8b30c4cabcf170d03d7b199a1fb58f3f68
status: complete
---

# Phase 01 Plan 08: Live Header Summary

**Header with FinAlly wordmark, live TOTAL VALUE (cash + positions re-priced from the SSE store, colored against $10,000.00), CASH and the LIVE/RECONNECTING/OFFLINE dot, with AppShell opening the single price EventSource from one top-level effect**

## Performance

- **Duration:** ~25 min (includes waiting on `npm ci` and a coordinator-requested pause)
- **Completed:** 2026-10-20T21:40:48Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- AppShell calls `connectPriceStream()` once in a top-level `useEffect` and returns `disconnectPriceStream`; replaced the static 01-04 header bar with `<Header />`.
- Header renders the wordmark, the connection indicator (fed from `usePriceStream()`), TOTAL VALUE at Display size and CASH at Heading size.
- `usePortfolio` fetches `GET /api/portfolio` once with an unmount guard; Header computes the live total and colors it by cents versus 1,000,000; no flash classes anywhere in the header.
- Loading shows muted dashes; failure shows dashes plus the fixed caption (down color, also `title`), never server text.

## Task Commits

1. **Task 1 RED: failing stream/indicator tests** - `00a01184` (test)
2. **Task 1 GREEN: AppShell connection effect and Header** - `e948eead` (feat)
3. **Task 2 RED: failing cash/total tests** - `854e861f` (test)
4. **Task 2 GREEN: usePortfolio and live total** - `56fa0c8b` (feat)

**Plan metadata:** committed separately (docs: complete plan). No REFACTOR commits were needed.

## TDD Notes

- **RED (Task 1):** target `opens exactly one EventSource to /api/stream/prices` failed on `expected "" to be "/api/stream/prices"` (no EventSource created); `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK`. Semantic assessment: failed on the planned assertion because AppShell had no connection effect.
- **RED (Task 2):** target `colors the live total up above $10,000.00 and down below it` failed on `expected '—' to be '$10,050.00'` against the placeholder header; `RED_EVIDENCE_OK`. Semantic assessment: genuine assertion failure for the intended reason (stub showed a dash, not the live total).
- GREEN: both suites pass; full suite 75/75, `next build` prerenders cleanly and `frontend/out/index.html` exists.

## Files Created/Modified
- `frontend/src/components/Header.tsx` - wordmark, TOTAL VALUE, CASH, error caption, ConnectionIndicator
- `frontend/src/lib/usePortfolio.ts` - fetch-once portfolio hook (loading/error/ready)
- `frontend/src/components/AppShell.tsx` - single stream effect, renders Header
- `frontend/src/__tests__/Header.test.tsx` - indicator, formatting, coloring, loading/error, no-flash cases
- `frontend/src/__tests__/AppShell.test.tsx` - fetch stub, store reset, one-EventSource and indicator cases

## Decisions Made
- `min-h-12` plus `flex-wrap` on the header so tablet wrapping works while desktop stays 48px.
- Value groups are `shrink-0 whitespace-nowrap` to satisfy the large-magnitude backstop.
- Rejection cause is discarded in `usePortfolio` so server text can never reach the DOM (T-01-29); all rendering is through React text nodes (T-01-09).

## Deviations from Plan

None - plan executed exactly as written. (Test-only note: the RED `expect` for the EventSource URL was written with `join(",")` and `eventually()` wraps `waitFor` so failure messages are single-line, which the plan's TDD evidence tooling requires.)

## Issues Encountered
- `git commit` prints "failed to delete .git/worktrees/...: Permission denied" from automatic worktree pruning of other agents' directories; commits succeeded and the warning is unrelated to this plan.

## Known Stubs
None. The RED-step stubs in `Header.tsx` and `usePortfolio.ts` were replaced by the GREEN commits.

## Threat Flags
None. No new endpoints, auth paths or trust boundaries beyond the plan's threat model; T-01-09 and T-01-29 mitigated as described.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The price stream is now connected app-wide, so watchlist/chart plans (01-10, 01-14) only need `usePriceStream()`/`onTick`.
- The $1,000,000.00 no-wrap visual check remains a backstop for a human or browser E2E pass.

## Self-Check: PASSED

---
*Phase: 01-live-market-terminal*
*Completed: 2026-10-20*
