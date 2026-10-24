import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getInstallationId, getInstallationIdentityPath, readOrCreateInstallationId } from '../install_identity';
import { getProjectRoot } from '../db_paths';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-install-id-'));
const file = path.join(dir, 'installation.json');
// Isolate the writable runtime files before any accessor resolves them.
Object.assign(process.env, { NODE_ENV: 'test', EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: dir, EDGEVIEW_JSON_DB: path.join(dir, 'rows.json') });
try {
  const first = readOrCreateInstallationId(file);
  assert.match(first, UUID, 'fresh identity is a UUID v4');
  assert.equal(readOrCreateInstallationId(file), first, 'restart returns the persisted identity');

  fs.writeFileSync(file, 'not json at all');
  const afterCorrupt = readOrCreateInstallationId(file);
  assert.match(afterCorrupt, /^[0-9a-f]{8}-/i);
  assert.equal(readOrCreateInstallationId(file), afterCorrupt, 'corrupt file is replaced and stable');

  fs.writeFileSync(file, JSON.stringify({ installation_id: 'not-a-uuid' }));
  const afterInvalid = readOrCreateInstallationId(file);
  assert.notEqual(afterInvalid, 'not-a-uuid', 'invalid identity shape must not be reused');

  fs.unlinkSync(file);
  const afterReset = readOrCreateInstallationId(file);
  assert.notEqual(afterReset, afterInvalid, 'deleting the identity file resets the installation identity');

  // Test processes must not mint an identity inside the real installation, and the
  // cached accessor must agree with the isolated path the same process resolves.
  const productionIdentity = path.join(getProjectRoot(), 'data', 'installation.json');
  const before = fs.existsSync(productionIdentity) ? fs.readFileSync(productionIdentity, 'utf8') : null;
  const isolated = getInstallationIdentityPath();
  assert.equal(isolated, path.join(dir, 'installation.json'), 'identity follows the isolated JSON store directory');
  const id = getInstallationId();
  assert.match(id, UUID, 'accessor mints a UUID v4');
  assert.equal(getInstallationId(), id, 'accessor caches the identity for the process');
  assert.equal(fs.readFileSync(isolated, 'utf8').includes(id), true, 'identity is persisted where the accessor resolved it');
  assert.equal(fs.existsSync(productionIdentity) ? fs.readFileSync(productionIdentity, 'utf8') : null, before, 'test process must not create or rewrite the production identity');

  console.log('PASS installation identity: creation, restart, corruption, reset and test isolation behave');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
