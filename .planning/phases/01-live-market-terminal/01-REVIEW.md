---
phase: 01-live-market-terminal
reviewed: 2026-10-20T00:00:00Z
depth: standard
files_reviewed: 85
files_reviewed_list:
  - .dockerignore
  - .env.example
  - .gitattributes
  - .gitignore
  - backend/app/api/__init__.py
  - backend/app/api/health.py
  - backend/app/api/portfolio.py
  - backend/app/api/watchlist.py
  - backend/app/config.py
  - backend/app/db/__init__.py
  - backend/app/db/schema.py
  - backend/app/errors.py
  - backend/app/main.py
  - backend/app/market/cache.py
  - backend/app/market/massive_client.py
  - backend/app/market/models.py
  - backend/app/market/simulator.py
  - backend/app/market/stream.py
  - backend/app/services/__init__.py
  - backend/app/services/portfolio.py
  - backend/app/services/watchlist.py
  - backend/pyproject.toml
  - db/.gitkeep
  - Dockerfile
  - frontend/app/globals.css
  - frontend/app/layout.tsx
  - frontend/app/page.tsx
  - frontend/next.config.ts
  - frontend/package.json
  - frontend/postcss.config.mjs
  - frontend/src/components/AppShell.tsx
  - frontend/src/components/ChartCanvas.tsx
  - frontend/src/components/ChartClient.tsx
  - frontend/src/components/ChartStrip.tsx
  - frontend/src/components/ConnectionIndicator.tsx
  - frontend/src/components/Header.tsx
  - frontend/src/components/MainChartPanel.tsx
  - frontend/src/components/Panel.tsx
  - frontend/src/components/PlaceholderPanel.tsx
  - frontend/src/components/PriceCell.tsx
  - frontend/src/components/Sparkline.tsx
  - frontend/src/components/WatchlistPanel.tsx
  - frontend/src/components/WatchlistRow.tsx
  - frontend/src/lib/api.ts
  - frontend/src/lib/chartData.ts
  - frontend/src/lib/format.ts
  - frontend/src/lib/priceStore.ts
  - frontend/src/lib/sparkline.ts
  - frontend/src/lib/types.ts
  - frontend/src/lib/usePortfolio.ts
  - frontend/src/lib/useWatchlist.ts
  - frontend/tsconfig.json
  - frontend/vitest.config.mts
  - frontend/vitest.setup.ts
  - planning/PLAN.md
  - scripts/start_mac.sh
  - scripts/start_windows.ps1
  - scripts/stop_mac.sh
  - scripts/stop_windows.ps1
  - backend/tests/api/__init__.py
  - backend/tests/api/test_errors.py
  - backend/tests/conftest.py
  - backend/tests/market/test_cache.py
  - backend/tests/market/test_massive.py
  - backend/tests/market/test_models.py
  - backend/tests/market/test_simulator.py
  - backend/tests/market/test_simulator_source.py
  - backend/tests/market/test_stream_router.py
  - backend/tests/services/__init__.py
  - backend/tests/services/test_portfolio.py
  - backend/tests/services/test_watchlist.py
  - backend/tests/test_config.py
  - backend/tests/test_db.py
  - backend/tests/test_server_smoke.py
  - frontend/src/__tests__/api.test.ts
  - frontend/src/__tests__/AppShell.test.tsx
  - frontend/src/__tests__/ChartCanvas.test.tsx
  - frontend/src/__tests__/chartData.test.ts
  - frontend/src/__tests__/ConnectionIndicator.test.tsx
  - frontend/src/__tests__/format.test.ts
  - frontend/src/__tests__/harness.test.ts
  - frontend/src/__tests__/Header.test.tsx
  - frontend/src/__tests__/MainChartPanel.test.tsx
  - frontend/src/__tests__/PriceCell.test.tsx
  - frontend/src/__tests__/priceStore.test.ts
  - frontend/src/__tests__/sparkline.test.tsx
  - frontend/src/__tests__/WatchlistPanel.test.tsx
