"""LiteLLM -> OpenRouter (Cerebras provider) client with structured outputs."""

from __future__ import annotations

import asyncio
import logging
import os

from litellm import completion
from pydantic import ValidationError

from app.errors import AppError

from .schema import ChatResponse

logger = logging.getLogger(__name__)

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
TIMEOUT_SECONDS = 30.0


def _llm_error(message: str) -> AppError:
    return AppError("llm_error", message, 502)


def _complete(messages: list[dict]) -> str:
    response = completion(
        model=MODEL,
        messages=messages,
        response_format=ChatResponse,
        reasoning_effort="low",
        extra_body=EXTRA_BODY,
        timeout=TIMEOUT_SECONDS,
    )
    return response.choices[0].message.content


async def call_llm(messages: list[dict]) -> ChatResponse:
    """Call the model and parse its reply. Every failure becomes ``AppError("llm_error")``."""
    if not os.environ.get("OPENROUTER_API_KEY", "").strip():
        raise _llm_error("The AI assistant is not configured (OPENROUTER_API_KEY is missing).")
    try:
        content = await asyncio.wait_for(
            asyncio.to_thread(_complete, messages), timeout=TIMEOUT_SECONDS + 5
        )
    except TimeoutError:
        logger.warning("LLM call timed out")
        raise _llm_error("The AI assistant took too long to respond. Please try again.") from None
    except Exception:
        logger.exception("LLM call failed")
        raise _llm_error("The AI assistant is unavailable right now. Please try again.") from None

    if not content:
        raise _llm_error("The AI assistant returned an empty response. Please try again.")
    try:
        return ChatResponse.model_validate_json(content)
    except ValidationError:
        logger.warning("LLM output did not match the schema: %.500s", content)
        raise _llm_error("The AI assistant returned an invalid response. Please try again.") from None
