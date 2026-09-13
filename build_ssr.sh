#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

release_flag=""
for arg in "$@"; do
  if [[ "$arg" == "--release" ]]; then
    release_flag="--release"
  fi
done

cd fastify_vite_ssr
npm run build
cd ..
cargo build --no-default-features --features proxy_default_service $release_flag