findings:
  critical: 0
  warning: 7
  info: 6
  total: 13
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-20
**Depth:** standard
**Files Reviewed:** 85 (planning/PLAN.md was used as the contract reference; the files `api.test.ts`, `chartData.test.ts`, `ConnectionIndicator.test.tsx`, `format.test.ts`, `harness.test.ts`, `PriceCell.test.tsx` and `sparkline.test.tsx` were listed but not opened line by line. Attention went to application source, then the larger test files.)
**Status:** issues_found

## Summary

The phase is in good shape. The SQLite layer, price cache, simulator, Massive poller, SSE generator and the frontend price store are internally consistent. The edge cases I traced all hold: sub-cent direction, unpriced tickers returning `null`, the removed-while-in-flight Massive poll, reconnect backoff, strictly ascending chart times, and a user-emptied watchlist not being re-seeded. I found no security vulnerabilities and no data-loss bugs. The repo-root `.env` was not read. The app binds to loopback, the `.env` file is excluded from the image, and every SQL statement is parameterised.

The findings are contract and robustness gaps. The two most worth fixing now are in `backend/app/errors.py`. PLAN section 8 says every non-2xx body uses the envelope, but unhandled exceptions bypass it. The 405 handler also drops the `Allow` header that `main.py` deliberately sets. After those: the chart time axis shows UTC while the crosshair shows local time, one smoke test asserts nothing, and the container runs as root.

## Warnings

### WR-01: Unhandled exceptions bypass the PLAN section 8 error envelope

**File:** `backend/app/errors.py:47-72`
**Issue:** PLAN section 8 says "Every non-2xx response ... uses one body shape" and CLAUDE.md calls the contract binding. Handlers are registered only for `ApiError`, `RequestValidationError` and `StarletteHTTPException`. Any other exception, such as a `sqlite3.OperationalError: database is locked` or the `TypeError` in IN-05, reaches Starlette's `ServerErrorMiddleware`. That returns a plain-text `Internal Server Error` with a non-JSON content type. The frontend `toError` copes with this (it falls back to a generic message), but the contract is broken. Phase 2 trade and chat endpoints will hit SQLite lock contention, so this will happen in practice.
**Fix:** Register a catch-all handler.
```python
@app.exception_handler(Exception)
async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return error_response("internal_error", 500, "Something went wrong. Please try again.")
```
Add a test that a route raising `RuntimeError` returns a JSON envelope. `TestClient(raise_server_exceptions=False)` is needed, since the default re-raises.

### WR-02: Generic HTTP exception handler drops `exc.headers`, so the 405 `Allow` header is lost

**File:** `backend/app/errors.py:61-72` (the lost header is raised at `backend/app/main.py:71-75`)
**Issue:** `main.py` raises `StarletteHTTPException(405, headers={"Allow": ...})` for wrong-method calls on known paths. `handle_http_exception` builds its response with `error_response(...)`, which never passes `exc.headers`. The `Allow` header (required by RFC 9110 on 405) is silently discarded. The same applies to any other `HTTPException` carrying headers, such as `WWW-Authenticate`. `test_method_not_allowed_uses_the_envelope` checks only the status and code, so nothing catches it.
**Fix:**
```python
def error_response(code, status_code, message, headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(status_code=status_code, headers=headers,
                        content={"error": {"code": code, "message": message}})
...
return error_response(code, exc.status_code, message, headers=getattr(exc, "headers", None))
```
Add `assert "GET" in response.headers["allow"]` to the 405 test.

### WR-03: Chart time axis renders UTC while the crosshair label renders local time

