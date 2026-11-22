import { test, expect } from './fixtures';

test('generic table retains codes and columns while archived trade history survives restart', async ({ page, request, runtime }) => {
  await page.goto('/');
  const upload = async (name: string, csv: string) => {
    const completed = page.waitForResponse(r => r.url().endsWith('/api/files/upload') && r.request().method() === 'POST');
    await page.locator('#file-upload-input').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(csv) });
    return (await (await completed).json()).data.id as string;
  };
  const csv = 'Importer,Exporter,Country,Item\nSample Buyer,Sample Supplier,Kenya,Product\n';
  const trade = await upload('shipment.csv', csv);
  const generic = await upload('weights.csv', 'DRG,Description,Weight\n001,Example procedure,28.1664\n');
  await expect(page.getByRole('columnheader', { name: 'DRG', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '001', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Display heading for DRG' })).toBeVisible();
  await expect(page.getByText('Exporters Found', { exact: true })).toHaveCount(0);
  expect((await request.post('/api/files/' + generic + '/save-to-history')).status()).toBe(422);
  expect((await request.post('/api/files/' + trade + '/save-to-history')).ok()).toBeTruthy();
  const summary = async () => (await (await request.get('/api/stats/summary?file_id=' + trade)).json());
  const before = await summary();
  expect(before.total_records).toBe(1);
  expect((await (await request.get('/api/stats/summary')).json()).total_records).toBe(1);
  expect((await request.delete('/api/files/' + trade + '?keep_history=true')).ok()).toBeTruthy();
  await runtime.restart();
  expect((await request.get('/api/files/' + trade + '/data')).status()).toBe(404);
  expect(await summary()).toEqual(before);
  await page.reload();
  expect(await upload('reopened.csv', csv)).toBe(trade);
  await runtime.restart();
  expect((await request.get('/api/files/' + trade + '/data')).ok()).toBeTruthy();
});
