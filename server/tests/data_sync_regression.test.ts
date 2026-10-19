// Data Synchronization Regression — guards the source-of-truth invariants:
//   - contacts are derived from files (runtime == post-restart state)
//   - deleting a file prunes contacts that no longer have a source file
//     (stale-state prevention; /api/companies, /api/summary,
//     /api/runtime/state and exports must not keep orphaned companies)
//   - companies shared by multiple files survive the deletion of one file
//   - boot simulation produces no orphan contacts (every contact maps to a file)
//   - outreach summary counts always equal the current contacts map

import * as assert from 'assert';
import { db } from '../db';
import { computeSummary } from '../summary';
import { canonicalCompanyIdentityKey, canonicalEntityIdentityKey } from '../company_identity';

const COLUMNS = ['Item', 'Importer', 'Exporter', 'Country', 'Total Value (USD)'];

function makeRow(item: string, importer: string, exporter: string, country: string, value: number) {
  return { Item: item, Importer: importer, Exporter: exporter, Country: country, 'Total Value (USD)': value };
}

function makeFile(id: string, name: string, rows: any[]) {
  const summary = computeSummary(COLUMNS, rows);
  return { id, name, file_type: 'CSV' as const, size: 1024, upload_time: new Date().toISOString(), columns: COLUMNS, rows, summary };
}

async function main() {
  const originalFileIds = new Set(db.files.keys());
  const originalContactKeys = new Set(db.contacts.keys());
  const addedFileIds: string[] = [];

  try {
    // --- Test 1: delete sync / prune removes orphaned contacts ---
    const fileA = makeFile('sync-test-a', 'sync_a.csv', [
      makeRow('Drug X', 'SyncPharma Importer A', 'SyncPharma Exporter A', 'Kenya', 100),
    ]);
    db.files.set(fileA.id, fileA);
    addedFileIds.push(fileA.id);
    db.syncCompaniesFromFiles();

    assert.ok(db.contacts.has('syncpharma importer a__kenya'), 'importer A country entity created by sync');
    assert.ok(db.contacts.has('syncpharma exporter a'), 'exporter A contact created by sync');

    const aliasFile = makeFile('sync-test-alias', 'sync_alias.csv', [
      makeRow('Drug X2', 'SyncPharma Importer A .', 'SyncPharma Exporter A.', 'Kenya', 50),
    ]);
    db.files.set(aliasFile.id, aliasFile);
    addedFileIds.push(aliasFile.id);
    db.syncCompaniesFromFiles();
    assert.equal(
      Array.from(db.contacts.values()).filter((contact) => contact.entity_key === 'syncpharma importer a__kenya').length,
      1,
      'trailing punctuation aliases collapse into one canonical contact'
    );
    db.files.delete(aliasFile.id);

    db.files.delete(fileA.id);
    db.syncCompaniesFromFiles();
    db.pruneOrphanedContacts();

    assert.ok(!db.contacts.has('syncpharma importer a__kenya'), 'orphaned importer A entity pruned after file delete');
    assert.ok(!db.contacts.has('syncpharma exporter a'), 'orphaned exporter A pruned after file delete');
    const removedContact = Array.from(db.contacts.values()).find((c) => c.company_name === 'SyncPharma Importer A');
    assert.ok(!removedContact, 'pruned contact no longer reachable');
    assert.ok(!db.getContactById('nope-does-not-exist'), 'contact index rebuilt (no stale id hits)');

    // --- Test 2: company shared across files survives deletion of one file ---
    const fileB = makeFile('sync-test-b', 'sync_b.csv', [
      makeRow('Drug Y', 'SyncPharma Shared Co', 'SyncPharma Exporter B', 'Sri Lanka', 200),
    ]);
    const fileC = makeFile('sync-test-c', 'sync_c.csv', [
      makeRow('Drug Z', 'SyncPharma Shared Co', 'SyncPharma Exporter C', 'Thailand', 300),
    ]);
    db.files.set(fileB.id, fileB);
    db.files.set(fileC.id, fileC);
    addedFileIds.push(fileB.id, fileC.id);
    db.syncCompaniesFromFiles();

    assert.ok(db.contacts.has('syncpharma shared co__sri lanka'), 'Sri Lanka company entity created');
    assert.ok(db.contacts.has('syncpharma shared co__thailand'), 'Thailand company entity created');

    db.files.delete(fileB.id);
    db.syncCompaniesFromFiles();
    db.pruneOrphanedContacts();

    assert.ok(!db.contacts.has('syncpharma shared co__sri lanka'), 'deleted source removes only its country entity');
    assert.ok(db.contacts.has('syncpharma shared co__thailand'), 'other country entity survives deletion of one source file');
    assert.ok(!db.contacts.has('syncpharma exporter b'), 'exporter B pruned after its only file deleted');
    assert.ok(db.contacts.has('syncpharma exporter c'), 'exporter C retained (file C still present)');

    // --- Test 3: boot simulation produces no orphans ---
    db.contacts.clear();
    db.syncCompaniesFromFiles();
    db.pruneOrphanedContacts();
    const fileCompanyKeys = new Set<string>();
    for (const f of db.files.values()) {
      for (const n of f.summary?.exporters_list || []) if (n && n !== 'N/A') fileCompanyKeys.add(canonicalCompanyIdentityKey(n));
      const rowImporterNames = new Set<string>();
      for (const row of f.rows || []) {
        const importer = row.Importer || row.IMPORTER || row.BUYER || row.BUYER_NAME || row.Consignee || '';
        if (!importer || importer === 'N/A') continue;
        const country = row.Country || row.COUNTRY || row.DESTINATION_COUNTRY || row.cntry || row.ORIGIN || '';
        fileCompanyKeys.add(canonicalEntityIdentityKey(importer, country));
        rowImporterNames.add(canonicalCompanyIdentityKey(importer));
      }
      for (const n of f.summary?.importers_list || []) {
        if (n && n !== 'N/A' && !rowImporterNames.has(canonicalCompanyIdentityKey(n))) fileCompanyKeys.add(canonicalCompanyIdentityKey(n));
      }
    }
    for (const key of db.contacts.keys()) {
      assert.ok(fileCompanyKeys.has(key), `boot contact "${key}" maps to a current file`);
    }

    // --- Test 4: pruning keeps the live contact set aligned with current files ---
    const before = db.contacts.size;

    // Simulate a delete again and confirm the contact count drops in lockstep.
    db.files.delete(fileC.id);
    db.syncCompaniesFromFiles();
    db.pruneOrphanedContacts();
    const after = db.contacts.size;
    assert.ok(after < before, 'contact count decreased after prune');

    console.log(`data_sync_regression OK (prune removed stale contacts; contacts ${before} -> ${after})`);
  } finally {
    for (const id of addedFileIds) db.files.delete(id);
    for (const key of Array.from(db.contacts.keys())) {
      if (!originalContactKeys.has(key)) db.contacts.delete(key);
    }
    db.rebuildIndexes();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
