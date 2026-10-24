# Graph Report - finally_new  (2026-10-24)

## Corpus Check
- 159 files · ~144,856 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .lock 1)

## Summary
- 1451 nodes · 3203 edges · 82 communities (52 shown, 30 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 321 edges (avg confidence: 0.86)
- Token cost: 1,000,718 input · 0 output

## Community Hubs (Navigation)
- PLAN Spec & Market Design
- Massive Snapshot Parsing
- Docker & Start Scripts
- Market Source Lifecycle Fixes
- Frontend Toolchain Setup
- PriceCache Read/Write API
- Server Smoke Test
- Live Watchlist Panel
- Backend API & DB Modules
- Frontend Component Tests
- Codebase Concerns & Bugs
- Phase 1 Decisions
- Watchlist UI & API Client
- Claude GitHub Workflow
- Runtime Settings Config
- Market Data Demo
- Main Chart Plan
- PriceCache Class
- Architecture Analysis
- Error Envelope Tests
- Code Review Workflow
- Terminal Grid Layout
- Live Header
- Frontend Dev Dependencies
- Data Source Factory
- Portfolio Service
- PriceUpdate Model
- Error Handlers
- Massive Poll Loop
- Price Cells & Formatting
- TypeScript Config
- Server Walking Skeleton
- Market Data Core Fixes
- Market Data Review
- DB Init & Schema Tests
- MarketDataSource Interface
- Day-Change Serialization
- Sector Correlation
- Lifespan Startup Order
- Error Envelope & DB Plan
- Project Overview Decisions
- Portfolio Router & Connections
- GBM Simulator Core
- Day-Change Baseline Tests
- SSE Generator Tests
- WatchlistPanel Tests
- App Factory & ApiError
- Root Layout & Runtime Deps
- Phase 2 Trading Context
- Cache Direction Tests
- Massive API Reference
- Archived Market Design
- v1 Requirements
- Coding Conventions
- LLM Chat Roadmap
- Tech Stack
- Unknown API Path Tests
- Vitest Setup
- Fake EventSource
- Project State
- Pytest Fixtures
- npm Scripts
- Testing Patterns
- Vitest Config
- Atomic Trade Decision
- Static-Dir Smoke Gap
- Backend Project Metadata

## God Nodes (most connected - your core abstractions)
1. `PriceCache` - 155 edges
2. `planning/PLAN.md (project spec)` - 80 edges
3. `MassiveDataSource` - 58 edges
4. `SimulatorDataSource` - 54 edges
5. `PriceUpdate` - 50 edges
6. `create_app()` - 46 edges
7. `GBMSimulator` - 43 edges
8. `create_market_data_source()` - 33 edges
9. `create_stream_router()` - 33 edges
10. `Plan 01-01: Server Walking-Skeleton Tracer` - 29 edges

## Surprising Connections (you probably didn't know these)
- `Env Var Reading Idiom (os.environ.get().strip())` --references--> `Settings`  [EXTRACTED]
  .planning/phases/01-live-market-terminal/01-PATTERNS.md → backend/app/config.py
- `Pattern B-5 SQLite Layer, App Factory, Lifespan` --references--> `create_app()`  [EXTRACTED]
  .planning/phases/01-live-market-terminal/01-RESEARCH.md → backend/app/main.py
- `create_app()` --implements--> `Guarded Static Mount After API Routers`  [EXTRACTED]
  backend/app/main.py → .planning/phases/01-live-market-terminal/01-01-PLAN.md
- `Price direction flickers to flat for sub-cent moves` --references--> `PriceCache`  [EXTRACTED]
  .planning/codebase/CONCERNS.md → backend/app/market/cache.py
- `Do not mock PriceCache or simulator` --references--> `PriceCache`  [EXTRACTED]
  .planning/codebase/TESTING.md → backend/app/market/cache.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **MarketDataSource implementations selected by factory** — backend_app_market_interface_marketdatasource, backend_app_market_simulator_simulatordatasource, backend_app_market_massive_client_massivedatasource, backend_app_market_factory_create_market_data_source [EXTRACTED 1.00]
- **Producer -> PriceCache -> SSE consumer flow** — backend_app_market_simulator_simulatordatasource, backend_app_market_massive_client_massivedatasource, backend_app_market_cache_pricecache, backend_app_market_stream_create_stream_router, _planning_codebase_architecture_producer_cache_consumer [EXTRACTED 1.00]
- **Atomic, serialized trade execution shared by manual and chat trades** — _planning_phases_02_manual_trading_portfolio_02_context_trade_service_single_path, _planning_phases_02_manual_trading_portfolio_02_context_d46_trade_transaction_lock, _planning_project_decision_trade_atomic_lock, _planning_requirements_port_05 [INFERRED 0.85]
- **Price pipeline: data source -> PriceCache -> SSE generate_events -> browser priceStore** — backend_app_market_simulator_simulatordatasource, backend_app_market_massive_client_massivedatasource, backend_app_market_cache_pricecache, backend_app_market_stream_generate_events, frontend_src_lib_pricestore_connectpricestream [INFERRED 0.85]
- **Lifespan startup sequence (D-21)** — backend_app_main_create_app, backend_app_db___init___init_db, backend_app_services_watchlist_list_tickers, backend_app_market_factory_create_market_data_source, backend_app_services_portfolio_record_snapshot [EXTRACTED 1.00]
- **Day-change baseline flow (D-18)** — backend_app_market_cache_pricecache, backend_app_market_models_priceupdate, backend_app_market_massive_client_parse_snapshot, backend_app_services_watchlist_watchlist_entry [INFERRED 0.85]
- **Live SSE price store feeding header, watchlist and chart** — frontend_src_lib_pricestore_connectpricestream, frontend_src_lib_pricestore_usepricestream, frontend_src_components_header_header, frontend_src_components_watchlistrow_watchlistrow, frontend_src_components_chartcanvas_chartcanvas, frontend_src_lib_pricestore_getticks, frontend_src_lib_pricestore_ontick [INFERRED 0.85]
- **One-command Docker launch (image, env template, start/stop scripts)** — dockerfile, _dockerignore, _env_example, scripts_start_mac, scripts_start_windows, scripts_stop_mac, scripts_stop_windows [EXTRACTED 1.00]
- **JSON error envelope stack** — backend_app_errors_apierror, backend_app_errors_install_error_handlers, backend_app_errors_error_response, backend_app_main_api_catch_all_route, backend_app_main_create_app [EXTRACTED 1.00]
- **Phase 1 Live Price Pipeline (source -> cache -> SSE -> store -> UI)** — backend_app_market_simulator_simulatordatasource, backend_app_market_massive_client_massivedatasource, backend_app_market_cache_pricecache, backend_app_market_stream_generate_events, frontend_src_lib_pricestore, frontend_src_components_pricecell, frontend_src_components_chartcanvas [EXTRACTED 1.00]
- **Lifespan Startup Sequence (init_db -> source.start -> snapshot)** — backend_app_main_create_app, backend_app_db___init___init_db, backend_app_market_factory_create_market_data_source, backend_app_services_portfolio_record_snapshot [EXTRACTED 1.00]
- **D-06 Raw-Price Direction Fix Spans Simulator, Model, Cache** — backend_app_market_simulator_gbmsimulator, backend_app_market_models_priceupdate, backend_app_market_cache_pricecache, _planning_phases_01_live_market_terminal_01_context_raw_price_direction [EXTRACTED 1.00]
- **Sources push to PriceCache, consumers read** — backend_app_market_simulator_simulatordatasource, backend_app_market_massive_client_massivedatasource, backend_app_market_cache_pricecache, backend_app_market_stream_generate_events, planning_market_data_design_fill_price, planning_market_data_design_watchlist_entry [EXTRACTED 1.00]
- **Massive poll pipeline** — backend_app_market_massive_client_massivedatasource_poll_once, backend_app_market_massive_client_massivedatasource_fetch_snapshots, backend_app_market_massive_client_parse_snapshot, massive_tickersnapshot [EXTRACTED 1.00]
- **Market Data Producer-Cache-SSE Flow** — backend_app_market_simulator_simulatordatasource, backend_app_market_massive_client_massivedatasource, backend_app_market_cache_pricecache, backend_app_market_stream_generate_events, planning_plan_watchlist_panel [INFERRED 0.95]
- **Chat Auto-Execution Through Trade and Watchlist Rules** — planning_plan_post_chat, planning_plan_structured_output_schema, planning_plan_auto_execution, planning_plan_trade_rules, planning_plan_post_watchlist, planning_plan_chat_messages_table [EXTRACTED 1.00]
- **Single-Command Docker Deployment** — planning_plan_multistage_dockerfile, planning_plan_finally_data_volume, planning_plan_start_stop_scripts, planning_plan_loopback_port_binding, planning_plan_get_health [EXTRACTED 1.00]

## Communities (82 total, 30 thin omitted)

### Community 0 - "PLAN Spec & Market Design"
Cohesion: 0.06
Nodes (56): Previous Close Endpoint, planning/PLAN.md (project spec), AI Chat Panel, API Error Envelope and Error Codes, cerebras skill (openrouter/openai/gpt-oss-120b), Open Item 22: GET /api/chat History Endpoint, chat_messages table, Connection Status Indicator (EventSource.readyState) (+48 more)

### Community 1 - "Massive Snapshot Parsing"
Cohesion: 0.07
Nodes (13): parse_snapshot(), ParsedSnapshot, _positive(), _snap(), _source(), TestFailureHandling, fetch(), TestLifecycle (+5 more)

### Community 2 - "Docker & Start Scripts"
Cohesion: 0.07
Nodes (40): .dockerignore, .env.example, .gitattributes, Phase 1 Plan 01-11: Docker Packaging, Phase 1 Summary 01-11: Docker Packaging, Phase 1 Plan 01-13: Start/Stop Scripts and PLAN.md Write-back, Phase 1 Summary 01-13: Start/Stop Scripts and PLAN.md Write-back, Multi-Stage Dockerfile (node:20-slim -> python:3.12-slim + uv) (+32 more)

### Community 3 - "Market Source Lifecycle Fixes"
Cohesion: 0.09
Nodes (6): Anti-pattern: silent no-op on ticker add before start, Pattern B-2 Simulator Pending-Ticker Queue (MKT-04), MKT-04: tickers added before simulator start() not dropped, SimulatorDataSource, TestPreStartTickers, TestSimulatorDataSource

### Community 4 - "Frontend Toolchain Setup"
Cohesion: 0.09
Nodes (33): Plan 01-02: Frontend Toolchain and Test Harness, UI-01: Dark terminal page with connection indicator, Summary 01-02: Frontend Toolchain and Test Harness, Plan 01-05: Client Data Layer, Summary 01-05: Client Data Layer, Pattern F-2 Single Price Store via useSyncExternalStore, IN-03 No Ticker-Removal Path in Price Store/SSE, nextConfig (+25 more)

### Community 6 - "Server Smoke Test"
Cohesion: 0.12
Nodes (18): _free_port(), _get_json(), _read_first_data_event(), server(), ServerHandle, smoke_dir(), start_server(), stop_server() (+10 more)

### Community 7 - "Live Watchlist Panel"
Cohesion: 0.13
Nodes (19): Phase 1 Plan 01-10: Live Watchlist Panel, Phase 1 Summary 01-10: Live Watchlist Panel, Flaky WatchlistPanel live-price tests (deferred), Stub-then-test RED (compile-only stubs), PriceCell(), Sparkline(), SparklineProps, STROKE_BY_TREND (+11 more)

### Community 9 - "Frontend Component Tests"
Cohesion: 0.07
Nodes (13): @testing-library/react@16.3.3, Direction, chartTitle(), PORTFOLIO, region(), TICKERS, lw, store (+5 more)

### Community 10 - "Codebase Concerns & Bugs"
Cohesion: 0.09
Nodes (20): CONCERNS.md - codebase concerns, Price direction flickers to flat for sub-cent moves, Auto-running independent-reviewer Stop hook risk, Test gap: Massive parsing only tested with MagicMock, Bug G1: Massive mode never receives prices (last_trade.timestamp), Missing .dockerignore and .env.example, Bug G3: removed ticker reappears after in-flight Massive poll, Secret handling by convention only (+12 more)

### Community 11 - "Phase 1 Decisions"
Cohesion: 0.09
Nodes (23): Phase 1 Context (Live Market Terminal), D-19 Connection Dot readyState Mapping, D-21 Lifespan DB Init, Source Start, Startup Snapshot, D-14..D-17 Main Chart Area Series, D-05 Price-Cell-Only Flash, D-10/D-11 Sparkline 5-Minute Rolling Window, Phase 1 Discussion Log, Phase 1 Pattern Map (+15 more)

### Community 12 - "Watchlist UI & API Client"
Cohesion: 0.14
Nodes (20): SKELETON_ROWS, WatchlistPanelProps, WatchlistRowProps, ApiRequestError, ErrorEnvelope, fetchPortfolio(), fetchWatchlist(), getJson() (+12 more)

### Community 13 - "Claude GitHub Workflow"
Cohesion: 0.07
Nodes (28): if, permissions, runs-on, steps, types, types, jobs, claude (+20 more)

### Community 14 - "Runtime Settings Config"
Cohesion: 0.11
Nodes (6): Settings, _stream_route_count(), TestCreateStreamRouter, _clean_env(), TestDbPath, TestStaticDir

### Community 15 - "Market Data Demo"
Cohesion: 0.10
Nodes (7): build_dashboard(), build_event_log(), build_table(), format_price(), print_summary(), run(), sparkline()

### Community 16 - "Main Chart Plan"
Cohesion: 0.17
Nodes (17): Phase 1 Plan 01-14: Main Chart, Phase 1 Summary 01-14: Main Chart, ChartCanvas(), ChartCanvasProps, formatTime(), ChartClient, changeColor(), ChartStrip() (+9 more)

### Community 17 - "PriceCache Class"
Cohesion: 0.12
Nodes (9): PriceCache, PriceHistory (optional), list_entries(), watchlist_entry(), test_identical_added_at_rows_come_back_in_insertion_order(), test_list_entries_is_empty_when_nothing_is_watched(), test_list_entries_returns_seeded_tickers_in_order(), test_watchlist_entry_for_unpriced_ticker_has_null_price_fields_not_zero() (+1 more)

### Community 18 - "Architecture Analysis"
Cohesion: 0.10
Nodes (18): ARCHITECTURE.md - codebase architecture, Anti-pattern: module-level router with factory-attached routes, Planned FastAPI entry point backend/app/main.py, SSE delivery path (version-polled, 500ms), Tech debt G6: module-level router mutated by factory, STRUCTURE.md - directory structure, IN-04 No SSE Keepalive, MKT-03: SSE router created twice registers no duplicate routes (+10 more)

### Community 20 - "Error Envelope Tests"
Cohesion: 0.15
Nodes (7): _Body, client(), _prepend_route(), _settings(), TestErrorEnvelope, echo(), TestWatchlistEdges

### Community 21 - "Code Review Workflow"
Cohesion: 0.08
Nodes (23): permissions, runs-on, steps, jobs, claude-review, name, contents, id-token (+15 more)

### Community 22 - "Terminal Grid Layout"
Cohesion: 0.19
Nodes (14): Plan 01-04: Terminal Grid and Panel Chrome, Summary 01-04: Terminal Grid and Panel Chrome, Phase 1 Plan 01-12: Live Watchlist Selection, Phase 1 Summary 01-12: Live Watchlist Selection, globals.css theme tokens, Page(), AppShell(), Panel() (+6 more)

### Community 23 - "Live Header"
Cohesion: 0.16
Nodes (14): Phase 1 Plan 01-08: Live Header, Phase 1 Summary 01-08: Live Header, ConnectionIndicator(), ConnectionIndicatorProps, present(), Presentation, Header(), liveTotal() (+6 more)

### Community 24 - "Frontend Dev Dependencies"
Cohesion: 0.12
Nodes (22): devDependencies, jsdom@30.1.3, postcss@8.5.29, tailwindcss@4.3.3, @tailwindcss/postcss@4.3.3, @testing-library/user-event@14.6.8, @types/node@22.20.5, @types/react@19.3.0 (+14 more)

### Community 25 - "Data Source Factory"
Cohesion: 0.12
Nodes (6): Env Var Reading Idiom (os.environ.get().strip()), create_market_data_source(), _poll_interval_from_env(), backend/README.md - backend structure, TestFactory, MASSIVE_POLL_INTERVAL env var

### Community 26 - "Portfolio Service"
Cohesion: 0.20
Nodes (11): IN-06 Second-Resolution Timestamps Tie Snapshot Order, now_iso(), build_portfolio(), record_snapshot(), _add_position(), _set_cash(), test_fresh_database_is_all_cash(), test_held_ticker_without_cached_price_is_valued_at_avg_cost() (+3 more)

### Community 27 - "PriceUpdate Model"
Cohesion: 0.13
Nodes (3): PriceUpdate, TestPriceUpdate, SSE Wire Format

### Community 28 - "Error Handlers"
Cohesion: 0.13
Nodes (9): Pattern B-6 Error Envelope Skeleton, WR-02 405 Allow Header Dropped, error_response(), install_error_handlers(), handle_api_error(), handle_http_exception(), handle_validation_error(), _validation_message() (+1 more)

### Community 30 - "Massive Poll Loop"
Cohesion: 0.11
Nodes (8): InvalidTicker, normalize_ticker(), TICKER_PATTERN, add_to_watchlist / remove_from_watchlist, fill_price(), G3 Massive Removal Race, portfolio_lock, watchlist_entry()

### Community 31 - "Price Cells & Formatting"
Cohesion: 0.24
Nodes (14): ChartStripProps, PriceCellProps, ariaLabel(), dayColor(), hundredths(), ascii(), decimalFormat, formatPrice() (+6 more)

### Community 32 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 33 - "Server Walking Skeleton"
Cohesion: 0.16
Nodes (10): Plan 01-01: Server Walking-Skeleton Tracer, PLAT-02: DB_PATH and persistence across restarts, PLAT-03: Seed default profile and watchlist, PLAT-05: GET /api/health, PLAT-07: Static export at / with API routes first, Walking Skeleton (Phase 1), Summary 01-01: Server Walking-Skeleton Tracer, create_health_router() (+2 more)

### Community 34 - "Market Data Core Fixes"
Cohesion: 0.23
Nodes (11): PLAT-06: SSE stream mounted streaming watched tickers, Plan 01-03: Market Data Core Fixes, MKT-04: Tickers added before start are kept, MKT-05: Day-change baseline reference_price/day_change_percent, UI-02: Price flash on up/down ticks, Summary 01-03: Market Data Core Fixes, TDD RED/GREEN Gate, Plan 01-07: Stream Router Factory and Massive Parsing (+3 more)

### Community 35 - "Market Data Review"
Cohesion: 0.20
Nodes (15): MARKET_DATA_DESIGN.md describes unimplemented fixes, CLAUDE.md - root project instructions, MARKET_DATA_REVIEW.md - Market Data Code Review, Missing hatch wheel packages config (High), DEFAULT_CORR vs CROSS_GROUP_CORR Naming, _generate_events Return Type Annotation (Low), SimulatorDataSource.get_tickers Accesses Private State (Low), Massive Test Fragility from Lazy Import (Medium) (+7 more)

### Community 36 - "DB Init & Schema Tests"
Cohesion: 0.28
Nodes (5): init_db(), _count(), TestSchema, TestSeeding, _tickers()

### Community 37 - "MarketDataSource Interface"
Cohesion: 0.14
Nodes (3): MarketDataSource, MARKET_INTERFACE.md - Market Data Interface Design, Market Data Lifecycle (startup, watchlist, SSE, trade, shutdown)

### Community 40 - "Lifespan Startup Order"
Cohesion: 0.21
Nodes (7): PLAT-01: Lifespan startup with DB init and startup snapshot, Plan 01-06: Watchlist and Portfolio Reads, PORT-01: GET /api/portfolio, WATCH-01: GET /api/watchlist with live prices, Summary 01-06: Watchlist and Portfolio Reads, create_watchlist_router(), get_watchlist()

### Community 41 - "Error Envelope & DB Plan"
Cohesion: 0.26
Nodes (11): Phase 1 Plan 01-09: JSON Error Envelope, TestClient and DB/Config Tests, Phase 1 Summary 01-09: JSON Error Envelope, TestClient and DB/Config Tests, Settings.from_env(), init_db(), DEFAULT_TICKERS, /api/{path:path} JSON 404 catch-all route, httpx (dev extra) for in-process TestClient, Requirement PLAT-02 (+3 more)

### Community 42 - "Project Overview Decisions"
Cohesion: 0.14
Nodes (3): D-45: position lifecycle, PROJECT.md - FinAlly Project Overview, Out of Scope (auth, limit orders, token streaming, reset endpoint)

### Community 43 - "Portfolio Router & Connections"
Cohesion: 0.15
Nodes (5): create_portfolio_router(), get_portfolio(), connect(), conn(), conn()

### Community 44 - "GBM Simulator Core"
Cohesion: 0.20
Nodes (9): CORRELATION_GROUPS, SEED_PRICES, GBMSimulator, Correlation Constants (tech 0.6, finance 0.5, cross 0.3), MARKET_SIMULATOR.md - Market Simulator Design, Cholesky-Correlated Moves, Geometric Brownian Motion Price Model, Realistic Seed Prices (+1 more)

### Community 46 - "SSE Generator Tests"
Cohesion: 0.25
Nodes (5): _collect(), _data_chunks(), FakeRequest, TestGenerateEvents, _wait_for()

### Community 47 - "WatchlistPanel Tests"
Cohesion: 0.19
Nodes (9): entriesWithDay(), Harness(), jsonResponse(), makeEntries(), renderReady(), renderStateful(), StatefulHarness(), stubFetch() (+1 more)

### Community 48 - "App Factory & ApiError"
Cohesion: 0.17
Nodes (6): WR-06 Lifespan Leaks Market Source on Snapshot Failure, ApiError, create_app(), api_not_found(), boom(), test_create_app_tolerates_missing_static_dir()

### Community 49 - "Root Layout & Runtime Deps"
Cohesion: 0.17
Nodes (11): metadata, dependencies, @fontsource/jetbrains-mono@5.3.0, lightweight-charts@5.2.1, next@16.3.8, react@19.3.0, react-dom@19.3.0, @fontsource/jetbrains-mono (+3 more)

### Community 50 - "Phase 2 Trading Context"
Cohesion: 0.23
Nodes (8): Phase 2 CONTEXT - Manual Trading & Portfolio, Shared selection in AppShell, Phase 2 Discussion Log (audit trail), P&L Chart Options (alternatives considered), Positions Heatmap Options (alternatives considered), Trade Bar Options (alternatives considered), Watchlist Options (alternatives considered), backend/CLAUDE.md - backend developer guide

### Community 53 - "Massive API Reference"
Cohesion: 0.21
Nodes (11): Archived MASSIVE_API.md, Aggregates (Bars) Endpoint, Massive API HTTP Errors (401/403/429/5xx), Last Trade / Last Quote Endpoints, Unix Millisecond Timestamps, Massive Rate Limits (free 5 req/min), massive RESTClient, Single Ticker Snapshot (+3 more)

### Community 55 - "Archived Market Design"
Cohesion: 0.24
Nodes (9): Archived MARKET_DATA_DESIGN.md, Market Data Configuration Summary, Price Cache / Source Dependency Injection, Empty Watchlist at Startup, FastAPI Lifespan Integration, Open Position on Watchlist Removal Edge Case, Price Cache Miss During Trade, Watchlist Coordination with Data Source (+1 more)

### Community 56 - "v1 Requirements"
Cohesion: 0.20
Nodes (9): REQUIREMENTS.md - v1 Requirements, DEP-01..03: Dockerfile, .env.example, start/stop scripts, MKT-05: day_change_percent baseline per ticker, PORT-02/03: buy and sell whole shares, TEST-01..03: backend, frontend and Playwright E2E suites, Requirement-to-phase traceability table, UI-01..10: terminal frontend requirements, v2 Enhancements ENH-01..04 (deferred) (+1 more)

### Community 59 - "LLM Chat Roadmap"
Cohesion: 0.28
Nodes (7): OpenRouter gpt-oss-120b via LiteLLM (Cerebras), CHAT-01..07: AI chat with structured output and auto-execution, PLAT-01: FastAPI lifespan init DB, market source, startup snapshot, ROADMAP.md - three-phase roadmap, Phase 1: Live Market Terminal, Phase 2: Manual Trading & Portfolio, Phase 3: AI Trading Copilot

### Community 60 - "Tech Stack"
Cohesion: 0.25
Nodes (8): STACK.md - technology stack, FastAPI 0.128.7, Next.js + Tailwind (planned), numpy (Cholesky, correlated draws), pytest 9 + pytest-asyncio, ruff linter, uv package manager, Uvicorn 0.40.0

### Community 62 - "Vitest Setup"
Cohesion: 0.29
Nodes (3): @testing-library/jest-dom@7.0.1, ResizeObserverStub, @testing-library/jest-dom

### Community 64 - "Project State"
Cohesion: 0.33
Nodes (3): PORT-07: portfolio value history, STATE.md - project state (Phase 2 planning), Phase 1 review warnings WR-01..07, IN-03, IN-06

### Community 67 - "npm Scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

## Knowledge Gaps
- **61 isolated node(s):** `finally-backend`, `MSYS_NO_PATHCONV`, `MSYS_NO_PATHCONV`, `Out of Scope (auth, limit orders, token streaming, reset endpoint)`, `PORT-02/03: buy and sell whole shares` (+56 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 502 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PriceCache` connect `PriceCache Class` to `PLAN Spec & Market Design`, `Massive Snapshot Parsing`, `Docker & Start Scripts`, `Market Source Lifecycle Fixes`, `PriceCache Read/Write API`, `Backend API & DB Modules`, `Codebase Concerns & Bugs`, `Phase 1 Decisions`, `Runtime Settings Config`, `Market Data Demo`, `Architecture Analysis`, `Market Package Modules`, `Data Source Factory`, `Portfolio Service`, `PriceUpdate Model`, `Massive Poll Loop`, `Server Walking Skeleton`, `Market Data Core Fixes`, `Market Data Review`, `MarketDataSource Interface`, `Lifespan Startup Order`, `Portfolio Router & Connections`, `Day-Change Baseline Tests`, `SSE Generator Tests`, `App Factory & ApiError`, `Cache Direction Tests`, `Archived Market Design`, `Testing Patterns`?**
  _High betweenness centrality (0.334) - this node is a cross-community bridge._
- **Are the 14 inferred relationships involving `PriceCache` (e.g. with `create_market_data_source()` and `build_dashboard()`) actually correct?**
  _`PriceCache` has 14 INFERRED edges - model-reasoned connections that need verification._
- **What connects `finally-backend`, `MSYS_NO_PATHCONV`, `MSYS_NO_PATHCONV` to the rest of the system?**
  _61 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PLAN Spec & Market Design` be split into smaller, more focused modules?**
  _Cohesion score 0.061018437225636525 - nodes in this community are weakly interconnected._
- **Why does `create_stream_router()` connect `Architecture Analysis` to `PLAN Spec & Market Design`, `Server Walking Skeleton`, `Market Data Core Fixes`, `Market Data Review`, `Frontend Toolchain Setup`, `Backend API & DB Modules`, `Codebase Concerns & Bugs`, `Phase 1 Decisions`, `Runtime Settings Config`, `App Factory & ApiError`, `PriceCache Class`, `Archived Market Design`, `Data Source Factory`, `Coding Conventions`?**
  _High betweenness centrality (0.176) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `planning/PLAN.md (project spec)` (e.g. with `MARKET_DATA_SUMMARY.md` and `Review.md - Review of Changes Since Last Commit`) actually correct?**
  _`planning/PLAN.md (project spec)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Massive Snapshot Parsing` be split into smaller, more focused modules?**
  _Cohesion score 0.06558441558441558 - nodes in this community are weakly interconnected._