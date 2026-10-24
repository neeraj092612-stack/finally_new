#!/usr/bin/env bash
# Start FinAlly in Docker (macOS/Linux, also Git Bash on Windows).
# --build is the only flag. FINALLY_CONTAINER, FINALLY_VOLUME and FINALLY_PORT
# override the container name, data volume and host port.
set -euo pipefail

# Git Bash would rewrite /app/db into a Windows path; harmless elsewhere.
export MSYS_NO_PATHCONV=1

cd "$(dirname "$0")/.."

IMAGE=finally
NAME="${FINALLY_CONTAINER:-finally-app}"
VOLUME="${FINALLY_VOLUME:-finally-data}"
PORT="${FINALLY_PORT:-8000}"

BUILD=0
for arg in "$@"; do
  case "$arg" in
    --build) BUILD=1 ;;
    *)
      echo "Usage: scripts/start_mac.sh [--build]" >&2
      exit 2
      ;;
  esac
done

command -v docker >/dev/null 2>&1 || { echo "Docker CLI not found on PATH. Install Docker and try again." >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker daemon is not running. Start Docker and try again." >&2; exit 1; }

if [ "$BUILD" = 1 ] || [ -z "$(docker images -q "$IMAGE")" ]; then
  docker build -t "$IMAGE" .
fi

# Build first, then replace: a failed build must not take down a running app.
docker rm -f "$NAME" >/dev/null 2>&1 || true

ENV_ARGS=()
if [ -f .env ]; then
  ENV_ARGS=(--env-file .env)
else
  echo "WARNING: .env not found - starting without it (the simulator works; AI chat will return llm_error until OPENROUTER_API_KEY is set). Copy .env.example to .env to configure." >&2
fi

# Bound to loopback on purpose: the app has no authentication.
# The ${arr[@]+...} form keeps an empty array safe under set -u on bash 3.2.
docker run -d --name "$NAME" \
  -v "$VOLUME":/app/db \
  -p "127.0.0.1:$PORT:8000" \
  ${ENV_ARGS[@]+"${ENV_ARGS[@]}"} \
  "$IMAGE" >/dev/null

STATUS=""
for _ in $(seq 1 60); do
  STATUS="$(docker inspect -f '{{.State.Health.Status}}' "$NAME" 2>/dev/null || true)"
  [ "$STATUS" = "healthy" ] && break
  sleep 1
done

if [ "$STATUS" = "healthy" ]; then
  echo "FinAlly is running at http://localhost:$PORT"
else
  echo "FinAlly is starting at http://localhost:$PORT (check: docker logs $NAME)"
fi
