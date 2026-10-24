---
last_mapped_commit: ab8faa811f2fa60fcadbd0de3c6af2005521e5ce
last_mapped_at: 2026-10-19
---
# Testing Patterns

**Analysis Date:** 2026-10-19

## Test Framework

**Runner:**
- pytest `>=8.3.0` (dev extra in `backend/pyproject.toml`)
- pytest-asyncio `>=0.24.0`
- pytest-cov `>=5.0.0`
- Config: `backend/pyproject.toml` under `[tool.pytest.ini_options]`:
  - `testpaths = ["tests"]`
  - `python_files = ["test_*.py"]`, `python_classes = ["Test*"]`, `python_functions = ["test_*"]`
  - `asyncio_mode = "auto"`
  - `asyncio_default_fixture_loop_scope = "function"`
- Coverage config: `[tool.coverage.run]` `source = ["app"]`, `omit = ["tests/*"]`; `[tool.coverage.report]` excludes `pragma: no cover`, `__repr__`, `raise NotImplementedError`, `if TYPE_CHECKING:`, `__main__` guards.

**Assertion Library:**
- Plain `assert` statements (pytest rewriting). No assertion library beyond pytest.
- `unittest.mock` (`MagicMock`, `patch`, `patch.object`) for mocking.

**Lint for tests:**
- Same ruff config as app code: `uv run --extra dev ruff check app/ tests/`.

**Run Commands:**

```bash
cd backend
uv sync --extra dev                         # Install deps incl. test tooling
uv run --extra dev pytest -v                # Run all tests
uv run --extra dev pytest tests/market -v   # Run one area
uv run --extra dev pytest --cov=app         # Coverage (term report)
uv run --extra dev pytest --cov=app --cov-report=html   # HTML coverage (htmlcov/ is gitignored)
uv run --extra dev ruff check app/ tests/   # Lint
```

Watch mode is not configured (no pytest-watch dependency).

## Test File Organization

**Location:**
- Separate tree: all tests live under `backend/tests/`, mirroring the package layout. Market tests are in `backend/tests/market/`.
- Each test subpackage has an empty or near-empty `__init__.py` (`backend/tests/__init__.py`, `backend/tests/market/__init__.py`). Add one for each new subpackage.
- PLAN.md Section 12 also reserves `test/` at repo root for Playwright E2E tests (not yet created).

**Naming:**
- Files: `test_<module>.py` matching the source module (`test_cache.py` → `app/market/cache.py`, `test_massive.py` → `massive_client.py`).
- Note: `test_simulator.py` tests `GBMSimulator` (the pure math class); `test_simulator_source.py` tests `SimulatorDataSource` (the async lifecycle wrapper). Keep this split: pure logic in one file, async integration in a `_source` file.
- Classes: `Test<Subject>` (`TestPriceCache`, `TestPriceUpdate`, `TestGBMSimulator`, `TestSimulatorDataSource`, `TestMassiveDataSource`, `TestFactory`).
- Functions: `test_<behavior>` written as a short descriptive phrase (`test_first_update_is_flat`, `test_remove_nonexistent`, `test_prices_are_positive`).

**Structure:**

```
backend/tests/
├── __init__.py
├── conftest.py                  # Shared fixtures (currently only event_loop_policy)
└── market/
    ├── __init__.py
    ├── test_cache.py            # PriceCache
    ├── test_factory.py          # create_market_data_source env selection
    ├── test_massive.py          # MassiveDataSource with mocked REST client
    ├── test_models.py           # PriceUpdate properties and to_dict
    ├── test_simulator.py        # GBMSimulator math and bookkeeping
    └── test_simulator_source.py # SimulatorDataSource async lifecycle
```

## Test Structure

**Suite Organization:**
Tests are grouped in a class per subject, with a one-line docstring on the class and on each test. Sync tests are plain methods; async tests are decorated with `@pytest.mark.asyncio` on the class (or rely on `asyncio_mode = "auto"`).

```python

# backend/tests/market/test_cache.py

class TestPriceCache:
    """Unit tests for the PriceCache."""

    def test_direction_up(self):
        """Test price update with upward direction."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        update = cache.update("AAPL", 191.00)
        assert update.direction == "up"
        assert update.change == 1.00
```

