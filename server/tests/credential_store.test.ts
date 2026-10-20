import assert from 'node:assert/strict';
import { CREDENTIAL_FIELDS, CredentialStorageError, decodeCredentials, encodeCredentials } from '../credential_store';

const fixture = Object.fromEntries(CREDENTIAL_FIELDS.map((key, index) => [key, `synthetic-only-${index}-never-a-real-key`]));
const legacy = { ...fixture, serper_enabled: false, nvidia_model: 'example/model' };
assert.deepEqual(decodeCredentials(legacy), legacy, 'legacy reads remain non-mutating');
if (process.platform === 'win32') {
  const encoded = encodeCredentials(legacy);
  const disk = JSON.stringify(encoded);
  for (const secret of Object.values(fixture)) assert.equal(disk.includes(secret), false);
  for (const field of CREDENTIAL_FIELDS) assert.equal(Object.hasOwn(encoded, field), false);
  assert.deepEqual(decodeCredentials(encoded), legacy);
  assert.deepEqual(decodeCredentials(encoded), legacy, 'cached reads preserve all values');
  assert.throws(() => decodeCredentials({ ...encoded, serper_api_key: 'mixed-plaintext' }), CredentialStorageError);
  const corrupt = structuredClone(encoded);
  (corrupt._edgeview_credentials as Record<string, unknown>).ciphertext = 'AAAA';
  assert.throws(() => decodeCredentials(corrupt), CredentialStorageError);
}
for (const envelope of [null, {}, { version: 2 }, { version: 1, kind: 'plaintext', ciphertext: 'AAAA' }]) {
  assert.throws(() => decodeCredentials({ _edgeview_credentials: envelope, ...fixture }), CredentialStorageError);
}
const empty = Object.fromEntries(CREDENTIAL_FIELDS.map(key => [key, '']));
assert.deepEqual(encodeCredentials(empty), empty, 'explicit empty values stay empty');
console.log('Credential storage: synthetic DPAPI round-trip, plaintext exclusion, malformed envelope and compatibility checks passed.');
