
#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

"${rust_log_env[@]}" cargo watch \
  --workdir "$script_dir" \
  -w "$script_dir/actix_server" \
  -x 'run --no-default-features --features "proxy_default_service vite_hmr_proxy"' &
cargo_pid=$!

(
  cd "$script_dir/fastify_vite"
  npm run dev
) &
vite_pid=$!

cleanup() {
  trap - EXIT INT TERM

  # Ask both processes to stop.
  kill "$cargo_pid" "$vite_pid" 2>/dev/null || true

  # Reap both children.
  wait "$cargo_pid" 2>/dev/null || true
  wait "$vite_pid" 2>/dev/null || true
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Exit when either service exits, successfully or unsuccessfully.
set +e
wait -n "$cargo_pid" "$vite_pid"
status=$?
set -e

exit "$status"
