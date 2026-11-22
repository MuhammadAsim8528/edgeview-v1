import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { deflateRawSync } from 'node:zlib';
import { parseDBFBuffer, parseFile, standardizeDate } from '../parsers';
import { historyInsertValues } from '../history_row_projection';
import { computeTotalValue } from '../sqlite_persistence';
import { parseTradeNumeric } from '../value_normalization';

// H19: no sign stripping, empty-to-zero conversion, or partial numeric parses.
for (const [input, expected] of [
  [0, 0], ['0', 0], ['$1,234.50', 1234.5], ['-$1,234.50', -1234.5],
  ['USD -2,000.25', -2000.25], ['1,234.50 USD', 1234.5], ['(PKR 3,500)', -3500],
  ['+.5', 0.5], ['1e3', 1000], [Number.MAX_VALUE, Number.MAX_VALUE],
] as const) assert.equal(parseTradeNumeric(input), expected, `valid numeric ${String(input)}`);
for (const input of ['', 'N/A', 'unknown', '12abc34', '1,23', '1,2,3', '1 234', '--1', '(USD -1)',
  'NaN', 'Infinity', '0x10', null, undefined, true, Number.NaN, Number.POSITIVE_INFINITY]) {
  assert.equal(parseTradeNumeric(input), null, `invalid numeric ${String(input)}`);
}
assert.equal(standardizeDate('20240229'), '2024-02-29');
assert.equal(standardizeDate('31/12/2024'), '2024-12-31');
assert.equal(standardizeDate('12/31/2024'), '2024-12-31');
assert.equal(standardizeDate('02/03/2024'), '2024-03-02');
for (const invalid of ['2023-02-29', '2024-13-01', '20240230', '02/30/2024', '2023-02-29T10:00:00Z', 'not a date']) {
  assert.equal(standardizeDate(invalid), invalid, `invalid date must remain raw: ${invalid}`);
}

// H08 + H19: delimiters and newlines inside quotes, escaped quotes, and strict aliases.
const csvText = [
  '"Importer";"Item";"Notes";"TOT_FC";"BE_DATE"',
  '"Buyer; ""A""";"Line, one\r\nLine; two";"He said ""hello""\r\nnext";"USD 1,234.50";"2023-02-29"',
  '"Zero Buyer";"Comma, tab\tand; delimiter";"Second ""quoted"" note";"0";"20240229"',
  '"Invalid Buyer";"Raw invalid";"Do not partially coerce";"12abc34";"2023-02-29"',
].join('\r\n');
const csv = await parseFile('quoted.csv', Buffer.from(csvText));
assert.equal(csv.error, undefined);
assert.equal(csv.rows.length, 3);
assert.equal(csv.rows[0].Importer, 'Buyer; "A"');
assert.equal(csv.rows[0].Item, 'Line, one\r\nLine; two');
assert.equal(csv.rows[0].Notes, 'He said "hello"\r\nnext');
assert.equal(csv.rows[0]['Total Value (USD)'], 1234.5);
assert.equal(csv.rows[0].Date, '2023-02-29');
assert.equal(csv.rows[1]['Total Value (USD)'], 0);
assert.equal(csv.rows[1].Date, '2024-02-29');
assert.equal(csv.rows[2].TOT_FC, '12abc34');
assert.equal(csv.rows[2]['Total Value (USD)'], '12abc34');
assert.equal(computeTotalValue(csv.rows), 1234.5, 'invalid and zero values produce accurate persisted metadata');
assert.match((await parseFile('broken.csv', Buffer.from('Importer,Item\n"unterminated,value'))).error || '', /unterminated/i);

// M09: key-value records are recognized before whitespace/tabular parsing.
const nvl = await parseFile('records.nvl', Buffer.from([
  'BE_DATE = "20240229"', 'ITEM = "Item = with equals"', 'IMPORTER = "First Buyer"',
  'EXPORTER = "First Seller"', 'AGENT_NAME = "Agent One"', 'TOT_FC = "(USD 1,250.50)"', '',
  'BE_DATE = "2023-02-29"', 'ITEM = "Second item"', 'IMPORTER = "Second Buyer"',
  'EXPORTER = "Second Seller"', 'AGENT_NAME = "Agent Two"', 'TOT_FC = "0"',
].join('\r\n')));
assert.equal(nvl.error, undefined);
assert.equal(nvl.rows.length, 2);
assert.equal(nvl.rows[0].Item, 'Item = with equals');
assert.equal(nvl.rows[0].IMPORTER, 'First Buyer');
assert.equal(nvl.rows[0].Date, '2024-02-29');
assert.equal(nvl.rows[0]['Total Value (USD)'], -1250.5);
assert.equal(nvl.rows[1].Date, '2023-02-29');
assert.equal(nvl.rows[1]['Total Value (USD)'], 0);

