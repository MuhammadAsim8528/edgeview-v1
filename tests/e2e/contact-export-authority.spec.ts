import { test, expect } from './fixtures';

test('contact download uses stored facts and refuses stale or mixed record selections', async ({ request, runtime }) => {
  await runtime.identity();
  const upload = await request.post('/api/files/upload', { multipart: { file: { name: 'export-authority.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,Authoritative Buyer,Kenya,Supplier,Product,10\n2026-01-01,Other Buyer,Uganda,Supplier,Product,20\n') } } });
  expect(upload.status()).toBe(201);
  const contacts = await (await request.get('/api/companies')).json();
  const buyer = contacts.find((row: { company_name: string }) => row.company_name === 'Authoritative Buyer');
  expect(buyer).toBeTruthy();
  const forged = { ...buyer, company_name: 'Forged Browser Company', country: 'Sudan', email: 'forged@example.test', emails_list: ['forged@example.test'] };
  const payload = { dataset: 'contacts', title: 'Stored contacts', format: 'csv', report_type: 'importer', records: [forged] };
  const download = await request.post('/api/export', { data: payload });
  expect(download.status()).toBe(200);
  const csv = await download.text();
  expect(csv).toContain('Authoritative Buyer');
  expect(csv).not.toContain('Other Buyer');
  expect(csv).not.toContain('Forged Browser Company');
  expect(csv).not.toContain('forged@example.test');
  for (const records of [[], [{ id: 'missing' }], [buyer, { id: 'missing' }], [{ ...buyer, id: undefined }], [buyer, buyer]]) {
    const response = await request.post('/api/export', { data: { ...payload, records } });
    expect(response.status()).toBe(400);
    expect((await response.json()).code).toBe('INVALID_EXPORT_REQUEST');
  }
  const other = contacts.find((row: { company_name: string }) => row.company_name === 'Other Buyer');
  for (const selectedRows of [[buyer.id, 'missing'], [buyer.id, buyer.id], [other.id], [null]]) {
    const mixed = await request.post('/api/export', { data: { ...payload, records: [buyer], selectedRows } });
    expect(mixed.status()).toBe(400);
    expect((await mixed.json()).code).toBe('INVALID_EXPORT_REQUEST');
  }
  const selectedObject = await request.post('/api/export', { data: { ...payload, records: [buyer, other], selectedRows: [forged] } });
  expect(selectedObject.status()).toBe(200);
  const selectedCsv = await selectedObject.text();
  expect(selectedCsv).toContain('Authoritative Buyer');
  expect(selectedCsv).not.toContain('Other Buyer');
  expect(selectedCsv).not.toContain('Forged Browser Company');
  expect(selectedCsv).not.toContain('forged@example.test');
});
