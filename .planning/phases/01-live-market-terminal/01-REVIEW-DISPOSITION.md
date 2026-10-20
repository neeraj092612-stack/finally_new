---
phase: 01
review: 01-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "Unhandled exceptions bypass the PLAN section 8 error envelope"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Generic HTTP exception handler drops `exc.headers`, so the 405 `Allow` header is lost"
  - id: WR-03
    severity: warning
    disposition: open
    title: "Chart time axis renders UTC while the crosshair label renders local time"
  - id: WR-04
    severity: warning
    disposition: open
    title: "Smoke test `test_create_app_tolerates_missing_static_dir` asserts nothing meaningful and has an inverted parameter"
  - id: WR-05
    severity: warning
    disposition: open
    title: "Runtime container runs as root"
  - id: WR-06
    severity: warning
    disposition: open
    title: "Lifespan leaks the running market source if the startup snapshot fails"
  - id: WR-07
    severity: warning
    disposition: open
    title: "Start scripts report \"starting\" and exit 0 when the container has crashed"
  - id: IN-01
    severity: info
    disposition: open
    title: "Connection indicator tooltip says \"reconnecting\" during the initial connect"
  - id: IN-02
    severity: info
    disposition: open
    title: "`disconnectPriceStream` leaves the snapshot's `connection` as `\"open\"`"
  - id: IN-03
    severity: info
    disposition: open
    title: "The price store and SSE have no path for ticker removal"
  - id: IN-04
    severity: info
    disposition: open
    title: "SSE stream has no keepalive, and stale Massive prices look live"
  - id: IN-05
    severity: info
    disposition: open
    title: "`build_portfolio` raises `TypeError` if the profile row is missing"
  - id: IN-06
    severity: info
    disposition: open
    title: "ISO timestamps have one-second resolution, so snapshot ordering can tie"
open: 13
total: 13
recorded: 2026-10-20T23:10:57.464Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| WR-07 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
