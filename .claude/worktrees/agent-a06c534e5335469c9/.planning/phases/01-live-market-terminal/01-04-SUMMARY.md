---
phase: 01-live-market-terminal
plan: 04
subsystem: ui
tags: [nextjs, tailwind-v4, static-export, jetbrains-mono, vitest, react-testing-library]

requires:
  - phase: 01-live-market-terminal
    provides: "plan 01-02 frontend toolchain (Next 16 static export, Tailwind v4, Vitest harness)"
provides:
  - "Tailwind v4 @theme tokens, flash/pulse keyframes and reduced-motion rules (globals.css)"
  - "Panel chrome (D-03) and PlaceholderPanel empty states (D-02)"
  - "AppShell: 3-column desktop grid and tablet stacking with collapsible chat (D-01, D-04)"
  - "Static export with bundled JetBrains Mono 400/600 woff2, no CDN"
affects: [01-05, 01-08, 01-10, 01-12, 01-14]

actuals:
  tokens: 9000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Tablet stacking via `contents desk:flex` column wrappers plus per-panel `order-*` / `desk:order-none`"
    - "Panels built on one shared Panel component; deferred features use PlaceholderPanel"

key-files:
  created:
    - frontend/app/globals.css
    - frontend/app/layout.tsx
    - frontend/app/page.tsx
    - frontend/src/components/Panel.tsx
    - frontend/src/components/PlaceholderPanel.tsx
    - frontend/src/components/AppShell.tsx
    - frontend/src/__tests__/AppShell.test.tsx
  modified:
    - frontend/tsconfig.json

key-decisions:
  - "PlaceholderPanel gained ariaLabel, className and collapsedBelowDesk props beyond the planned title/heading/body/header/actions, needed for region labels, grid placement and the tablet chat collapse"
  - "AppShell test helper uses single-line assertions (expect(...).toContain) instead of RTL getByText so TAP failure output is classifiable as RED evidence"

patterns-established:
  - "Panel region lookup in tests: getByRole('region', { name: ariaLabel })"
  - "Collapsed-on-tablet bodies use `hidden desk:flex`"

requirements-completed: [UI-01]

duration: 22min
completed: 2026-10-20
status: complete
plan_head_before: 7342d6cbbf4ef7aa990f965d1f6c073cdb9e9b89
plan_head_after: 53c31cf0657e4a921ac37c4f99fbdf03fbbb554e
commits: 3
---

# Phase 1 Plan 04: Terminal grid and panel chrome Summary

**Dark terminal grid in the Next static export: UI-SPEC Tailwind v4 tokens, bundled JetBrains Mono, square panel chrome, titled empty states for the deferred panels and a tablet layout with a collapsible chat**

## Performance

- **Duration:** about 22 min
- **Completed:** 2026-10-20T17:55Z
- **Tasks:** 2 (Task 2 TDD: RED + GREEN)
- **Files modified:** 8

## Accomplishments
- `npm --prefix frontend run build` writes `frontend/out/index.html`; the built CSS contains `#ecad0a`, `flash-up`/`flash-down`, `dot-pulse`, `skeleton-pulse` and the `prefers-reduced-motion` block; two woff2 files (400, 600) are bundled under `_next/static/media`, with no third-party font reference.
- Desktop grid per D-01: 48px header, 352px left column (WATCHLIST over 96px TRADE), flexible center (CHART over 220px HEATMAP | P&L over 200px POSITIONS), 320px AI CHAT.
- Below 1200px the column wrappers become `display: contents` and `order-*` classes give header, watchlist, chart, heatmap, P&L, positions, trade, chat; chat is collapsed by default behind a `Show chat` / `Hide chat` button with `aria-expanded`.
- Deferred panels render their exact UI-SPEC empty-state copy; POSITIONS shows the six column headers; WATCHLIST shows a header row and 10 skeleton rows.

## Task Commits

1. **Task 1: dark terminal grid with panel chrome** - `9a595ea1` (feat)
2. **Task 2 RED: failing AppShell tests** - `acdef0b8` (test)
3. **Task 2 GREEN: empty states and collapsible chat** - `53c31cf0` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## TDD Gate Compliance

- RED: `frontend/src/__tests__/AppShell.test.tsx` written against the Task 1 AppShell (empty panels). Target test `Trade panel shows its empty state` failed on `expected [] to include 'Trading — coming soon'`; 7 of 9 tests failed on planned assertions, the 2 passing ones (panel titles, 10 skeleton rows) assert behavior Task 1 already delivered. `gsd check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`, format tap-flat). Semantic assessment: target executed and failed on the planned copy assertion, no import, syntax or fixture fault.
- GREEN: `feat(01-04)` commit `53c31cf0`; full Vitest run 17/17 pass, typecheck clean, build still writes `index.html`.
- REFACTOR: none needed.
- The first RED attempt with RTL's default `getByText` messages was rejected by the classifier (`invalid_record`, blank lines in the multi-line DOM dump broke TAP parsing); the test helper was changed to single-line assertions and RED was re-run, which the classifier accepted.

## Files Created/Modified
- `frontend/app/globals.css` - @theme tokens, flash/pulse keyframes, reduced-motion overrides
- `frontend/app/layout.tsx` - global CSS, bundled font CSS, metadata title
- `frontend/app/page.tsx` - renders AppShell
- `frontend/src/components/Panel.tsx` - shared panel chrome
- `frontend/src/components/PlaceholderPanel.tsx` - empty-state panel
- `frontend/src/components/AppShell.tsx` - grid, tablet stacking, chat collapse
- `frontend/src/__tests__/AppShell.test.tsx` - AppShell behavior tests
- `frontend/tsconfig.json` - rewritten by first `next build` (`jsx: react-jsx`, `.next/types` includes)

## Decisions Made
- Extra PlaceholderPanel props (`ariaLabel`, `className`, `collapsedBelowDesk`) were needed for region labels, grid placement and the tablet collapse; the planned props are all present.
- Test assertions kept single-line so RED evidence is machine-classifiable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test helper reworked for classifiable RED evidence**
- **Found during:** Task 2 (RED)
- **Issue:** RTL's multi-line failure messages made the TDD classifier return `invalid_record`.
- **Fix:** Replaced `getByText` assertions with a single-line `expectText` helper and `queryByRole` + attribute checks.
- **Files modified:** frontend/src/__tests__/AppShell.test.tsx
- **Committed in:** `acdef0b8`

**2. [Rule 1 - Bug] Implicit-any type error in test helper**
- **Found during:** Task 2 (GREEN typecheck)
- **Fix:** Typed the map callback parameter `HTMLElement`.
- **Committed in:** `53c31cf0`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug). **Impact:** test-only, no scope creep.

## Issues Encountered
None beyond the deviations above. The visual layout (breakpoints, stacking order) was verified by class inspection and a successful build, not in a browser; jsdom has no CSS layout.

## Known Stubs
- `AppShell.tsx` header is a static wordmark bar (plan 01-08 replaces it with the live Header); the WATCHLIST skeleton rows and CHART overlay are placeholders filled by plans 01-12 and 01-14; TRADE, HEATMAP, P&L, POSITIONS and AI CHAT are intentional D-02 empty states for later phases. All are by design per this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AppShell is ready for sequential edits by plans 01-08, 01-12 and 01-14.

---
*Phase: 01-live-market-terminal*
*Completed: 2026-10-20*

## Self-Check: PASSED

All created files exist; commits `9a595ea1`, `acdef0b8`, `53c31cf0` are on HEAD; Vitest 17/17, typecheck and build pass.
