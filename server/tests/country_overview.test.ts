import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildCountryOverview, isCountryOverview } from '../../shared/country_overview';
import { CountryView } from '../../src/components/CountryView';

const overview = buildCountryOverview([
  { country: 'Kenya', importer: 'Same Name', exporter: 'Shared Supplier', total_value: 100 },
  { country: 'Kenya', importer: 'Same Name', exporter: 'Second Supplier', total_value: 20 },
  { country: 'Uganda', importer: 'Same Name', exporter: 'Shared Supplier', total_value: -10 },
]);
assert.deepEqual(overview.stats, { totalCountries: 2, totalImporters: 2, totalExporters: 2, totalValue: 110 });
assert.ok(isCountryOverview(overview));
assert.deepEqual(buildCountryOverview([]).stats, { totalCountries: 0, totalImporters: 0, totalExporters: 0, totalValue: 0 });
for (const value of [null, {}, { ...overview, stats: { ...overview.stats, totalCountries: 1 } },
  { ...overview, stats: { ...overview.stats, totalExporters: -1 } }, { ...overview, countries: [null] },
  { ...overview, stats: { ...overview.stats, totalValue: NaN } }]) assert.equal(isCountryOverview(value), false);
const selected = { id: 'selected', name: 'Selected.csv', rows: [], summary: { total_rows: 17612 } } as any;
const other = { id: 'other', name: 'Other.csv', rows: [{ Importer: 'Unrelated Importer', Exporter: 'Unrelated Supplier', Country: 'Kenya', TOT_FC: 987654321 }], summary: { total_rows: 1 } } as any;
const markup = renderToStaticMarkup(React.createElement(CountryView, { selectedFile: selected, files: [selected, other] }));
assert.doesNotMatch(markup, /987,654,321|987\.65|Unrelated Importer|Unrelated Supplier/);
assert.match(markup, /Not available/);
const zero = renderToStaticMarkup(React.createElement(CountryView, { selectedFile: { ...selected, summary: { total_rows: 0 } } }));
assert.doesNotMatch(zero, /Not available/);
console.log('PASS country overview entity denominator, exporter dedup, zero/unknown, validation and scoped static markup (not browser QA)');
