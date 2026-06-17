import { defineConfig } from '@playwright/test';

// E2E runs against the production build served by `vite preview`. Run
// `npm run build:content && npm run build` first so dist/ + dist-content exist.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: { baseURL: 'http://localhost:4178', headless: true },
  webServer: {
    command: 'npm run preview -- --port 4178',
    port: 4178,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
