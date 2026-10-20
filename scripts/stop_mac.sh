#!/usr/bin/env bash
# Stop FinAlly: removes the container and keeps the data volume.
set -euo pipefail

export MSYS_NO_PATHCONV=1

NAME="${FINALLY_CONTAINER:-finally-app}"
VOLUME="${FINALLY_VOLUME:-finally-data}"

# docker rm -f exits 0 for a missing container, so look first to report accurately.
if [ -n "$(docker ps -aq --filter "name=^${NAME}\$" 2>/dev/null || true)" ]; then
  docker rm -f "$NAME" >/dev/null
  echo "Stopped $NAME (data volume $VOLUME kept)."
else
  echo "$NAME is not running (data volume $VOLUME kept)."
fi
