"""Health check endpoint."""

from __future__ import annotations

from fastapi import APIRouter


def create_health_router() -> APIRouter:
    """Create the router serving GET /api/health."""
    router = APIRouter(prefix="/api", tags=["system"])

    @router.get("/health")
    def health() -> dict[str, str]:
        """Liveness probe for Docker and deployment checks."""
        return {"status": "ok"}

    return router