```python

# backend/tests/market/test_simulator_source.py

@pytest.mark.asyncio
class TestSimulatorDataSource:
    """Integration tests for the SimulatorDataSource."""

    async def test_stop_is_clean(self):
        """Test that stop() is clean and idempotent."""
        cache = PriceCache()
        source = SimulatorDataSource(price_cache=cache, update_interval=0.1)
        await source.start(["AAPL"])
        await source.stop()
        # Double stop should not raise
        await source.stop()
```

**Patterns:**
- **Setup:** Build the object under test inline at the top of each test. No `setUp`/`setup_method`.
- **Teardown:** Explicit `await source.stop()` at the end of async tests that call `start()`. There is no yield-fixture teardown yet. Use `try/finally` if an assertion can fail before stop, and do so in new tests.
- **Assertions:** Direct equality and truthiness on returned values; `set(...)` comparison for key sets (`assert set(all_prices.keys()) == {"AAPL", "GOOGL"}`); `pytest.approx` for float math where needed.
- **Exceptions:** Expected non-raising behavior is tested by calling the method and relying on the test not failing (e.g., `cache.remove("AAPL")  # Should not raise`). Use `pytest.raises` for raising paths.
- **Timing-based async tests:** Use short intervals (`update_interval=0.05`) and `await asyncio.sleep(0.3)` to observe several cycles; assert on monotonic counters (`cache.version`) rather than exact values.

## Mocking

**Framework:** `unittest.mock` (`MagicMock`, `patch`, `patch.object`). No `pytest-mock` dependency.

**Patterns:**

```python

# backend/tests/market/test_massive.py

def _make_snapshot(ticker: str, price: float, timestamp_ms: int) -> MagicMock:
    """Create a mock Massive snapshot object."""
    snap = MagicMock()
    snap.ticker = ticker
    snap.last_trade = MagicMock()
    snap.last_trade.price = price
    snap.last_trade.timestamp = timestamp_ms
    return snap

source = MassiveDataSource(api_key="test-key", price_cache=cache, poll_interval=60.0)
source._tickers = ["AAPL", "GOOGL"]
source._client = MagicMock()  # Satisfy the _poll_once guard

with patch.object(source, "_fetch_snapshots", return_value=mock_snapshots):
    await source._poll_once()
```

```python

# backend/tests/market/test_factory.py

with patch.dict(os.environ, {"MASSIVE_API_KEY": ""}, clear=True):
    source = create_market_data_source(cache)
assert isinstance(source, SimulatorDataSource)
```

**What to Mock:**
- The Massive REST client and its synchronous `_fetch_snapshots` method (never hit the real API in tests).
- Environment variables via `patch.dict(os.environ, ..., clear=True)`.
- Malformed upstream payloads (`bad_snap.last_trade = None`) to exercise tolerance paths.
- Upstream failures via `side_effect=Exception("network error")`.

**What NOT to Mock:**
- `PriceCache`: always use the real thread-safe cache; it is cheap and is the contract downstream code depends on.
- `GBMSimulator` / `SimulatorDataSource`: test them for real with short intervals. The simulator is deterministic enough in shape (positive prices, key sets) that no mock is needed.
- `PriceUpdate`: construct real frozen dataclasses with explicit timestamps.

**Known coupling:** Several Massive tests set private attributes (`source._tickers`, `source._client`) and patch private methods (`_fetch_snapshots`, `_poll_once`). When refactoring `MassiveDataSource`, update these tests together. Prefer public methods (`add_ticker`, `start`) where feasible in new tests.

## Fixtures and Factories

**Shared fixtures:**
- `backend/tests/conftest.py` defines `event_loop_policy` returning `asyncio.DefaultEventLoopPolicy()`. Keep this file for cross-cutting fixtures only.

**Test data:**
- Use literal values inline: prices like `190.50`, `175.25`; tickers `"AAPL"`, `"GOOGL"`, `"BAD"`; timestamps in ms like `1707580800000` (converted to seconds `1707580800.0` in assertions).
- Use `app.market.seed_prices.SEED_PRICES` when a test needs realistic starting values (`test_simulator.py`).
- Helper factories are module-private functions prefixed `_make_` (e.g., `_make_snapshot`) defined at the top of the test file.

**Location:**
- No shared factory module. Put helpers in the test file that uses them; move to `conftest.py` only when two or more files need the same helper.

**Recommended fixture for future work:** when DB-backed tests are added (portfolio, watchlist, chat), create a function-scoped fixture in `backend/tests/conftest.py` that builds a temporary SQLite file (`tmp_path / "finally.db"`) and seeds it using the lazy-init code, so tests never touch `db/finally.db`.

