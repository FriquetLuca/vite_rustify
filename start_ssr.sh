#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

(trap 'kill 0' SIGINT; \
bash -c 'cargo run --no-default-features --features proxy_default_service' & \
bash -c 'cd fastify_vite_ssr; npm run start')
