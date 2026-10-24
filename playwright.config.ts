import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: true,
  outputDir: '.test-cache/e2e-artifacts/results',
  reporter: [['list'], ['json', { outputFile: '.test-cache/e2e-artifacts/results.json' }]],
  use: { browserName: 'chromium', headless: true, viewport: { width: 1440, height: 1000 },
    actionTimeout: 15_000, navigationTimeout: 30_000, bypassCSP: false,
    screenshot: 'only-on-failure', trace: 'retain-on-failure', video: 'off', serviceWorkers: 'block' },
});
