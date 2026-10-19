#!/usr/bin/env bash
# Start FinAlly in Docker (macOS/Linux). Usage: scripts/start_mac.sh [--build]
set -euo pipefail

IMAGE=finally
CONTAINER=finally
VOLUME=finally-data
PORT=8000

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BUILD=0
for arg in "$@"; do
  case "$arg" in
    --build) BUILD=1 ;;
    *) echo "Unknown option: $arg (only --build is supported)" >&2; exit 1 ;;
  esac
done

if [ ! -f .env ]; then
  cp .env.example .env
  echo "WARNING: .env not found; created it from .env.example."
  echo "         Set OPENROUTER_API_KEY in .env for AI chat (chat returns an error until then)."
fi

if [ "$BUILD" -eq 1 ] || ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "Building Docker image '$IMAGE'..."
  docker build -t "$IMAGE" .
fi

# Idempotent: replace any existing container (running or stopped).
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

docker run -d \
  --name "$CONTAINER" \
  -v "$VOLUME":/app/db \
  -p "$PORT":8000 \
  --env-file .env \
  "$IMAGE" >/dev/null

echo "FinAlly is running at http://localhost:$PORT"
echo "Stop it with: scripts/stop_mac.sh"
