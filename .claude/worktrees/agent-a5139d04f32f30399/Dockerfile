# syntax=docker/dockerfile:1

# Stage 1: build the Next.js static export
FROM node:20-slim AS frontend
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
# npm ci (not npm install) so lockfile drift fails the build
RUN npm ci
COPY frontend/ ./
# Writes the static export to /build/out
RUN npm run build

# Stage 2: Python runtime serving the API, the SSE stream and the static export
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11.7 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    DB_PATH=/app/db/finally.db \
    STATIC_DIR=/app/static
WORKDIR /app
# backend/README.md is required because pyproject.toml declares readme = "README.md"
COPY backend/pyproject.toml backend/uv.lock backend/README.md ./
# No dev extra: pytest, httpx and ruff stay out of the runtime image
RUN uv sync --frozen --no-install-project
COPY backend/app ./app
COPY --from=frontend /build/out ./static
RUN mkdir -p /app/db
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2).status == 200 else 1)"
# Single process on purpose: one shared in-memory price cache serves every SSE client.
# --timeout-graceful-shutdown 2 lets docker stop finish with an open SSE connection.
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--timeout-graceful-shutdown", "2"]
