import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// Single build, served three ways (static web + iOS + Android via Capacitor).
// `base: './'` keeps asset URLs relative so the same bundle works from a CDN
// path, the device filesystem (capacitor://), and `vite preview`.
export default defineConfig({
  // Absolute base: assets resolve correctly under nested client routes (e.g.
  // /trace/:id) on web, and Capacitor's local server serves them from root on
  // native. (Earlier './' broke relative fetches on deep SPA paths.)
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Full offline: precache the app shell + the compiled content bundle, the
      // Bible SQLite DB, and the sql.js wasm. The DB is ~10 MB so the workbox
      // file-size cap is raised accordingly.
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm}', 'dist-content/**/*.{json,sqlite}'],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      includeAssets: ['dist-content/content.sqlite', 'dist-content/bundle.json', 'icon.svg'],
      manifest: {
        name: 'Journeys — Atlas of the Apostles',
        short_name: 'Journeys',
        description: 'An accurate, cited, offline atlas of the journeys of Jesus and the apostles.',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // MapLibre's vendor chunk is intrinsically ~820 kB; this is expected for a
    // map app, so raise the advisory limit above it rather than chase it.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // MapLibre is large and stable; isolate it so the app chunk stays small
        // and the map vendor bundle caches across releases.
        manualChunks: { maplibre: ['maplibre-gl', 'pmtiles'] },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**', 'scripts/**'],
    },
  },
});
