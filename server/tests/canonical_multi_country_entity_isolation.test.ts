import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from '../db';
import { computeSummary } from '../summary';
import {
  canonicalCompanyIdentityKey,
  canonicalCountryIdentityKey,
  canonicalEntityIdentityKey,
} from '../company_identity';
import { TradeRelationshipResolver } from '../trade_relationship_resolver';
import { saveEnrichedData, getCachedCompany } from '../enrichment';
import { getDb, resetDbInstanceForTests } from '../sqlite';
import { getSqlitePath } from '../db_paths';
import { applyEnrichmentDetailsToContact, selectContactCacheRow, selectContactEntity } from '../contact_projection';
import { buildContactReport, mergeContacts } from '../contact_report_model';
import { getInternationalImporterDirectory } from '../international_importer_directory';

const COLUMNS = ['Item', 'Importer', 'Exporter', 'Country', 'Total Value (USD)'];
const RUN = `entity-proof-${process.pid}-${Date.now()}`;

function hash(filePath: string): string | null {
  return fs.existsSync(filePath)
    ? crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
    : null;
}

function makeFile(id: string, importer: string, exporter: string, country: string, aliases: string[] = []) {
  const rows = [importer, ...aliases].map((name, index) => ({
    Item: `Product ${country} ${index + 1}`,
    Importer: name,
    Exporter: exporter,
    Country: country,
    'Total Value (USD)': 100 + index,
  }));
  return {
    id,
    name: `${id}.csv`,
    file_type: 'CSV' as const,
    size: 512,
    upload_time: new Date().toISOString(),
    columns: COLUMNS,
    rows,
    summary: computeSummary(COLUMNS, rows),
  };
}