// H07 + H19: rich text, hyperlinks, formulas, and real Excel dates become scalars.
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Synthetic');
sheet.addRow(['Importer', 'Item', 'Web', 'TOT_FC', 'BE_DATE', 'Notes']);
sheet.addRow([
  { text: 'Linked Buyer', hyperlink: 'https://example.invalid/buyer' },
  { richText: [{ text: 'Rich ' }, { text: 'Item', font: { bold: true } }] },
  { text: 'Official label', hyperlink: 'https://example.invalid/' },
  { formula: '1000+250.5', result: 1250.5 },
  new Date('2024-02-29T12:00:00.000Z'),
  { richText: [{ text: 'first' }, { text: ' second' }] },
]);
const rich = await parseFile('rich.xlsx', Buffer.from(await workbook.xlsx.writeBuffer()));
assert.equal(rich.error, undefined);
assert.equal(rich.rows.length, 1);
assert.equal(rich.rows[0].Importer, 'Linked Buyer');
assert.equal(rich.rows[0].Item, 'Rich Item');
assert.equal(rich.rows[0].Web, 'Official label');
assert.equal(rich.rows[0].Notes, 'first second');
assert.equal(rich.rows[0]['Total Value (USD)'], 1250.5);
assert.equal(rich.rows[0].Date, '2024-02-29');
for (const value of Object.values(rich.rows[0])) assert.equal(typeof value === 'object' && value !== null, false);
const wideWorkbook = new ExcelJS.Workbook();
wideWorkbook.addWorksheet('Wide').addRow(Array.from({ length: 513 }, (_, index) => `Column ${index + 1}`));
const wideResult = await parseFile('wide.xlsx', Buffer.from(await wideWorkbook.xlsx.writeBuffer()));
assert.match(wideResult.error || '', /512|safe parsing limits/i);

// H06: every canonical history alias survives, including numeric strings and QTY.
assert.deepEqual(historyInsertValues({
  BE_LINK: 'BE-1', BE_DATE: '2024-02-29', HS_CODE: '3004.90', ITEM: 'Product', IMPORTER: 'Buyer',
  EXPORTER: 'Seller', COUNTRY: 'Kenya', TOT_FC: 'USD 1,250.50', QTY: '2', UNT: 'PCS', AGENT_NAME: 'Agent',
}, 'source.csv', 'file-1'), ['BE-1', '2024-02-29', '3004.90', 'Product', 'Buyer', 'Seller', 'Kenya', 1250.5, 2, 'PCS', 'Agent', 'source.csv', 'file-1']);

// M08: reject declared ZIP expansion before ExcelJS or Mammoth sees the bytes.
function archiveWithDeclaredSize(expandedBytes: number, entryName: string, payload?: Buffer): Buffer {
  const name = Buffer.from(entryName);
  const compressed = payload ? deflateRawSync(payload) : Buffer.alloc(0);
  const method = payload ? 8 : 0;
  const local = Buffer.alloc(30 + name.length);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8);
  local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(expandedBytes, 22);
  name.copy(local, 30);
  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(method, 10);
  central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(expandedBytes, 24);
  central.writeUInt16LE(name.length, 28); name.copy(central, 46);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(local.length + compressed.length, 16);
  return Buffer.concat([local, compressed, central, end]);
}
for (const [name, entry] of [['bounded.xlsx', 'xl/workbook.xml'], ['bounded.docx', 'word/document.xml']] as const) {
  const result = await parseFile(name, archiveWithDeclaredSize(64 * 1024 * 1024 + 1, entry));
  assert.match(result.error || '', /expanded-size|invalid directory/i);
}
const understated = await parseFile('understated.xlsx',
  archiveWithDeclaredSize(1, 'xl/workbook.xml', Buffer.alloc(1024 * 1024)));
assert.ok(understated.error, 'actual inflation is bounded even when central-directory size is understated');
const dbfHeaderLength = 32 + 513 * 32 + 1;
const wideDbf = Buffer.alloc(dbfHeaderLength + 1);
wideDbf.writeUInt16LE(dbfHeaderLength, 8); wideDbf.writeUInt16LE(1, 10); wideDbf[dbfHeaderLength - 1] = 0x0d;
for (let index = 0; index < 513; index += 1) {
  const offset = 32 + index * 32;
  wideDbf.write(`F${index}`, offset, 'ascii'); wideDbf[offset + 11] = 78; wideDbf[offset + 16] = 1;
}
assert.throws(() => parseDBFBuffer(wideDbf), /safe parsing limits/);

console.log('PASS H06/H07/H08/H19/M08/M09 parser, normalization, history aliases and allocation regressions');
