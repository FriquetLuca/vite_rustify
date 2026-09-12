#!/usr/bin/env bash

cd vite_csr
npm run build
cd ..
cargo build
