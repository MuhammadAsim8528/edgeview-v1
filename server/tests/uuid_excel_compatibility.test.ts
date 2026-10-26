import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { parseFile } from '../parsers';

const require = createRequire(import.meta.url);
const excelRequire = createRequire(require.resolve('exceljs'));
const uuid = excelRequire('uuid');
const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
// Attack the installed dependency resolved by ExcelJS, not a separate root copy.
for (const name of ['v3', 'v5', 'v6']) {
  for (const [length, offset] of [[8, 0], [16, 1], [16, -1]]) {
    const buffer = new Uint8Array(length).fill(0x5a);
    assert.throws(() => name === 'v6' ? uuid.v6({}, buffer, offset)
      : uuid[name]('synthetic', namespace, buffer, offset), RangeError,
      `${name} must reject invalid output-buffer bounds`);
    assert.ok(buffer.every(byte => byte === 0x5a), 'rejected writes cannot partially alter the buffer');
  }
  assert.match(name === 'v6' ? uuid.v6() : uuid[name]('synthetic', namespace), /^[a-f0-9-]{36}$/i, 'ordinary string generation preserved');
}
assert.equal(excelRequire('uuid/package.json').version, '11.1.1');
assert.match(uuid.v4(), /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Synthetic');
sheet.addRow(['Company', 'Amount']);
sheet.addRow(['Synthetic Buyer', 10]);
sheet.addRow(['Synthetic Supplier', 20]);
sheet.addConditionalFormatting({ ref: 'B2:B3', rules: [{ type: 'iconSet', iconSet: '3Stars', priority: 1,
  cfvo: [{ type: 'percent', value: 0 }, { type: 'percent', value: 33 }, { type: 'percent', value: 67 }] }] });
const bytes = Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
const zipped = await JSZip.loadAsync(bytes);
const xml = await zipped.file('xl/worksheets/sheet1.xml')!.async('string');
assert.match(xml, /<x14:cfRule\b[^>]*id="\{[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}\}"/,
  'actual extended conditional formatting exercises ExcelJS CommonJS UUID v4');
const reopened = new ExcelJS.Workbook();
await reopened.xlsx.load(bytes as any);
assert.equal(reopened.worksheets[0].getCell('B3').value, 20);
const roundTripZip = await JSZip.loadAsync(Buffer.from(await reopened.xlsx.writeBuffer() as ArrayBuffer));
assert.match(await roundTripZip.file('xl/worksheets/sheet1.xml')!.async('string'), /<x14:cfRule\b[^>]*type="iconSet"/,
  'extended formatting survives reload and reserialization');
const parsed = await parseFile('synthetic-conditional.xlsx', bytes);
assert.deepEqual(parsed.columns, ['Company', 'Amount']);
assert.equal(parsed.rows.length, 2);
assert.equal(parsed.rows[0].Company, 'Synthetic Buyer');
assert.equal(parsed.rows[1].Amount, 20);
console.log('PASS resolved UUID bounds refusal and valid generation; real extended-CF XLSX serialization/reload/application import');
