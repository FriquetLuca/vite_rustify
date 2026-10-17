#!/usr/bin/env bash
# start.sh — Run the production Rust backend and frontend server.

set -Eeuo pipefail
IFS=$'\n\t'

# Resolve the project directory independently of the caller's CWD.
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=./bashlib/common.sh
source "$PROJECT_DIR/bashlib/common.sh"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Start the Rust backend and frontend production server.

Options:
  --log             Enable Rust logging (RUST_LOG=info)
  --log=LEVEL       Set the Rust log level (e.g. debug, trace, warn)
  -h, --help        Display this help message

Examples:
  ./start.sh
  ./start.sh --log
  ./start.sh --log=debug
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

BACKEND_BIN="$PROJECT_DIR/target/release/actix_server"

if [[ ! -d "$PROJECT_DIR/fastify_vite" ]]; then
    die "Frontend directory not found: $PROJECT_DIR/fastify_vite"
fi

[[ -x "$BACKEND_BIN" ]] ||
    die "Production binary not found. Run ./build.sh first."

START_TIME_MS=$(now_ms)
backend_pid=''
frontend_pid=''

cleanup() {
    local status=$?
    local end_time_ms elapsed_ms

    # Prevent recursive cleanup and preserve the original exit status.
    trap - EXIT INT TERM
    set +e

    echo ''
    log_info "Stopping production services..."

    kill_pid "$backend_pid"
    kill_pid "$frontend_pid"

    end_time_ms=$(now_ms)
    elapsed_ms=$((end_time_ms - START_TIME_MS))

    if ((status == 0)); then
        log_success "Production services stopped after $(format_duration "$elapsed_ms")."
    else
        log_warn "Production services exited with status $status after $(format_duration "$elapsed_ms")."
    fi

    exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

log_info "Starting production services..."

printf '%b\n' "${CYAN}▸ Starting Rust backend...${RESET}"

(
    cd "$PROJECT_DIR"
    if [[ -n "$RUST_LOG_VALUE" ]]; then
        exec env "RUST_LOG=$RUST_LOG_VALUE" \
            "$BACKEND_BIN"
    else
        exec "$BACKEND_BIN"
    fi
) &
backend_pid=$!

printf '%b\n' "${CYAN}▸ Starting frontend server...${RESET}"

(
    cd "$PROJECT_DIR/fastify_vite"
    exec npm run --silent start
) &
frontend_pid=$!

log_success "Production services started."
log_info "Press Ctrl+C to stop both services."

# Exit when either service exits, successfully or unsuccessfully.
set +e
wait -n "$backend_pid" "$frontend_pid"
status=$?
set -e

exit "$status"
