#!/usr/bin/env bash

set -euo pipefail

IFS=$'\n\t'

backend_pid=""

START_TIME_MS=$(( ${EPOCHREALTIME/./} / 1000 ))

format_duration() {
  local milliseconds=$1

  local hours=$((milliseconds / 3600000))
  local minutes=$(((milliseconds % 3600000) / 60000))
  local seconds=$(((milliseconds % 60000) / 1000))
  local ms=$((milliseconds % 1000))

  if (( hours > 0 )); then
    printf '%dh %02dm %02d.%03ds' \
      "$hours" \
      "$minutes" \
      "$seconds" \
      "$ms"
  elif (( minutes > 0 )); then
    printf '%dm %02d.%03ds' \
      "$minutes" \
      "$seconds" \
      "$ms"
  elif (( seconds > 0 )); then
    printf '%d.%03ds' \
      "$seconds" \
      "$ms"
  else
    printf '%dms' "$ms"
  fi
}

cleanup() {
  if [[ -n "$backend_pid" ]]; then
    kill "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true

    backend_pid=""
  fi
  END_TIME_MS=$(( ${EPOCHREALTIME/./} / 1000 ))
  ELAPSED_MS=$((END_TIME_MS - START_TIME_MS))
  printf '%b\n' \
    "${GREEN}✓ build completed successfully in $(format_duration "$ELAPSED_MS")${RESET}"
}

RESET='\033[0m'
BOLD='\033[1m'
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
CYAN='\033[36m'
GRAY='\033[90m'

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

BACKEND_PROTOCOL="${PROTOCOL:-https}"
BACKEND_HOST="${HOST:-127.0.0.1}"
BACKEND_PORT="${PORT:-8443}"
BACKEND_URL="${BACKEND_PROTOCOL}://${BACKEND_HOST}:${BACKEND_PORT}"

trap cleanup EXIT INT TERM

echo -e "${BLUE}Actix Server v0.13${RESET} ${GREEN}building the server for production...${RESET}"
cargo build \
  --no-default-features \
  --features proxy_default_service \
  --release

cargo run \
  --no-default-features \
  --features proxy_default_service \
  --release &

backend_pid=$!

for _ in {1..60}; do
  if curl --silent --fail \
    "${BACKEND_URL}/health" \
    >/dev/null 2>&1
  then
    break
  fi
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    echo "Server exited before becoming ready."
    wait "$backend_pid"
    exit 1
  fi
  
  sleep 0.5
done

if ! curl --silent --fail \
  "${BACKEND_URL}/health" \
  >/dev/null 2>&1
then
  echo "Server did not become ready."
  exit 1
fi

(
  cd fastify_vite_ssr
  npm run build
)
