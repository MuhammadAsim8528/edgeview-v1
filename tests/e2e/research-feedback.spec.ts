import { test, expect } from './fixtures';

test('research result feedback distinguishes failed, partial, completed and unknown outcomes', async ({ page, context, runtime }, testInfo) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await page.route('**/api/runtime/state', async route => {
    const response = await route.fetch();
    const body = await response.json();
    body.capabilities.company_enrichment = { available: true, status: 'READY', reason: 'Synthetic browser control' };
    await route.fulfill({ response, json: body });
  });
  let status = 'FAILED';
  await page.route('**/api/enrich/company', route => route.fulfill({ json: { success: true, run: { id: 'synthetic-feedback-run', status } } }));
  await page.goto('/');
  const uploaded = page.waitForResponse(response => response.url().endsWith('/api/files/upload') && response.request().method() === 'POST');
  await page.locator('#file-upload-input').setInputFiles({ name: 'feedback.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,Feedback Buyer,Kenya,Feedback Supplier,Product,10\n') });
  expect((await uploaded).status()).toBe(201);
  await page.locator('#nav-tab-contacts').click();
  await page.getByRole('button', { name: 'Importers', exact: true }).click();
  const row = page.locator('tbody tr').filter({ hasText: 'Feedback Buyer' });
  for (const outcome of [
    { status: 'FAILED', text: 'V1 enrichment failed for Feedback Buyer', color: 'text-rose-200' },
    { status: 'PARTIAL', text: 'V1 enrichment partial for Feedback Buyer', color: 'text-sky-200' },
    { status: 'COMPLETED', text: 'V1 enrichment completed for Feedback Buyer', color: 'text-emerald-200' },
    { status: 'NOT_FOUND', text: 'V1 enrichment not found for Feedback Buyer', color: 'text-sky-200' },
    { status: 'UNKNOWN', text: 'V1 enrichment status unverified for Feedback Buyer', color: 'text-amber-200' },
  ]) {
    status = outcome.status;
    const message = page.getByText(outcome.text, { exact: true });
    // The hosted trace showed the transient toast before click() returned.
    await Promise.all([
      expect(message).toBeVisible(),
      expect(message.locator('xpath=../..')).toHaveClass(new RegExp(outcome.color)),
      row.getByRole('button', { name: 'Fetch Details', exact: true }).click(),
    ]);
    await expect(row.getByRole('button', { name: 'Fetch Details', exact: true })).toBeEnabled();
  }
  await page.screenshot({ path: testInfo.outputPath('result-feedback.png'), fullPage: true });
});

