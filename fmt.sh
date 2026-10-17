#!/usr/bin/env bash
# fmt.sh — Format the Rust backend and frontend.

set -Eeuo pipefail
IFS=$'\n\t'

# Resolve the project directory independently of the caller's CWD.
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=./bashlib/common.sh
source "$PROJECT_DIR/bashlib/common.sh"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Format the Rust backend and Vite frontend.

Options:
  -h, --help    Display this help message

Examples:
  ./fmt.sh
EOF
}

while (($# > 0)); do
    case "$1" in
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

if [[ ! -d "$PROJECT_DIR/fastify_vite" ]]; then
    die "Frontend directory not found: $PROJECT_DIR/fastify_vite"
fi

START_TIME_MS=$(now_ms)

log_info "Formatting Rust backend and frontend..."

printf '%b\n' "${CYAN}▸ Formatting Rust backend...${RESET}"
(
    cd "$PROJECT_DIR"
    cargo fmt
)
log_success "Rust formatting complete."

printf '%b\n' "${CYAN}▸ Formatting Vite frontend...${RESET}"
(
    cd "$PROJECT_DIR/fastify_vite"
    npm run --silent format
)
log_success "Frontend formatting complete."

END_TIME_MS=$(now_ms)
ELAPSED_MS=$((END_TIME_MS - START_TIME_MS))

log_success "Formatting completed successfully in $(format_duration "$ELAPSED_MS")."
