import assert from 'node:assert/strict';
import { testHunterKey, testSerperKey } from '../settings';
import { GroqProvider } from '../ai_providers';

for (const test of [testHunterKey, testSerperKey]) {
  for (const payload of [{}, { error: { message: 'controlled error' } }]) {
    global.fetch = (async () => Response.json(payload)) as typeof fetch;
    assert.equal((await test('synthetic-diagnostic-key')).success, false, 'HTTP 200 alone cannot certify provider health');
  }
  global.fetch = (async () => new Response('<html>broken upstream</html>')) as typeof fetch;
  assert.equal((await test('synthetic-diagnostic-key')).success, false);
  global.fetch = (async () => new Response('', { status: 401 })) as typeof fetch;
  assert.match((await test('synthetic-diagnostic-key')).message, /Unauthorized/);
  global.fetch = (async () => { throw new Error('Empty key must not make a request'); }) as typeof fetch;
  assert.equal((await test('')).success, false);
}
global.fetch = (async () => Response.json({ organic: [] })) as typeof fetch;
assert.equal((await testSerperKey('synthetic-diagnostic-key')).success, true);
global.fetch = (async () => Response.json({ data: { emails: [] } })) as typeof fetch;
assert.equal((await testHunterKey('synthetic-diagnostic-key')).success, true);
for (const payload of [{}, { error: 'controlled failure' }, { data: [null] }]) {
  global.fetch = (async () => Response.json(payload)) as typeof fetch;
  assert.equal((await GroqProvider.testConnection('synthetic-diagnostic-key')).success, false, 'invalid model envelopes cannot become healthy empty catalogs');
}
for (const payload of [{ data: [{ id: 'synthetic-model' }] }, ['synthetic-model']]) {
  global.fetch = (async () => Response.json(payload)) as typeof fetch;
  assert.equal((await GroqProvider.testConnection('synthetic-diagnostic-key', 'synthetic-model')).success, true);
}
console.log('PASS diagnostic health requires valid provider payloads, not only HTTP success');
