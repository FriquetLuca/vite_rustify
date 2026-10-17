
#!/usr/bin/env bash
# build.sh — Build the production backend and frontend.

set -Eeuo pipefail
IFS=$'\n\t'

# Resolve the project directory independently of the caller's CWD.
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=./bashlib/common.sh
source "$PROJECT_DIR/bashlib/common.sh"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Build the production backend and frontend.

Options:
  -c, -check, --check   Check backend ports and offer to free occupied ports
  -y, --yes             Skip interactive confirmations.
  -h, --help            Display this help message

Examples:
  ./build.sh
  ./build.sh --check

The optional .env file in the project directory is loaded before building.
EOF
}

BACKCHECKED=false
AUTO_YES=false

while (($# > 0)); do
    case "$1" in
        -y|--yes)
          AUTO_YES=true
          ;;
        -c|-check|--check)
            BACKCHECKED=true
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

require_command cargo npm curl find grep date

if [[ "$BACKCHECKED" == true ]]; then
    require_command sudo lsof sort
    sudo -v
fi

# Load project environment variables, if present.
if [[ -f "$PROJECT_DIR/.env" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$PROJECT_DIR/.env"
    set +a
fi

BACKEND_PROTOCOL="${PROTOCOL:-https}"
BACKEND_HOST="${HOST:-127.0.0.1}"
BACKEND_PORT="${PORT:-8443}"
BACKEND_HTTP_PORT="${HTTP_PORT:-80}"
FRONTEND_PORT="${VITE_PORT:-5173}"
BACKEND_URL="${BACKEND_PROTOCOL}://${BACKEND_HOST}:${BACKEND_PORT}"

START_TIME_MS=$(now_ms)
backend_pid=''

cleanup() {
    local status=$?
    local end_time_ms elapsed_ms

    # Prevent cleanup failures from replacing the build's exit status.
    trap - EXIT
    set +e

    kill_pid "$backend_pid"

    end_time_ms=$(now_ms)
    elapsed_ms=$((end_time_ms - START_TIME_MS))

    if ((status == 0)); then
        log_success "Build completed successfully in $(format_duration "$elapsed_ms")."
    else
        log_error "Build failed or was interrupted (exit code $status) after $(format_duration "$elapsed_ms")."
    fi

    exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

log_info "Actix Server v0.13 — production build"

printf '%b\n' "${CYAN}▸ Building Rust backend...${RESET}"

(
    cd "$PROJECT_DIR"
    cargo build \
        --no-default-features \
        --features proxy_default_service \
        --release
)

if [[ "$BACKCHECKED" == true ]]; then
    check_port "$BACKEND_PORT" "HTTPS backend" "$AUTO_YES" ||
        die "HTTPS backend port check failed."

    check_port "$BACKEND_HTTP_PORT" "HTTP backend" "$AUTO_YES" ||
        die "HTTP backend port check failed."

    check_port "$FRONTEND_PORT" "HTTP frontend" "$AUTO_YES" ||
        die "HTTP frontend port check failed."
fi

# Only start the temporary backend when SSG pages require it.
SSG_DIR="$PROJECT_DIR/fastify_vite/src/pages"

if [[ ! -d "$SSG_DIR" ]]; then
    die "SSG pages directory not found: $SSG_DIR"
fi

SSG_FILES=()

while IFS= read -r -d '' file; do
    SSG_FILES+=("$file")
done < <(
    find "$SSG_DIR" -type f \
        \( -name '*.ssg.tsx' -o -name '*.ssg.jsx' \
           -o -name '*.ssg.ts' -o -name '*.ssg.js' \) \
        -print0
)

if ((${#SSG_FILES[@]} > 0)); then

    printf '%b\n' "${CYAN}▸ Starting temporary backend for SSG...${RESET}"

    (
        cd "$PROJECT_DIR"
        exec cargo run \
            --no-default-features \
            --features proxy_default_service \
            --release
    ) 2>/dev/null &

    backend_pid=$!

    ready=false

    for _ in {1..60}; do
        if curl --silent --fail \
            "$BACKEND_URL/health" >/dev/null 2>&1; then
            ready=true
            break
        fi

        if ! kill -0 "$backend_pid" 2>/dev/null; then
            wait "$backend_pid" || true
            backend_pid=''
            die "Backend exited before becoming ready."
        fi

        sleep 0.5
    done

    if [[ "$ready" != true ]]; then
        die "Backend did not become ready at $BACKEND_URL/health."
    fi

    log_success "Temporary backend is ready."
else
    log_info "No SSG pages found; skipping temporary backend."
fi

printf '%b\n' "${CYAN}▸ Building frontend...${RESET}"

(
    cd "$PROJECT_DIR/fastify_vite"
    npm run --silent build
)
