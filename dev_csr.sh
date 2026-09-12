#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

(trap 'kill 0' SIGINT; \
bash -c 'cargo watch -x "run --features proxy_default_service"' & \
bash -c 'cd vite_csr; npm run dev')
