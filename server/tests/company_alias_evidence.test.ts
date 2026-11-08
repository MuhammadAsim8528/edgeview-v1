import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyCompanyAliasEvidence } from '../company_alias_evidence';
import { externalizeV1RunForStorage, hydrateV1RunFromStorage } from '../v1_blob_store';
import type { V1Run } from '../v1_engine';

const left = { company_name: 'Global Pharma', country: 'Kenya' };
const right = { company_name: 'Global Pharma Ltd', country: 'Kenya' };
const body = '<p>Global Pharma Ltd is also known as Global Pharma in Kenya.</p>';
function fixture(html = body): V1Run {
  const response = { status: 200, body: html,
    provenance: { finalUrl: 'https://global.example.test/legal', redirectCount: 1 } };
  return {
    id: 'run-alias-proof', company_name: left.company_name, country: 'Kenya', status: 'COMPLETED',
    started_at: '2026-11-08T01:00:00.000Z', queries: [], results: [], timeline: [],
    identity_resolution: { official_domain: 'global.example.test', confidence: 'high', candidates: [
      { domain: 'global.example.test', score: 100, accepted: true, reasons: [], evidence_urls: [] },
    ] },
    raw_records: [{ id: 'raw-alias', run_id: 'run-alias-proof', kind: 'scrape', provider: 'direct-http',
      request: { url: 'https://global.example.test/start' }, response,
      sha256: crypto.createHash('sha256').update(JSON.stringify(response)).digest('hex'),
      requested_at: '2026-11-08T01:00:00.000Z', completed_at: '2026-11-08T01:00:01.000Z', latency_ms: 1 }],
    limits: { max_queries: 4, max_results_per_query: 8, max_scrapes: 8, timeout_ms: 120000 },
  };
}
function rehash(run: V1Run) {
  run.raw_records[0].sha256 = crypto.createHash('sha256').update(JSON.stringify(run.raw_records[0].response)).digest('hex');
}
const original = fixture();
const before = JSON.stringify(original);
const verified = verifyCompanyAliasEvidence(left, right, original, 'raw-alias');
assert.equal(verified.verified, true, 'explicit official local statement can be proposed for review');
if (verified.verified) {
  assert.equal(verified.quote, body.slice(3, -4));
  assert.equal(verified.source_url, 'https://global.example.test/legal');
  assert.equal(verified.quote_sha256, crypto.createHash('sha256').update(verified.quote).digest('hex'));
}
assert.equal(JSON.stringify(original), before, 'proof must not rewrite immutable captures');
const invalidBodies = [
  '<p>Global Pharma Ltd is a subsidiary of Global Pharma in Kenya.</p>',
  '<p>Global Pharma Ltd distributes products for Global Pharma in Kenya.</p>',
  '<p>Global Pharma Ltd is not also known as Global Pharma in Kenya.</p>',
  '<p>Global Pharma Ltd is also known as Global Pharma in Pakistan.</p>',
  '<p>Kenya</p><p>Global Pharma Ltd is also known as Global Pharma in Pakistan.</p>',
  '<p>Global Pharma Ltd is also known as Global Pharma in Kenya and Pakistan.</p>',
  '<p>Global Pharma Ltd</p><p>Global Pharma in Kenya</p>',
  '<iframe>' + body + '</iframe>', '<textarea>' + body + '</textarea>',
  '<svg>' + body + '</svg>', '<details>' + body + '</details>',
  '<!--' + body + '-->', '<script>' + body + '</script>', '<template>' + body + '</template>',
  '<div hidden>' + body + '</div>', '<div style="display:none">' + body + '</div>',
  '<p class="hidden">Global Pharma Ltd is also known as Global Pharma in Kenya.</p>',
  '<p>Another Global Pharma Ltd is also known as Global Pharma in Kenya.</p>',
  '<p>Global Pharma Ltd is also known as Global Pharma in Kenya. Distributor contact follows.</p>',
];
for (const html of invalidBodies) assert.equal(verifyCompanyAliasEvidence(left, right, fixture(html), 'raw-alias').verified,
  false, 'valid-hash adversarial capture must abstain: ' + invalidBodies.indexOf(html));
const mutations: Array<(run: V1Run) => void> = [
  run => { run.country = 'Pakistan'; }, run => { run.company_name = 'Unrelated Company'; },
  run => { run.status = 'FAILED'; }, run => { run.identity_resolution!.candidates[0].accepted = false; },
  run => { run.raw_records[0].run_id = 'run-other'; }, run => { run.raw_records[0].provider = 'serper'; },
  run => { run.raw_records[0].sha256 = '0'.repeat(64); },
  run => { (run.raw_records[0].response as any).status = 403; rehash(run); },
  run => { delete (run.raw_records[0].response as any).provenance; rehash(run); },
  run => { (run.raw_records[0].response as any).provenance.finalUrl = 'https://foreign.example.test/legal'; rehash(run); },
  run => { (run.raw_records[0].response as any).provenance.finalUrl = 'http://global.example.test/legal'; rehash(run); },
  run => { (run.raw_records[0].response as any).provenance.finalUrl = 'https://user:pass@global.example.test/legal'; rehash(run); },
  run => { (run.raw_records[0].response as any).provenance.redirectCount = -1; rehash(run); },
  run => { run.raw_records.push({ ...run.raw_records[0] }); },
];
for (const mutate of mutations) {
  const run = fixture(); mutate(run);
  assert.equal(verifyCompanyAliasEvidence(left, right, run, 'raw-alias').verified, false);
}
assert.equal(verifyCompanyAliasEvidence(left, { ...right, country: 'Pakistan' }, fixture(), 'raw-alias').verified, false);
assert.equal(verifyCompanyAliasEvidence({ ...left, country: 'Sudan' }, { ...right, country: 'South Sudan' }, fixture(), 'raw-alias').verified, false);
assert.equal(verifyCompanyAliasEvidence(left, right, fixture(), 'raw-missing').verified, false);
assert.equal(verifyCompanyAliasEvidence(left, right, fixture('<p>Global Pharma trades as Global Pharma Ltd in Kenya.</p>'), 'raw-alias').verified, true);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-alias-evidence-'));
try {
  const run = fixture('\n'.repeat(5000) + body);
  const envelope = externalizeV1RunForStorage(run, root);
  const stored = JSON.stringify(envelope);
  fs.writeFileSync(path.join(root, 'run.json'), stored);
  const reloaded = JSON.parse(fs.readFileSync(path.join(root, 'run.json'), 'utf8'));
  assert.ok(reloaded.raw_records[0].response.__edgeview_blob_ref__, 'proof uses the existing content-addressed blob store');
  const hydrated = hydrateV1RunFromStorage(reloaded, root) as V1Run;
  assert.equal(verifyCompanyAliasEvidence(left, right, hydrated, 'raw-alias').verified, true);
  const tampered = structuredClone(hydrated);
  (tampered.raw_records[0].response as any).provenance.finalUrl = 'https://foreign.example.test/legal';
  assert.equal(verifyCompanyAliasEvidence(left, right, tampered, 'raw-alias').verified, false);
  assert.equal(fs.readFileSync(path.join(root, 'run.json'), 'utf8'), stored, 'inspection preserves the original envelope');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
console.log('PASS immutable alias proof: identity, final authority, valid-hash hostile carriers, local explicit relation and abstention');
