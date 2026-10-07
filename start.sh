#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

rust_log_env=""

for arg in "$@"; do
  case "$arg" in
    --log)
      rust_log_env="RUST_LOG=info"
      ;;
    --log=*)
      rust_log_env="RUST_LOG=${arg#--log=}"
      ;;
  esac
done

(trap 'kill 0' SIGINT; \
bash -c "$rust_log_env cargo run --no-default-features --features proxy_default_service" & \
bash -c 'cd fastify_vite_ssr; npm run start')
