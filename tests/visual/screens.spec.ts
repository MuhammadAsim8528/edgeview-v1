import { test, expect } from '../e2e/fixtures';
import type { Page, TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const captureOnly = process.env.EDGEVIEW_VISUAL_CAPTURE === '1';
async function screen(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  if (captureOnly) {
    const file = info.outputPath(`${name}.png`);
    await page.screenshot({ path: file, fullPage: true, animations: 'disabled', caret: 'hide' });
    await info.attach(`${name}-UNREVIEWED`, { path: file, contentType: 'image/png' });
    info.annotations.push({ type: 'visual-status', description: `${name}: capture only; baseline comparison NOT VERIFIED` });
  } else {
    // Missing references must fail, never silently bless current rendering.
    expect(fs.existsSync(path.join('tests/visual/baselines', process.platform, `${name}.png`)),
      `No reviewed ${process.platform} baseline for ${name}. Capture and review first; do not auto-update.`).toBe(true);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
    info.annotations.push({ type: 'visual-status', description: `${name}: reviewed baseline matched` });
  }
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'narrow', width: 390, height: 844 }]) {
  test(`${viewport.name}: synthetic empty, loaded data and settings review images`, async ({ page, context, runtime }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
    const health = await runtime.identity();
    await info.attach('build.json', { body: JSON.stringify({ version: health.app.build.version,
      buildId: health.app.build.buildId, commit: health.app.build.gitCommit, platform: process.platform,
      viewport, mode: captureOnly ? 'UNREVIEWED_CAPTURE' : 'COMPARISON_REQUESTED' }), contentType: 'application/json' });
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByText('No File Loaded in File Viewer')).toBeVisible();
    await screen(page, info, `${viewport.name}-empty`);
    const uploaded = page.waitForResponse(response => response.url().endsWith('/api/files/upload') && response.request().method() === 'POST');
    await page.locator('#file-upload-input').setInputFiles({ name: 'synthetic-visual.csv', mimeType: 'text/csv',
      buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC,QTY,UNT\n2026-01-01,Synthetic Kenya Buyer,Kenya,Synthetic Supplier,Synthetic Item,10,1,KG\n2026-01-02,Synthetic Sri Lanka Buyer,Sri Lanka,Synthetic Supplier,Synthetic Item,20,2,KG') });
    expect((await uploaded).status()).toBe(201);
    await expect(page.getByRole('heading', { name: 'synthetic-visual.csv', exact: true })).toBeVisible();
    await screen(page, info, `${viewport.name}-loaded`);
    await page.locator('#nav-tab-settings').click();
    await expect(page.getByRole('button', { name: 'Save configuration', exact: true })).toBeVisible();
    await screen(page, info, `${viewport.name}-settings`);
    expect(errors).toEqual([]);
  });
}
