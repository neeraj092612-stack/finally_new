"""The PLAN section 8 error envelope and the exception handlers that produce it."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

__all__ = ["ApiError", "error_response", "install_error_handlers"]


class ApiError(Exception):
    """A failure with an API error code, an HTTP status and a user-facing message."""

    def __init__(self, code: str, status_code: int, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.message = message


def error_response(code: str, status_code: int, message: str) -> JSONResponse:
    """Render the single error body shape: {"error": {"code", "message"}}."""
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}},
    )


def _validation_message(exc: RequestValidationError) -> str:
    """Describe the first validation problem using only its location and pydantic message."""
    errors = exc.errors()
    if not errors:
        return "The request is invalid."
    first = errors[0]
    # Drop the leading "body"/"query"/"path" marker; keep the field path the user can act on.
    location = ".".join(str(part) for part in first.get("loc", ())[1:])
    detail = str(first.get("msg", "invalid value"))
    return f"{location}: {detail}" if location else detail


def install_error_handlers(app: FastAPI) -> None:
    """Route ApiError, validation failures and framework HTTP errors through the envelope."""

    @app.exception_handler(ApiError)
    async def handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
        return error_response(exc.code, exc.status_code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # Fixed prefix plus the field path and pydantic's own message; never the raw input.
        return error_response("invalid_request", 422, _validation_message(exc))

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        if exc.status_code == 404:
            code = "not_found"
            fallback = "The requested resource was not found."
        else:
            code = "http_error"
            fallback = "The request could not be completed."
        message = exc.detail if isinstance(exc.detail, str) and exc.detail else fallback
        return error_response(code, exc.status_code, message)
