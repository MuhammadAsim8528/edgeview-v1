import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyLegacyRuntimeData } from '../legacy_data_migration';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-empty-legacy-db-'));
const source = path.join(root, 'source');
const destination = `${source}-data`;
try {
  fs.mkdirSync(path.join(source, 'data', 'v1-runs'), { recursive: true });
  fs.mkdirSync(path.join(source, 'uploads'));
  fs.writeFileSync(path.join(source, 'edgeview.db'), Buffer.alloc(0));
  fs.writeFileSync(path.join(source, 'edgeview_db.json'), '[]');
  fs.writeFileSync(path.join(source, 'config.json'), '{}');
  fs.writeFileSync(path.join(source, 'data', 'installation.json'), '{"installation_id":"550e8400-e29b-41d4-a716-446655440000"}');
  const before = fs.readdirSync(source, { recursive: true }).sort();
  await assert.rejects(copyLegacyRuntimeData(source, destination), /LEGACY_MIGRATION_REFUSED/);
  assert.equal(fs.existsSync(destination), false, 'empty source DB is refused before destination creation');
  assert.equal(fs.readFileSync(path.join(source, 'edgeview.db')).length, 0, 'original zero-length source is retained byte-for-byte');
  assert.deepEqual(fs.readdirSync(source, { recursive: true }).sort(), before, 'refusal adds no migration journal or source files');
  assert.equal(fs.existsSync(path.join(source, 'edgeview.db.lock.maintenance')), false, 'maintenance admission is released');
  console.log('PASS L01 zero-length legacy DB refusal preserves originals and creates no accepted destination');
} finally {
  assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
