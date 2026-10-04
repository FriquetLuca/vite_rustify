import { defineConfig, loadEnv } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import virtualMetadataPlugin from './src/build/virtualMetadataPlugin.js';

export default defineConfig(({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, '../', ['VITE_', 'PUBLIC_']);
  return {
    plugins: [
      react(),
      virtualMetadataPlugin({
        moduleId: 'route-metadata',
        allowProperties: ['isChild'],
        include: [
          '/src/pages/**/*.tsx',
        ],
        exclude: [
          '/src/pages/**/*.server.tsx',
        ],
      }),
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
      rollupOptions: {
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
