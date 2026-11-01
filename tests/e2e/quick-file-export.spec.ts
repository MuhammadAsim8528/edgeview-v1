import { test, expect, EXPORT_ARTIFACT_TIMEOUT_MS } from './fixtures';

test('quick full export sends a stored-file reference and includes rows beyond the visible page', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  await page.goto('/');
  const csv = ['Date,Importer,Country,Exporter,Item,TOT_FC', ...Array.from({ length: 60 }, (_, index) => `2026-01-01,Quick Buyer ${index},Kenya,Supplier,Product,10`)].join('\n');
  const uploaded = page.waitForResponse(response => response.url().endsWith('/api/files/upload') && response.request().method() === 'POST');
  await page.locator('#file-upload-input').setInputFiles({ name: 'quick-authority.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  expect((await uploaded).status()).toBe(201);
  await page.getByRole('button', { name: 'Export Data', exact: true }).click();
  const submitted = page.waitForRequest(request => new URL(request.url()).pathname.startsWith('/api/export') && request.method() === 'POST');
  const downloading = page.waitForEvent('download', { timeout: EXPORT_ARTIFACT_TIMEOUT_MS });
  await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
  const request = await submitted;
  expect(new URL(request.url()).pathname).toMatch(/^\/api\/export\/file\/[^/]+$/);
  expect(request.postDataJSON()).not.toHaveProperty('records');
  expect(Buffer.byteLength(request.postData() || '')).toBeLessThan(1024);
  const download = await downloading;
  const stream = await download.createReadStream();
  const parts: Buffer[] = []; for await (const part of stream!) parts.push(Buffer.from(part));
  const text = Buffer.concat(parts).toString('utf8');
  expect(text.trim().split('\n')).toHaveLength(61);
  expect(text).toContain('Quick Buyer 59');
});
