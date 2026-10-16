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
    printf '%dh %02dm %02d.%03ds' "$hours" "$minutes" "$seconds" "$ms"
  elif (( minutes > 0 )); then
    printf '%dm %02d.%03ds' "$minutes" "$seconds" "$ms"
  elif (( seconds > 0 )); then
    printf '%d.%03ds' "$seconds" "$ms"
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


check_port() {
  local port="$1"
  local name="$2"
  local output
  local pids
  local pid
  local answer

  output=$(sudo lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null) || true

  if [[ -z "$output" ]]; then
    return 0
  fi

  printf '%b\n' "${YELLOW}⚠ ${name} port ${port} is already in use.${RESET}" >&2
  sudo lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2 || true

  read -r -p "Do you want to terminate the process(es) using port ${port}? [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]] || return 1

  pids=$(printf '%s\n' "$output" | sort -u)

  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue

    # Avoid terminating this script or its parent.
    if [[ "$pid" == "$$" || "$pid" == "$PPID" ]]; then
      printf '%b\n' "${RED}Refusing to terminate this script or its parent.${RESET}" >&2
      return 1
    fi

    printf 'Sending SIGTERM to PID %s...\n' "$pid"
    sudo kill -TERM "$pid" 2>/dev/null || true
  done <<< "$pids"

  sleep 1

  output=$(sudo lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null) || true

  if [[ -n "$output" ]]; then
    printf '%b\n' "${RED}Port ${port} is still occupied.${RESET}" >&2
    sudo lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2 || true
    printf '%s\n' "Not force-killing the remaining processes automatically." >&2
    return 1
  fi

  printf '%b\n' "${GREEN}✓ Port ${port} is now free.${RESET}"
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
BACKEND_HTTP_PORT="${HTTP_PORT:-80}"
BACKEND_URL="${BACKEND_PROTOCOL}://${BACKEND_HOST}:${BACKEND_PORT}"

trap cleanup EXIT INT TERM

echo -e "${BLUE}Actix Server v0.13${RESET} ${GREEN}building the server for production...${RESET}"

cargo build \
  --no-default-features \
  --features proxy_default_service \
  --release

check_port "$BACKEND_PORT" "HTTPS backend" || exit 1
check_port "$BACKEND_HTTP_PORT" "HTTP backend" || exit 1

if IFS= read -r -d '' _ < <(
  find fastify_vite/src/pages \
    -type f \
    \( -name '*.ssg.tsx' -o -name '*.ssg.jsx' \
       -o -name '*.ssg.ts' -o -name '*.ssg.js' \) \
    -print0 -quit
); then
  cargo run \
    --no-default-features \
    --features proxy_default_service \
    --release 2>/dev/null &

  backend_pid=$!

  for _ in {1..60}; do
    if curl --silent --fail \
      "${BACKEND_URL}/health" \
      >/dev/null 2>&1
    then
      break
    fi

    if ! kill -0 "$backend_pid" 2>/dev/null; then
      echo "Server exited before becoming ready." >&2
      wait "$backend_pid"
      exit 1
    fi

    sleep 0.5
  done

  if ! curl --silent --fail \
    "${BACKEND_URL}/health" \
    >/dev/null 2>&1
  then
    echo "Server did not become ready." >&2
    exit 1
  fi
fi

(
  cd fastify_vite
  npm run build
)
