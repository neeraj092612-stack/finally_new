"""Application error type shared by the REST routes and the LLM chat flow."""

from __future__ import annotations


class AppError(Exception):
    """An error with a stable machine code, a user-facing message and an HTTP status.

    The FastAPI exception handler in ``app.main`` renders it as
    ``{"error": {"code": ..., "message": ...}}``.
    """

    def __init__(self, code: str, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code

    def to_dict(self) -> dict:
        return {"code": self.code, "message": self.message}


def format_money(value: float) -> str:
    """Format a dollar amount for user-facing messages: ``$1,912.40``."""
    return f"${value:,.2f}"
