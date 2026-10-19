"""Domain services shared by the REST routes and the LLM chat flow.

Modules:
    tickers    - ticker normalization/validation
    portfolio  - portfolio valuation and snapshots
    watchlist  - watchlist view, add/remove (keeps the market source in sync)
    trading    - trade execution (serialized by a module-level lock)
"""