## Coverage

**Requirements:** None enforced. No `--cov-fail-under` threshold is configured.

**View Coverage:**

```bash
cd backend
uv run --extra dev pytest --cov=app --cov-report=term-missing
```

## Test Types

**Unit Tests:**
- Scope: single classes/functions in `app/market/` — `PriceCache`, `PriceUpdate`, `GBMSimulator`, factory selection, Massive response parsing.
- Synchronous unless the method is `async`.

**Integration Tests:**
- Scope: async lifecycle of `SimulatorDataSource` against a real `PriceCache` with real `asyncio` tasks (`test_simulator_source.py`). Despite the name, these do not hit external services.
- The Massive tests are "mocked integration": they exercise `start`/`add_ticker`/`_poll_once` with the REST client replaced.

**E2E Tests:**
- Not yet implemented. PLAN.md Section 12 specifies Playwright tests in `test/` run via `test/docker-compose.test.yml` with `LLM_MOCK=true`. Scenarios: fresh start shows default watchlist and $10k; add/remove ticker; buy/sell updates cash and positions; heatmap and P&L chart render; mocked AI chat shows inline trade.

**Frontend Tests:**
- Not yet implemented. PLAN.md Section 12 specifies React Testing Library unit tests for: component rendering with mock data, price flash timing, watchlist CRUD, portfolio calculations, chat rendering and loading state, and connection-status indicator mapped to `EventSource` readyState.

**Backend Tests still to write (per PLAN.md Section 12):**
- Portfolio: buy/sell math, P&L, edge cases (oversell, insufficient cash, sell at loss, non-integer or non-positive quantity).
- Watchlist: removing a ticker with an open position returns 409.
- LLM: structured output parsing, malformed response handling, trade validation within chat flow. Tests must run with the mock LLM path (`LLM_MOCK=true`), not the network.
- API routes: status codes, response shapes, error body `{"error": {"code", "message"}}`.

## Common Patterns

**Async Testing:**

```python
@pytest.mark.asyncio
class TestSimulatorDataSource:
    async def test_add_ticker(self):
        cache = PriceCache()
        source = SimulatorDataSource(price_cache=cache, update_interval=0.1)
        await source.start(["AAPL"])
        await source.add_ticker("TSLA")
        assert "TSLA" in source.get_tickers()
        assert cache.get("TSLA") is not None
        await source.stop()
```

- `asyncio_mode = "auto"` means `async def test_*` works without a marker, but the existing code adds `@pytest.mark.asyncio` on classes. Follow the class-level marker for consistency.
- Use `await asyncio.sleep(...)` only for observing background loops; do not sleep to "wait for" deterministic operations.

**Error Testing:**

```python

# Tolerated upstream error: must not raise, must not update cache

with patch.object(source, "_fetch_snapshots", side_effect=Exception("network error")):
    await source._poll_once()  # Should not raise
assert cache.get_price("AAPL") is None
```

```python

# Idempotency / no-op: call twice, assert no exception and state unchanged

cache.remove("AAPL")  # Should not raise
```

**Environment-dependent tests:**

```python
with patch.dict(os.environ, {}, clear=True):
    source = create_market_data_source(cache)
```

Always use `clear=True` so a developer's real `MASSIVE_API_KEY` in the shell cannot change the result.

**Randomness:**
- The simulator uses `numpy.random` and `random`. Current tests assert properties (positive prices, key sets, monotonic version) rather than exact values. Keep new randomized tests property-based; if exact values are needed, seed with `np.random.seed(...)` and `random.seed(...)` inside the test.

## Writing New Tests: Checklist

1. Put the file under `backend/tests/<area>/test_<module>.py` with an `__init__.py` in the new directory.
2. Name classes `Test<Subject>` with a docstring; name methods `test_<behavior>` with a docstring.
3. Use `@pytest.mark.asyncio` on any class containing `async def` tests that start background tasks.
4. Always `await source.stop()` (or equivalent teardown) after `start()`, including on assertion failure (use `try/finally`).
5. Do not hit the Massive API or OpenRouter from tests; mock the client or set `LLM_MOCK=true`.
6. Run `uv run --extra dev pytest -v` and `uv run --extra dev ruff check app/ tests/` before finishing.

---

*Testing analysis: 2026-10-19*
