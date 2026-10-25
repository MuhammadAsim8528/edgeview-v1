import { test, expect } from './fixtures';
import ExcelJS from 'exceljs';

test('literal CSV markup is retained and a truncated spreadsheet fails visibly before a real retry', async ({ page, context, runtime }, testInfo) => {
  const errors: string[] = [];
  const downloads: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('download', file => downloads.push(file.suggestedFilename()));
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  const literal = 'literal <script>not executable</script> & <header> text';
  const readDownload = async () => {
    const file = await page.waitForEvent('download');
    const chunks: Buffer[] = [];
    for await (const bytes of (await file.createReadStream())!) chunks.push(Buffer.from(bytes));
    return Buffer.concat(chunks);
  };
  try {
    await page.goto('/');
    const uploaded = page.waitForResponse(response => response.url().endsWith('/api/files/upload') && response.request().method() === 'POST');
    await page.locator('#file-upload-input').setInputFiles({ name: 'literal-content.csv', mimeType: 'text/csv',
      buffer: Buffer.from(`Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,Content Buyer,Kenya,Content Supplier,"${literal}",10\n`) });
    expect((await uploaded).status()).toBe(201);
    await expect(page.getByRole('heading', { name: 'literal-content.csv', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Export Full', exact: true }).click();
    const csv = readDownload();
    await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
    expect((await csv).toString('utf8')).toContain(literal);
    await expect(page.getByRole('heading', { name: 'Export Data', exact: true })).toBeHidden();

    await page.getByRole('button', { name: 'Export Full', exact: true }).click();
    await page.locator('input[name="export_format"][value="xlsx"]').check();
    await page.route('**/api/export/**', route => route.fulfill({ status: 200,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: Buffer.from([0x50]) }));
    await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('not a valid XLSX archive package');
    expect(downloads).toHaveLength(1);
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath('truncated-export-rejected.png'), fullPage: true });
    await page.unroute('**/api/export/**');
    const xlsx = readDownload();
    await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(await xlsx).buffer);
    expect(JSON.stringify(workbook.worksheets.map(sheet => sheet.getSheetValues()))).toContain(literal);
    await expect(page.getByRole('heading', { name: 'Export Data', exact: true })).toBeHidden();
    expect(downloads).toHaveLength(2);
    expect(errors).toEqual([]);
  } finally {
    await testInfo.attach('content-export-observations.json', { body: JSON.stringify({ downloads, errors }), contentType: 'application/json' });
  }
});
