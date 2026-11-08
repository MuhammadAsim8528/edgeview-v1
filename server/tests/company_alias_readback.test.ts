import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prepareCompanyAliasAdmission, persistCompanyAliasAdmission, validateCompanyAliasRegistration,
  readCompanyAliasRegistration } from '../company_alias_registry';
import { getDb, resetDbInstanceForTests, type CompanyAliasRow } from '../sqlite';
import type { CompanyContact } from '../db';
import type { V1Run } from '../v1_engine';

const contact = (id: string, company_name: string) => ({ id, company_name, country: 'Kenya', type: 'Importer',
  ceo: '', email: '', phone: '', whatsapp: '', linkedin: '', message_sent: false, last_updated: '2026-11-08T01:00:00.000Z' } as CompanyContact);
const alias = contact('alias-one', 'Global Pharma'), canonical = contact('canonical-one', 'Global Pharma Ltd');
const contacts = [alias, canonical];
const response = { status: 200, body: '<p>Global Pharma is also known as Global Pharma Ltd in Kenya.</p>',
  provenance: { finalUrl: 'https://global.example.test/legal', redirectCount: 0 } };
const run = { id: 'run-readback', company_name: alias.company_name, country: 'Kenya', status: 'COMPLETED',
  identity_resolution: { official_domain: 'global.example.test', candidates: [{ domain: 'global.example.test', accepted: true }] },
  raw_records: [{ id: 'raw-readback', run_id: 'run-readback', kind: 'scrape', provider: 'direct-http', response,
    sha256: crypto.createHash('sha256').update(JSON.stringify(response)).digest('hex') }],
} as V1Run;
const plan = prepareCompanyAliasAdmission(alias, canonical, run, 'raw-readback');
const row: CompanyAliasRow = { ...plan.row, created_at: '2026-11-08T01:00:00.000Z' };
const original = JSON.stringify({ contacts, row, run });
const load = (id: string) => id === run.id ? run : null;
const expected = { status: 'verified', alias_id: alias.id, canonical_id: canonical.id, country: 'kenya' };
assert.deepEqual(validateCompanyAliasRegistration(row, contacts, [], load), expected);
for (const current of [[], [alias], [canonical], [alias, canonical, alias],
  [{ ...alias, company_name: 'Unrelated Medical' }, canonical],
  [{ ...alias, country: 'Pakistan' }, canonical], [alias, { ...canonical, country: 'South Sudan' }],
  [{ ...alias, type: 'Exporter' as const }, canonical]]) {
  assert.equal(validateCompanyAliasRegistration(row, current, [], load).status, 'invalid');
}
for (const change of [
  { alias_id: 'alias-other' }, { canonical_id: 'canonical-other' }, { alias_key: 'other__kenya' },
  { canonical_key: 'other__kenya' }, { country: 'pakistan' }, { created_at: 'invalid' },
  { proof_json: '{PRIVATE_BAD_PROOF' }, { proof_json: 'x'.repeat(8193) },
  { proof_json: JSON.stringify({ ...JSON.parse(row.proof_json), policy_version: 999 }) },
  { proof_json: JSON.stringify({ ...JSON.parse(row.proof_json), run_id: '../run-readback' }) },
  { proof_json: JSON.stringify({ ...JSON.parse(row.proof_json), quote_sha256: '0'.repeat(64) }) },
]) assert.equal(validateCompanyAliasRegistration({ ...row, ...change }, contacts, [], load).status, 'invalid');
const relatedCases: CompanyAliasRow[] = [
  { ...row, alias_id: canonical.id, alias_key: row.canonical_key, canonical_id: 'third', canonical_key: 'third__kenya' },
  { ...row, alias_id: 'third', alias_key: 'third__kenya', canonical_id: alias.id, canonical_key: row.alias_key },
  { ...row, alias_id: canonical.id, alias_key: row.canonical_key, canonical_id: alias.id, canonical_key: row.alias_key },
  { ...row, canonical_id: 'other' },
];
for (const related of relatedCases) assert.equal(validateCompanyAliasRegistration(row, contacts, [related], load).status, 'invalid');
assert.deepEqual(validateCompanyAliasRegistration(row, contacts,
  [{ ...row, alias_id: 'another-alias', alias_key: 'another alias__kenya' }], load), expected,
  'a different alias may share the same canonical target');
