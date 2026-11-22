import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { systemTar } from './system-tar.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-safe-source-'));
const script = path.resolve('scripts/package-safe-source.mjs');
try {
  const write = (relative, body = 'synthetic fixture\n') => {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  };
  for (const file of ['package.json', 'package-lock.json', 'bun.lock', 'src/index.ts']) write(file);
  for (const file of ['pharma_db.json', 'edgeview_db.json', 'config.json', 'config.prev.json', 'edgeview.db', 'edgeview.db.lock', 'nested/pharma_db.json', '.git/config']) write(file, 'synthetic private fixture\n');
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8', timeout: 60_000, windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  const archive = result.stdout.trim();
  assert.equal(path.dirname(archive), path.join(root, '.agent', 'packages'));
  const listed = spawnSync(systemTar(), ['-tf', archive], { cwd: root, encoding: 'utf8', timeout: 30_000, windowsHide: true });
  assert.equal(listed.status, 0, listed.stderr);
  const entries = listed.stdout.split(/\r?\n/).filter(Boolean).map(entry => entry.replace(/^\.\//, '').replace(/\\/g, '/'));
  for (const lock of ['package-lock.json', 'bun.lock']) assert.ok(entries.includes(lock), `${lock} must remain in the safe source archive`);
  for (const prohibited of ['pharma_db.json', 'edgeview_db.json', 'config.json', 'config.prev.json', 'edgeview.db', 'edgeview.db.lock', 'nested/pharma_db.json', '.git/config']) {
    assert.equal(entries.includes(prohibited), false, `${prohibited} must not enter the safe source archive`);
  }
  assert.ok(entries.includes('src/index.ts'));
  console.log('PASS safe source includes dependency locks and excludes current/legacy datasets, credentials, databases and runtime locks');
} finally {
  assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
