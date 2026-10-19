import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditV1Evidence } from '../v1_evidence_maintenance';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-quarantine-test-'));
try {
  const valid = JSON.stringify({ id: 'run-valid', company_name: 'Synthetic Company', country: 'Kenya', started_at: '2026-10-19T00:00:00.000Z', status: 'COMPLETED', queries: [] });
  fs.writeFileSync(path.join(root,'run-valid.json'), valid);
  fs.writeFileSync(path.join(root,'run-zero.json'), '');
  fs.writeFileSync(path.join(root,'run-corrupt.json'), '{"interrupted":');
  const report = auditV1Evidence(root);
  assert.equal(report.valid, 1); assert.equal(report.invalid.length, 2);
  assert.equal(report.quarantine, null);
  assert.ok(fs.existsSync(path.join(root,'run-zero.json')), 'default audit must not mutate evidence');
  const applied = auditV1Evidence(root, true);
  assert.ok(applied.quarantine);
  assert.equal(fs.readFileSync(path.join(root,'run-valid.json'),'utf8'), valid, 'valid evidence must remain byte-identical');
  const manifest = JSON.parse(fs.readFileSync(path.join(applied.quarantine!,'manifest.json'),'utf8'));
  assert.ok(manifest.files.every((item: { moved: boolean }) => item.moved));
  assert.equal(fs.statSync(path.join(applied.quarantine!,'run-zero.json')).size, 0);
  assert.equal(fs.readFileSync(path.join(applied.quarantine!,'run-corrupt.json'),'utf8'), '{"interrupted":');
  const index = fs.readFileSync(path.join(root,'identity-index.jsonl'),'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(index.map(item => item.id), ['run-valid']);
  assert.equal(auditV1Evidence(root).invalid.length, 0);
  const indexBeforeFailure = fs.readFileSync(path.join(root,'identity-index.jsonl'),'utf8');
  fs.writeFileSync(path.join(root,'run-corrupt-again.json'), '{"partial":');
  fs.writeFileSync(path.join(root,'run-zero-again.json'), '');
  const originalRename = fs.renameSync;
  try {
    fs.renameSync = ((source: fs.PathLike, destination: fs.PathLike) => {
      if (String(destination).endsWith('run-zero-again.json')) throw new Error('Controlled quarantine interruption');
      return originalRename(source, destination);
    }) as typeof fs.renameSync;
    assert.throws(() => auditV1Evidence(root, true), /quarantine interruption/);
  } finally { fs.renameSync = originalRename; }
  assert.equal(fs.readFileSync(path.join(root,'identity-index.jsonl'),'utf8'), indexBeforeFailure, 'interrupted quarantine must not publish an incomplete index');
  const manifests = fs.readdirSync(path.join(root,'quarantine')).map(folder => ({ folder, data: JSON.parse(fs.readFileSync(path.join(root,'quarantine',folder,'manifest.json'),'utf8')) }));
  const partial = manifests.find(item => item.data.files.some((entry: { file: string }) => entry.file === 'run-zero-again.json'))!;
  for (const entry of partial.data.files) {
    const existsAtSource = fs.existsSync(path.join(root,entry.file));
    const existsInQuarantine = fs.existsSync(path.join(root,'quarantine',partial.folder,entry.file));
    assert.equal(Number(existsAtSource) + Number(existsInQuarantine), 1, 'each interrupted move must retain one recoverable artifact');
  }
  assert.equal(fs.readFileSync(path.join(root,'run-valid.json'),'utf8'), valid);
  console.log('PASS read-only audit, recoverable quarantine, valid evidence preservation and index rebuilding.');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
