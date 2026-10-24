import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Explicit opt-in; never lengthen the normal browser/CI smoke suite silently.
export default defineConfig({ ...base, testDir: './tests/soak', timeout: 2_000_000,
  outputDir: '.test-cache/soak-artifacts/results',
  reporter: [['list'], ['json', { outputFile: '.test-cache/soak-artifacts/results.json' }]],
});
