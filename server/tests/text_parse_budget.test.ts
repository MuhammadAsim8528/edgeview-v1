import assert from 'node:assert/strict';
import { parseFile, parseNVL } from '../parsers';
import { TextParseBudget, TEXT_PARSE_LIMITS } from '../text_parse_budget';

const wide = Array.from({ length: TEXT_PARSE_LIMITS.columns + 1 }, (_, i) => `Field${i}`).join(',');
for (const ext of ['csv', 'tsv', 'txt']) {
  const delimiter = ext === 'tsv' ? '\t' : ',';
  const parsed = await parseFile(`wide.${ext}`, Buffer.from(`${wide.replaceAll(',', delimiter)}\nx\nx`));
  assert.match(parsed.error || '', /safe parsing limits/);
  assert.deepEqual(parsed.rows, []);
  const later = await parseFile(`late.${ext}`, Buffer.from(`Field\nx\n${wide.replaceAll(',', delimiter)}`));
  assert.match(later.error || '', /safe parsing limits/);
  assert.deepEqual(later.rows, [], 'a valid prefix of the table must never become a partial success');
}
assert.throws(() => parseNVL(`IMPORTER,${wide}\nx`), { name: 'TextParseLimitError' });
const nvl = await parseFile('wide.nvl', Buffer.from(`IMPORTER,${wide}\nx`));
assert.match(nvl.error || '', /safe parsing limits/, 'NVL catches cannot turn a limit into fallback success');
assert.deepEqual(nvl.rows, []);

const budget = new TextParseBudget();
const accepted = Math.floor(TEXT_PARSE_LIMITS.cells / (TEXT_PARSE_LIMITS.columns + 24));
for (let i = 0; i < accepted; i++) budget.addRow(TEXT_PARSE_LIMITS.columns);
assert.throws(() => budget.addRow(TEXT_PARSE_LIMITS.columns), { name: 'TextParseLimitError' });
const tooManyNarrow = await parseFile('cells.csv', Buffer.from(`Field\n${'x\n'.repeat(Math.floor(TEXT_PARSE_LIMITS.cells / 25) + 1)}`));
assert.match(tooManyNarrow.error || '', /safe parsing limits/);
assert.deepEqual(tooManyNarrow.rows, []);

// Representative existing trade-file shape, synthetic and parser-only.
const header = 'BE_DATE,ITEM,IMPORTER,EXPORTER,TOT_FC,AGENT_NAME,COUNTRY,HS_CODE,BE_LINK';
const line = '2026-01-01,"Product, quoted",Buyer,Seller,100,Agent,Kenya,3004,ref';
const normal = await parseFile('normal.csv', Buffer.from(`${header}\n${`${line}\n`.repeat(17432)}`));
assert.equal(normal.error, undefined);
assert.equal(normal.rows.length, 17432);
assert.equal(normal.rows[0].ITEM, 'Product, quoted');
assert.equal(normal.rows[17431].IMPORTER, 'Buyer');
const duplicate = await parseFile('duplicate.csv', Buffer.from('A,,A\none,two,three\nx'));
assert.equal(duplicate.error, undefined);
assert.equal(duplicate.rows[0].A, 'three');
assert.equal(duplicate.rows[0].Column_2, 'two');
assert.equal(duplicate.rows[1].Column_2, '');
const normalNvl = parseNVL('BE_DATE,ITEM,IMPORTER,EXPORTER,TOT_FC,AGENT_NAME\n2026-01-01,Product,Buyer,Seller,100,Agent');
assert.equal(normalNvl.rows.length, 1);
assert.equal(normalNvl.rows[0].Importer, 'Buyer');
console.log('PASS bounded CSV/TSV/TXT/NVL expansion, no partial success, and 17432-row compatibility');
