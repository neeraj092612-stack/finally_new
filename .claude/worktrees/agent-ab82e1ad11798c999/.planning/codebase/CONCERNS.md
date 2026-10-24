---
last_mapped_commit: ab8faa811f2fa60fcadbd0de3c6af2005521e5ce
last_mapped_at: 2026-10-19
---
# Codebase Concerns

**Analysis Date:** 2026-10-19

## Scope Note

Only the market data subsystem (`backend/app/market/`) and its tests exist as application code. The rest of the specified system (FastAPI app entry point, SQLite layer, portfolio/trade logic, watchlist routes, chat/LLM integration, `frontend/`, `scripts/`, Dockerfile, `db/.gitkeep`, `.env.example`) is not yet in the repository. Those are missing features rather than debt, and are listed under Missing Critical Features. Concerns below are grounded in the files that do exist.

## Tech Debt

**Design document describes fixes that are not in the code:**
- Issue: `planning/MARKET_DATA_DESIGN.md` (sections 1, 10, 17) lists gaps G1 to G9 and describes their fixes as designed. The code in `backend/app/market/` still has the pre-fix behaviour for G1, G3, G4, G5, G6, G7, G8 and G9. The design doc is therefore ahead of the implementation and can be mistaken for a record of what is done.
- Files: `planning/MARKET_DATA_DESIGN.md`, `backend/app/market/massive_client.py`, `backend/app/market/stream.py`, `backend/app/market/cache.py`
- Impact: Reviewers reading the design doc will assume Massive mode and the stream router are correct. They are not (see G1 under Known Bugs).
- Fix approach: Either implement the G-list items and mark each as done in the design doc, or mark them as open. Keep the doc status in sync with the code.

**Module-level router mutated by a factory:**
- Issue: `create_stream_router()` in `backend/app/market/stream.py` decorates a module-level `router` with `@router.get("/prices")` on each call. A second call registers the route again on the same object and captures the new `price_cache` only in a closure that is never removed.
- Files: `backend/app/market/stream.py`
- Impact: Tests or any future app factory that builds more than one app in a process get duplicate routes, and the first `price_cache` stays reachable through the shared router. This is the G6 item.
- Fix approach: Create the `APIRouter` inside `create_stream_router()` and return it. Add a test that calls the factory twice.

**Simulator silently ignores tickers added before `start()`:**
- Issue: `SimulatorDataSource.add_ticker()` does nothing when `self._sim` is `None`, and `get_tickers()` returns `[]`. No warning is logged.
- Files: `backend/app/market/simulator.py` (`SimulatorDataSource.add_ticker`, `get_tickers`)
- Impact: A watchlist addition made before startup completes is lost without any error. The `MarketDataSource` docstring says `start()` must be called first, but nothing enforces it.
- Fix approach: Raise `RuntimeError` when the source is not started, or queue the ticker into the start list.

**Dead test fixture and deprecated pytest-asyncio pattern:**
- Issue: `backend/tests/conftest.py` defines an `event_loop_policy` fixture. pytest-asyncio 0.24+ (the version floor in `backend/pyproject.toml`) no longer reads this fixture. The lock file pins a version that should be checked before relying on it.
- Files: `backend/tests/conftest.py`, `backend/pyproject.toml`
- Impact: Misleading configuration; the event loop setup it suggests is not applied.
- Fix approach: Remove the fixture, or set `asyncio_default_fixture_loop_scope` (already set) and rely on it.

**Shared mutable parameter dicts:**
- Issue: `GBMSimulator._add_ticker_internal` assigns `TICKER_PARAMS.get(ticker, dict(DEFAULT_PARAMS))`. For known tickers this is the same dict object as the module-level `TICKER_PARAMS` entry, so any in-place mutation of a simulator's params changes the global default.
- Files: `backend/app/market/simulator.py`, `backend/app/market/seed_prices.py`
- Impact: Low today (params are read-only), but a trap for future tuning code.
- Fix approach: Copy with `dict(TICKER_PARAMS.get(...))`.

**Inaccurate comment on correlation groups:**
- Issue: `GBMSimulator._pairwise_correlation` says "TSLA is in tech set but behaves independently", but `CORRELATION_GROUPS["tech"]` does not contain TSLA. The TSLA rule is a separate early return.
- Files: `backend/app/market/simulator.py`, `backend/app/market/seed_prices.py`
- Impact: Misleads the next editor about how TSLA is handled.
- Fix approach: Correct the comment.

## Known Bugs

