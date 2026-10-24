import { test, expect } from './fixtures';

test('finishing an upload preserves a newer navigation choice', async ({ page, context, runtime }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  let releaseRefresh = () => {};
  try {
    const initialFiles = page.waitForResponse(response => new URL(response.url()).pathname === '/api/files');
    await page.goto('/');
    expect((await initialFiles).status()).toBe(200);
    let refreshStarted = () => {};
    const started = new Promise<void>(resolve => { refreshStarted = resolve; });
    const release = new Promise<void>(resolve => { releaseRefresh = resolve; });
    await page.route('**/api/files', async route => {
      refreshStarted();
      await release;
      await route.continue(); // Real backend response, not a fabricated success.
    });
    const uploaded = page.waitForResponse(response => response.url().endsWith('/api/files/upload') && response.request().method() === 'POST');
    await page.locator('#file-upload-input').setInputFiles({ name: 'navigation-choice.csv', mimeType: 'text/csv',
      buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,Navigation Buyer,Kenya,Navigation Supplier,Product,10\n') });
    expect((await uploaded).status()).toBe(201);
    await started;
    await page.locator('#nav-tab-contacts').click();
    await expect(page.getByRole('button', { name: 'All exporters', exact: true })).toBeVisible();
    releaseRefresh();
    await expect(page.getByText('Successfully uploaded navigation-choice.csv', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'All exporters', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'All exporters', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('preserved-contacts-tab.png'), fullPage: true });
    await page.locator('#nav-tab-files').click();
    await expect(page.getByRole('heading', { name: 'navigation-choice.csv', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('upload-navigation.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    releaseRefresh();
    await testInfo.attach('page-errors.json', { body: JSON.stringify(errors), contentType: 'application/json' });
  }
});
