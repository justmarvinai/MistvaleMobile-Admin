import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The suite is served from `play.pathlands.cc/admin` (path-based on the game's single
 * domain — ADMIN_ARCHITECTURE §1), so every asset URL must carry that prefix.
 *
 * In dev the Admin API is proxied to the locally running game server, which keeps the
 * SPA same-origin in both environments: no CORS surface anywhere, and the session
 * cookie behaves identically.
 */
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5174,
    proxy: {
      '/admin/api': { target: 'http://127.0.0.1:3001', changeOrigin: false },
      // The dashboard's health strip reads `/api/health`, which is admin-gated but
      // lives under the player prefix because the ops scripts read it too.
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Mantine and TanStack are large and change rarely; splitting them keeps the app
    // chunk small enough to re-download on every deploy without a visible stall. React
    // itself is deliberately not split out — both vendors import it, so a separate
    // chunk would come out empty.
    rollupOptions: {
      output: {
        manualChunks: {
          mantine: ['@mantine/core', '@mantine/hooks', '@mantine/notifications'],
          tanstack: ['@tanstack/react-query', '@tanstack/react-router', '@tanstack/react-table'],
        },
      },
    },
  },
});
