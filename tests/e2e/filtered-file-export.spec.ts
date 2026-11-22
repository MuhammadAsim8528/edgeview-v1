import { test, expect, EXPORT_ARTIFACT_TIMEOUT_MS } from './fixtures';
import { extractPdfText, pdfTextContains } from '../../server/tests/pdf_inspect';

test('filtered grouped export uses the stored file and server view, not browser rows', async ({ page, context, runtime, request }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity(); await page.goto('/');
  const csv = ['Date,Importer,Country,Exporter,Item,TOT_FC,BE_LINK',
    '2026-01-01,Local Buyer,Kenya,Supplier,MATCH_A,10,shared',
    '2026-01-01,Local Buyer,Kenya,Supplier,MATCH_B,20,shared',
    ...Array.from({ length: 58 }, (_, i) => `2026-01-01,Noise Buyer ${i},Uganda,Supplier,Noise Product,5,noise-${i}`)].join('\n');
  const uploaded = page.waitForResponse(r => r.url().endsWith('/api/files/upload') && r.request().method() === 'POST');
  await page.locator('#file-upload-input').setInputFiles({ name: 'filtered-authority.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  expect((await uploaded).status()).toBe(201);
  const filtered = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/data') && new URL(r.url()).searchParams.get('search') === 'MATCH');
  await page.getByPlaceholder('Global keyword search across Date, Item, Importer, Cost...').fill('MATCH');
  expect((await filtered).status()).toBe(200);
  await expect(page.locator('tbody tr').filter({ hasText: 'Local Buyer' })).toHaveCount(1);
  let exportPageReads = 0;
  page.on('request', req => { if (new URL(req.url()).pathname.endsWith('/data')) exportPageReads++; });
  await page.locator('#export-filtered-btn').click();
  const submitted = page.waitForRequest(r => new URL(r.url()).pathname.startsWith('/api/export') && r.method() === 'POST');
  const downloading = page.waitForEvent('download', { timeout: EXPORT_ARTIFACT_TIMEOUT_MS });
  await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
  const sent = await submitted;
  expect(new URL(sent.url()).pathname).toMatch(/^\/api\/export\/file\/[^/]+$/);
  const body = sent.postDataJSON();
  expect(body).not.toHaveProperty('records');
  expect(body.view.search).toBe('MATCH'); expect(body.view.group_shipments).toBe('true');
  const stream = await (await downloading).createReadStream(); const parts: Buffer[] = [];
  for await (const part of stream!) parts.push(Buffer.from(part));
  const text = Buffer.concat(parts).toString('utf8');
  expect(text.trim().split('\n')).toHaveLength(2);
  expect(text).toContain('MATCH_A'); expect(text).toContain('MATCH_B'); expect(text).not.toContain('Noise Buyer');
  expect(text).toContain('30.00');
  expect(exportPageReads).toBe(0); // Export must not collect the paginated dataset in the browser.
  const url = new URL(sent.url()).pathname;
  const unanchored = await request.post('/api/export', { data: { dataset: 'files', format: 'csv',
    records: [{ Date: '2026-01-01', Importer: 'FORGED', Country: 'Kenya', Item: 'Not stored', TOT_FC: 999 }] } });
  expect(unanchored.status()).toBe(400);
  expect((await unanchored.json()).code).toBe('STORED_FILE_REQUIRED');
  const rawView = await request.post(url, { data: { ...body, view: { search: 'MATCH', country: 'Kenya', group_shipments: 'false', sort_by: 'TOT_FC', sort_dir: 'desc' } } });
  expect(rawView.status()).toBe(200);
  const rawCsv = await rawView.text();
  expect(rawCsv.trim().split('\n')).toHaveLength(3);
  expect(rawCsv.indexOf('MATCH_B')).toBeLessThan(rawCsv.indexOf('MATCH_A'));
  const scoped = await request.post(url, { data: { ...body, view: { group_shipments: 'false', product: 'Noise', country: 'Uganda', importer: 'Noise Buyer 0', start_date: '2026-01-01', end_date: '2026-01-01' } } });
  expect(scoped.status()).toBe(200);
  const scopedCsv = await scoped.text();
  expect(scopedCsv.trim().split('\n')).toHaveLength(2);
  expect(scopedCsv).toContain('Noise Buyer 0'); expect(scopedCsv).not.toContain('Local Buyer');
  const fileId = url.split('/').at(-1);
  const invalidPage = await request.get(`/api/files/${fileId}/data?search=a&search=b`);
  expect(invalidPage.status()).toBe(400);
  expect((await invalidPage.json()).code).toBe('INVALID_FILE_VIEW');
  for (const view of [{ search: ['MATCH'] }, { unknown: 'x' }, { group_shipments: 'maybe' }, { sort_dir: 'backward' }, { search: 'x'.repeat(1001) }]) {
    const bad = await request.post(url, { data: { ...body, view } });
    expect(bad.status()).toBe(400); expect((await bad.json()).code).toBe('INVALID_EXPORT_REQUEST');
  }
  const noMatch = await request.post(url, { data: { ...body, view: { search: 'NOT_PRESENT_IN_FIXTURE' } } });
  expect(noMatch.status()).toBe(400);
  for (const view of [{ start_date: '2027-01-01' }, { end_date: '2025-12-31' }, { country: 'Uganda', importer: 'Local Buyer' }]) {
    const noScope = await request.post(url, { data: { ...body, view } });
    expect(noScope.status()).toBe(400); expect((await noScope.json()).code).toBe('INVALID_EXPORT_REQUEST');
  }
});


test('detected headings and selected rows carry through to a stored-file download', async ({ page, context, runtime, request }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  await page.goto('/');
  const uploaded = page.waitForResponse(r => r.url().endsWith('/api/files/upload') && r.request().method() === 'POST');
  const csv = [
    'Date,Importer,Country,Exporter,Item,TOT_FC',
    '2026-01-01,Buyer A,Kenya,Supplier,Selected item,10',
    ...Array.from({ length: 24 }, (_, index) => `2026-01-02,Buyer B,Pakistan,Supplier,Excluded item ${index},20`),
    '2026-01-03,Buyer C,Kenya,Supplier,Second page item,30',
  ].join('\n');
  await page.locator('#file-upload-input').setInputFiles({ name: 'column-options.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  expect((await uploaded).status()).toBe(201);
  await page.getByRole('button', { name: 'Group Shipments ON' }).click();
  await expect(page.getByRole('checkbox', { name: 'Item', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Item', exact: true }).check();
  await page.getByRole('textbox', { name: 'Display heading for Item' }).fill('Product label');
  await expect(page.getByRole('columnheader', { name: 'Product label' })).toBeVisible();
  await page.getByText('Display columns', { exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'Selected item' }).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'Second page item' }).getByRole('checkbox').check();
  const filteredPage = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/data') && new URL(response.url()).searchParams.get('search') === 'Second page item');
  await page.getByPlaceholder('Global keyword search across Date, Item, Importer, Cost...').fill('Second page item');
  expect((await filteredPage).status()).toBe(200);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: /Export selected \(2/ }).click();
  const submitted = page.waitForRequest(r => new URL(r.url()).pathname.startsWith('/api/export/file/') && r.method() === 'POST');
  const downloading = page.waitForEvent('download', { timeout: EXPORT_ARTIFACT_TIMEOUT_MS });
  await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
  const sent = await submitted;
  const body = sent.postDataJSON();
  expect(body.row_positions).toEqual([0, 25]);
  expect(body.source_columns).toEqual([{ key: 'Item', header: 'Product label' }]);
  expect(body).not.toHaveProperty('records');
  const stream = await (await downloading).createReadStream();
  const parts: Buffer[] = [];
  for await (const part of stream!) parts.push(Buffer.from(part));
  expect(Buffer.concat(parts).toString('utf8').replace(/^\uFEFF/u, '')).toBe('"Product label"\r\n"Selected item"\r\n"Second page item"');
  const pdf = await request.post(new URL(sent.url()).pathname, { data: { ...body, format: 'pdf' } });
  expect(pdf.status()).toBe(200);
  const text = extractPdfText(await pdf.body());
  expect(pdfTextContains(text, 'Product label')).toBe(true);
  expect(pdfTextContains(text, 'Selected item')).toBe(true);
  expect(pdfTextContains(text, 'Excluded item')).toBe(false);
});
