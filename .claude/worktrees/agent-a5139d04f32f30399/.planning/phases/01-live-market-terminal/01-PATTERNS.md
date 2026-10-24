# Phase 1: Live Market Terminal - Pattern Map

**Mapped:** 2026-10-20
**Files analyzed:** 49 (new/modified)
**Analogs found:** 14 in-repo analogs / 49 files (all backend; frontend, Docker, scripts have none)

All analog paths below were verified git-tracked (`git ls-files backend`). `frontend/`, `scripts/`, `test/`, `Dockerfile` and `.env.example` have no tracked files.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/market/models.py` (mod) | model | transform | itself (frozen dataclass) | exact |
| `backend/app/market/cache.py` (mod) | store | event-driven | itself | exact |
| `backend/app/market/simulator.py` (mod: step no-round, pending queue) | service | event-driven | itself | exact |
| `backend/app/market/massive_client.py` (mod: `parse_snapshot`) | service | batch/polling | itself | exact |
| `backend/app/market/stream.py` (mod: router in factory) | route | streaming | itself | exact |
| `backend/app/main.py` | app factory/lifespan | request-response | `market/factory.py` (factory style) | role-match |
| `backend/app/config.py` | config | transform | `market/factory.py` (env reading) | role-match |
| `backend/app/errors.py` | middleware | request-response | none | no analog |
| `backend/app/db/__init__.py`, `db/schema.py` | utility/model | CRUD | `market/seed_prices.py` (data constants) | partial |
| `backend/app/services/portfolio.py`, `services/watchlist.py` | service | CRUD | `market/cache.py` (plain class/func, injected deps) | partial |
| `backend/app/api/health.py`, `api/portfolio.py`, `api/watchlist.py` | route | request-response | `market/stream.py` (`create_*_router` factory) | role-match |
| `backend/tests/market/test_*.py` (updates) | test | - | existing tests | exact |
| `backend/tests/{api,db,services}/test_*.py`, `market/test_stream_router.py`, `market/test_massive_parse.py` | test | - | `tests/market/test_simulator_source.py`, `test_cache.py` | role-match |
| `backend/tests/conftest.py` (mod) | test config | - | itself | exact |
| `frontend/**` (store, components, config, vitest) | frontend | - | none in repo | no analog |
| `Dockerfile`, `.dockerignore`, `.env.example`, `.gitattributes` | config | - | none | no analog |
| `scripts/start_*.{sh,ps1}`, `stop_*.{sh,ps1}` | script | - | none | no analog |

## Pattern Assignments

### `backend/app/market/models.py` (model, transform) - MKT-05, D-06
**Analog:** itself, lines 9-49. Keep `@dataclass(frozen=True, slots=True)`, derived values as `@property`, explicit `to_dict()`.
```python
@dataclass(frozen=True, slots=True)
class PriceUpdate:
    ticker: str
    price: float
    previous_price: float
    timestamp: float = field(default_factory=time.time)  # Unix seconds
    @property
    def direction(self) -> str:
        if self.price > self.previous_price: return "up"
        ...
```
Add new fields only after `timestamp` with defaults (`reference_price`, `raw_price`, `raw_previous_price` = None) so every existing constructor call still works. `to_dict()` (lines 39-49) gains `reference_price` and `day_change_percent`; never serialize `raw_*`. Full target code: RESEARCH Pattern B-1.

### `backend/app/market/cache.py` (store, event-driven)
**Analog:** itself. Current `update` (lines 23-42) takes `with self._lock:`, `ts = timestamp or time.time()` (bug G9: use `time.time() if timestamp is None`), `previous_price = prev.price`, rounds in the constructor. Change: store raw values, add `reference_price: float | None = None` kwarg, carry `prev.reference_price` (first price seen) when not given. `remove()` (lines 59-62) should bump `_version` only if something was removed; `version` property (64-67) should read under the lock.

### `backend/app/market/simulator.py` (service, event-driven) - MKT-04, D-06
**Analog:** itself.
- `GBMSimulator.step()` line 116 `result[ticker] = round(self._prices[ticker], 2)` -> return the raw price (cache rounds).
- `SimulatorDataSource.start` (219-230), `add_ticker` (242-249; silent no-op when `self._sim` is None), `remove_ticker` (251-255), `get_tickers` (257-258). Add `self._pending: list[str] = []` in `__init__` (207-217), merge in `start`, queue in `add_ticker`, filter in `remove_ticker`. Follow existing logging style: `logger.info("Simulator: added ticker %s", ticker)`. Code: RESEARCH Pattern B-2.

### `backend/app/market/massive_client.py` (service, batch polling) - MKT-01, MKT-05
**Analog:** itself, `_poll_once` lines 89-121. Bug at 101-103 (`last_trade.timestamp / 1000.0`). Extract a module-level pure `parse_snapshot(snap)` returning `(ticker, price, timestamp, reference_price)` (RESEARCH B-4 / `planning/MARKET_DATA_DESIGN.md` 10.2), keep the per-snapshot `try/except (AttributeError, TypeError)` skip with `logger.warning("Skipping snapshot for %s: %s", ...)` (110-115), and the outer `except Exception` with `logger.error` (118-121; redact key, log `type(e).__name__`). Keep `asyncio.to_thread(self._fetch_snapshots)` (97). Pass `reference_price=` to `self._cache.update`.

### `backend/app/market/stream.py` (route, streaming) - MKT-03
**Analog:** itself. Defect at line 17 (module-level `router`) with `@router.get("/prices")` at 26 inside the factory. Move into factory:
```python
def create_stream_router(price_cache: PriceCache) -> APIRouter:
    router = APIRouter(prefix="/api/stream", tags=["streaming"])
    @router.get("/prices")
    async def stream_prices(request: Request) -> StreamingResponse: ...
    return router
```
Rename `_generate_events` (51) to `generate_events` for testability. Keep `retry: 1000\n\n` first (62), version-change loop (75-83), `except asyncio.CancelledError` (86).

### `backend/app/main.py`, `config.py`, `api/*.py` (app factory / routes)
**Analog:** `backend/app/market/factory.py` (env + factory style) and `stream.py` (router-factory style).
```python
# factory.py:24 env idiom - reuse for DB_PATH/STATIC_DIR
api_key = os.environ.get("MASSIVE_API_KEY", "").strip()
```
```python
# stream.py router-per-factory idiom (with fix applied)
router = APIRouter(prefix="/api/stream", tags=["streaming"])
```
Each `api/*.py` exposes `create_<name>_router(settings, cache)` building its own `APIRouter(prefix="/api", tags=[...])`. Dependencies injected by constructor/args, no module singletons. Target code: RESEARCH B-5 (`create_app`, lifespan order init_db -> list tickers -> `source.start` -> snapshot -> yield -> `source.stop()`), C-8 (watchlist route). Mount `include_router(create_stream_router(cache))` before the guarded `StaticFiles` mount, which comes last.

### `backend/app/db/`, `services/` (CRUD)
No true analog (no SQLite code exists). Conventions to copy: `from __future__ import annotations`, one-line module docstring, class/function docstrings, `logger = logging.getLogger(__name__)`, `UPPER_SNAKE` constants as in `seed_prices.py`. `DEFAULT_TICKERS = list(SEED_PRICES)` imported from `app.market.seed_prices`. Money/P&L as plain functions `build_portfolio(conn, cache)` taking cache and DB (CLAUDE.md "Patterns to Follow"), reading `cache.get_price(ticker)`. Round money to 2 dp at the boundary. Use RESEARCH B-5 for connection/seed code.

### Tests
**Analogs:** `tests/market/test_simulator_source.py` (async class style) and `test_cache.py` (sync class style).
```python
@pytest.mark.asyncio
class TestSimulatorDataSource:
    async def test_start_populates_cache(self):
        cache = PriceCache()
        source = SimulatorDataSource(price_cache=cache, update_interval=0.1)
        await source.start(["AAPL", "GOOGL"])
        assert cache.get("AAPL") is not None
        await source.stop()
```
Conventions: class-per-subject, docstring per test, short `update_interval` (0.05-0.1) with `await source.stop()` at end, absolute imports `from app.market.cache import PriceCache`.
Required updates to existing tests:
- `test_simulator.py:123-131` `test_prices_rounded_to_two_decimals` -> assert rounding on `cache.update("X", 190.1234).price == 190.12` instead.
- `test_massive.py:11-18` `_make_snapshot` uses `MagicMock` with `last_trade.timestamp` (the exact thing that hid G1); rewrite with `TickerSnapshot.from_dict(...)`. `test_malformed_snapshot_skipped` (47-68) relies on `last_trade = None`; keep that behavior via real model with missing `lastTrade`.
- `test_cache.py` direction/first-update tests: add raw-vs-rounded cases (190.001 -> 190.003 is `up`).
- `tests/conftest.py`: dead `event_loop_policy` fixture (lines 6-11) replaced by autouse `monkeypatch.delenv("MASSIVE_API_KEY", raising=False)` and a `tmp_settings` fixture.
- New API tests use `with TestClient(create_app(Settings(db_path=tmp_path/"t.db", static_dir=None))) as client:`. Do not drive the infinite SSE route through `TestClient`; call `generate_events` with a fake request. Run via `uv run --no-sync pytest -q` or `backend/.venv/Scripts/python.exe -m pytest -q` (Pitfall 7).

## Shared Patterns

### Module header / typing
**Source:** every `backend/app/market/*.py` (e.g. `cache.py:1-8`): one-line docstring, blank, `from __future__ import annotations`, stdlib, third-party, relative sibling imports. **Apply to:** all new Python modules.

### Logging
**Source:** `massive_client.py:14` `logger = logging.getLogger(__name__)`; lazy %-args (`logger.info("Simulator: added ticker %s", ticker)`); no `print`; no `info` in per-tick paths. **Apply to:** all backend files.

### Router factory (no module-level router)
**Source:** `stream.py` after MKT-03 fix. **Apply to:** `api/health.py`, `api/portfolio.py`, `api/watchlist.py`.

### Env var reading
**Source:** `factory.py:24` `os.environ.get(NAME, "").strip()`. **Apply to:** `config.py` (`DB_PATH`, `STATIC_DIR`).

### Lifecycle / task handling
**Source:** `simulator.py:232-240` (idempotent stop: cancel, await in `try/except asyncio.CancelledError`, set `_task = None`). **Apply to:** lifespan teardown (`await source.stop()` in `finally`).

### Thread-safe shared state
**Source:** `cache.py` `with self._lock:` around every shared access. **Apply to:** `PriceCache.version` / `remove` changes.

## No Analog Found

| File | Role | Reason / planner guidance |
|---|---|---|
| `backend/app/errors.py` (optional envelope) | middleware | No exception handlers exist; use RESEARCH B-6 |
| `backend/app/db/*`, `services/*` SQL | CRUD | No SQLite code; use RESEARCH B-5, C-8 |
| `frontend/**` (priceStore, Header, ConnectionIndicator, WatchlistPanel/Row, PriceCell, Sparkline, MainChartPanel/ChartCanvas, AppShell, Panel, placeholders, configs, vitest setup, `globals.css`) | frontend | Directory does not exist; use RESEARCH F-1..F-6 and `01-UI-SPEC.md` |
| `Dockerfile`, `.dockerignore`, `.env.example`, `.gitattributes` | config | Not present; use RESEARCH C-9, C-10, Pitfall 10 |
| `scripts/start_mac.sh`, `stop_mac.sh`, `start_windows.ps1`, `stop_windows.ps1` | script | `scripts/` empty; use RESEARCH C-11, Pitfalls 9-10; bind `127.0.0.1:8000:8000` (OQ-4) |
| `db/.gitkeep` | placeholder | trivial |
| `planning/PLAN.md` write-back (D-23) | docs | edit only |

## Metadata

**Analog search scope:** `backend/app`, `backend/tests`, plus `git ls-files` for `frontend scripts test Dockerfile .env.example` (none tracked).
**Files scanned:** ~12 read in full or in part.
**Pattern extraction date:** 2026-10-20
