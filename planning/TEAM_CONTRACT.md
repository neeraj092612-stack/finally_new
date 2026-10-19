# FinAlly — Agent Team Contract

Written by the team lead on 2026-10-19. This is the shared contract that lets every team member work
in parallel. It **extends** `planning/PLAN.md` (Section 8 API contracts remain authoritative) and
resolves the open questions in PLAN §13.2. If you need to change anything here, message the
owner(s) affected and the team lead, then update this file.

## 1. Team and file ownership

Only the owner edits files in their area. If you find a bug in someone else's area, message them;
do not fix it yourself.

| Member (agent name) | Owns |
|---|---|
| `database-engineer` | `backend/app/db/**` (package incl. `schema.sql`), `backend/tests/db/**` |
| `backend-engineer` | `backend/app/main.py`, `backend/app/errors.py`, `backend/app/api/**` (except chat), `backend/app/services/**`, `backend/tests/api/**`, `backend/tests/services/**`, `backend/pyproject.toml` + `uv.lock` (others ask backend-engineer to add deps), `backend/CLAUDE.md`. `backend/app/market/**` is complete — touch only to fix bugs. |
| `llm-engineer` | `backend/app/llm/**` (structured output schema, prompt, LiteLLM client, mock, chat orchestration, chat router `GET/POST /api/chat`), `backend/tests/llm/**` |
| `frontend-engineer` | `frontend/**` |
| `devops-engineer` | `Dockerfile`, `.dockerignore`, `.gitignore`, `.gitattributes`, `.env.example`, `scripts/**`, `db/.gitkeep`, root `README.md` run instructions |
| `integration-tester` | `test/**` (Playwright project + `test/docker-compose.test.yml`) |

Deviation from PLAN §4: schema SQL and seed logic live in the Python package `backend/app/db/`
(not `backend/db/`) so they are importable and packaged by hatch.

## 2. Resolved open questions (PLAN §13.2)

| # | Decision |
|---|---|
| 6 | devops creates `.env.example`. Start scripts: if `.env` is missing, copy `.env.example` to `.env` and print a warning (chat returns `llm_error` until a key is set). |
| 8 | DB init (`init_db()`) runs in the FastAPI lifespan, before the market source starts, followed by the startup portfolio snapshot. |
| 11 | Simulator accepts any well-formed ticker (unknown ones get a random $50–$300 seed). Massive mode: no existence check; documented limitation. |
| 12 | `day_change_percent` baseline = the first price seen for that ticker since server start (backend keeps a `{ticker: first_price}` dict in `app/services`). `round(..., 2)`, percent units (0.65 = 0.65%). |
| 13 | Accepted: chart and sparkline history live only in the browser since page load. No backend history buffer. |
| 14 | Massive mode is static outside market hours — documented in README, not a bug. |
| 17 | Confirmed: full sell deletes the position row; buy into existing position → weighted-average `avg_cost`; partial sell leaves `avg_cost` unchanged. |
| 18 | No realized P&L display. Total value vs $10,000 is enough. |
| 19 | Every trade (manual or LLM) runs inside one module-level `asyncio.Lock` in `app/services/trading.py` and one SQLite transaction (cash, position, trade row, snapshot). |
| 21 | Reset = `docker volume rm finally-data` (documented in README). No endpoint. |
| 22 | Add `GET /api/chat` → `{"messages": [<message>, ...]}`, oldest first, last 50. Each message has the same shape as `POST /api/chat`'s `message` (`id, role, content, created_at, actions`); `actions` is `null` for user messages. |
| 23 | LLM receives the last 20 stored messages as history. |
| 26 | Mock is defined in §5 below. |
| 27 | Structured output: `message`, `trades`, `watchlist_changes` are all **required**; arrays may be empty. |
| 29 | Frontend refetches `/api/portfolio` (and `/api/portfolio/history`) after every manual trade and after any chat response with a non-empty action; refetches `/api/watchlist` after watchlist changes / chat actions. Header total value, positions' current price / P&L, and the P&L chart's final point are recomputed client-side from live SSE prices between refetches. |
| 30 | Connection dot: `EventSource.readyState` OPEN → green, CONNECTING → yellow, CLOSED → red. |
| 31 | API routers are registered before the static mount. Static files are served with `StaticFiles(directory=STATIC_DIR, html=True)` mounted at `/`, only if the directory exists. `STATIC_DIR` env var, default `backend/static`. |
| 32 | `DB_PATH` env var. Default: `<repo root>/db/finally.db` (computed relative to the package file). Docker sets `DB_PATH=/app/db/finally.db`. Parent directory is created if missing. |

## 3. Backend module interfaces

