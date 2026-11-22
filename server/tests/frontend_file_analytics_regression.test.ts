import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createLatestRequestGuard,
  reconcileSelectedFile,
  replacedUploadFileIds,
} from '../../src/store/appStore';
import {
  FILE_PAGE_SIZE_OPTIONS,
  compareTradeDates,
  isTradeDateInRange,
  parseTradeDateKey,
} from '../../src/components/FileViewer';
import {
  buildStatsExportQuery,
  monthDateRange,
} from '../../src/components/StatsTab';
import { escapeCountryCsvCell } from '../../src/components/CountryView';
import {
  FILE_VIEW_SORT_KEYS,
  canonicalFileViewSortKey,
  compareFileViewDates,
  parseFileViewDateKey,
  selectFileViewRows,
} from '../file_view';

// H15: a superseded request is aborted and cannot finish/commit as current.
const requests = createLatestRequestGuard();
const first = requests.begin();
const second = requests.begin();
assert.equal(first.controller.signal.aborted, true);
assert.notEqual(first.generation, second.generation);
assert.equal(requests.isCurrent(first), false);
assert.equal(requests.finish(first), false);
assert.equal(requests.isCurrent(second), true);
assert.equal(requests.finish(second), true);
assert.equal(requests.isCurrent(second), false);
const cancelled = requests.begin();
requests.cancel();
assert.equal(cancelled.controller.signal.aborted, true);
assert.equal(requests.finish(cancelled), false);

// M14/M20: explicit replacement and deleted-selection reconciliation are deterministic.
const existing = [
  { id: 'old', name: ' shipments.csv ' },
  { id: 'other', name: 'other.csv' },
  { id: 'old-2', name: 'SHIPMENTS.CSV' },
];
assert.deepEqual(replacedUploadFileIds(existing, { id: 'new', name: 'shipments.csv' }), [], 'ordinary same-name uploads remain distinct');
assert.deepEqual(replacedUploadFileIds(existing, { id: 'new', name: 'shipments.csv' }, 'old'), ['old']);
assert.deepEqual(replacedUploadFileIds(existing, { id: 'old', name: 'shipments.csv' }, 'old'), [], 'identical content returns the existing ID');
assert.deepEqual(replacedUploadFileIds(existing, { id: 'new', name: 'shipments.csv' }, 'other'), [], 'a different-name dataset is never cleanup target');
assert.equal(reconcileSelectedFile({ id: 'deleted', rows: ['stale'] }, [{ id: 'other' }]), null);
assert.deepEqual(reconcileSelectedFile({ id: 'other', rows: [] }, [{ id: 'other' }]), { id: 'other', rows: [] });

// M16: month presets produce real calendar month ends, including leap years.
assert.deepEqual(monthDateRange(new Date(2026, 1, 10)), { startDate: '2026-02-01', endDate: '2026-02-28' });
assert.deepEqual(monthDateRange(new Date(2028, 1, 10)), { startDate: '2028-02-01', endDate: '2028-02-29' });
assert.deepEqual(monthDateRange(new Date(2026, 3, 10)), { startDate: '2026-04-01', endDate: '2026-04-30' });
assert.deepEqual(monthDateRange(new Date(2026, 11, 10)), { startDate: '2026-12-01', endDate: '2026-12-31' });

// M17: fallback exports serialize the applied scope rather than pending inputs.
const appliedQuery = buildStatsExportQuery({
  fileIds: ['file/1'], country: 'Sri Lanka', importer: 'Fixture & Co',
  startDate: '2026-02-01', endDate: '2026-02-28',
});
const appliedParams = new URL(appliedQuery, 'http://fixture.local').searchParams;
assert.equal(appliedParams.get('file_id'), 'file/1');
assert.equal(appliedParams.get('country'), 'Sri Lanka');
assert.equal(appliedParams.get('start'), '2026-02-01');
assert.equal(appliedParams.get('end'), '2026-02-28');
assert.equal(buildStatsExportQuery({ fileIds: [], country: 'ALL', importer: 'Unused', startDate: '', endDate: '' }), '');

// M25/L06: client and server accept the same noncanonical calendar-day formats.
const excelSerial = Math.floor((Date.UTC(2026, 7, 13) - Date.UTC(1899, 11, 30)) / 86400000);
const dateCases: Array<[unknown, number | null]> = [
  ['2026-08-13', 20260813],
  ['2026-08-13T23:30:00Z', 20260813],
  ['13/08/2026', 20260813],
  ['08/13/2026', 20260813],
  ['13-Aug-2026', 20260813],
  ['13 August 2026', 20260813],
  ['20260813', 20260813],
  [excelSerial, 20260813],
  ['2028-02-29', 20280229],
  ['2026-02-29', null],
  ['2026-04-31', null],
  ['not a date', null],
  ['', null],
];
for (const [value, expected] of dateCases) {
  assert.equal(parseTradeDateKey(value), expected, `client date key for ${String(value)}`);
  assert.equal(parseFileViewDateKey(value), expected, `server date key for ${String(value)}`);
}
assert.ok(compareTradeDates('01/02/2026', '31/12/2025') > 0);
assert.ok(compareFileViewDates('01/02/2026', '31/12/2025') > 0);
assert.equal(compareTradeDates('01-Jan-2026', '2026-01-01'), 0);
assert.equal(isTradeDateInRange('15-Jan-2026', '2026-01-01', '2026-01-31'), true);
assert.equal(isTradeDateInRange('31/12/2025', '2026-01-01', '2026-01-31'), false);
assert.equal(isTradeDateInRange('20260201', '2026-01-01', '2026-01-31'), false);
assert.equal(isTradeDateInRange('15-Jan-2026', '2026-01-01', '2026-02-28'), true);

