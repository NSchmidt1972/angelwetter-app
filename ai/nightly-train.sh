#!/usr/bin/env bash
set -Eeuo pipefail

# Configurable via env, defaults match your server setup.
APP_DIR="${APP_DIR:-/srv/docker/ai}"
LOCK_FILE="${LOCK_FILE:-/tmp/ai-nightly.lock}"
LOG_DIR="${LOG_DIR:-$APP_DIR/logs}"
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-}"

ts() { date -Is; }
log() { echo "[$(ts)] $*"; }

on_error() {
  local line="${1:-unknown}"
  local rc="$?"
  log "ERROR rc=${rc} line=${line}"
  exit "${rc}"
}
trap 'on_error $LINENO' ERR

mkdir -p "$LOG_DIR"

# Self-locking: safe for cron and manual execution.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "SKIP another nightly training is already running"
  exit 0
fi

cd "$APP_DIR"
log "START nightly training"

# Validate expected compose services exist.
if ! docker compose config --services | grep -qx "ai-trainer"; then
  log "ERROR docker compose service 'ai-trainer' not found"
  exit 1
fi
if ! docker compose config --services | grep -qx "ai-server"; then
  log "ERROR docker compose service 'ai-server' not found"
  exit 1
fi

# Run training job and remove transient container.
docker compose run --rm ai-trainer
log "TRAINING finished"

# Ensure ai-server is running (for immediate model reload/health).
if ! docker compose ps --status running ai-server | grep -q "ai-server"; then
  log "ai-server not running, starting it"
  docker compose up -d ai-server
fi

# Health from inside the container (works even without host port mapping).
INTERNAL_HEALTH="$(
  docker compose exec -T ai-server python -c \
  "import json,urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/health').read().decode())"
)"
log "INTERNAL_HEALTH ${INTERNAL_HEALTH}"

# Optional public health check via reverse proxy/domain.
if [[ -n "$PUBLIC_HEALTH_URL" ]]; then
  if PUBLIC_HEALTH="$(curl -fsS "${PUBLIC_HEALTH_URL}?ts=$(date +%s)")"; then
    log "PUBLIC_HEALTH ${PUBLIC_HEALTH}"
  else
    log "WARN public health check failed for ${PUBLIC_HEALTH_URL}"
  fi
fi

log "DONE nightly training"