**Massive mode never receives prices (G1, high severity):**
- Symptoms: With `MASSIVE_API_KEY` set, every snapshot raises `AttributeError` and is skipped with a warning. The cache stays empty, the SSE stream sends nothing, and trades return `price_unavailable`.
- Files: `backend/app/market/massive_client.py` (`_poll_once`, reads `snap.last_trade.timestamp`)
- Trigger: Any real poll. Verified against the installed `massive` 2.2.0 package (`backend/.venv/Lib/site-packages/massive/rest/models/trades.py`): `LastTrade` has `sip_timestamp` (nanoseconds) and no `timestamp` field.
- Why tests miss it: `backend/tests/market/test_massive.py` builds snapshots with `MagicMock`, which returns any attribute requested, so the missing field is never exercised.
- Workaround: None. Use the simulator (no key) until fixed.
- Fix approach: Read `snap.last_trade.price` and `snap.last_trade.sip_timestamp / 1e9`, handle `None`, and build test snapshots from the real `TickerSnapshot.from_dict(...)` model so the field names are checked.

**Removed ticker can reappear after an in-flight Massive poll (G3, medium):**
- Symptoms: A ticker removed from the watchlist re-enters the cache and the SSE stream until restart.
- Files: `backend/app/market/massive_client.py` (`_poll_once`, `remove_ticker`)
- Trigger: `remove_ticker()` during the `asyncio.to_thread` call in `_poll_once`. The results loop writes every snapshot ticker to the cache after the await, without filtering against the current ticker list.
- Workaround: Restart the backend.
- Fix approach: After the await, filter results to the current `self._tickers` set before calling `cache.update`.

**Stale cache entries after failed polls are indistinguishable from live ones:**
- Symptoms: When Massive polls fail (401, 429, network), the last price stays in the cache with its original timestamp. Consumers and the SSE payload have no staleness marker.
- Files: `backend/app/market/massive_client.py` (`_poll_once` exception handler), `backend/app/market/models.py`
- Trigger: Bad key, rate limit, or outage.
- Workaround: None.
- Fix approach: Expose `timestamp` age to consumers and add a staleness threshold; log at warning level once rather than on every failure.

**Price direction flickers to "flat" for sub-cent moves:**
- Symptoms: `PriceCache.update` rounds prices to 2 decimals before computing `direction`. Simulator per-tick moves for AAPL-class tickers are roughly one cent (estimate: sigma 0.22, dt about 8.5e-8, price 190 gives about $0.012 per tick), so many ticks report `flat` and the green/red flash rarely fires.
- Files: `backend/app/market/cache.py` (`update`), `backend/app/market/simulator.py` (`step` rounds to 2 dp)
- Trigger: Normal simulator operation.
- Workaround: None.
- Fix approach: Compare unrounded prices for direction, or keep full precision in the cache and round only for display.

## Security Considerations

**Secret handling is by convention only:**
- Risk: `MASSIVE_API_KEY` is read from `os.environ` in `backend/app/market/factory.py` and passed into `MassiveDataSource`. Nothing prevents a future log line or exception message from including it. The `massive` client exception text could in principle include request details.
- Files: `backend/app/market/factory.py`, `backend/app/market/massive_client.py` (`logger.error("Massive poll failed: %s", e)`)
- Current mitigation: The key is not logged directly. `.env` is in `.gitignore`.
- Recommendations: Redact the key from exception text before logging. Keep the root `.env` out of the Docker image (`.dockerignore`, not yet present).

**No `.dockerignore` or `.env.example` yet:**
- Risk: When the Dockerfile is added, `COPY . .` would bring in `.env`, `backend/.venv`, `frontend/node_modules`, `test/node_modules`, and the `.claude/` directory into the image.
- Files: repo root (`.gitignore` exists; no `.dockerignore`)
- Current mitigation: `.env` is gitignored, which does not affect Docker build context.
- Recommendations: Add `.dockerignore` before the Dockerfile. Create `.env.example` (referenced by `.gitignore` as `!.env.example` and by `planning/PLAN.md` section 13.2 item 6).

**Auto-running external agent hook in the repo:**
- Risk: `independent-reviewer/hooks/hooks.json` defines a `Stop` hook that runs `codex exec "..."` on every agent stop and writes `planning/Review.md`. If this file is loaded by a settings file, it runs an external CLI with write access to the repo after every session, without an explicit user action.
- Files: `independent-reviewer/hooks/hooks.json`, `planning/Review.md`
- Current mitigation: The file is not under `.claude/` and no settings file in the repo references it (checked: only `.claude/` is untracked and is excluded from this analysis).
- Recommendations: Document the hook's activation path, or remove it if unused.

