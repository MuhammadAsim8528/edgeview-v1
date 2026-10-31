import { test, expect } from './fixtures';
import JSZip from 'jszip';
import { extractPdfText, pdfTextContains } from '../../server/tests/pdf_inspect';

test('saved report download preserves actual custom columns/text and rejects browser overrides', async ({ page, context, request, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  const create = async (data: object) => { const response = await request.post('/api/reports/upload', { data }); expect(response.status()).toBe(201); return (await response.json()).report; };
  const table = await create({ title: 'Synthetic Table', report_type: 'table', columns: ['Product','Amount'], rows: [{ Product: 'SAVED_REPORT_MARKER', Amount: 42 }] });
  const text = await create({ title: 'Synthetic Text', report_type: 'text', content_text: 'SAVED_TEXT_START ' + 'report body '.repeat(900) + 'SAVED_TEXT_END' });
  expect(text.id).not.toBe(table.id);
  await page.goto('/'); await page.locator('#nav-tab-reports').click();
  await expect(page.getByRole('cell', { name: 'SAVED_REPORT_MARKER', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Export Report', exact: true }).click();
  const sent = page.waitForRequest(r => r.url().endsWith('/api/export') && r.method() === 'POST'); const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
  const payload = (await sent).postDataJSON();
  const stream = await (await downloading).createReadStream(); const parts: Buffer[] = []; for await (const part of stream!) parts.push(Buffer.from(part));
  const csv = Buffer.concat(parts).toString('utf8');
  expect(csv).toContain('Product'); expect(csv).toContain('SAVED_REPORT_MARKER'); expect(csv).toContain('42');
  expect(csv).not.toContain('Importer'); expect(payload.report_id).toBe(table.id); expect(payload).not.toHaveProperty('records');
  for (const report of [table, text]) for (const format of ['csv','xlsx','docx','pdf','all']) {
    const exported = await request.post('/api/export', { data: { dataset: 'reports', report_id: report.id, format } });
    expect(exported.status()).toBe(200); expect(exported.headers()['x-export-failed-formats']).toBeUndefined();
    const bytes = await exported.body(); const marker = report.id === table.id ? 'SAVED_REPORT_MARKER' : 'SAVED_TEXT_END';
    if (format === 'csv') expect(bytes.toString('utf8')).toContain(marker);
    else if (format === 'pdf') expect(pdfTextContains(extractPdfText(bytes), marker)).toBe(true);
    else {
      const zip = await JSZip.loadAsync(bytes);
      if (format === 'docx' || format === 'xlsx') expect(await zip.file(format === 'docx' ? 'word/document.xml' : 'xl/sharedStrings.xml')!.async('string')).toContain(marker);
      else {
        for (const extension of ['csv','xlsx','docx','pdf']) expect(Object.keys(zip.files).some(name => name.endsWith('.'+extension))).toBe(true);
        expect(await Object.values(zip.files).find(file => file.name.endsWith('.csv'))!.async('string')).toContain(marker);
        expect(pdfTextContains(extractPdfText(await Object.values(zip.files).find(file => file.name.endsWith('.pdf'))!.async('nodebuffer')), marker)).toBe(true);
      }
    }
  }
  for (const patch of [{ report_id: 'missing' }, { records: [{ Product: 'FORGED' }] }, { columns: [{ key: 'FORGED', header: 'FORGED' }] }, { selectedRows: [] }]) {
    const bad = await request.post('/api/export', { data: { dataset: 'reports', report_id: table.id, format: 'csv', ...patch } });
    expect(bad.status()).toBe(400); expect((await bad.json()).code).toBe('INVALID_EXPORT_REQUEST');
  }
});
