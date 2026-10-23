import assert from 'node:assert/strict';
import { createLatestResearchRequest } from '../../src/utils/latestResearchRequest.ts';
import type { SafeFetchResult } from '../../src/utils/safeFetch.ts';
import { chooseResearchRunId, validResearchRun, validResearchSummaries } from '../../src/utils/researchRunValidation.ts';
const success = (id: string): SafeFetchResult<{ id: string }> => ({ ok: true, status: 200, data: { id } });

const reader = createLatestResearchRequest(1000);
const published: string[] = [];
let finishOld!: (result: SafeFetchResult<{ id: string }>) => void;
let oldSignal!: AbortSignal;
const old = reader.run(signal => {
  oldSignal = signal;
  return new Promise<SafeFetchResult<{ id: string }>>(resolve => { finishOld = resolve; }); // deliberately ignores abort
}, result => published.push(result.data!.id));
await Promise.resolve();
await reader.run(async () => success('new selection'), result => published.push(result.data!.id));
assert.equal(oldSignal.aborted, true);
finishOld(success('wrong older company'));
await old;
await Promise.resolve();
assert.deepEqual(published, ['new selection'], 'late old company must never overwrite the current selected company');

let finishUnmounted!: (result: SafeFetchResult<{ id: string }>) => void;
const unmounted = reader.run(() => new Promise<SafeFetchResult<{ id: string }>>(resolve => { finishUnmounted = resolve; }), () => assert.fail('unmounted callback'));
await Promise.resolve(); reader.cancel(); finishUnmounted(success('closed')); await unmounted;
let dispatches = 0;
const cancelledBeforeDispatch = reader.run(async () => { dispatches++; return success('unneeded'); }, () => assert.fail('cancelled callback'));
reader.cancel(); await cancelledBeforeDispatch; assert.equal(dispatches, 0);

const errors: SafeFetchResult<unknown>[] = [];
await reader.run(async () => { throw new Error('synthetic transport failure'); }, result => errors.push(result));
assert.equal(errors[0].code, 'RESEARCH_READ_FAILED');
await reader.run(async () => ({ ok: false, status: 404, data: null, error: 'Missing retained run' }), result => errors.push(result));
assert.equal(errors[1].status, 404);

const deadlineReader = createLatestResearchRequest(20);
let finishTimedOut!: (result: SafeFetchResult<{ id: string }>) => void;
let timeoutSignal!: AbortSignal;
const timeoutResults: SafeFetchResult<{ id: string }>[] = [];
await deadlineReader.run(signal => {
  timeoutSignal = signal;
  return new Promise<SafeFetchResult<{ id: string }>>(resolve => { finishTimedOut = resolve; });
}, result => timeoutResults.push(result));
assert.equal(timeoutResults[0].code, 'RESEARCH_READ_TIMEOUT', 'hanging response must stop loading with an explicit failure');
assert.equal(timeoutSignal.aborted, true);
finishTimedOut(success('too late')); await Promise.resolve(); await Promise.resolve();
assert.equal(timeoutResults.length, 1);
await deadlineReader.run(async () => success('retry'), result => timeoutResults.push(result));
assert.equal(timeoutResults[1].data?.id, 'retry', 'a timeout must not prevent a later successful retry');

for (let i = 0; i < 200; i++) await reader.run(async () => success(String(i)), result => assert.equal(result.data?.id, String(i)));
reader.cancel(); deadlineReader.cancel();
for (const invalid of [0, -1, Infinity, NaN, 0.5, 300001]) assert.throws(() => createLatestResearchRequest(invalid));
const run = { id: 'selected', company_name: 'Synthetic buyer', country: 'Kenya', status: 'COMPLETED', started_at: '2026-10-23', queries: [], results: [], raw_records: [], timeline: [] };
assert.equal(validResearchRun(run, 'selected'), true);
assert.equal(validResearchRun(run, 'another'), false, 'response identity must match requested run, even when the transport succeeds');
for (const patch of [{ queries: [null] }, { results: [null] }, { timeline: [{ message: {} }] }, { raw_records: [{}] }, { company_name: {} }]) assert.equal(validResearchRun({ ...run, ...patch }, 'selected'), false);
assert.equal(validResearchSummaries([run]), true);
assert.equal(validResearchSummaries([{ ...run, status: {} }]), false);
const result = { id: 'result', raw_record_id: 'raw', query: 'fixture', provider: 'serper', title: 'Fixture', url: 'https://example.test', snippet: 'public', status: 'success', links: [], text: 'retained' };
assert.equal(validResearchRun({ ...run, results: [result] }, 'selected'), true);
for (const patch of [{ links: null }, { links: [{}] }, { text: {} }]) assert.equal(validResearchRun({ ...run, results: [{ ...result, ...patch }] }, 'selected'), false);
const recent = Array.from({ length: 1000 }, (_, i) => ({ id: `recent-${i}` }));
assert.equal(chooseResearchRunId('older-retained-run', 'different-saved-id', recent), 'older-retained-run');
assert.equal(chooseResearchRunId('', 'older-retained-run', recent), 'older-retained-run');
assert.equal(chooseResearchRunId('', '', recent), 'recent-0');
assert.equal(chooseResearchRunId('', '', []), '');
console.log('PASS research selection isolation, ignored aborts, unmount, pre-dispatch cancellation, errors, deadline, retry and 200 repeated reads');
