import { test, expect } from '../e2e/fixtures';

test('sustained synthetic navigation records resources without inventing leak thresholds', async ({ page, context, runtime }, testInfo) => {
  const seconds = Number(process.env.EDGEVIEW_SOAK_SECONDS || 300);
  expect(Number.isSafeInteger(seconds) && seconds >= 300 && seconds <= 1800).toBe(true);
  test.setTimeout(seconds * 1000 + 180_000);
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', error => { if (errors.length < 20) errors.push(error.message); });
  page.on('console', message => { if (message.type() === 'error' && consoleErrors.length < 20) consoleErrors.push(message.text()); });
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  const identity = await runtime.identity();
  const started = performance.now();
  type Sample = { phase: string; elapsedSeconds: number; rssBytes: number | null; heapUsedBytes: number | null; cpuPercent: number | null; browserJsHeapEstimateBytes: number | null; domNodes: number; cycleMs: number | null };
  const samples: Sample[] = [];
  const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  const sample = async (phase: string, cycleMs: number | null = null) => {
    const health = await runtime.identity();
    const browser = await page.evaluate(() => ({
      heap: (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize ?? null,
      domNodes: document.querySelectorAll('*').length,
    }));
    samples.push({ phase, elapsedSeconds: (performance.now() - started) / 1000,
      rssBytes: numeric(health.resources?.rssBytes), heapUsedBytes: numeric(health.resources?.heapUsedBytes),
      cpuPercent: numeric(health.resources?.cpuPercent), browserJsHeapEstimateBytes: numeric(browser.heap),
      domNodes: browser.domNodes, cycleMs });
    expect(samples.length).toBeLessThanOrEqual(128);
  };
  try {
    await page.goto('/');
    await expect(page.getByText('No File Loaded in File Viewer')).toBeVisible();
    await sample('idle-start');
    await page.waitForTimeout(30_000);
    await sample('idle-end');
    const csv = ['Date,Importer,Country,Exporter,Item,TOT_FC,QTY,UNT', ...Array.from({ length: 60 }, (_, i) =>
      `2026-01-01,Soak Buyer ${i},Kenya,Soak Supplier,Soak Product ${i},10,1,KG`)].join('\n');
    const uploaded = page.waitForResponse(response => response.url().endsWith('/api/files/upload') && response.request().method() === 'POST');
    await page.locator('#file-upload-input').setInputFiles({ name: 'owned-soak.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    expect((await uploaded).status()).toBe(201);
    await page.getByRole('button', { name: 'Group Shipments ON', exact: true }).click();
    const workloadStarted = performance.now();
    let cycles = 0;
    while (performance.now() - workloadStarted < seconds * 1000) {
      const cycleStarted = performance.now();
      await page.locator('#nav-tab-files').click();
      await expect(page.getByRole('heading', { name: 'owned-soak.csv', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByText('Page 2 of 3 (60 rows)', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Previous', exact: true }).click();
      await page.getByRole('button', { name: 'Country View', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Expand Kenya', exact: true })).toBeVisible();
      await page.locator('#nav-tab-contacts').click();
      await page.getByRole('button', { name: 'Importers', exact: true }).click();
      await page.getByPlaceholder('Search company, CEO, email...').fill('Soak Buyer 5');
      await expect(page.getByText('Soak Buyer 5', { exact: true }).first()).toBeVisible();
      await page.getByPlaceholder('Search company, CEO, email...').fill('');
      await page.locator('#nav-tab-settings').click();
      await expect(page.getByRole('button', { name: 'Save configuration', exact: true })).toBeVisible();
      await page.getByRole('button', { name: /^System Logs/ }).click();
      await page.getByPlaceholder('Search log entries...').fill('no-such-soak-log');
      await page.getByPlaceholder('Search log entries...').fill('');
      await sample('workload', performance.now() - cycleStarted);
      cycles += 1;
      console.log(`Resource observation cycle ${cycles}; workload seconds ${Math.round((performance.now() - workloadStarted) / 1000)}`);
      // Pace below ordinary local-client limits; no provider checks or research.
      await page.waitForTimeout(Math.max(0, 20_000 - (performance.now() - cycleStarted)));
    }
    await page.goto('about:blank');
    await page.waitForTimeout(30_000);
    await sample('settled');
    expect(cycles).toBeGreaterThanOrEqual(1);
    expect(errors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  } finally {
    await testInfo.attach('resource-observations.json', { body: JSON.stringify({
      buildId: identity.app.build?.buildId, gitCommit: identity.app.build?.gitCommit,
      requestedWorkloadSeconds: seconds, elapsedSeconds: (performance.now() - started) / 1000, samples,
      pageErrorCount: errors.length, consoleErrorCount: consoleErrors.length,
      limitations: 'Synthetic 60-row workflow only. Browser heap is a Chromium estimate, not process RSS. No forced GC, paid provider work, large import, export or leak-free verdict. Thresholds are not established by this observation.',
    }, null, 2), contentType: 'application/json' });
  }
});
