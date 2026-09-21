import { defineConfig, loadEnv } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode, isSsrBuild }) => {
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
    envDir: '../',
    build: {
      copyPublicDir: !isSsrBuild,
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