All Python is synchronous `sqlite3` for DB access (single user, tiny data). Timestamps are produced by
`app.db.utc_now_iso()` → `"2026-10-04T14:03:22Z"` (UTC, seconds precision, `Z` suffix).

### 3.1 `app.db` (database-engineer)

```python
DEFAULT_USER_ID = "default"
DEFAULT_TICKERS = ["AAPL","GOOGL","MSFT","AMZN","TSLA","NVDA","META","JPM","V","NFLX"]
STARTING_CASH = 10000.0

def utc_now_iso() -> str
def get_db_path() -> pathlib.Path                     # DB_PATH env or default
def init_db(db_path: str | os.PathLike | None = None) -> None
    # create tables if missing (CREATE TABLE IF NOT EXISTS from schema.sql);
    # seed user profile + 10 watchlist tickers only if users_profile is empty. Idempotent.
@contextmanager
def connect(db_path=None) -> Iterator[sqlite3.Connection]
    # row_factory=sqlite3.Row, foreign_keys on; commits on success, rolls back on exception, closes.
    # One `with connect() as conn:` block == one transaction.

# Repository functions — all take `conn` first, all return plain dicts (JSON-ready), all scoped to DEFAULT_USER_ID.
get_cash_balance(conn) -> float
set_cash_balance(conn, value: float) -> None
list_watchlist(conn) -> list[dict]            # {ticker, added_at}, ORDER BY added_at, rowid
get_watchlist_tickers(conn) -> list[str]
is_watched(conn, ticker) -> bool
add_watchlist_ticker(conn, ticker) -> tuple[dict, bool]   # (entry, created); idempotent
remove_watchlist_ticker(conn, ticker) -> bool             # False if not present
list_positions(conn) -> list[dict]            # {ticker, quantity, avg_cost, updated_at}, ORDER BY ticker
get_position(conn, ticker) -> dict | None
upsert_position(conn, ticker, quantity: int, avg_cost: float) -> None
delete_position(conn, ticker) -> None
insert_trade(conn, ticker, side, quantity: int, price: float) -> dict
    # {id, ticker, side, quantity, price, executed_at}
list_trades(conn) -> list[dict]               # oldest first
insert_snapshot(conn, total_value: float) -> dict         # {total_value, recorded_at}
list_snapshots(conn) -> list[dict]            # {total_value, recorded_at}, oldest first
insert_chat_message(conn, role: str, content: str, actions: dict | None) -> dict
    # {id, role, content, actions (decoded dict or None), created_at}
list_chat_messages(conn, limit: int | None = None) -> list[dict]
    # the most recent `limit` messages, returned oldest first; actions JSON-decoded
```

### 3.2 `app.errors` (backend-engineer)

```python
class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int): ...
    def to_dict(self) -> dict   # {"code": ..., "message": ...}
```
`app.main` installs exception handlers that turn `AppError` and `RequestValidationError`
(→ `invalid_request`, 422) into `{"error": {"code", "message"}}`.

### 3.3 `app.services` (backend-engineer)

Shared by the REST routes and the LLM chat flow — the LLM never touches the DB tables for trades/
watchlist directly.

```python
# app/services/tickers.py
def normalize_ticker(raw: str) -> str          # strip/upper; raises AppError("invalid_ticker", ..., 400)

# app/services/portfolio.py
def build_portfolio(conn, cache: PriceCache) -> dict       # exact GET /api/portfolio shape
def record_snapshot(conn, cache: PriceCache) -> dict

# app/services/watchlist.py
def build_watchlist(conn, cache: PriceCache) -> list[dict] # exact GET /api/watchlist element shape
async def add_ticker(cache, source: MarketDataSource, raw_ticker: str) -> tuple[dict, bool]
async def remove_ticker(cache, source: MarketDataSource, raw_ticker: str) -> None
    # raises not_watched / position_open; removes from source and cache

# app/services/trading.py
async def execute_trade(cache, raw_ticker: str, side: str, quantity: int) -> dict
    # validates in the PLAN §8 order, holds the trade lock, one transaction, writes snapshot.
    # returns {"trade": {...}, "portfolio": {...}}  (exact POST /api/portfolio/trade shape)
    # raises AppError for every rule violation (incl. invalid_request for bad side/quantity).
```

App wiring: the lifespan creates `PriceCache` and the market source and stores them on
`app.state.price_cache` and `app.state.market_source`. Routers read them from `request.app.state`.

### 3.4 `app.llm` (llm-engineer)

