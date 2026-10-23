import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ExportTemporaryFiles } from '../export_temp';
import { validateExportRequest } from '../export_validation';
import JSZip from 'jszip';
import { processContactExport, processFullDatasetExport, processExportRequest } from '../export_manager';
import { TradeRelationshipResolver } from '../trade_relationship_resolver';

const base = { dataset: 'contacts', title: 'Synthetic fixture', format: 'all', records: [{ name: 'Fixture' }] };
for (const filenamePrefix of ['../escape', '..\\escape', 'C:escape', '\\\\host\\share', 'a/b', 'a\\b', 'a\u0000b', 'a\r\nb', 'file:stream', 'a?b']) {
  for (const dataset of ['contacts', 'outreach', 'files']) {
    for (const report_type of ['importer', 'exporter', 'both', 'international_importer']) {
      assert.throws(() => validateExportRequest({ ...base, dataset, report_type, filenamePrefix }), { name: 'ExportValidationError' });
    }
  }
}
for (const filenamePrefix of [undefined, '', 'Trade report', 'شرکت 薬品', "Company's (2026)"]) {
  assert.doesNotThrow(() => validateExportRequest({ ...base, filenamePrefix }));
}
const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-export-boundary-test-'));
try {
  const outside = path.join(parent, 'untouched.txt');
  fs.writeFileSync(outside, 'preserve');
  const first = new ExportTemporaryFiles(parent);
  const second = new ExportTemporaryFiles(parent);
  const [a, b] = await Promise.all([first.write('شرکت 薬品.csv', 'one'), second.write('شرکت 薬品.csv', 'two')]);
  assert.notEqual(path.dirname(a), path.dirname(b));
  assert.equal(first.nameFor(a), 'شرکت 薬品.csv');
  assert.equal(fs.readFileSync(a, 'utf8'), 'one');
  assert.equal(fs.readFileSync(b, 'utf8'), 'two');
  await assert.rejects(first.write('../untouched.txt', 'overwrite'), { name: 'ExportValidationError' });
  assert.throws(() => first.nameFor(b), /Unknown temporary/);
  first.cleanup();
  first.cleanup();
  assert.equal(fs.existsSync(a), false);
  assert.equal(fs.existsSync(b), true);
  second.cleanup();
  const failing = new ExportTemporaryFiles(parent);
  const originalWrite = fs.promises.writeFile;
  try {
    fs.promises.writeFile = async (...args: Parameters<typeof fs.promises.writeFile>) => {
      await originalWrite(...args);
      throw new Error('controlled partial write failure');
    };
    await assert.rejects(failing.write('safe.csv', 'partial'), /controlled partial/);
  } finally {
    fs.promises.writeFile = originalWrite;
    failing.cleanup();
  }
  assert.deepEqual(fs.readdirSync(parent), ['untouched.txt']);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'preserve');
} finally {
  fs.rmSync(parent, { recursive: true, force: true });
}
console.log('PASS export path rejection, Unicode names, concurrent isolation, partial-write cleanup, outside-file preservation');

// No production history/provider access: this suite tests the export boundary,
// with an explicitly empty synthetic trade index.
const originalIndex = TradeRelationshipResolver.buildTradeIndex;
TradeRelationshipResolver.buildTradeIndex = async () => ({ importedFrom: new Map(), suppliedTo: new Map() });
try {
  const records = [{ id: 'synthetic-export', company_name: 'Synthetic Export Fixture', country: 'Kenya', email: 'fixture@example.test' }];
  for (const processor of [processContactExport, processFullDatasetExport, processExportRequest]) {
    await assert.rejects(processor({ ...base, records, filenamePrefix: '../escape' } as any), { name: 'ExportValidationError' });
  }
  for (const report_type of ['importer', 'exporter', 'both', 'international_importer'] as const) {
    const result = await processExportRequest({ ...base, dataset: 'contacts', format: 'all', records, report_type, filenamePrefix: 'Trade 薬品' });
    assert.equal(result.failedFormats, undefined);
    const zip = await JSZip.loadAsync(result.buffer);
    const names = Object.keys(zip.files);
    assert.equal(names.length, report_type === 'both' ? 8 : 4);
    assert.ok(names.every(name => name.startsWith('Trade 薬品_') && !/[\\/]/u.test(name)));
    for (const name of names) assert.ok((await zip.file(name)!.async('uint8array')).length > 0);
  }
  const dataset = await processFullDatasetExport({ ...base, dataset: 'files', format: 'all', records, filenamePrefix: 'Trade 薬品' });
  assert.equal(dataset.failedFormats, undefined);
  assert.equal(Object.keys((await JSZip.loadAsync(dataset.buffer)).files).length, 4);
} finally {
  TradeRelationshipResolver.buildTradeIndex = originalIndex;
}
console.log('PASS direct processor rejection and all contact/dataset ZIP modes preserve readable artifacts');
