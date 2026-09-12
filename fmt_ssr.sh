#!/usr/bin/env bash

cargo fmt
cd fastify_vite_ssr # cd vite_csr
npm run format
cd ..
