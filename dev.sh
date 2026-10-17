#!/usr/bin/env bash
# dev.sh — Run the Rust backend and Vite development server.

set -Eeuo pipefail
IFS=$'\n\t'

# Resolve the project directory independently of the caller's CWD.
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=./bashlib/common.sh
source "$PROJECT_DIR/bashlib/common.sh"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Run the Rust backend with Cargo Watch and the Vite development server.

Options:
  --log             Enable Rust logging (RUST_LOG=info)
  --log=LEVEL       Set the Rust log level (e.g. debug, trace, warn)
  -h, --help        Display this help message

Examples:
  ./dev.sh
  ./dev.sh --log
  ./dev.sh --log=debug
EOF
}

RUST_LOG_VALUE=''

while (($# > 0)); do
    case "$1" in
        --log)
            RUST_LOG_VALUE=info
            ;;
        --log=*)
            RUST_LOG_VALUE="${1#--log=}"

            if [[ -z "$RUST_LOG_VALUE" ]]; then
                usage_error "The --log option requires a non-empty level."
            fi
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            usage_error "Unknown argument: $1"
            ;;
    esac
    shift
done

require_command cargo npm

if ! cargo watch --version >/dev/null 2>&1; then
    die "Cargo Watch is not installed. Install it with: cargo install cargo-watch"
fi

START_TIME_MS=$(now_ms)
cargo_pid=''
vite_pid=''

cleanup() {
    local status=$?
    local end_time_ms elapsed_ms

    # Prevent recursive cleanup and preserve the original exit status.
    trap - EXIT INT TERM
    set +e

    echo ''
    log_info "Stopping development services..."

    kill_pid "$cargo_pid"
    kill_pid "$vite_pid"

    end_time_ms=$(now_ms)
    elapsed_ms=$((end_time_ms - START_TIME_MS))

    if ((status == 0)); then
        log_success "Development services stopped after $(format_duration "$elapsed_ms")."
    else
        log_info "Development services exited with status $status after $(format_duration "$elapsed_ms")."
    fi

    exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

log_info "Starting development services..."

# Start the Rust backend with Cargo Watch.
(
    cd "$PROJECT_DIR"

    if [[ -n "$RUST_LOG_VALUE" ]]; then
        exec env "RUST_LOG=$RUST_LOG_VALUE" cargo watch \
            --workdir "$PROJECT_DIR" \
            -w "$PROJECT_DIR/actix_server" \
            -x 'run --no-default-features --features "proxy_default_service vite_hmr_proxy"'
    else
        exec cargo watch \
            --workdir "$PROJECT_DIR" \
            -w "$PROJECT_DIR/actix_server" \
            -x 'run --no-default-features --features "proxy_default_service vite_hmr_proxy"'
    fi
) &
cargo_pid=$!

# Start the Vite development server.
(
    cd "$PROJECT_DIR/fastify_vite"
    exec npm run --silent dev
) &
vite_pid=$!

log_success "Rust backend and Vite development server started."
log_info "Press Ctrl+C to stop both services."

# Exit when either service exits, successfully or unsuccessfully.
set +e
wait -n "$cargo_pid" "$vite_pid"
status=$?
set -e

exit "$status"