**File:** `frontend/src/components/ChartCanvas.tsx:64-65`
**Issue:** The comment says "Local time; the timestamps are deliberately not pre-shifted", but only `localization.timeFormatter` is overridden. In Lightweight Charts, `timeFormatter` affects the crosshair and last-value labels. The time-scale tick labels use the library's own formatter, which interprets `UTCTimestamp` values as UTC. Result: the axis shows UTC clock times, and hovering shows local clock times. For any user not in UTC the two disagree. The test file only checks option keys, so this is not covered.
**Fix:** Add a `tickMarkFormatter` that formats in local time, consistent with `formatTime`.
```ts
timeScale: {
  ...,
  tickMarkFormatter: (time: Time) =>
    new Date((time as number) * 1000).toLocaleTimeString("en-GB"),
},
```

### WR-04: Smoke test `test_create_app_tolerates_missing_static_dir` asserts nothing meaningful and has an inverted parameter

**File:** `backend/tests/test_server_smoke.py:270-274`
**Issue:** The test builds the app and asserts `app is not None`. It never enters the lifespan or sends a request, so it cannot detect a regression in the static-mount guard at `main.py:80-83`. The only effect that guard has is skipping `app.mount`. The parameter `missing` is also inverted in meaning: `False` gives `static_dir=None` (not "present"), and `True` gives a nonexistent directory. The case where the directory is present is not tested here at all.
**Fix:** Use `TestClient(app)` as a context manager and assert `GET /api/health` returns 200 and `GET /` returns 404 JSON. Rename the parameter, for example `@pytest.mark.parametrize("static_dir_kind", ["none", "nonexistent"])`. `test_errors.py::test_missing_static_directory_still_serves_the_api` already covers the nonexistent-directory case, so this test is redundant as written.

### WR-05: Runtime container runs as root

**File:** `Dockerfile:15-37`
**Issue:** The final stage has no `USER` directive, so uvicorn runs as root. The app is unauthenticated, accepts network input and writes to a volume. Loopback binding in the start scripts limits exposure, but a compromise of the process would have root inside the container.
**Fix:** Create an unprivileged user, give it ownership of `/app/db`, and switch to it before `CMD`.
```dockerfile
RUN useradd --system --uid 10001 --home /app app && mkdir -p /app/db && chown app /app/db
USER app
```
Docker initialises a new named volume from the image directory's ownership, so `finally-data` works. Existing volumes created by a root-run container would need a one-time `chown`. Mention this in the scripts or docs.

### WR-06: Lifespan leaks the running market source if the startup snapshot fails

**File:** `backend/app/main.py:39-48`
**Issue:** `source.start(tickers)` is called outside the `try/finally`. If `record_snapshot` (line 43) raises, the `finally: await source.stop()` is never reached, because the `try` begins at line 45. The simulator or Massive poller task is left running. In the real server the process exits anyway. Under `TestClient` or a restarting worker, the background task is orphaned and logs "Task was destroyed but it is pending".
**Fix:** Start the `try` immediately after `start()`.
```python
await source.start(tickers)
try:
    with closing(connect(settings.db_path)) as conn:
        record_snapshot(conn, cache)
    app.state.market_source = source
    yield
finally:
    await source.stop()
```

### WR-07: Start scripts report "starting" and exit 0 when the container has crashed

**File:** `scripts/start_mac.sh:53-64`, `scripts/start_windows.ps1:58-69`
**Issue:** The health-wait loop only checks for `healthy`. If the container exits immediately (a bad `.env`, a port-in-use race, a Python import error), `docker inspect` stops reporting `healthy`. The loop spins for the full 60 seconds, then prints "FinAlly is starting at http://localhost:8000 (check: docker logs ...)" and exits 0. The user is told the app is starting when it is dead, and the one-command demo experience is the project's core value.
**Fix:** Inside the loop, also check `docker inspect -f '{{.State.Running}}'`. If it is `false`, print the tail of `docker logs --tail 20 "$NAME"` and exit non-zero. After the loop, exit 1 if the status is not `healthy`.

## Info

### IN-01: Connection indicator tooltip says "reconnecting" during the initial connect

