import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyReleaseEvidence, REQUIRED_GATES } from './verify-release-evidence.mjs';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-release-evidence-'));
const commit = 'a'.repeat(40);
try {
  fs.mkdirSync(path.join(root, 'evidence'));
  fs.writeFileSync(path.join(root, 'evidence', 'synthetic.txt'), 'synthetic evidence, not a real acceptance run');
  const reference = { path: 'evidence/synthetic.txt', sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'evidence', 'synthetic.txt'))).digest('hex') };
  const base = { format: 1, commit, gates: REQUIRED_GATES.map(id => ({ id, status: 'NOT VERIFIED', note: 'No independent execution evidence.', evidence: [] })) };
  const report = await verifyReleaseEvidence(base, root, commit);
  assert.equal(report.openGates.length, 11);
  assert.equal(report.acceptance, 'NOT VERIFIED');
  for (const patch of [{ commit: 'b'.repeat(40) }, { gates: base.gates.slice(1) }, { gates: [...base.gates.slice(1), base.gates[1]] }]) {
    await assert.rejects(verifyReleaseEvidence({ ...base, ...patch }, root, commit));
  }
  const passing = { ...base, gates: base.gates.map(gate => ({ ...gate, status: 'PASS', evidence: [reference] })) };
  assert.equal((await verifyReleaseEvidence(passing, root, commit)).acceptance, 'NOT VERIFIED', 'self-reported PASS must never authorize production');
  for (const status of ['WARN','FAIL','SKIPPED','NOT VERIFIED']) {
    assert.equal((await verifyReleaseEvidence({ ...passing, gates: passing.gates.map((gate, i) => i ? gate : { ...gate, status }) }, root, commit)).openGates.length, 1);
  }
  for (const badReference of [{ ...reference, sha256: '0'.repeat(64) }, { ...reference, path: 'evidence/../package.json' }, { ...reference, path: 'evidence\\file' }, { ...reference, path: '/evidence/x' }]) {
    await assert.rejects(verifyReleaseEvidence({ ...base, gates: base.gates.map((gate, i) => i ? gate : { ...gate, status: 'PASS', evidence: [badReference] }) }, root, commit));
  }
  await assert.rejects(verifyReleaseEvidence({ ...base, gates: base.gates.map((gate, i) => i ? gate : { ...gate, status: 'PASS' }) }, root, commit));
  fs.mkdirSync(path.join(root, 'outside'));
  fs.writeFileSync(path.join(root, 'outside', 'proof.txt'), 'linked');
  fs.symlinkSync(path.join(root, 'outside'), path.join(root, 'evidence', 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const linked = { path: 'evidence/linked/proof.txt', sha256: crypto.createHash('sha256').update('linked').digest('hex') };
  await assert.rejects(verifyReleaseEvidence({ ...base, gates: base.gates.map((gate, i) => i ? gate : { ...gate, status: 'PASS', evidence: [linked] }) }, root, commit), /links/);
  fs.appendFileSync(path.join(root, 'evidence', 'synthetic.txt'), 'modified after recording');
  await assert.rejects(verifyReleaseEvidence(passing, root, commit));
  console.log('PASS release manifest rejects missing/duplicate gates, stale commit, missing/tampered evidence and unsafe paths; no synthetic claim grants readiness');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
