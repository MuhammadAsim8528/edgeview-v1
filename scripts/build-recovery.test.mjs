import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-build-recovery-'));
const launcher = path.resolve('scripts/build-if-needed.mjs');
try {
  fs.mkdirSync(path.join(fixture, 'dist'));
  for (const file of ['server.cjs', 'index.html']) {
    fs.writeFileSync(path.join(fixture, 'dist', file), `original ${file}`);
    fs.utimesSync(path.join(fixture, 'dist', file), new Date(0), new Date(0));
  }
  const metadata = path.resolve('scripts/build-metadata.mjs').replace(/\\/g, '/');
  fs.writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({ name: 'edgeview', version: '1.0.0', scripts: { build: `node fail.cjs && node "${metadata}"` } }));
  fs.writeFileSync(path.join(fixture, 'fail.cjs'), "require('fs').writeFileSync('dist/index.html', 'partial'); process.exit(7);");
  const failed = spawnSync(process.execPath, [launcher], { cwd: fixture, encoding: 'utf8' });
  assert.notEqual(failed.status, 0, 'failed build must not be reported as successful');
  for (const file of ['server.cjs', 'index.html']) {
    assert.equal(fs.readFileSync(path.join(fixture, 'dist', file), 'utf8'), `original ${file}`);
  }
  assert.equal(fs.readdirSync(fixture).filter(name => name.startsWith('.edgeview-build-backup-')).length, 0);
  fs.writeFileSync(path.join(fixture, 'fail.cjs'), "const fs=require('fs'); fs.writeFileSync('dist/index.html','new html'); fs.writeFileSync('dist/server.cjs','new server');");
  fs.utimesSync(path.join(fixture, 'package.json'), new Date(Date.now() + 2000), new Date(Date.now() + 2000));
  const successful = spawnSync(process.execPath, [launcher], { cwd: fixture, encoding: 'utf8' });
  assert.equal(successful.status, 0, successful.stderr);
  assert.equal(fs.readFileSync(path.join(fixture, 'dist/index.html'), 'utf8'), 'new html');
  assert.equal(fs.readFileSync(path.join(fixture, 'dist/server.cjs'), 'utf8'), 'new server');
  const reused = spawnSync(process.execPath, [launcher], { cwd: fixture, encoding: 'utf8' });
  assert.equal(reused.status, 0, reused.stderr); assert.match(reused.stdout, /up to date/);
  fs.writeFileSync(path.join(fixture, 'server.ts'), 'changed source with old timestamp');
  fs.utimesSync(path.join(fixture, 'server.ts'), new Date(0), new Date(0));
  const changed = spawnSync(process.execPath, [launcher], { cwd: fixture, encoding: 'utf8' });
  assert.equal(changed.status, 0, changed.stderr); assert.match(changed.stdout, /rebuilding/);
  console.log('PASS: failed rebuild restores previous artifacts; successful rebuild keeps new artifacts.');
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