assert.deepEqual(validateCompanyAliasRegistration(row, contacts, [], () => null),
  { status: 'unavailable', code: 'ALIAS_REGISTRATION_UNAVAILABLE' });
const unavailable = validateCompanyAliasRegistration(row, contacts, [], () => { throw new Error('PRIVATE_SOURCE_PATH'); });
assert.equal(unavailable.status, 'unavailable'); assert.doesNotMatch(JSON.stringify(unavailable), /PRIVATE_SOURCE_PATH/);
const tampered = structuredClone(run);
(tampered.raw_records[0].response as any).body = '<p>Global Pharma is also known as Global Pharma Ltd in Pakistan.</p>';
tampered.raw_records[0].sha256 = crypto.createHash('sha256').update(JSON.stringify(tampered.raw_records[0].response)).digest('hex');
assert.equal(validateCompanyAliasRegistration(row, contacts, [], () => tampered).status, 'invalid', 'valid-hash foreign proof cannot revive the mapping');
assert.equal(JSON.stringify({ contacts, row, run }), original, 'read validation preserves source objects');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-alias-readback-'));
const oldPath = process.env.EDGEVIEW_SQLITE_DB, oldTest = process.env.EDGEVIEW_TEST_MODE;
process.env.EDGEVIEW_TEST_MODE = '1'; process.env.EDGEVIEW_SQLITE_DB = path.join(root, 'operational.db');
try {
  resetDbInstanceForTests();
  assert.equal((await readCompanyAliasRegistration(alias.id, () => contacts, load)).status, 'unavailable');
  assert.equal(fs.existsSync(process.env.EDGEVIEW_SQLITE_DB), false, 'review must not implicitly create a database');
  let database = await getDb();
  let reads = 0;
  assert.deepEqual(await readCompanyAliasRegistration(alias.id, () => contacts, () => { reads++; return run; }), { status: 'unlinked' });
  assert.equal(reads, 0, 'unlinked record does not hydrate any evidence');
  await persistCompanyAliasAdmission(plan, plan.confirmation_sha256);
  const before = fs.readFileSync(process.env.EDGEVIEW_SQLITE_DB);
  assert.deepEqual(await readCompanyAliasRegistration(alias.id, () => contacts, load), expected);
  assert.deepEqual(fs.readFileSync(process.env.EDGEVIEW_SQLITE_DB), before);
  const get = database.get;
  try {
    database.get = async () => { throw new Error('PRIVATE_DATABASE_READ_FAILURE'); };
    const failedRead = await readCompanyAliasRegistration(alias.id, () => contacts, load);
    assert.deepEqual(failedRead, { status: 'unavailable', code: 'ALIAS_REGISTRATION_UNAVAILABLE' });
    assert.doesNotMatch(JSON.stringify(failedRead), /PRIVATE_DATABASE_READ_FAILURE/);
  } finally { database.get = get; }
  resetDbInstanceForTests(); database = await getDb();
  assert.deepEqual(await readCompanyAliasRegistration(alias.id, () => contacts, load), expected);
  assert.equal((await readCompanyAliasRegistration(alias.id, () => [canonical], load)).status, 'invalid');
  assert.equal((await readCompanyAliasRegistration(alias.id, () => contacts, () => null)).status, 'unavailable');
  await database.run('UPDATE company_aliases SET proof_json=? WHERE alias_id=?', ['{"policy_version":999}', alias.id]);
  await database.flush();
  assert.equal((await readCompanyAliasRegistration(alias.id, () => contacts, load)).status, 'invalid');
  assert.equal((await database.all('SELECT * FROM company_aliases')).length, 1, 'invalid mappings remain available for recovery, never deleted by reads');
  console.log('PASS alias readback: current identity/proof/policy, chain/cycle refusal, missing sources, no initialization/write, reopen and recovery preservation');
} finally {
  resetDbInstanceForTests();
  if (oldPath === undefined) delete process.env.EDGEVIEW_SQLITE_DB; else process.env.EDGEVIEW_SQLITE_DB = oldPath;
  if (oldTest === undefined) delete process.env.EDGEVIEW_TEST_MODE; else process.env.EDGEVIEW_TEST_MODE = oldTest;
  assert.equal(fs.realpathSync(path.dirname(root)), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true });
}
