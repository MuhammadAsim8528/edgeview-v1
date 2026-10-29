import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const artifacts = process.env.EDGEVIEW_VISUAL_CAPTURE === '1' ? 'visual-artifacts' : 'visual-comparison';

export default defineConfig({
  ...base,
  testDir: './tests/visual',
  timeout: 120_000,
  outputDir: `.test-cache/${artifacts}/results`,
  snapshotPathTemplate: '{testDir}/baselines/{platform}/{arg}{ext}',
  updateSnapshots: 'none',
  reporter: [['list'], ['json', { outputFile: `.test-cache/${artifacts}/results.json` }]],
  expect: { ...base.expect, toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixels: 0 } },
});
