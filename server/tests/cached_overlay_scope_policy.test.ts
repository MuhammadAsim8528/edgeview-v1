import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-cached-scope-'));
process.env.NODE_ENV = 'test';
process.env.EDGEVIEW_TEST_DB_DIR = root;
process.env.EDGEVIEW_JSON_DB = path.join(root, 'dataset.json');
process.env.EDGEVIEW_SQLITE_DB = path.join(root, 'operational.db');
process.env.EDGEVIEW_V1_DATA_DIR = path.join(root, 'runs');
try {
  const { getDb, resetDbInstanceForTests } = await import('../sqlite');
  const { db } = await import('../db');
  const { hydrateV1ContactEnrichment } = await import('../job_manager');
  const { V1_CONTACT_OVERLAY_VERSION } = await import('../../shared/v1_contact_contract');
  const { canonicalEntityIdentityKey } = await import('../company_identity');
  const database = await getDb();
  const contact = { id: 'synthetic-kenya', company_name: 'Scopeanchor Medical', country: 'Kenya', type: 'Importer', email: '', phone: '' } as any;
  db.contacts.clear(); db.contacts.set(contact.id, contact); db.rebuildIndexes();
  const old = JSON.stringify({ schema_version: 26, entity_key: canonicalEntityIdentityKey(contact.company_name, contact.country), emails_list: ['foreign@scopeanchor.test'], email: 'foreign@scopeanchor.test', quality_status: 'COMPLETE' });
  await database.run('INSERT INTO v1_contact_enrichment (company_id, run_id, overlay_json, updated_at) VALUES (?, ?, ?, ?)',
    [contact.id, 'retained-old-run', old, '2026-01-01T00:00:00Z']);
  await database.flush();
  const read = fs.readFileSync;
  let bodyReads = 0;
  (fs as any).readFileSync = (file: any, ...args: any[]) => {
    if (String(file).startsWith(process.env.EDGEVIEW_V1_DATA_DIR!)) { bodyReads++; throw new Error('immutable-body-read-forbidden'); }
    return (read as any)(file, ...args);
  };
  try {
    await hydrateV1ContactEnrichment();
    assert.equal(contact.email, '', 'startup must not promote an older foreign/unvalidated overlay');
    assert.equal(contact.research_validation_status, 'needs_revalidation');
    assert.equal(contact.edgeview_v1_run_id, 'retained-old-run', 'original research remains discoverable');
    assert.equal(bodyReads, 0, 'startup must not replay raw evidence bodies');
  } finally { fs.readFileSync = read; }
  const stored = await database.get('SELECT overlay_json FROM v1_contact_enrichment WHERE company_id = ?', [contact.id]);
  assert.equal(stored.overlay_json, old, 'withholding a cached projection must not erase its stored recovery data');
  const wrongEntity = JSON.stringify({ schema_version: V1_CONTACT_OVERLAY_VERSION,
    entity_key: canonicalEntityIdentityKey(contact.company_name, 'Pakistan'), email: 'wrong@scopeanchor.test' });
  await database.run('UPDATE v1_contact_enrichment SET overlay_json = ? WHERE company_id = ?', [wrongEntity, contact.id]);
  await hydrateV1ContactEnrichment();
  assert.equal(contact.email, '', 'current version alone cannot authorize another country entity');
  const current = JSON.stringify({ schema_version: V1_CONTACT_OVERLAY_VERSION,
    entity_key: canonicalEntityIdentityKey(contact.company_name, contact.country), email: 'kenya@scopeanchor.test' });
  await database.run('UPDATE v1_contact_enrichment SET overlay_json = ? WHERE company_id = ?', [current, contact.id]);
  await database.flush();
  resetDbInstanceForTests();
  await hydrateV1ContactEnrichment();
  assert.equal(contact.email, 'kenya@scopeanchor.test', 'current matching-entity cache remains usable after database reopen');
  assert.equal(contact.research_validation_status, 'current');
  await (await getDb()).flush();
  resetDbInstanceForTests();
  console.log('PASS active SQLite old/wrong-entity withholding, retained recovery data, current cache reopen and no evidence-body reads');
} finally {
  assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
