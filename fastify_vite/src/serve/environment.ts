import path from 'node:path';
import dotenv from 'dotenv';

let injectedEnv = false;
if (!injectedEnv) {
  dotenv.config({
    path: path.resolve(process.cwd(), '../.env'),
  });
  injectedEnv = true;
}

export const IS_SSG = process.env.SSG_GEN === 'true';
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const IS_SECURE = !IS_SSG && IS_PRODUCTION;
export const TITLE = process.env.VITE_APP_NAME ?? 'Fastify Vite';
export const BASE = process.env.VITE_BASE_PATH ?? '/';
export const HOST = process.env.VITE_HOST ?? '0.0.0.0';
export const PORT = process.env.VITE_PORT
  ? Number(process.env.VITE_PORT)
  : 5173;
