import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import initSqlJs from 'sql.js';
import { prepareCompanyAliasAdmission, persistCompanyAliasAdmission } from '../company_alias_registry';
import { getDb, resetDbInstanceForTests, CURRENT_SCHEMA_VERSION } from '../sqlite';
import type { CompanyContact } from '../db';
import type { V1Run } from '../v1_engine';

process.env.EDGEVIEW_TEST_MODE = '1';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-alias-registry-'));
const databasePath = path.join(root, 'operational.db');
const previous = process.env.EDGEVIEW_SQLITE_DB;
process.env.EDGEVIEW_SQLITE_DB = databasePath;
const contact = (id: string, company_name: string, country = 'Kenya') => ({
  id, company_name, country, type: 'Importer', ceo: '', email: '', phone: '', whatsapp: '', linkedin: '',
  message_sent: false, last_updated: '2026-11-08T01:00:00.000Z',
} as CompanyContact);
function plan(alias: CompanyContact, canonical: CompanyContact) {
  const response = { status: 200,
    body: `<p>${alias.company_name} is also known as ${canonical.company_name} in Kenya.</p>`,
    provenance: { finalUrl: 'https://global.example.test/legal', redirectCount: 0 } };
  const run = { id: 'run-registry', company_name: alias.company_name, country: alias.country, status: 'COMPLETED',
    identity_resolution: { official_domain: 'global.example.test', candidates: [{ domain: 'global.example.test', accepted: true }] },
    raw_records: [{ id: 'raw-registry', run_id: 'run-registry', kind: 'scrape', provider: 'direct-http', response,
      sha256: crypto.createHash('sha256').update(JSON.stringify(response)).digest('hex') }],
  } as V1Run;
  return prepareCompanyAliasAdmission(alias, canonical, run, 'raw-registry');
}
const admit = (prepared: ReturnType<typeof plan>) => persistCompanyAliasAdmission(prepared, prepared.confirmation_sha256);
try {
  // Actual schema2 migration must preserve unrelated state and a byte-exact backup.
  const SQL = await initSqlJs();
  const old = new SQL.Database();
  old.exec("PRAGMA user_version=2; CREATE TABLE untouched(value TEXT); INSERT INTO untouched VALUES('Synthetic original');");
  const before = old.export(); old.close(); fs.writeFileSync(databasePath, before);
  resetDbInstanceForTests();
  let db = await getDb();
  assert.equal((await db.get('PRAGMA user_version')).user_version, CURRENT_SCHEMA_VERSION);
  assert.equal((await db.get('SELECT value FROM untouched')).value, 'Synthetic original');
  const backups = fs.readdirSync(root).filter(name => name.startsWith('operational.db.pre-migration-v2-'));
  assert.equal(backups.length, 1);
  assert.deepEqual(fs.readFileSync(path.join(root, backups[0])), Buffer.from(before));
  const alias = contact('alias-one', 'Global Pharma');
  const canonical = contact('canonical-one', 'Global Pharma Ltd');
  const inputs = JSON.stringify([alias, canonical]);
  const prepared = plan(alias, canonical);
  await assert.rejects(persistCompanyAliasAdmission(prepared, '0'.repeat(64)), { code: 'ALIAS_CONFIRMATION_CHANGED' });
  const results = await Promise.allSettled([admit(prepared), admit(plan(alias, { ...canonical, id: 'canonical-other' }))]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1, 'racing conflicting targets never both commit');
  const refusal = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
  assert.equal(refusal.reason.code, 'ALIAS_MAPPING_CONFLICT');
  const first = await admit(prepared);
  await assert.rejects(db.insertCompanyAliasDurably({ ...first, alias_id: 'foreign-alias',
    alias_key: 'global pharma limited__pakistan' }), /CHECK constraint failed/,
  'storage constraints independently reject country-key mismatch');
  assert.equal((await db.all('SELECT * FROM company_aliases')).length, 1, 'same exact admission is idempotent');
  assert.equal(JSON.parse(first.proof_json).alias_name, 'Global Pharma');
  assert.equal(JSON.parse(first.proof_json).canonical_name, 'Global Pharma Ltd');
  assert.equal(JSON.stringify([alias, canonical]), inputs, 'raw names and caller objects are preserved');
  resetDbInstanceForTests(); db = await getDb();
  assert.deepEqual(await db.get('SELECT * FROM company_aliases WHERE alias_id=?', [alias.id]), first, 'mapping and proof survive disk reopen');
  const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|APPDATA|LOCALAPPDATA|USERPROFILE)$/i.test(key)));
  Object.assign(childEnv, { NODE_ENV: 'test', EDGEVIEW_TEST_MODE: '1', EDGEVIEW_SQLITE_DB: databasePath });
  const sqliteModule = pathToFileURL(fileURLToPath(new URL('../sqlite.ts', import.meta.url))).href;
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    `import assert from 'node:assert/strict'; import {getDb} from ${JSON.stringify(sqliteModule)};
     const db=await getDb(); const rows=await db.all('SELECT * FROM company_aliases');
     assert.equal(rows.length,1); assert.equal(rows[0].canonical_id,'canonical-one');
     assert.equal(JSON.parse(rows[0].proof_json).alias_name,'Global Pharma'); console.log('alias-child-pass');`],
  { env: childEnv, encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(child.status, 0, 'independent process can reopen the durable mapping');
  assert.match(child.stdout, /alias-child-pass/);
  assert.equal(fs.readdirSync(root).filter(name => name.startsWith('operational.db.pre-migration-')).length, 1);
  const third = contact('third-entity', 'Global Pharma Limited');
  await assert.rejects(admit(plan(canonical, third)), { code: 'ALIAS_CHAIN_REFUSED' });
  await assert.rejects(admit(plan(third, alias)), { code: 'ALIAS_CHAIN_REFUSED' });
  const rename = fs.renameSync;
  try {
    fs.renameSync = ((from, to) => {
      if (String(to) === databasePath) throw Object.assign(new Error('Synthetic write failure'), { code: 'ENOSPC' });
      return rename(from, to);
    }) as typeof fs.renameSync;
    await assert.rejects(admit(plan(third, canonical)), { code: 'DISK_FULL' });
    assert.equal(await db.get('SELECT * FROM company_aliases WHERE alias_id=?', [third.id]), undefined,
      'failed durable write is removed from memory before returning');
  } finally { fs.renameSync = rename; }
  await db.flush(); resetDbInstanceForTests(); db = await getDb();
  assert.equal(await db.get('SELECT * FROM company_aliases WHERE alias_id=?', [third.id]), undefined,
    'later flush/reopen cannot resurrect rejected admission');
  assert.equal((await db.all('SELECT * FROM company_aliases')).length, 1);
  await admit(plan(third, canonical));
  assert.equal((await db.all('SELECT * FROM company_aliases')).length, 2, 'independent aliases may share one canonical target');
  assert.throws(() => plan({ ...alias, country: 'Pakistan' }, canonical));
  assert.throws(() => plan({ ...alias, country: 'Sudan' }, { ...canonical, country: 'South Sudan' }));
  assert.throws(() => plan({ ...alias, type: 'Exporter' }, canonical), { code: 'ALIAS_ROLE_REVIEW_REQUIRED' });
  console.log('PASS alias registry: schema2 backup/migration, explicit confirmation, race/conflict, idempotence, chain refusal, failed-save undo and disk reopen');
} finally {
  resetDbInstanceForTests();
  if (previous === undefined) delete process.env.EDGEVIEW_SQLITE_DB; else process.env.EDGEVIEW_SQLITE_DB = previous;
  fs.rmSync(root, { recursive: true, force: true });
}
