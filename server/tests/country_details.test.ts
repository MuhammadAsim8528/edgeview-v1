import assert from 'node:assert/strict';
import { loadCountryDetails, loadImporterDetails } from '../../src/utils/countryDetails';

const original = globalThis.fetch;
const controller = new AbortController();
const summary = { country: 'Kenya', importers_count: 1, exporters_count: 2, total_export_value: 100 };
const importers = [{ importer: 'Synthetic Buyer', exporters_count: 2, total_export_value: 100 }];
const detail = { exporter: 'Synthetic Supplier', product: 'Synthetic Item', quantity: 0, unit: 'KG', total_value: 0 };
let sum: unknown = summary, imps: unknown = importers, details: unknown = [detail], status = 200;
const urls: string[] = [];
const fixture = async (input: RequestInfo | URL) => {
  const url = String(input); urls.push(url);
  return new Response(JSON.stringify(url.includes('/summary') ? sum : url.includes('/importers') ? imps : details), { status });
};
try {
  globalThis.fetch = fixture;
  assert.equal((await loadCountryDetails('Kenya', 'file & other', controller.signal)).ok, true);
  assert.ok(urls.every(url => url.endsWith('?file_id=file+%26+other')));
  assert.equal((await loadImporterDetails('Kenya', 'Buyer / & ?', 'file & other', controller.signal)).ok, true);
  assert.match(urls.at(-1)!, /Buyer%20%2F%20%26%20%3F\/details/);
  for (const malformed of [null, {}, { ...summary, country: 42 }, { ...summary, country: 'Uganda' }, { ...summary, importers_count: -1 }, { ...summary, total_export_value: '100' }]) {
    sum = malformed;
    assert.equal((await loadCountryDetails('Kenya', undefined, controller.signal)).ok, false);
  }
  sum = summary;
  for (const malformed of [null, {}, [null], [{ importer: 'Buyer', exporters_count: -1, total_export_value: 0 }]]) {
    imps = malformed;
    assert.equal((await loadCountryDetails('Kenya', undefined, controller.signal)).ok, false);
  }
  imps = importers;
  for (const malformed of [null, {}, [null], [{ ...detail, quantity: '0' }], [{ ...detail, exporter: null }]]) {
    details = malformed;
    assert.equal((await loadImporterDetails('Kenya', 'Buyer', undefined, controller.signal)).ok, false);
  }
  details = [];
  assert.equal((await loadImporterDetails('Kenya', 'Buyer', undefined, controller.signal)).ok, true, 'genuine empty is distinct from failure');
  status = 500;
  sum = { error: 'PRIVATE PATH OR BUSINESS CONTENT' };
  const failed = await loadCountryDetails('Kenya', undefined, controller.signal);
  assert.ok('error' in failed); assert.doesNotMatch(failed.error, /PRIVATE/);
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal((await loadImporterDetails('Kenya', 'Buyer', undefined, controller.signal)).ok, false);
  globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
  const keepAlive = setTimeout(() => {}, 2000);
  try {
    assert.equal((await loadCountryDetails('Kenya', undefined, controller.signal, 10)).ok, false);
    const abort = new AbortController();
    const pending = loadImporterDetails('Kenya', 'Buyer', undefined, abort.signal);
    abort.abort();
    assert.equal((await pending).ok, false);
  } finally { clearTimeout(keepAlive); }
  console.log('PASS country/importer detail transport validation, encoded scope, zero/empty, offline, failure, timeout and cancellation');
} finally { globalThis.fetch = original; }
