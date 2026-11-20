import { defineConfig } from '@playwright/test';

// Phone-sized run against the web deploy base. Build first with
// `npx vite build --base /app/ --outDir dist-app` (see web-cloudflare.yml).
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: 'trace_map_app.spec.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:4179/app/',
    headless: true,
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    isMobile: true,
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'npx vite preview --outDir dist-app --base /app/ --port 4179 --strictPort --host 127.0.0.1',
    port: 4179,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
