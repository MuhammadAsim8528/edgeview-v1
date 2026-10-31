import JSZip from 'jszip';
import { extractPdfText, pdfTextContains } from '../../server/tests/pdf_inspect';
import { test, expect } from './fixtures';

test('summary and country downloads resolve explicit stored file scopes and reject browser facts', async ({ page, context, request, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity(); await page.goto('/');
  const csv = ['Date,Importer,Country,Exporter,Item,TOT_FC', ...Array.from({ length: 60 }, (_, i) => `2026-01-01,Derived Buyer ${i},Kenya,Supplier,Product,10`)].join('\n');
  const uploaded = page.waitForResponse(r => r.url().endsWith('/api/files/upload') && r.request().method() === 'POST');
  await page.locator('#file-upload-input').setInputFiles({ name: 'derived-authority.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  const result = await uploaded; expect(result.status()).toBe(201);
  const body = await result.json(); const fileId = body.data?.id || body.id;
  const otherResponse = await request.post('/api/files/upload', { multipart: { file: { name: 'other-derived.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,OTHER_FILE,Sri Lanka,Supplier,Product,20\n') } } });
  expect(otherResponse.status()).toBe(201); const otherBody = await otherResponse.json(); const otherId = otherBody.data?.id || otherBody.id;
  for (const section of [{ nav: '#nav-tab-summary', button: 'Export Summary Data', dataset: 'summary' }, { nav: '#nav-tab-country', button: 'Export Full Report', dataset: 'country' }]) {
    await page.locator(section.nav).click();
    await page.getByRole('button', { name: section.button, exact: true }).click();
    const sent = page.waitForRequest(r => r.url().endsWith('/api/export') && r.method() === 'POST');
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
    const payload = (await sent).postDataJSON();
    expect(payload.dataset).toBe(section.dataset); expect(payload.source_file_ids).toEqual([fileId]); expect(payload).not.toHaveProperty('records');
    const stream = await (await downloaded).createReadStream(); const parts: Buffer[] = [];
    for await (const part of stream!) parts.push(Buffer.from(part));
    const text = Buffer.concat(parts).toString('utf8');
    expect(text.trim().split('\n')).toHaveLength(61); expect(text).toContain('Derived Buyer 59'); expect(text).not.toContain('OTHER_FILE');
  }
  const base = { dataset: 'country', format: 'csv', title: 'Explicit scope', source_file_ids: [fileId, otherId] };
  const union = await request.post('/api/export', { data: base }); expect(union.status()).toBe(200);
  const combined = await union.text(); expect(combined.trim().split('\n')).toHaveLength(62); expect(combined).toContain('OTHER_FILE');
  for (const patch of [{ source_file_ids: [] }, { source_file_ids: ['missing'] }, { source_file_ids: [fileId, 'missing'] }, { source_file_ids: [fileId, fileId] }, { source_file_ids: fileId }, { records: [{ Importer: 'FORGED' }] }, { selectedRows: [] }, { dataset: 'summary' }]) {
    const bad = await request.post('/api/export', { data: { ...base, ...patch } });
    expect(bad.status()).toBe(400); expect((await bad.json()).code).toBe('INVALID_EXPORT_REQUEST');
  }
});


test('stored summary and country scope preserves actual contents in all five formats', async ({ request, runtime }) => {
  await runtime.identity();
  const response = await request.post('/api/files/upload', { multipart: { file: { name: 'derived-formats.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,DerivedFormatBuyer,Kenya,Supplier,Product,10\n') } } });
  expect(response.status()).toBe(201); const uploaded = await response.json(); const id = uploaded.data?.id || uploaded.id;
  for (const dataset of ['summary','country']) for (const format of ['csv','xlsx','docx','pdf','all']) {
    const exported = await request.post('/api/export', { data: { dataset, format, source_file_ids: [id], title: 'Synthetic stored scope' } });
    expect(exported.status()).toBe(200); expect(exported.headers()['x-export-failed-formats']).toBeUndefined();
    const bytes = await exported.body();
    if (format === 'csv') expect(bytes.toString('utf8')).toContain('DerivedFormatBuyer');
    else if (format === 'pdf') expect(pdfTextContains(extractPdfText(bytes), 'DerivedFormatBuyer')).toBe(true);
    else {
      const zip = await JSZip.loadAsync(bytes);
      if (format === 'docx' || format === 'xlsx') expect(await zip.file(format === 'docx' ? 'word/document.xml' : 'xl/sharedStrings.xml')!.async('string')).toContain('DerivedFormatBuyer');
      else {
        for (const extension of ['csv','xlsx','docx','pdf']) expect(Object.keys(zip.files).some(name => name.endsWith('.'+extension))).toBe(true);
        const csv = Object.values(zip.files).find(file => file.name.endsWith('.csv'))!;
        expect(await csv.async('string')).toContain('DerivedFormatBuyer');
      }
    }
  }
});
