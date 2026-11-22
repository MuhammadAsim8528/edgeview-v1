import assert from 'node:assert/strict';
import { inferExporterCountryFromDataset } from '../dataset_provenance';
import { canonicalCountryIdentityKey, canonicalEntityIdentityKey } from '../company_identity';
import { detectAffirmedCountryNames, detectNegatedCountryNames, normalizeCountryName, normalizeCountryNameStrict }
  from '../../src/utils/countryNormalizer';
import { hasExplicitCountryCallingCode, isCountryCompatiblePhone } from '../phone_country';
import { detectColumns, hasTradeParties } from '../../shared/dataset_columns';
import { computeSummary } from '../summary';

const rows = Array.from({ length: 12 }, (_, index) => ({
  IMPORTER: `Foreign buyer ${index}`,
  EXPORTER: `Pakistan supplier ${index}`,
  COUNTRY: 'Kenya',
  PORT: index === 0 ? 'UNKNOWN' : 'KPAE',
}));

assert.equal(inferExporterCountryFromDataset({
  columns: ['IMPORTER', 'EXPORTER', 'COUNTRY', 'DV_PAK', 'AV_PAK', 'PORT'],
  rows,
}), '', 'M03: a file-wide port ratio cannot assign every exporter a country');

assert.equal(inferExporterCountryFromDataset({
  columns: ['IMPORTER', 'EXPORTER', 'COUNTRY', 'EXPORTER_COUNTRY'],
  rows: rows.map(row => ({ ...row, EXPORTER_COUNTRY: 'PK' })),
}), 'Pakistan', 'an explicit, uniform exporter-country column remains valid');
assert.equal(inferExporterCountryFromDataset({
  columns: ['IMPORTER', 'EXPORTER', 'COUNTRY', 'EXPORTER_COUNTRY'],
  rows: rows.map((row, index) => ({ ...row, EXPORTER_COUNTRY: index === 0 ? 'Kenya' : 'Pakistan' })),
}), '', 'mixed explicit exporter countries abstain');
assert.equal(inferExporterCountryFromDataset({
  columns: ['IMPORTER', 'EXPORTER', 'COUNTRY', 'EXPORTER_COUNTRY'],
  rows: rows.map((row, index) => ({ ...row, EXPORTER_COUNTRY: index === 0 ? '' : 'Pakistan' })),
}), '', 'a missing exporter-country value cannot be filled from other rows');

assert.equal(inferExporterCountryFromDataset({
  columns: ['IMPORTER', 'EXPORTER', 'COUNTRY', 'PORT'],
  rows,
}), '', 'generic trade files must not inherit a country');

assert.equal(inferExporterCountryFromDataset({
  columns: ['IMPORTER', 'EXPORTER', 'COUNTRY', 'DV_PAK', 'AV_PAK', 'PORT'],
  rows: rows.map((row) => ({ ...row, PORT: 'JFK' })),
}), '', 'valuation column names alone are insufficient without matching port provenance');

assert.equal(
  canonicalEntityIdentityKey('WORLD HEALTH PHARMACEUTICAL CO., LTD.', 'Cambodia'),
  canonicalEntityIdentityKey('WORLD HEALTH PHARMACEUTICAL CO LTD', 'Cambodia'),
  'formatting-only punctuation variants must share one entity identity',
);

// H13: missing, mixed, contradictory and negated countries never become facts.
assert.equal(normalizeCountryName('NA'), 'Unknown', 'NA is a missing-data marker, not Namibia');
assert.equal(normalizeCountryName('N/A'), 'Unknown');
assert.equal(normalizeCountryName('NAM'), 'Namibia', 'unambiguous Namibia alpha-3 remains valid');
for (const unresolved of ['Niger / Nigeria', 'Sudan and South Sudan', 'not Kenya', 'Nigeria (NE)', 'Kenya / N/A']) {
  assert.equal(normalizeCountryName(unresolved), unresolved, `preserve unresolved country text: ${unresolved}`);
  assert.equal(normalizeCountryNameStrict(unresolved), '', `strict identity abstains: ${unresolved}`);
  assert.equal(canonicalCountryIdentityKey(unresolved), '');
}
assert.equal(normalizeCountryName('Country: United States of America'), 'United States');
assert.equal(canonicalEntityIdentityKey('Example Co', 'NA'), 'example co');
assert.equal(canonicalEntityIdentityKey('Example Co', 'Kenya'), 'example co__kenya');
assert.deepEqual(detectAffirmedCountryNames('Not Nigeria; Niger office'), ['Niger']);
assert.deepEqual(detectNegatedCountryNames('Not Nigeria; Niger office'), ['Nigeria']);

// H14: comprehensive calling-code data rejects foreign international numbers;
// local numbers and valid target-country prefixes remain eligible.
assert.equal(isCountryCompatiblePhone('+92 300 1234567', 'Germany'), false);
assert.equal(isCountryCompatiblePhone('+49 30 1234567', 'Germany'), true);
assert.equal(hasExplicitCountryCallingCode('+49 30 1234567', 'Germany'), true);
assert.equal(hasExplicitCountryCallingCode('030 1234567', 'Germany'), false);
assert.equal(isCountryCompatiblePhone('030 1234567', 'Germany'), true);
assert.equal(isCountryCompatiblePhone('+1 242 555 0123', 'United States'), false, 'Bahamas is not US merely because both use +1');
assert.equal(isCountryCompatiblePhone('+1 212 555 0123', 'United States'), true);
assert.equal(isCountryCompatiblePhone('0049 30 1234567', 'Germany'), true, 'standard 00 international prefix remains supported');
assert.equal(isCountryCompatiblePhone('0092 300 1234567', 'Germany'), false);

// M22: attributes of a trade party are not the party-name column itself.
const partyAttributes = ['Importer Country', 'Exporter Country', 'Importer Notes', 'Exporter Notes', 'Item'];
const detectedAttributes = detectColumns(partyAttributes).displayColumns;
assert.equal(detectedAttributes.find(column => column.key === 'importer')?.actualCol, null);
assert.equal(detectedAttributes.find(column => column.key === 'exporter')?.actualCol, null);
assert.equal(hasTradeParties(partyAttributes), false);
const validPartyColumns = detectColumns(['Importer Name', 'Exporter Company']).displayColumns;
assert.equal(validPartyColumns.find(column => column.key === 'importer')?.actualCol, 'Importer Name');
assert.equal(validPartyColumns.find(column => column.key === 'exporter')?.actualCol, 'Exporter Company');
const badSummary = computeSummary(partyAttributes, [{ 'Importer Country': 'Kenya', 'Exporter Country': 'Pakistan',
  'Importer Notes': 'not a buyer', 'Exporter Notes': 'not a supplier' }]);
assert.equal(badSummary.detected_importer_col, undefined);
assert.equal(badSummary.detected_exporter_col, undefined);
assert.deepEqual(badSummary.importers_list, []);
assert.deepEqual(badSummary.exporters_list, []);
const validSummary = computeSummary(['Importer Name', 'Exporter Company', 'Total Value (USD)'], [
  { 'Importer Name': 'Valid Buyer', 'Exporter Company': 'Valid Supplier', 'Total Value (USD)': 10 },
]);
assert.deepEqual(validSummary.importers_list, ['Valid Buyer']);
assert.deepEqual(validSummary.exporters_list, ['Valid Supplier']);
assert.equal(validSummary.total_cost_usd, 10);

console.log('dataset provenance and identity/country helper tests passed');
