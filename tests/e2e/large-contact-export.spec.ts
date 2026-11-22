import { test, expect, EXPORT_ARTIFACT_TIMEOUT_MS } from './fixtures';
import type { Download } from '@playwright/test';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { assertPdfContainsText } from '../../server/tests/pdf_inspect';

test('large stored trade context exports through the real Contacts proceed control without a record-body roundtrip', async ({ page, context, runtime }, testInfo) => {
  test.setTimeout(300000);
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await page.addInitScript(() => { localStorage.setItem('edgeview_contacts_view', 'table'); localStorage.setItem('edgeview_contacts_filter', 'ALL'); });
  const company = 'Synthetic Large Buyer Δ';
  const count = 3200;
  const rows = Array.from({ length: count }, (_, i) => `2026-10-01,${company},Kenya,Synthetic Supplier,Product-${i}-${'x'.repeat(1800)},1`);
  const csv = Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n' + rows.join('\n'));
  await page.goto('/');
  const uploaded = page.waitForResponse(response => response.url().endsWith('/api/files/upload') && response.request().method() === 'POST', { timeout: 60000 });
  await page.locator('#file-upload-input').setInputFiles({ name: 'large-synthetic-export.csv', mimeType: 'text/csv', buffer: csv });
  expect((await uploaded).status()).toBe(201);
  await page.locator('#nav-tab-contacts').click();
  await page.getByRole('button', { name: 'Importers', exact: true }).click();
  await expect(page.locator('tbody tr').filter({ hasText: company })).toBeVisible();
  const downloads: Download[] = [];
  page.on('download', download => downloads.push(download));
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/export' && request.method() === 'POST') {
      console.log('LARGE_EXPORT_REQUEST ' + JSON.stringify({ bodyBytes: request.postDataBuffer()?.length || 0, bodyKeys: Object.keys(request.postDataJSON()) }));
    }
  });
  const observations: Array<{ format: string; method: string; route: string; bodyBytes: number; status: number; bodyKeys: string[] }> = [];
  for (const format of ['csv', 'all']) {
    await page.getByRole('button', { name: 'Export Report', exact: true }).click();
    await page.locator(`input[name="export_format"][value="${format}"]`).check();
    const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/export' && response.request().method() === 'POST', { timeout: 150000 });
    const before = downloads.length;
    await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
    const response = await responsePromise;
    const request = response.request();
    observations.push({ format, method: request.method(), route: new URL(request.url()).pathname, bodyBytes: request.postDataBuffer()?.length || 0, status: response.status(), bodyKeys: Object.keys(request.postDataJSON()) });
    expect(response.status(), `${format} must succeed before artifact validation`).toBe(200);
    expect(response.headers()['x-export-failed-formats']).toBeUndefined();
    await expect.poll(() => downloads.length, { timeout: EXPORT_ARTIFACT_TIMEOUT_MS }).toBe(before + 1);
    const stream = await downloads[before].createReadStream();
    expect(stream).not.toBeNull();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    const markers = [company, String(count), 'Synthetic Supplier'];
    if (format === 'csv') {
      const text = bytes.toString('utf8');
      for (const marker of markers) expect(text, `standalone CSV includes ${marker}`).toContain(marker);
    } else {
      const zip = await JSZip.loadAsync(bytes);
      for (const extension of ['csv', 'pdf', 'docx', 'xlsx']) {
        const members = zip.file(new RegExp(`\\.${extension}$`));
        expect(members.length, `exactly one complete ${extension} member`).toBe(1);
        const memberBytes = await members[0].async('nodebuffer');
        expect(memberBytes.length, `${extension} must not be a placeholder`).toBeGreaterThan(500);
        if (extension === 'csv') {
          const text = memberBytes.toString('utf8');
          for (const marker of markers) expect(text, `ZIP CSV includes ${marker}`).toContain(marker);
        } else if (extension === 'docx') {
          const documentZip = await JSZip.loadAsync(memberBytes);
          const document = await documentZip.file('word/document.xml')!.async('string');
          for (const marker of markers) expect(document, `ZIP DOCX includes ${marker}`).toContain(marker);
        } else if (extension === 'pdf') {
          assertPdfContainsText(memberBytes, ['Synthetic Large Buyer', String(count), 'Synthetic Supplier'], 'large-export ZIP PDF');
        } else {
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(memberBytes as any);
          expect(workbook.worksheets.length).toBeGreaterThan(0);
          let text = '';
          for (const sheet of workbook.worksheets) sheet.eachRow(row => { text += JSON.stringify(row.values); });
          for (const marker of markers) expect(text, `ZIP XLSX includes ${marker}`).toContain(marker);
        }
      }
    }
    await expect(page.getByRole('heading', { name: 'Export Data', exact: true })).not.toBeVisible();
  }
  console.log('LARGE_EXPORT_OBSERVATION ' + JSON.stringify({ syntheticRows: count, csvBytes: csv.length, observations }));
  await testInfo.attach('large-export-request-observation', { body: JSON.stringify({ syntheticRows: count, csvBytes: csv.length, observations }), contentType: 'application/json' });
  expect(observations.map(item => item.status)).toEqual([200, 200]);
  expect(observations.every(item => item.bodyBytes < 4096)).toBe(true);
  expect(runtime.outboundAttempts()).toBe(0);
});
