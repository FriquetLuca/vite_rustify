#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

rust_log_env=()

for arg in "$@"; do
  case "$arg" in
    --log)
      rust_log_env=(env RUST_LOG=info)
      ;;
    --log=*)
      rust_log_env=(env "RUST_LOG=${arg#--log=}")
      ;;
  esac
done

cargo run --no-default-features --features proxy_default_service &
cargo_pid=$!

(
  cd fastify_vite
  npm run start
) &
fastify_pid=$!

cleanup() {
  trap - INT TERM EXIT

  kill "$cargo_pid" "$fastify_pid" 2>/dev/null || true
  wait "$cargo_pid" "$fastify_pid" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

wait -n "$cargo_pid" "$fastify_pid"
status=$?

exit "$status"
