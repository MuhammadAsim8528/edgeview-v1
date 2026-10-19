import assert from 'node:assert/strict';
import { inferExporterCountryFromDataset } from '../dataset_provenance';
import { canonicalEntityIdentityKey } from '../company_identity';

const rows = Array.from({ length: 12 }, (_, index) => ({
  IMPORTER: `Foreign buyer ${index}`,
  EXPORTER: `Pakistan supplier ${index}`,
  COUNTRY: 'Kenya',
  PORT: index === 0 ? 'UNKNOWN' : 'KPAE',
}));

assert.equal(inferExporterCountryFromDataset({
  columns: ['IMPORTER', 'EXPORTER', 'COUNTRY', 'DV_PAK', 'AV_PAK', 'PORT'],
  rows,
}), 'Pakistan', 'Pakistan customs export schema should identify exporter country');

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

console.log('dataset provenance tests passed');
