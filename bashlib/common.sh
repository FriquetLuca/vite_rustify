
#!/usr/bin/env bash
# bashlib/common.sh — Shared functions for project scripts.
#
# This file defines functions only. It does not execute project tasks.

# Colors are enabled only when writing to a terminal.
if [[ -t 1 ]]; then
    RESET=$'\033[0m'
    BOLD=$'\033[1m'
    RED=$'\033[31m'
    GREEN=$'\033[32m'
    YELLOW=$'\033[33m'
    BLUE=$'\033[34m'
    CYAN=$'\033[36m'
    GRAY=$'\033[90m'
else
    RESET=''
    BOLD=''
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    CYAN=''
    GRAY=''
fi

log_info() {
    printf '%b\n' "${BLUE}INFO${RESET} $*"
}

log_success() {
    printf '%b\n' "${GREEN}✓ $*${RESET}"
}

log_warn() {
    printf '%b\n' "${YELLOW}⚠ $*${RESET}" >&2
}

log_error() {
    printf '%b\n' "${RED}ERROR${RESET} $*" >&2
}

die() {
    log_error "$*"
    exit 1
}

usage_error() {
    log_error "$*"
    exit 2
}

require_command() {
    local command_name

    for command_name in "$@"; do
        command -v "$command_name" >/dev/null 2>&1 ||
            die "Required command not found: $command_name"
    done
}

confirm() {
    local prompt="${1:-Continue?}"
    local answer

    read -r -p "$prompt [y/N] " answer || return 1

    [[ "$answer" =~ ^([yY]|[yY][eE][sS])$ ]]
}

# GNU date is expected on the Linux systems this project targets.
now_ms() {
    date +%s%3N
}

format_duration() {
    local milliseconds=$1
    local hours minutes seconds ms

    hours=$((milliseconds / 3600000))
    minutes=$(((milliseconds % 3600000) / 60000))
    seconds=$(((milliseconds % 60000) / 1000))
    ms=$((milliseconds % 1000))

    if ((hours > 0)); then
        printf '%dh %02dm %02d.%03ds' \
            "$hours" "$minutes" "$seconds" "$ms"
    elif ((minutes > 0)); then
        printf '%dm %02d.%03ds' "$minutes" "$seconds" "$ms"
    elif ((seconds > 0)); then
        printf '%d.%03ds' "$seconds" "$ms"
    else
        printf '%dms' "$ms"
    fi
}

kill_pid() {
    local curr_pid=$1

    if [[ -n "$curr_pid" ]]; then
        if kill -0 "$curr_pid" 2>/dev/null; then
            kill -TERM "$curr_pid" 2>/dev/null
        fi
        wait "$curr_pid" 2>/dev/null
    fi
}

# Return success if a TCP listening port is free.
# If occupied, ask before sending SIGTERM. Never force-kill automatically.
check_port() {
    local port=$1
    local name=$2
    local autokill=${3:-false}
    local output pids pid

    output=$(sudo lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null) || true

    if [[ -z "$output" ]]; then
        return 0
    fi

    log_warn "$name port $port is already in use."
    sudo lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2 || true

    if [[ "$autokill" != true ]] && ! confirm "Terminate the process(es) using port $port?"; then
        log_info "Leaving the existing process(es) untouched."
        return 1
    fi

    pids=$(printf '%s\n' "$output" | sort -nu)

    while IFS= read -r pid; do
        [[ -n "$pid" ]] || continue

        if [[ "$pid" == "$$" || "$pid" == "$PPID" ]]; then
            log_error "Refusing to terminate this script or its parent."
            return 1
        fi

        printf 'Sending SIGTERM to PID %s...\n' "$pid"
        sudo kill -TERM "$pid" 2>/dev/null || true
    done <<< "$pids"

    sleep 1

    output=$(sudo lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        log_error "Port $port is still occupied."
        sudo lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2 || true
        printf '%s\n' \
            "Remaining processes will not be force-killed automatically." >&2
        return 1
    fi

    log_success "Port $port is now free."
}
