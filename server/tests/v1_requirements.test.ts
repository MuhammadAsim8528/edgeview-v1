import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installAiTransportFixture } from './fixtures/ai_transport';

const restoreAiTransport = installAiTransportFixture(['ai.test', 'api.groq.com', 'google.serper.dev', 'api.hunter.io', 'acme.example']);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-v1-test-'));
process.env.EDGEVIEW_CONFIG = path.join(temp, 'config.json');
process.env.EDGEVIEW_V1_DATA_DIR = path.join(temp, 'runs');
fs.writeFileSync(process.env.EDGEVIEW_CONFIG, JSON.stringify({
  nvidia_api_key: 'test-ai', nvidia_enabled: true, nvidia_model: 'test-model', nvidia_base_url: 'https://ai.test/v1',
  groq_api_key: 'test-groq', groq_enabled: true, groq_model: 'test-groq-model', primary_ai_provider: 'GROQ',
  serper_api_key: 'test-search', serper_enabled: true, hunter_enabled: false,
  firecrawl_enabled: false, tavily_enabled: false, exa_enabled: false, linkup_enabled: false, apify_enabled: false,
}));

let searchCalls = 0;
const aiCalls: string[] = [];
global.fetch = (async (input: string | URL | Request) => {
  const url = String(input);
  if (url.includes('chat/completions')) {
    aiCalls.push(url);
    return new Response(JSON.stringify({ choices: [{ message: { content: '["Acme Pharma Kenya official", "Acme Pharma Kenya contact", "Acme Pharma Kenya leadership"]' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.includes('google.serper.dev')) {
    searchCalls++;
    return new Response(JSON.stringify({ organic: [{ position: 1, title: 'Acme Pharma', link: 'https://acme.example/about', snippet: 'Official profile', date: '2026-01-01', sitelinks: [{ title: 'Contact', link: 'https://acme.example/contact' }] }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  throw new Error(`Unexpected URL ${url}`);
}) as typeof fetch;

const { runV1Enrichment, getV1Run } = await import('../v1_engine');
const run = await runV1Enrichment('Acme Pharma', 'Kenya');

assert.ok(run.queries.length >= 2 && run.queries.length <= 4, 'query generation is compact and bounded');
assert.match(aiCalls[0], /api\.groq\.com/, 'persisted primary AI provider controls runtime routing order');
assert.ok(run.queries.every(query => query.toLowerCase().includes('acme pharma') && query.toLowerCase().includes('kenya')), 'every query is identity anchored');
assert.equal(searchCalls, run.queries.length, 'each generated query is searched exactly once');
assert.equal(run.raw_records.filter(record => record.kind === 'scrape' && (record.request as any).url === 'https://acme.example/about').length, 1, 'duplicate result URLs are scraped once');
assert.ok(run.results.length >= 1, 'search results survive a downstream scrape failure');
assert.equal(run.results[0].status, 'success', 'downstream scrape failure never erases an already-fetched search result');
assert.equal(run.results[0].metadata.scrape_status, 'failed', 'downstream scrape failure remains visible on the normalized result');
assert.equal(run.results[0].title, 'Acme Pharma');
assert.equal(run.results[0].snippet, 'Official profile');
assert.equal(run.results[0].metadata.date, '2026-01-01', 'provider-only metadata is retained');
assert.ok(run.raw_records.some(record => record.kind === 'ai' && record.response), 'complete AI response is retained');
assert.equal(run.raw_records.filter(record => record.kind === 'search').length, searchCalls, 'every search request has a raw record');
assert.ok(run.raw_records.filter(record => record.kind === 'search').every(record => record.http_status === 200), 'actual response status is retained even for successful calls');
assert.ok(run.raw_records.some(record => record.kind === 'scrape' && record.failure), 'a structured failure is retained for every failed page request');
assert.ok(run.timeline.some(event => event.stage === 'scrape' && event.status === 'failed'), 'timeline exposes downstream failure');
assert.ok(run.raw_records.every(record => /^[a-f0-9]{64}$/.test(record.sha256)), 'raw records have integrity hashes');
assert.deepEqual(getV1Run(run.id), JSON.parse(JSON.stringify(run)), 'persisted JSON run can be read without information loss');
const malformedText = '<html>provider gateway error, not a search result</html>';
global.fetch = (async () => new Response(malformedText, { status: 200 })) as typeof fetch;
const malformedRun = await runV1Enrichment('Malformed Provider Example', 'Kenya');
const malformedSearch = malformedRun.raw_records.filter(record => record.kind === 'search');
assert.ok(malformedSearch.length > 0);
assert.ok(malformedSearch.every(record => record.response === malformedText && record.failure?.name === 'ProviderSchemaError'), 'malformed successful HTTP responses retain complete text and explicit schema failure');
assert.ok(malformedRun.timeline.some(event => event.stage === 'search' && event.status === 'failed'));
assert.deepEqual(getV1Run(malformedRun.id), JSON.parse(JSON.stringify(malformedRun)), 'malformed provider evidence survives storage round trip');
const errorPayload = { error: { code: 'upstream_problem' }, unknown_field: 'must survive' };
global.fetch = (async (input: string | URL | Request) => String(input).includes('chat/completions')
  ? Response.json({ choices: [{ message: { content: 'unusable model answer without anchored queries' } }] })
  : Response.json(errorPayload)) as typeof fetch;
const errorRun = await runV1Enrichment('Error Envelope Example', 'Kenya');
assert.equal(errorRun.status, 'FAILED', 'HTTP-200 provider errors are not successful empty research');
assert.ok(errorRun.raw_records.every(record => record.http_status === 200), 'HTTP status and semantic failure are distinct facts');
assert.ok(errorRun.raw_records.filter(record => record.kind === 'ai').every(record => record.failure?.name === 'ProviderSchemaError'), 'unusable model query answers must not become successful telemetry');
assert.ok(errorRun.raw_records.filter(record => record.kind === 'search').every(record => record.failure?.name === 'ProviderSchemaError' && JSON.stringify(record.response) === JSON.stringify(errorPayload)));
assert.ok(errorRun.timeline.some(event => event.message.includes('deterministic exact-identity fallback')));
const { saveAppSettings } = await import('../settings');
saveAppSettings({ hunter_enabled: true, hunter_api_key: 'synthetic-test-hunter' });
global.fetch = (async (input: string | URL | Request) => {
  if (String(input).includes('chat/completions')) return Response.json({ choices: [{ message: { content: '["Mixed Records Example Kenya first", "Mixed Records Example Kenya second"]' } }] });
  if (String(input).includes('google.serper.dev')) return Response.json({ organic: [null, { title: 'Mixed Records Example Kenya', link: 'https://mixedrecordsexample.test/about', snippet: 'Retained valid result' }] });
  if (String(input).includes('api.hunter.io')) return Response.json({ data: { emails: [null, { value: 'public@mixedrecordsexample.test', first_name: 'Synthetic', last_name: 'Fixture', extra: 'retain' }] } });
  throw new Error('Controlled downstream failure');
}) as typeof fetch;
const mixedRun = await runV1Enrichment('Mixed Records Example', 'Kenya');
assert.ok(mixedRun.results.some(result => result.snippet === 'Retained valid result'), 'one malformed organic item cannot erase its valid siblings');
assert.ok(mixedRun.raw_records.some(record => record.kind === 'search' && record.failure?.name === 'ProviderSchemaError' && (record.response as any).organic[0] === null), 'malformed sibling remains in raw evidence with explicit failure');
assert.ok(mixedRun.queries.includes('Mixed Records Example Kenya first'), 'actual AI-generated queries must not be displaced by the fallback query list');
assert.ok(mixedRun.results.some(result => result.provider === 'hunter' && result.snippet === 'public@mixedrecordsexample.test' && result.metadata.extra === 'retain'), 'one malformed email record cannot erase its valid siblings or unknown metadata');
assert.ok(mixedRun.raw_records.some(record => record.provider === 'hunter' && record.failure?.name === 'ProviderSchemaError'), 'malformed Hunter sibling is explicitly recorded');
console.log('PASS EdgeView V1 requirement-driven tests');
restoreAiTransport();
