import assert from 'node:assert/strict';
import { parseFile, parseNVL, standardizeDate } from '../parsers';

// RFC 4180-style CSV: quotes may contain delimiters, escaped quotes and CRLF.
const csv = await parseFile('quoted.csv', Buffer.from([
  'Importer,Country,Item',
  '"Acme, Ltd",Kenya,"First line\r\nSecond ""quoted"" line"',
  '',
].join('\r\n')));
assert.equal(csv.rows.length, 1, 'one logical CSV row may span physical lines');
assert.deepEqual(
  [csv.rows[0].Importer, csv.rows[0].Country, csv.rows[0].Item],
  ['Acme, Ltd', 'Kenya', 'First line\r\nSecond "quoted" line'],
);

// Semicolons inside quoted fields must not be detected as the record delimiter
const csvSemicolon = await parseFile('semicolon_quoted.csv', Buffer.from([
  'Importer,Country,Item',
  'Acme Ltd,Kenya,"First; Second; Third"',
].join('\r\n')));
assert.deepEqual(csvSemicolon.columns, ['Importer', 'Country', 'Item'], 'CSV must retain comma delimiter');
assert.equal(csvSemicolon.rows.length, 1);
assert.equal(csvSemicolon.rows[0].Item, 'First; Second; Third');

// This is the key-value NVL format documented by the parser, not a table.
const nvl = parseNVL([
  'BE_DATE = "20260101"',
  'IMPORTER = "First Pharma"',
  '',
  '---',
  'BE_DATE = "20260102"',
  'IMPORTER = "Second Pharma"',
  '',
].join('\r\n'));
assert.equal(nvl.rows.length, 2, 'blank lines and --- delimit complete key-value records');
assert.deepEqual(nvl.rows.map(row => [row.BE_DATE, row.IMPORTER, row.Date, row.Importer]), [
  ['20260101', 'First Pharma', '20260101', 'First Pharma'],
  ['20260102', 'Second Pharma', '20260102', 'Second Pharma'],
]);

// Keep the existing tabular NVL path intact.
const table = parseNVL('BE_DATE\tIMPORTER\n20260103\tTable Pharma');
assert.equal(table.rows.length, 1);
assert.equal(table.rows[0].Importer, 'Table Pharma');

// Invalid calendar input must remain visible as raw source, not be silently changed.
assert.equal(standardizeDate('2023/02/31'), '2023/02/31');
assert.equal(standardizeDate('20230231'), '20230231');
assert.equal(standardizeDate('2026-01-15'), '2026-01-15');
console.log('PASS CSV quoted fields, multiline records, key-value NVL boundaries and tabular NVL compatibility');