```python
# app/llm/router.py
router = APIRouter(prefix="/api/chat")   # GET "" and POST "" ; backend-engineer includes it in main.py
# app/llm/chat.py
async def handle_chat(user_message: str, cache, source) -> dict   # returns {"message": {...}}
```
Flow per PLAN §9: store user message → build context (via `app.services.portfolio.build_portfolio` /
`build_watchlist`) + last 20 messages → call LLM (or mock) → on failure raise
`AppError("llm_error", ..., 502)` with no actions run → run actions in order (watchlist adds, trades,
watchlist removals) through `app.services` functions, catching `AppError` per action → store assistant
message with `actions` → return. Use the `cerebras` skill for the LiteLLM call; run the blocking
`completion` call in a thread (`asyncio.to_thread`) with a timeout. Dependencies `litellm`,
`pydantic`, `python-dotenv` are added by backend-engineer (ask if missing). The backend loads the
root `.env` with python-dotenv at startup (does not override existing env vars).

## 4. Environment variables

| Var | Default | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` | — | Required for real chat |
| `MASSIVE_API_KEY` | empty | Empty → simulator |
| `LLM_MOCK` | `false` | `true` → deterministic mock (§5) |
| `DB_PATH` | `<repo>/db/finally.db` | Docker: `/app/db/finally.db` |
| `STATIC_DIR` | `backend/static` | Docker: `/app/static` |

## 5. LLM mock (`LLM_MOCK=true`)

Deterministic, matched case-insensitively against the user message, first rule wins. `TICKER` is
uppercased in the output. Actions then run through the normal execution path.

| Pattern (regex, case-insensitive) | `message` | `watchlist_changes` | `trades` |
|---|---|---|---|
| `\bbuy\s+(\d+)\s+(?:shares?\s+(?:of\s+)?)?([a-z][a-z0-9.]{0,9})\b` | `[mock] Buying N shares of TICKER.` | `[{TICKER, add}]` | `[{TICKER, buy, N}]` |
| `\bsell\s+(\d+)\s+(?:shares?\s+(?:of\s+)?)?([a-z][a-z0-9.]{0,9})\b` | `[mock] Selling N shares of TICKER.` | `[]` | `[{TICKER, sell, N}]` |
| `\b(?:add\|watch)\s+([a-z][a-z0-9.]{0,9})\b` | `[mock] Adding TICKER to your watchlist.` | `[{TICKER, add}]` | `[]` |
| `\bremove\s+([a-z][a-z0-9.]{0,9})\b` | `[mock] Removing TICKER from your watchlist.` | `[{TICKER, remove}]` | `[]` |
| anything else | `[mock] Your portfolio is worth $X with $Y in cash.` (2-decimal, comma thousands) | `[]` | `[]` |

## 6. Frontend ↔ E2E selector contract (`data-testid`)

The frontend must render these; the integration tester relies only on these (plus visible text).

| testid | Element / notes |
|---|---|
| `connection-status` | header dot; attribute `data-status="connected"\|"reconnecting"\|"disconnected"` |
| `header-total-value`, `header-cash` | header numbers, formatted like `$10,000.00` |
| `watchlist` | watchlist panel |
| `watchlist-row-{TICKER}` | one row per ticker; clicking selects it for the main chart |
| `watchlist-price-{TICKER}` | price cell; gets class `flash-up` / `flash-down` briefly on change |
| `watchlist-remove-{TICKER}` | remove button |
| `watchlist-add-input`, `watchlist-add-button` | add form |
| `watchlist-error` | inline error text (e.g. `position_open` message) |
| `main-chart` | main chart container; `data-ticker="{TICKER}"` for the selected ticker |
| `trade-ticker-input`, `trade-quantity-input`, `trade-buy-button`, `trade-sell-button` | trade bar |
| `trade-error` | inline trade error message (API `error.message`) |
| `positions-table`, `position-row-{TICKER}` | positions table rows; row has `data-quantity="{n}"` |
| `heatmap`, `heatmap-cell-{TICKER}` | treemap cells; `data-pnl="positive"\|"negative"\|"flat"` |
| `pnl-chart` | P&L chart container; `data-points="{n}"` = number of plotted points |
| `chat-panel`, `chat-input`, `chat-send-button` | chat |
| `chat-message` | each message; `data-role="user"\|"assistant"` |
| `chat-loading` | visible while awaiting `/api/chat` |
| `chat-action` | each inline action; `data-status="executed"\|"failed"` |

## 7. Coordination protocol

- Everyone writes unit tests for their own area and keeps them green
  (`cd backend && uv run --extra dev pytest`, frontend: `npm test`).
- When your area is ready for integration, message `integration-tester` and the team lead.
- `integration-tester` reports each E2E failure **only to the owning member** (per §1), with the
  failing test, observed vs expected, and logs. The owner fixes it and replies when done.
- Unsure who owns a bug → ask the team lead.
