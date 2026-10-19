import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { parseFile } from '../parsers';
import { generateXlsxWorkbook } from '../export_manager';

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Input');
sheet.addRow(['Company', 'Country', 'Amount']);
sheet.addRow(['Slim Pharmaceuticals', 'Sri Lanka', 1250]);
const input = Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
const parsed = await parseFile('fixture.xlsx', input);
assert.equal(parsed.file_type, 'Excel');
assert.deepEqual(parsed.columns, ['Company', 'Country', 'Amount']);
assert.equal(parsed.rows.length, 1);
assert.equal(parsed.rows[0].Company, 'Slim Pharmaceuticals');
assert.equal(parsed.rows[0].Amount, 1250);

const legacy = await parseFile('fixture.xls', Buffer.from('not-a-legacy-workbook'));
assert.match(legacy.error || '', /not accepted/i);

const output = await generateXlsxWorkbook('Safe Export', [
  { key: 'company', header: 'Company' },
  { key: 'note', header: 'Note' },
], [{ company: 'Example Pharma', note: '=HYPERLINK("https://evil.example")' }]);
const check = new ExcelJS.Workbook();
await check.xlsx.load(output as any);
assert.equal(check.worksheets[0].getCell('B2').value, "'=HYPERLINK(\"https://evil.example\")");
console.log('PASS safe XLSX parsing and export');
