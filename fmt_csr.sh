#!/usr/bin/env bash

cargo fmt
cd vite_csr
npm run format
cd ..
