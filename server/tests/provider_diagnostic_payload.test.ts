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
for (const test of [testHunterKey, testSerperKey, (key: string) => GroqProvider.testConnection(key)]) {
  for (const status of [401, 403, 429, 503]) {
    global.fetch = (async () => Response.json({ message: 'controlled upstream failure' }, { status })) as typeof fetch;
    const result = await test('synthetic-diagnostic-key');
    assert.equal(result.success, false);
    assert.equal(result.httpStatus, status, 'HTTP status is transport data, not parsed prose');
  }
  global.fetch = (async () => { throw new Error('controlled network failure'); }) as typeof fetch;
  assert.equal((await test('synthetic-diagnostic-key')).httpStatus, null);
}
global.fetch = (async () => Response.json({ data: [{ id: 'synthetic-model' }] }, { status: 201 })) as typeof fetch;
assert.equal((await GroqProvider.testConnection('synthetic-diagnostic-key')).httpStatus, 201, 'do not invent 200 after any successful request');
console.log('PASS diagnostic transport status survives errors and non-200 success; network failures stay unknown');
