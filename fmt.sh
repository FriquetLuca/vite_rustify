#!/usr/bin/env bash

cargo fmt
cd fastify_vite
npm run format
cd ..