**CI workflows grant write-capable tokens:**
- Risk: `.github/workflows/claude.yml` grants `id-token: write` and `actions: read`, and runs on `issue_comment`, `issues`, and review events. Any user who can comment with `@claude` can drive the agent on the repo.
- Files: `.github/workflows/claude.yml`, `.github/workflows/claude-code-review.yml`
- Current mitigation: `contents: read`, `pull-requests: read`, `issues: read` permissions. No write permission on contents.
- Recommendations: Restrict the trigger to repository members (`author_association` check) before the repository is public.

**No input validation on ticker strings yet:**
- Risk: `MassiveDataSource.add_ticker` and `SimulatorDataSource.add_ticker` accept any string. Those strings go into the Massive REST request (`tickers=self._tickers`) and into the SSE JSON keys. The format rule `^[A-Z][A-Z0-9.]{0,9}$` from `planning/PLAN.md` section 8 is not enforced anywhere (G5).
- Files: `backend/app/market/massive_client.py`, `backend/app/market/simulator.py`
- Current mitigation: Massive uppercases and strips; the simulator does not.
- Recommendations: Validate and normalize once at the API boundary (to be built) and also in `add_ticker`.

## Performance Bottlenecks

**One SSE generator per client copies the full cache every change:**
- Problem: Each connected client calls `price_cache.get_all()` (a dict copy under the lock) and serializes all tickers with `json.dumps` whenever the version changes.
- Files: `backend/app/market/stream.py` (`_generate_events`), `backend/app/market/cache.py` (`get_all`)
- Cause: Per-client serialization; no shared encoded payload.
- Improvement path: Serialize once per version and share the bytes across clients. Acceptable for a single-user app; revisit if multi-user is added (PLAN.md section 3 mentions it).

**Simulator rebuilds the full Cholesky matrix on every add/remove:**
- Problem: `GBMSimulator._rebuild_cholesky` is O(n^2) pairwise correlation plus an O(n^3) factorization, run synchronously on the event loop.
- Files: `backend/app/market/simulator.py`
- Cause: Full rebuild on each watchlist change.
- Improvement path: Negligible at n < 50 (the design caps this). Only matters if the watchlist grows substantially.

## Fragile Areas

**Massive snapshot parsing depends on exact attribute names:**
- Files: `backend/app/market/massive_client.py` (`_poll_once`)
- Why fragile: The code reads `snap.last_trade.price` and `snap.last_trade.timestamp` with a broad `except (AttributeError, TypeError)`. Any upstream model change silently turns every snapshot into a warning and no prices.
- Safe modification: Test parsing against real `massive` model objects (`TickerSnapshot.from_dict`), not `MagicMock`. Do not widen the `except` further.
- Test coverage: Mocked only (`backend/tests/market/test_massive.py`).

**Module-level state in the stream router:**
- Files: `backend/app/market/stream.py` (`router`, `create_stream_router`)
- Why fragile: Calling the factory twice or in tests changes shared state (see Tech Debt).
- Safe modification: Build a new router per call.
- Test coverage: No test for repeated calls.

**Race between `start()` and `stop()` on Massive:**
- Files: `backend/app/market/massive_client.py` (`stop`, `_fetch_snapshots`)
- Why fragile: `stop()` sets `self._client = None` while a worker thread may still be inside `self._client.get_snapshot_all(...)`. The resulting `AttributeError` is swallowed by the generic handler in `_poll_once`.
- Safe modification: Await the in-flight poll task in `stop()` before clearing `_client`, or capture the client in a local variable at the start of the poll.
- Test coverage: `test_massive.py` covers repeated `stop()` but not stop during a poll.

**Simulator tests depend on wall-clock timing and unseeded randomness:**
- Files: `backend/tests/market/test_simulator_source.py` (`asyncio.sleep(0.3)`, `asyncio.sleep(0.05)` with count assertions), `backend/tests/market/test_simulator.py` (`test_prices_change_over_time`, `test_prices_are_positive` run unseeded `np.random` and `random`)
- Why fragile: Sleep-based assertions can fail on a loaded CI runner. Unseeded draws make failures non-reproducible.
- Safe modification: Inject a seeded RNG into `GBMSimulator` and use a fake clock or generous tolerances for async tests.
- Test coverage: Adequate in count; reproducibility is weak.

## Scaling Limits

**In-memory price cache and single process:**
- Current capacity: One process, one event loop, all tickers in a dict.
- Limit: Multiple uvicorn workers would each run their own simulator and cache, so SSE clients on different workers would see different prices.
- Scaling path: Keep `uvicorn` at one worker (the Dockerfile should set this explicitly once written), or move the cache out of process.

