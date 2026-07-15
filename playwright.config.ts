import { defineConfig } from '@playwright/test';

// E2E runs against the production build served by `vite preview`. Run
// `npm run build:content && npm run build` first so dist/ + dist-content exist.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:4178',
    headless: true,
    // Sandboxed/CI environments often pre-install a system Chromium instead of
    // the exact build this Playwright version pins; CHROMIUM_PATH points the
    // tests at it without downloading anything.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'npm run preview -- --port 4178',
    port: 4178,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
