#!/usr/bin/env bash

cd fastify_vite_ssr
npm run build
cd ..
cargo build