async function main() {
  const productionDb = path.join(process.cwd(), 'edgeview.db');
  const productionJson = path.join(process.cwd(), 'edgeview_db.json');
  const prodDbBefore = hash(productionDb);
  const prodJsonBefore = hash(productionJson);
  assert.match(getSqlitePath(), /\.test-cache/i, 'cache proof must use isolated test persistence');

  const originalFiles = new Map(db.files);
  const originalContacts = new Map(db.contacts);
  const files = {
    nl: makeFile(`${RUN}-nl`, 'Novartis', 'Exporter Netherlands A', 'Netherlands', ['NOVARTIS', 'Novartis.']),
    pk: makeFile(`${RUN}-pk`, 'Novartis', 'Exporter Pakistan B', 'Pakistan'),
    ke: makeFile(`${RUN}-ke`, 'Novartis', 'Exporter Kenya C', 'Kenya'),
  };
  const keys = {
    nl: canonicalEntityIdentityKey('Novartis', 'Netherlands'),
    pk: canonicalEntityIdentityKey('Novartis', 'Pakistan'),
    ke: canonicalEntityIdentityKey('Novartis', 'Kenya'),
  };

  try {
    assert.deepEqual(keys, {
      nl: 'novartis__netherlands',
      pk: 'novartis__pakistan',
      ke: 'novartis__kenya',
    });
    assert.equal(canonicalCompanyIdentityKey('NOVARTIS.'), 'novartis');
    assert.equal(canonicalCountryIdentityKey('NL'), 'netherlands');
    assert.equal(canonicalCountryIdentityKey('PAK'), 'pakistan');
    assert.equal(canonicalCountryIdentityKey('KE'), 'kenya');

    Object.values(files).forEach((file) => db.files.set(file.id, file));
    db.syncCompaniesFromFiles();
    db.pruneOrphanedContacts();

    const contacts = [keys.nl, keys.pk, keys.ke].map((key) => db.contacts.get(key));
    assert.ok(contacts.every(Boolean), 'all three country entities must be independently addressable');
    assert.deepEqual(contacts.map((c) => c!.country), ['Netherlands', 'Pakistan', 'Kenya']);
    assert.equal(db.contacts.has('novartis'), false, 'country-aware importer must not collapse to a name-only contact');
    assert.equal(
      Array.from(db.contacts.values()).filter((c) => c.entity_key === keys.nl).length,
      1,
      'same-country case/punctuation aliases merge exactly once'
    );
    assert.equal(selectContactEntity(contacts as any[], { company_name: 'Novartis' }), null, 'ambiguous name-only lookup is rejected');
    for (const contact of contacts) {
      const lookupCountry = contact!.country === 'Netherlands' ? 'NL' : contact!.country;
      assert.equal(
        selectContactEntity(contacts as any[], { company_name: 'NOVARTIS.', country: lookupCountry })?.entity_key,
        contact!.entity_key,
        `${contact!.country} lookup resolves only its entity`
      );
    }

    const tradeIndex = await TradeRelationshipResolver.buildTradeIndex();
    const expectedPartners = {
      nl: 'Exporter Netherlands A',
      pk: 'Exporter Pakistan B',
      ke: 'Exporter Kenya C',
    };
    for (const code of ['nl', 'pk', 'ke'] as const) {
      const rels = TradeRelationshipResolver.resolveFromIndex('Novartis', tradeIndex, 'importer', contacts[['nl', 'pk', 'ke'].indexOf(code)]!.country);
      assert.deepEqual(rels.importedFrom.map((r) => r.partnerName), [expectedPartners[code]], `${code} trade relationship must be isolated`);
    }

    const cachePayloads = {
      nl: 'netherlands-test@example.invalid',
      pk: 'pakistan-test@example.invalid',
      ke: 'kenya-test@example.invalid',
    };
    const cacheCountryInput = { nl: 'NL', pk: 'PAK', ke: 'KE' };
    for (const code of ['nl', 'pk', 'ke'] as const) {
      await saveEnrichedData({
        company_name: 'Novartis',
        country: cacheCountryInput[code],
        email: cachePayloads[code],
        emails_list: [cachePayloads[code]],
        source: 'canonical_entity_isolation_test',
      });
    }
    let sqlDb = await getDb();
    await sqlDb.exec('PRAGMA integrity_check;');
    await new Promise((resolve) => setTimeout(resolve, 400));

    const cacheRows = await sqlDb.all("SELECT * FROM contact_cache WHERE source = 'canonical_entity_isolation_test'");
    assert.equal(cacheRows.length, 3, 'three separate cache rows must be persisted');
    await sqlDb.run(
      'INSERT OR REPLACE INTO contact_cache (company_name, details_json, source) VALUES (?, ?, ?)',
      ['legacy ambiguous novartis', JSON.stringify({ emails_list: ['ambiguous-test@example.invalid'] }), 'canonical_entity_isolation_test']
    );
    assert.equal(
      await getCachedCompany('Legacy Ambiguous Novartis', 'Kenya'),
      null,
      'countryless legacy cache rows are never attached to an arbitrary country'
    );
    for (const code of ['nl', 'pk', 'ke'] as const) {
      const cached = await getCachedCompany('Novartis', contacts[['nl', 'pk', 'ke'].indexOf(code)]!.country);
      assert.deepEqual(cached?.emails_list, [cachePayloads[code]], `${code} cache read must not leak`);
      const projected = { ...contacts[['nl', 'pk', 'ke'].indexOf(code)] } as any;
      const row = selectContactCacheRow(cacheRows, projected);
      assert.ok(row, `${code} API/contact projection selects its cache row`);
      applyEnrichmentDetailsToContact(projected, JSON.parse(row.details_json));
      assert.deepEqual(projected.emails_list, [cachePayloads[code]], `${code} projected payload remains isolated`);
    }

    resetDbInstanceForTests();
    sqlDb = await getDb();
    for (const code of ['nl', 'pk', 'ke'] as const) {
      const cached = await getCachedCompany('Novartis', contacts[['nl', 'pk', 'ke'].indexOf(code)]!.country);
      assert.deepEqual(cached?.emails_list, [cachePayloads[code]], `${code} survives on-disk database reinitialization`);
    }

    const isolatedContacts = contacts.map((contact) => ({ ...contact! })) as any[];
    const merged = mergeContacts([
      ...isolatedContacts,
      { ...isolatedContacts[0], company_name: 'NOVARTIS.' },
    ] as any);
    assert.equal(merged.length, 3, 'aliases merge within Netherlands but never across countries');

    const lowerLevelDirectory = await buildContactReport(isolatedContacts as any, 'importer', tradeIndex);
    assert.deepEqual(lowerLevelDirectory.countrySections.map((s) => s.country).sort(), ['Kenya', 'Netherlands', 'Pakistan']);
    for (const section of lowerLevelDirectory.countrySections) {
      assert.equal(section.importers.length, 1);
      assert.equal(section.importers[0].companyName, 'Novartis');
    }
    const internationalDirectory = await getInternationalImporterDirectory(isolatedContacts as any, tradeIndex);
    assert.deepEqual(internationalDirectory.countrySections.map((s) => s.country).sort(), ['Kenya', 'Netherlands']);
    assert.equal(internationalDirectory.countrySections.some((s) => s.country === 'Pakistan'), false, 'real Pakistan exclusion remains intact');

    db.files.delete(files.nl.id);
    db.syncCompaniesFromFiles();
    db.pruneOrphanedContacts();
    assert.equal(db.contacts.has(keys.nl), false, 'deleted Netherlands source invalidates its contact');
    assert.ok(db.contacts.has(keys.pk) && db.contacts.has(keys.ke), 'other country entities survive source deletion');

    db.contacts.clear();
    db.syncCompaniesFromFiles();
    db.pruneOrphanedContacts();
    assert.equal(db.contacts.has(keys.nl), false, 'removed entity does not resurrect after rebuild');
    assert.ok(db.contacts.has(keys.pk) && db.contacts.has(keys.ke), 'remaining entities survive rebuild');

    console.log('CANONICAL KEYS', keys);
    console.log('CONTACT IDS', contacts.map((c) => ({ id: c!.id, entity_key: c!.entity_key, country: c!.country })));
    console.log('TRADE PROOF', expectedPartners);
    console.log('CACHE PROOF', cachePayloads);
    console.log('canonical_multi_country_entity_isolation.test.ts: PASS');
  } finally {
    try {
      const cleanupDb = await getDb();
      await cleanupDb.run("DELETE FROM contact_cache WHERE source = 'canonical_entity_isolation_test'");
      await cleanupDb.exec('PRAGMA integrity_check;');
    } catch (_) {}
    db.files.clear();
    originalFiles.forEach((value, key) => db.files.set(key, value));
    db.contacts.clear();
    originalContacts.forEach((value, key) => db.contacts.set(key, value));
    db.rebuildIndexes();
    assert.equal(hash(productionDb), prodDbBefore, 'production SQLite remains byte-identical');
    assert.equal(hash(productionJson), prodJsonBefore, 'production JSON remains byte-identical');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
