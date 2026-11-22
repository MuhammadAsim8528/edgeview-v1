import assert from 'node:assert/strict';
import { parseTradeNumeric } from '../value_normalization';

assert.equal(parseTradeNumeric(1250.5), 1250.5);
assert.equal(parseTradeNumeric(0), 0);
assert.equal(parseTradeNumeric('1,250.50'), 1250.5);
assert.equal(parseTradeNumeric('$ 1,250.50 USD'), 1250.5);
assert.equal(parseTradeNumeric('1e3'), 1000);
assert.equal(parseTradeNumeric('-1'), -1);
assert.equal(parseTradeNumeric('(USD 1,250.50)'), -1250.5);
assert.equal(parseTradeNumeric('2.5 kg'), 2.5);
for (const invalid of ['', 'N/A', '12.3.4', '12-3', '12abc34', '1,23', '1 234', NaN, Infinity, null, undefined, {}, []]) {
  assert.equal(parseTradeNumeric(invalid), null, `${String(invalid)} must not become a trade number`);
}
console.log('PASS conservative trade numeric normalization');
