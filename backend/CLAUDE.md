# Backend — Developer Guide

## Project Setup

```bash
cd backend
uv sync --extra dev   # Install all dependencies including test/lint tools
```

## Running the App

```bash
uv run uvicorn app.main:app --port 8000
```

`app/main.py` loads the repo-root `.env` (python-dotenv, existing env vars win) and builds the app via
`create_app(price_cache=None, market_source=None)` (tests inject a cache and a fake source). The lifespan
runs `db.init_db()` → starts the market source with the DB watchlist → primes day-change baselines →
records a startup snapshot, and stores `app.state.price_cache` / `app.state.market_source`.
Env vars: `OPENROUTER_API_KEY`, `MASSIVE_API_KEY`, `LLM_MOCK`, `DB_PATH` (default `<repo>/db/finally.db`),
`STATIC_DIR` (default `backend/static`; mounted at `/` last, only if it exists).

## Layout

- `app/errors.py` — `AppError(code, message, status_code)`; every non-2xx response is
  `{"error": {"code", "message"}}` (handlers in `app/main.py` also cover validation errors → `invalid_request` 422,
  404 → `not_found`, 405 → `method_not_allowed`, unhandled → `internal_error` 500).
- `app/services/` — domain logic shared by REST and the LLM chat flow:
  - `tickers.normalize_ticker` (strip/upper, `^[A-Z][A-Z0-9.]{0,9}$`, else `invalid_ticker`)
  - `portfolio.build_portfolio` / `record_snapshot` (unpriced positions are valued at avg_cost)
  - `watchlist.build_watchlist` / `add_ticker` / `remove_ticker`; `day_change_percent` baseline = first price
    seen since server start (`prime_baselines` at startup)
  - `trading.execute_trade` — validation order per PLAN §8, `TRADE_LOCK` + one DB transaction
    (cash, position, trade row, snapshot). Full sell deletes the position; buys use weighted avg cost.
- `app/api/` — routers: `health`, `portfolio`, `watchlist` (chat router lives in `app/llm/router.py`).
- `app/db/` — SQLite layer (see `TEAM_CONTRACT.md` §3.1). `app/llm/` — chat.
- Tests: `tests/services/` (service logic, `fakes.FakeSource`), `tests/api/` (TestClient against `create_app`).

## Market Data API

The market data subsystem lives in `app/market/`. Use these imports:

```python
from app.market import PriceCache, PriceUpdate, MarketDataSource, create_market_data_source
```

### Core Types

- **`PriceUpdate`** — Immutable dataclass: `ticker`, `price`, `previous_price`, `timestamp`, plus properties `change`, `change_percent`, `direction` ("up"/"down"/"flat"), and `to_dict()` for JSON serialization.

- **`PriceCache`** — Thread-safe in-memory store. Key methods:
  - `update(ticker, price, timestamp=None) -> PriceUpdate`
  - `get(ticker) -> PriceUpdate | None`
  - `get_price(ticker) -> float | None`
  - `get_all() -> dict[str, PriceUpdate]`
  - `remove(ticker)`
  - `version` property — monotonic counter, increments on every update (for SSE change detection)

- **`MarketDataSource`** — Abstract interface implemented by `SimulatorDataSource` and `MassiveDataSource`. Lifecycle: `start(tickers)` -> `add_ticker()` / `remove_ticker()` -> `stop()`.

- **`create_market_data_source(cache)`** — Factory. Returns `MassiveDataSource` if `MASSIVE_API_KEY` is set, otherwise `SimulatorDataSource`.

### SSE Streaming

```python
from app.market import create_stream_router

router = create_stream_router(price_cache)  # Returns FastAPI APIRouter
# Endpoint: GET /api/stream/prices (text/event-stream)
```

### Seed Data

Default tickers: AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX. Seed prices and per-ticker volatility/drift params are in `app/market/seed_prices.py`.

## Running Tests

```bash
uv run --extra dev pytest -v              # All tests
uv run --extra dev pytest --cov=app       # With coverage
uv run --extra dev ruff check app/ tests/ # Lint
```

## Demo

```bash
uv run market_data_demo.py   # Live terminal dashboard with simulated prices
```
