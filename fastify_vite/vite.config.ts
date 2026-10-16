import { defineConfig, loadEnv } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import routerPlugin from './src/build/routerPlugin.js';
import serverRouterPlugin from './src/build/serverRouterPlugin.js';

export default defineConfig(({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, '../', ['VITE_', 'PUBLIC_']);
  return {
    plugins: [
      react(),
      routerPlugin({
        include: [
          '/src/pages/**/*.tsx',
        ],
        exclude: [
          '/src/pages/**/*.server.tsx',
        ],
        allowProperties: ["mode", "isChild"],
      }),
      serverRouterPlugin(),
      babel({
        presets: [reactCompilerPreset()]
      }),
      tailwindcss(),
    ],
    css: {
      devSourcemap: process.env.NODE_ENV !== 'production',
    },
    envDir: '../',
    build: {
      copyPublicDir: !isSsrBuild,
      rolldownOptions: {
        treeshake: true,
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('i18n')) return 'i18n-vendor';
              if (id.includes('react-dom')) return 'react-dom-vendor';
              if (id.includes('react-router')) return 'react-router-vendor';
              if (id.includes('react')) return 'react-vendor';
              return 'vendor';
            }
          }
        }
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
    },
    server: {
      ws: {
        port: Number(env.VITE_WS_PORT) || 24678,
        clientPort: Number(env.PUBLIC_PORT) || 443,
        path: "/__vite_hmr",
      },
    },
  };
});
