import assert from 'node:assert/strict';
import { buildContactBlocksHtml, safeExportHref } from '../export_blocks';

for (const unsafe of [
  null, undefined, 42, {}, '', '   ', '/relative', '//example.test',
  'javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'java\nscript:alert(1)',
  'data:text/html,<script>x</script>', 'VBScript:x', 'file:///C:/private', 'ftp://example.test',
  'https://', 'https://[broken', 'https://bad%00host/', 'https:\\example.test',
  'https://example.test/\tpath', '\nhttps://example.test', 'https://example.test/\u0000',
  'https://example.test/\u007f', 'https&colon;//example.test',
]) assert.equal(safeExportHref(unsafe), null, `must remain inert: ${String(unsafe)}`);

for (const value of [
  'http://example.test', 'HTTPS://example.test/one?a=1&b=2',
  'https://例え.テスト/会社?q=دواء', 'https://example.test/" onmouseover="bad()',
  "https://example.test/'><svg/onload=bad()>", 'https://example.test/?q=&quot;bad',
]) {
  assert.equal(safeExportHref(value), value, 'ordinary explicit http(s) value retained');
  const html = buildContactBlocksHtml([{ company_name: 'شركة 医薬品', website: value, linkedin: value }]);
  assert.equal((html.match(/<a /g) || []).length, 2);
  assert.equal((html.match(/rel="noopener noreferrer"/g) || []).length, 2);
  assert.ok(!html.includes('<svg'), 'URL text cannot become a tag');
  assert.ok(!html.includes(' onmouseover="bad()'), 'URL cannot create an event attribute');
  assert.ok(html.includes('شركة 医薬品'));
}
const blank = buildContactBlocksHtml([{}]);
assert.equal((blank.match(/class="empty"/g) || []).length, 6, 'all absent optional displayed fields retain placeholders');
assert.ok(!buildContactBlocksHtml([]).includes('class="card-title"'));
console.log('PASS HTML-block URL scheme/parser/control/quote matrix and ordinary multilingual/empty controls');
