import assert from 'assert';
import { validateHttpHeaderValue, assertSafeHeaderValue } from '../utils/header_encoder';

console.log('--- RUNNING PROVIDER TRANSPORT BOUNDARY UNIT TESTS ---');

// Test 1: Normal ASCII key
const test1 = validateHttpHeaderValue('Bearer nvapi-1234567890abcdef', 'NVIDIA API key');
assert.strictEqual(test1.valid, true, 'Valid ASCII key should pass');
console.log('✅ Test 1 Passed: ASCII key verified');

// Test 2: Unicode Bullet U+2022 (Character 8226)
const test2 = validateHttpHeaderValue('Bearer ••••••••', 'NVIDIA API key');
assert.strictEqual(test2.valid, false, 'Bullet character must fail validation');
assert.strictEqual(test2.invalidCharIndex, 7, 'First bullet character index should be 7 in string');
assert.strictEqual(test2.invalidCodePoint, 'U+2022', 'Code point must be U+2022');
assert.ok(test2.errorMessage?.includes('invalid HTTP-header character'), 'Error message must be human actionable');
console.log('✅ Test 2 Passed: Unicode bullet character U+2022 detected at index 7');

// Test 3: En dash U+2013 & Em dash U+2014
const test3 = validateHttpHeaderValue('Bearer key–with–endash', 'NVIDIA API key');
assert.strictEqual(test3.valid, false, 'En dash must fail header validation');
assert.strictEqual(test3.invalidCodePoint, 'U+2013');

const test3b = validateHttpHeaderValue('Bearer key—with—emdash', 'NVIDIA API key');
assert.strictEqual(test3b.valid, false, 'Em dash must fail header validation');
assert.strictEqual(test3b.invalidCodePoint, 'U+2014');
console.log('✅ Test 3 Passed: En dash U+2013 and Em dash U+2014 detected');

// Test 4: Urdu & Chinese Unicode characters
const test4 = validateHttpHeaderValue('Bearer کلید_کید', 'NVIDIA API key');
assert.strictEqual(test4.valid, false, 'Urdu text must fail header validation');

const test4b = validateHttpHeaderValue('Bearer 密钥_key', 'NVIDIA API key');
assert.strictEqual(test4b.valid, false, 'Chinese text must fail header validation');
console.log('✅ Test 4 Passed: Non-Latin scripts detected and blocked from HTTP headers');

// Test 5: CRLF injection & NUL byte
const test5 = validateHttpHeaderValue('Bearer key\r\nX-Injected: true', 'NVIDIA API key');
assert.strictEqual(test5.valid, false, 'CRLF injection must fail header validation');

const test5b = validateHttpHeaderValue('Bearer key\0null', 'NVIDIA API key');
assert.strictEqual(test5b.valid, false, 'Null byte must fail header validation');
console.log('✅ Test 5 Passed: CRLF injection and Null bytes blocked');

// Test 6: Exception throwing helper
try {
  assertSafeHeaderValue('Bearer ••••••••', 'NVIDIA API key');
  assert.fail('Should have thrown error for bullet key');
} catch (err: any) {
  assert.ok(err.message.includes('NVIDIA API key contains an invalid HTTP-header character at index 7 (U+2022)'));
  console.log('✅ Test 6 Passed: Exception message format verified clean');
}

console.log('🎉 ALL PROVIDER TRANSPORT BOUNDARY TESTS PASSED 100%');