**File:** `frontend/src/components/ConnectionIndicator.tsx:18-24`
**Issue:** For `connection === "connecting"` the label correctly switches between CONNECTING and RECONNECTING on `hasOpened`, but `title` is always "Price stream reconnecting". On first load the tooltip contradicts the label.
**Fix:** `title: hasOpened ? "Price stream reconnecting" : "Connecting to price stream"`.

### IN-02: `disconnectPriceStream` leaves the snapshot's `connection` as `"open"`

**File:** `frontend/src/lib/priceStore.ts:60-67`
**Issue:** Disconnect closes the source but does not update the snapshot. On a StrictMode dev double-mount, or an unmount and remount, `connection` still reads `"open"` while a new `EventSource` is connecting. The header shows LIVE until the first `onopen` or `onerror`. If the server is down it self-corrects only after the first error event. `priceStore.test.ts` checks the number of live sources after a connect/disconnect/connect cycle but not the reported state.
**Fix:** In `connectPriceStream`, when opening a new source after a disconnect, call `update({ connection: "connecting" })` if the current value is not already `"connecting"`.

### IN-03: The price store and SSE have no path for ticker removal

**File:** `backend/app/market/stream.py:78-83`, `frontend/src/lib/priceStore.ts:200-229`
**Issue:** When the last ticker is removed, `get_all()` is empty, so `if prices:` suppresses the event. Clients are never told the set is empty. More generally, `ingest` only adds to `latest`, `session` and `buffers`. It never prunes a ticker that is absent from a later event. Today harmless, because the UI renders from the REST watchlist. Phase 2 adds watchlist removal, and any view that iterates `latest` would show removed tickers indefinitely.
**Fix:** Either send the (possibly empty) object whenever the version changes, or prune tickers that are absent from a payload in `ingest`. Decide when the Phase 2 DELETE endpoint is built.

### IN-04: SSE stream has no keepalive, and stale Massive prices look live

**File:** `backend/app/market/stream.py:68-85`
**Issue:** An event is sent only when the cache version changes. In Massive mode that is once per poll, up to 120 seconds apart under backoff. During a failure streak, no bytes are written for up to 2 minutes, so an intermediate proxy could close the idle connection. The header also shows LIVE with frozen prices, because "live" means only that the TCP stream is open.
**Fix:** Emit a comment frame (`: keepalive\n\n`) every ~15 seconds when nothing changed. Optionally expose staleness to the UI. PLAN item 14 already tells readers to expect static prices outside market hours, so this is low priority.

### IN-05: `build_portfolio` raises `TypeError` if the profile row is missing

**File:** `backend/app/services/portfolio.py:14-17`
**Issue:** `profile["cash_balance"]` on a `None` row raises `TypeError: 'NoneType' object is not subscriptable`. `init_db` guarantees the row on a healthy database, but the startup snapshot call and `GET /api/portfolio` would fail with an opaque 500. This is only reachable through manual DB tampering, so I am not raising it above Info.
**Fix:** Raise a clear error such as `RuntimeError("users_profile row missing; database is corrupt")`, or fall back to `STARTING_CASH`. Combined with WR-01 this gives a logged traceback and a proper envelope.

### IN-06: ISO timestamps have one-second resolution, so snapshot ordering can tie

**File:** `backend/app/db/__init__.py:31-33`
**Issue:** `now_iso()` truncates to whole seconds. `portfolio_snapshots` rows recorded at startup and by a trade in the same second share a `recorded_at`. Phase 2's `/api/portfolio/history` must order by `recorded_at, rowid` (as `list_tickers` already does for the watchlist). Ordering by `recorded_at` alone gives nondeterministic order for ties. The P&L chart needs strictly ascending times as well.
**Fix:** Note it in the Phase 2 plan. Use `ORDER BY recorded_at, rowid` in the history query and de-duplicate equal timestamps on the frontend.

---

_Reviewed: 2026-10-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