// M13/M25: lowercase client keys and chronological dates reach canonical rows.
assert.equal(canonicalFileViewSortKey('importer'), 'Importer');
assert.equal(canonicalFileViewSortKey('total_fc_usd'), 'Total Value (USD)');
assert.equal(canonicalFileViewSortKey('custom_source'), 'custom_source');
const alphabetical = selectFileViewRows([
  { IMPORTER: 'Zulu', BE_DATE: '31/12/2025' },
  { IMPORTER: 'Alpha', BE_DATE: '01-Feb-2026' },
  { IMPORTER: 'Middle', BE_DATE: '20260115' },
], { sort_by: 'importer', sort_dir: 'asc' });
assert.deepEqual(alphabetical.map(row => row.Importer), ['Alpha', 'Middle', 'Zulu']);
const chronological = selectFileViewRows([
  { id: 'old', BE_DATE: '31/12/2025' },
  { id: 'new', BE_DATE: '01-Feb-2026' },
  { id: 'middle', BE_DATE: '20260115' },
  { id: 'serial', BE_DATE: excelSerial },
], { sort_by: 'date', sort_dir: 'desc' });
assert.deepEqual(chronological.map(row => row.id), ['serial', 'new', 'middle', 'old']);
const january = selectFileViewRows([
  { id: 'before', BE_DATE: '31/12/2025' },
  { id: 'january', BE_DATE: '15-Jan-2026' },
  { id: 'after', BE_DATE: '20260201' },
  { id: 'unknown', BE_DATE: '' },
], { start_date: '2026-01-01', end_date: '2026-01-31' });
assert.deepEqual(january.map(row => row.id), ['january', 'unknown']);

// L08: both page-size controls render the same compatibility-preserving union.
assert.deepEqual([...FILE_PAGE_SIZE_OPTIONS], [15, 25, 50, 100, 200, 250, 500]);
const fileViewerSource = readFileSync(new URL('../../src/components/FileViewer.tsx', import.meta.url), 'utf8');
assert.equal((fileViewerSource.match(/FILE_PAGE_SIZE_OPTIONS\.map/g) || []).length, 2);
assert.match(fileViewerSource, /pageParams\.set\('sort_by', serverSortKey\(sortColumn\)\)/);
assert.match(fileViewerSource, /isTradeDateInRange\(rawDate, startDate, endDate\)/);
const appStoreSource = readFileSync(new URL('../../src/store/appStore.ts', import.meta.url), 'utf8');
assert.match(appStoreSource, /loadingOperations\.current > 0/);
assert.match(appStoreSource, /uploadRequests\.finish\(token\)\) setUploading\(false\)/);
assert.match(appStoreSource, /\?keep_history=true/);
const uploadAreaSource = readFileSync(new URL('../../src/components/UploadArea.tsx', import.meta.url), 'utf8');
assert.match(uploadAreaSource, /uploading \|\| uploadPending\.current/);
assert.match(uploadAreaSource, /onFileUpload\(file, replaceFileId\)/);
const statsSource = readFileSync(new URL('../../src/components/StatsTab.tsx', import.meta.url), 'utf8');
assert.match(statsSource, /buildStatsExportQuery\(scope\)/);
assert.match(statsSource, /Applied range:/);
assert.match(statsSource, /Date edits are not applied yet\./);
assert.deepEqual(Object.keys(FILE_VIEW_SORT_KEYS).sort(), ['country', 'date', 'exporter', 'importer', 'item', 'total_fc_usd']);

// L14: CSV quoting is retained, and formula-like cells are made literal text.
assert.equal(escapeCountryCsvCell('=1+1'), '"\'=1+1"');
assert.equal(escapeCountryCsvCell('+SUM(A1:A2)'), '"\'+SUM(A1:A2)"');
assert.equal(escapeCountryCsvCell('  @SUM(A1:A2)'), '"\'  @SUM(A1:A2)"');
assert.equal(escapeCountryCsvCell('\t=1+1'), '"\'\t=1+1"');
assert.equal(escapeCountryCsvCell('Fixture "Ltd"'), '"Fixture ""Ltd"""');
assert.equal(escapeCountryCsvCell('Ordinary text'), '"Ordinary text"');

console.log('PASS frontend request/file/analytics regressions (H15 M13 M14 M16 M17 M20 M25 L06 L08 L14)');
