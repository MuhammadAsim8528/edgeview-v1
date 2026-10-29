import assert from 'assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NvidiaProvider, GroqProvider, fetchProviderModels } from '../ai_providers';
import { resolveApiKey, maskKey } from '../settings';
import { validateHttpHeaderValue, assertSafeHeaderValue } from '../utils/header_encoder';

/**
 * P0 REGRESSION — BYTESTRING CREDENTIAL INCIDENT (U+2022 / code point 8226)
 *
 * Original failure:
 *   "Cannot convert argument to a ByteString because the character at index 11 has a
 *    value of 8226 which is greater than 255."
 *
 * Root signature: `Authorization: Bearer nvap••••••••XXXX` where the masked NVIDIA
 * key (maskKey output = first4 + '••••••••' + last4) was placed directly into the
 * HTTP header. Index 11 = 'Bearer ' (7) + 'nvap' (4) = first bullet char.
 *
 * This test must FAIL (throw) if a masked credential can ever reach an outbound
 * fetch header, and must reproduce the exact original code-point signature.
 */

const MASKED_NVIDIA = maskKey('nvapi-' + 'TEST-FIXTURE-1111-2222-3333-XXXX');
const MASKED_GROQ = 'gsk_••••••••2G9u';
const STORED = 'TEST-FIXTURE-STORED-NVIDIA-KEY';

function firstBulletIndex(value: string): number {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) === 8226) return i;
  }
  return -1;
}

console.log('--- P0 BYTESTRING CREDENTIAL REGRESSION ---');

// 1. Reproduce the exact original failure signature at index 11.
const authValue = `Bearer ${MASKED_NVIDIA}`;
const bulletIdx = firstBulletIndex(authValue);
assert.strictEqual(bulletIdx, 11, `Expected first bullet at index 11, got ${bulletIdx}`);
console.log(`✅ Test 1: Reproduced original signature — 'Bearer nvap••••••••XXXX' bullet at index ${bulletIdx} (U+2022)`);

// 2. The exact header value MUST be rejected by the transport guard.
const check = validateHttpHeaderValue(authValue, 'NVIDIA API key');
assert.strictEqual(check.valid, false, 'Masked NVIDIA credential must be rejected at transport boundary');
assert.strictEqual(check.invalidCharIndex, 11, `Guard must flag index 11, got ${check.invalidCharIndex}`);
assert.strictEqual(check.invalidCodePoint, 'U+2022', `Guard must cite U+2022, got ${check.invalidCodePoint}`);
console.log('✅ Test 2: Transport guard rejects the exact masked credential at index 11 (U+2022)');

// 3. assertSafeHeaderValue must throw the clean controlled error, not the undici crash.
try {
  assertSafeHeaderValue(authValue, 'NVIDIA API key');
  assert.fail('Should have thrown for masked credential');
} catch (err: any) {
  assert.ok(
    err.message.includes('invalid HTTP-header character at index 11 (U+2022)'),
    `Unexpected error message: ${err.message}`
  );
  assert.ok(!err.message.includes('ByteString'), 'Must never surface the undici ByteString wording');
}
console.log('✅ Test 3: Clean controlled rejection — no ByteString wording');

// 4. resolveApiKey must NEVER return a masked value (secret-state resolution).
const resolved = resolveApiKey(MASKED_NVIDIA, STORED);
assert.strictEqual(resolved, STORED, 'Masked input must resolve to the stored secret');
assert.ok(!resolved.includes('•'), 'Resolved credential must contain no bullet chars');
const resolvedCheck = validateHttpHeaderValue(`Bearer ${resolved}`, 'Authorization header');
assert.strictEqual(resolvedCheck.valid, true, 'Resolved secret must be header-safe');
console.log('✅ Test 4: resolveApiKey returns stored secret — never masked');

// 5. Provider listModels with a raw masked key must throw the guard error BEFORE fetch.
async function assertProviderGuard() {
  try {
    await NvidiaProvider.listModels(MASKED_NVIDIA);
    assert.fail('NvidiaProvider.listModels should reject masked key');
  } catch (err: any) {
    assert.ok(err.message.includes('U+2022'), `NVIDIA guard message: ${err.message}`);
  }
  try {
    await GroqProvider.listModels(MASKED_GROQ);
    assert.fail('GroqProvider.listModels should reject masked key');
  } catch (err: any) {
    assert.ok(err.message.includes('U+2022'), `Groq guard message: ${err.message}`);
  }
  console.log('✅ Test 5: Both provider listModels reject masked keys at the transport boundary');
}
await assertProviderGuard();

// 6. Exercise the real settings resolver using synthetic storage only. A refused
// request is not a successful resolution; every unexpected failure must fail CI.
const originalConfig = process.env.EDGEVIEW_CONFIG;
const originalCatalog = NvidiaProvider.listModels;
const isolatedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-bytestring-'));
const syntheticStored = 'nvapi-SYNTHETIC0000000000000000000000';
let catalogCalls = 0;
try {
  process.env.EDGEVIEW_CONFIG = path.join(isolatedRoot, 'config.json');
  fs.writeFileSync(process.env.EDGEVIEW_CONFIG, JSON.stringify({ nvidia_api_key: syntheticStored, nvidia_base_url: '' }));
  NvidiaProvider.listModels = async key => {
    catalogCalls++;
    assert.strictEqual(key, syntheticStored, 'catalog must receive the synthetic stored secret, never the mask');
    assertSafeHeaderValue(`Bearer ${key}`, 'Authorization header');
    return [{ id: 'synthetic-model', name: 'Synthetic model' }];
  };
  const result = await fetchProviderModels('nvidia', maskKey(syntheticStored), undefined, true);
  assert.strictEqual(catalogCalls, 1, 'the settings-to-provider path must actually execute');
  assert.deepStrictEqual(result.models.map(model => model.id), ['synthetic-model']);
  assert.strictEqual(result.cached, false, 'cached output must not hide a broken resolver');
  console.log('PASS Test 6: synthetic stored credential reached the catalog boundary; no live provider contacted');
} finally {
  NvidiaProvider.listModels = originalCatalog;
  if (originalConfig === undefined) delete process.env.EDGEVIEW_CONFIG;
  else process.env.EDGEVIEW_CONFIG = originalConfig;
  assert.strictEqual(path.dirname(fs.realpathSync(isolatedRoot)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(isolatedRoot, { recursive: true, force: true });
}

console.log('PASS ByteString credential regression (isolated catalog; real delivery NOT VERIFIED)');
