import { test, expect } from './fixtures';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';

test('each file export format downloads through the rendered dialog', async ({ page, context, runtime }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  const observed: Array<{ format: string; filename: string; bytes: number }> = [];
  try {
    await page.goto('/');
    const uploaded = page.waitForResponse(response => response.url().endsWith('/api/files/upload') && response.request().method() === 'POST');
    await page.locator('#file-upload-input').setInputFiles({ name: 'format & controls.csv', mimeType: 'text/csv',
      buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,"Équipe & Sons, Ltd",Kenya,Format Supplier,Format Product,10\n2026-01-02,Second Buyer,Kenya,Format Supplier,Second Product,20\n') });
    expect((await uploaded).status()).toBe(201);
    await expect(page.getByRole('heading', { name: 'format & controls.csv', exact: true })).toBeVisible();
    const validate = async (format: string, bytes: Buffer, directory = false) => {
      if (format === 'csv') {
        expect(bytes.toString('utf8')).toContain('Équipe & Sons, Ltd');
        expect(bytes.toString('utf8')).toContain('Second Buyer');
      } else if (format === 'xlsx') {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(Uint8Array.from(bytes).buffer);
        const values = JSON.stringify(workbook.worksheets.map(sheet => sheet.getSheetValues()));
        expect(values).toContain('Équipe & Sons, Ltd');
        expect(values).toContain('Second Buyer');
      } else if (format === 'docx') {
        const archive = await JSZip.loadAsync(bytes);
        for (const entry of Object.values(archive.files).filter(entry => !entry.dir && /\.(xml|rels)$/.test(entry.name))) {
          const error = await page.evaluate(xml => new DOMParser().parseFromString(xml, 'application/xml')
            .querySelector('parsererror')?.textContent?.slice(0, 240) ?? null, await entry.async('string'));
          expect(error, `DOCX package member ${entry.name} must be well-formed XML`).toBeNull();
        }
        const document = await archive.file('word/document.xml')!.async('string');
        const parsed = await page.evaluate(xml => {
          const doc = new DOMParser().parseFromString(xml, 'application/xml');
          return { error: doc.querySelector('parsererror')?.textContent?.slice(0, 240) ?? null,
            text: Array.from(doc.getElementsByTagName('w:t'), node => node.textContent).join('\n') };
        }, document);
        expect(parsed.error, 'Downloaded DOCX must contain well-formed document XML').toBeNull();
        expect(parsed.text).toMatch(/Équipe & Sons, Ltd/i);
        expect(parsed.text).toMatch(/Second Buyer/i);
        if (!directory) expect(parsed.text).toContain('EdgeView — format & controls.csv (Full Dataset)');
      } else if (format === 'pdf') {
        expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
        expect(bytes.subarray(-32).toString()).toContain('%%EOF');
        // Signature/trailer checks do not certify PDF text, layout or font rendering.
      }
    };
    for (const format of ['csv', 'xlsx', 'docx', 'pdf', 'all']) {
      await page.getByRole('button', { name: 'Export Full', exact: true }).click();
      await page.locator(`input[name="export_format"][value="${format}"]`).check();
      const downloading = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
      const file = await downloading;
      const stream = await file.createReadStream();
      const chunks: Buffer[] = [];
      for await (const bytes of stream!) chunks.push(Buffer.from(bytes));
      const bytes = Buffer.concat(chunks);
      expect(file.suggestedFilename()).toMatch(new RegExp(`\\.${format === 'all' ? 'zip' : format}$`, 'i'));
      expect(bytes.length).toBeGreaterThan(0);
      if (format === 'all') {
        const archive = await JSZip.loadAsync(bytes);
        for (const member of ['csv', 'xlsx', 'docx', 'pdf']) {
          const entries = Object.values(archive.files).filter(entry => !entry.dir && entry.name.endsWith(`.${member}`));
          expect(entries).toHaveLength(1);
          await validate(member, await entries[0].async('nodebuffer'));
        }
      } else await validate(format, bytes);
      observed.push({ format, filename: file.suggestedFilename(), bytes: bytes.length });
      await expect(page.getByRole('heading', { name: 'Export Data', exact: true })).toBeHidden();
    }
    await page.locator('#nav-tab-contacts').click();
    await page.getByRole('button', { name: 'Importers', exact: true }).click();
    await expect(page.locator('tbody tr').filter({ hasText: 'Second Buyer' })).toBeVisible();
    for (const report of ['Importer Buyers & History', 'International Importers Excl. Pakistan, A→Z']) {
      await page.getByRole('button', { name: 'Export Report', exact: true }).click();
      await page.getByRole('button', { name: report, exact: true }).click();
      await page.locator('input[name="export_format"][value="docx"]').check();
      const downloading = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
      const file = await downloading;
      const chunks: Buffer[] = [];
      for await (const bytes of (await file.createReadStream())!) chunks.push(Buffer.from(bytes));
      const bytes = Buffer.concat(chunks);
      await validate('docx', bytes, true);
      observed.push({ format: report, filename: file.suggestedFilename(), bytes: bytes.length });
      await expect(page.getByRole('heading', { name: 'Export Data', exact: true })).toBeHidden();
    }
    await page.screenshot({ path: testInfo.outputPath('all-formats-completed.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await testInfo.attach('download-observations.json', { body: JSON.stringify({ observed, errors }), contentType: 'application/json' });
  }
});
