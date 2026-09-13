#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

rust_log_env=""
for arg in "$@"; do
  if [[ "$arg" == "--log" ]]; then
    rust_log_env="RUST_LOG=debug"
  fi
done

(trap 'kill 0' SIGINT; \
bash -c "$rust_log_env cargo watch --workdir '$script_dir' -w '$script_dir/actix_server' -x 'run --features \"proxy_default_service vite_hmr_proxy\"'" & \
bash -c "cd '$script_dir/vite_csr' && npm run dev")

wait