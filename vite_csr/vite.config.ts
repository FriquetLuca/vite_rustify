/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';

declare const process: {
  cwd: () => string;
  env: Record<string, string | undefined>;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../', ['VITE_', 'PUBLIC_']);
  return {
    plugins: [
      react(),
      babel({
        presets: [reactCompilerPreset()]
      }),
      tailwindcss(),
    ],
    css: {
      devSourcemap: process.env.NODE_ENV !== 'production',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react')) return 'react-vendor';
              if (id.includes('react-router')) return 'router';
              return 'vendor';
            }
          }
        }
      },
    },
    envDir: '../',
    server: {
      cors: true,
      host: env.VITE_HOST || '0.0.0.0',
      port: Number(env.VITE_PORT) || 5173,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
    },
    base: env.VITE_BASE_PATH,
  };
});