**Massive free-tier rate limit:**
- Current capacity: 5 calls/min on the free tier; the poller uses one call per 15 s (about 4/min) for all tickers in one snapshot request.
- Limit: Any additional REST calls on the same key (for example, a future per-ticker lookup or `prev_day` fetch for G2) would exceed the limit.
- Scaling path: Batch any extra data into the same snapshot call. Add backoff on 429 (G8).

## Dependencies at Risk

**`massive` package API surface:**
- Risk: The code targets `massive` 2.2.0 (`backend/uv.lock`). The client depends on `RESTClient.get_snapshot_all`, `SnapshotMarketType`, and snapshot field names. Field names differ from the archived `planning/archive/MASSIVE_API.md` (which the design doc says is wrong; see G1).
- Impact: Silent breakage of Massive mode on upgrade, as with G1.
- Migration plan: Pin the version in `backend/pyproject.toml` more tightly (currently `massive>=1.0.0`), and add an integration test that parses a recorded real response.

**`pytest-asyncio` version range:**
- Risk: `backend/pyproject.toml` allows `pytest-asyncio>=0.24.0` with no upper bound. Event-loop fixture behaviour changed across majors.
- Impact: Async tests may stop running or run on different loops after an upgrade.
- Migration plan: Pin to the locked major version.

## Missing Critical Features

**Application server and API routes:**
- Problem: No FastAPI `app` entry point, no `/api/portfolio`, `/api/watchlist`, `/api/chat`, or `/api/health` routes, and no static file mount. Only the SSE router exists.
- Blocks: Running the app at all; the frontend cannot load data.

**Persistence layer:**
- Problem: No SQLite schema, lazy initialization, or seed data (`backend/db/` is absent; `db/` at root is empty and has no `.gitkeep`).
- Blocks: Portfolio, watchlist persistence, trade history, snapshots, chat history.

**Trade execution and portfolio math:**
- Problem: No trade validation, position lifecycle, weighted average cost, or P&L calculation.
- Blocks: Buy/sell, heatmap, P&L chart.

**LLM integration:**
- Problem: No LiteLLM/OpenRouter client, structured output schema, mock mode (`LLM_MOCK`), or auto-execution logic.
- Blocks: AI chat panel.

**Frontend, Docker, and scripts:**
- Problem: `frontend/` is empty; no `Dockerfile`, no `scripts/start_*`/`stop_*`, no `test/` E2E specs (only generated `playwright-report/` and `test-results/`, which are gitignored).
- Blocks: The single-command launch that PLAN.md section 1 describes.

**Open spec questions (PLAN.md section 13.2):**
- Items 11 (unknown symbols in Massive mode), 12 (day change baseline; the design doc now proposes a `prev_day` fallback), 13 (chart history on refresh), 17 (position lifecycle), 19 (trade atomicity), 22 (no `GET /api/chat`), 23 (history window), 26 (mock responses), 27 (strict schema for optional arrays), 29 to 32 are not resolved in code.
- Blocks: The API contracts for watchlist `day_change_percent`, chat, and trade atomicity.

## Test Coverage Gaps

**Real Massive response shapes:**
- What's not tested: Parsing of actual `TickerSnapshot` objects from the `massive` package. Current tests use `MagicMock`.
- Files: `backend/tests/market/test_massive.py`
- Risk: G1 went undetected; any future field rename will also go undetected.
- Priority: High

**Removal race and in-flight polls:**
- What's not tested: `remove_ticker()` during a poll (G3).
- Files: `backend/app/market/massive_client.py`
- Risk: Removed tickers reappear in the stream.
- Priority: Medium

**Stream router behaviour:**
- What's not tested: No test module for `backend/app/market/stream.py` (no `test_stream.py`). Disconnect handling, event format, `retry: 1000` header, and repeated factory calls are unverified.
- Files: `backend/app/market/stream.py`
- Risk: Breaking the SSE contract in PLAN.md section 8 would go unnoticed.
- Priority: High

**Simulator behaviour under random events and correlation:**
- What's not tested: Statistical properties (event frequency, correlation of sampled returns). Only sign and existence checks exist.
- Files: `backend/tests/market/test_simulator.py`
- Risk: Silent regressions in the GBM math.
- Priority: Low

**Frontend and E2E:**
- What's not tested: No frontend unit tests (none exist yet) and no Playwright specs in `test/tests/` (directory is empty).
- Files: `frontend/`, `test/tests/`
- Risk: All UI behaviour is unverified.
- Priority: Medium once the frontend exists

---

*Concerns audit: 2026-10-19*
