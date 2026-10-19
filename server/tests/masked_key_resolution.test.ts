import assert from 'assert';
import { resolveApiKey, maskKey } from '../settings';
import { validateHttpHeaderValue } from '../utils/header_encoder';

console.log('--- RUNNING MASKED KEY SECRET ARCHITECTURE REGRESSION TESTS ---');

const STORED_SECRET = 'nvapi-' + 'TEST-FIXTURE-STORED-1234';

// Test 1: Masked key input returns stored real secret
const maskedInput1 = 'nvap••••••••6789';
const resolved1 = resolveApiKey(maskedInput1, STORED_SECRET);
assert.strictEqual(resolved1, STORED_SECRET, 'Masked key input must resolve to stored secret');
console.log('✅ Test 1 Passed: Masked key resolves to stored server-side secret');

// Test 2: Full bullet mask returns stored real secret
const maskedInput2 = '••••••••';
const resolved2 = resolveApiKey(maskedInput2, STORED_SECRET);
assert.strictEqual(resolved2, STORED_SECRET, 'Full bullet mask must resolve to stored secret');
console.log('✅ Test 2 Passed: Full bullet mask resolves to stored secret');

// Test 3: New unmasked key input overrides stored key
const newUnmaskedKey = 'nvapi-' + 'TEST-FIXTURE-NEW-999';
const resolved3 = resolveApiKey(newUnmaskedKey, STORED_SECRET);
assert.strictEqual(resolved3, newUnmaskedKey, 'New unmasked key input must override stored secret');
console.log('✅ Test 3 Passed: New unmasked key overrides stored secret');

// Test 4: Empty string input returns stored key
const resolved4 = resolveApiKey('', STORED_SECRET);
assert.strictEqual(resolved4, STORED_SECRET, 'Empty string must fallback to stored secret');
console.log('✅ Test 4 Passed: Empty key falls back to stored secret');

// Test 5: Verify resolved key is Header ByteString safe
const headerCheck = validateHttpHeaderValue(`Bearer ${resolved1}`, 'Authorization header');
assert.strictEqual(headerCheck.valid, true, 'Resolved secret header value must be ByteString safe');
console.log('✅ Test 5 Passed: Resolved credential is ByteString safe (0 bullet characters)');

// Test 6: Verify masked key string directly fails header validation if ever passed
const rawMaskedHeaderCheck = validateHttpHeaderValue(`Bearer ${maskedInput1}`, 'Authorization header');
assert.strictEqual(rawMaskedHeaderCheck.valid, false, 'Raw masked key must fail header validation');
assert.strictEqual(rawMaskedHeaderCheck.invalidCodePoint, 'U+2022');
console.log('✅ Test 6 Passed: Raw masked key rejected by header validation before fetch');

console.log('🎉 ALL MASKED KEY SECRET ARCHITECTURE REGRESSION TESTS PASSED 100%');
