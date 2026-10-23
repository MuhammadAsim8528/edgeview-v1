import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntlDirectoryTable } from '../../src/components/Contacts';
import { directoryPage } from '../../src/utils/directoryPagination';

const rows = Array.from({ length: 205 }, (_, index) => ({ sNo: index + 1, importer: `SYN-${index + 1}`, country: index < 80 ? 'Kenya' : 'Sri Lanka',
  tradedWith: '', topProducts: '', website: '', email: '', phone: '', address: '', leadership: '', sources: '' }));
const sections = [{ country: 'Kenya', importers: rows.slice(0, 80) }, { country: 'Sri Lanka', importers: rows.slice(80) }];
const allIds: number[] = [];
for (let page = 1; page <= 3; page++) {
  const result = directoryPage(sections, page);
  const pageRows = result.sections.flatMap(section => section.importers);
  assert.ok(pageRows.length <= 100, 'DOM page cannot grow with full directory size');
  assert.equal(result.totalRows, 205);
  assert.equal(result.totalPages, 3);
  allIds.push(...pageRows.map(row => row.sNo));
}
assert.deepEqual(allIds, Array.from({ length: 205 }, (_, index) => index + 1), 'no duplicates or omissions across country/page boundaries');
assert.equal(directoryPage(sections, 1).sections[1].importers.length, 20);
assert.equal(directoryPage(sections, 2).sections[0].totalImporters, 125);
for (const [requested, expected] of [[NaN, 1], [Infinity, 1], [-8, 1], [2.9, 2], [999, 3]]) assert.equal(directoryPage(sections, requested).page, expected);
assert.deepEqual([directoryPage([], 9).start, directoryPage([], 9).end], [0, 0]);
assert.throws(() => directoryPage(sections, 1, 0), /Invalid directory page size/);
assert.throws(() => directoryPage(sections, 1, 10000), /Invalid directory page size/);
const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
try {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => '3', setItem() {} } });
  const data = { title: 'Synthetic directory', countrySections: sections, totalImporters: 205, excluded: { country: 'Pakistan', count: 0 }, topProductsLimit: 5 };
  const markup = renderToStaticMarkup(<IntlDirectoryTable data={data} loading={false} onReload={() => {}} />);
  assert.ok(markup.includes('Showing 201-205 of 205 importers'));
  for (const row of rows) assert.equal(markup.includes(`>${row.importer}<`), row.sNo >= 201, 'saved page controls actual initial rendered rows');
  assert.match(markup, /aria-label="Next directory page" disabled=""/);
  assert.ok(!/aria-label="Previous directory page" disabled=""/.test(markup));
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Controlled unavailable UI storage'); } });
  assert.ok(renderToStaticMarkup(<IntlDirectoryTable data={data} loading={false} onReload={() => {}} />).includes('Showing 1-100 of 205 importers'));
  assert.ok(renderToStaticMarkup(<IntlDirectoryTable data={{ ...data, countrySections: [], totalImporters: 0 }} loading={false} onReload={() => {}} />).includes('No international importers in this dataset.'));
  assert.ok(renderToStaticMarkup(<IntlDirectoryTable data={null} loading onReload={() => {}} />).includes('Loading international importer directory'));
  console.log('PASS all-page directory coverage, bounded projection, saved-page rendered rows, empty/loading/denied-storage states; browser navigation/effect persistence NOT VERIFIED');
} finally {
  if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
  else delete (globalThis as any).localStorage;
}
