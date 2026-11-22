import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installAiTransportFixture } from './fixtures/ai_transport';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-evidence-security-'));
process.env.EDGEVIEW_TEST_MODE = '1';
process.env.EDGEVIEW_TEST_DB_DIR = root;
process.env.EDGEVIEW_CONFIG = path.join(root, 'config.json');
process.env.EDGEVIEW_V1_DATA_DIR = path.join(root, 'runs');

const originalFetch = globalThis.fetch;
const hosts = ['api.groq.com', 'integrate.api.nvidia.com', 'google.serper.dev', 'api.hunter.io', 'scopeanchor.test', 'foreign.test'];
const restoreTransport = installAiTransportFixture(hosts);
type Scenario = 'grounded' | 'wrong_role' | 'length' | 'trailing' | 'cross' | 'same' | 'hard401' | 'hard401_extraction' | 'stall' | 'empty' | 'provider_echo' | 'model_ok';
let scenario: Scenario = 'grounded';
let wireCalls = 0;
let aiWireCalls = 0;

const officialHtml = '<html><title>Scopeanchor Medical Kenya</title><p>Alice Fixture Director at Scopeanchor Medical Kenya</p><a href="/contact">Contact</a></html>';
const foreignHtml = '<html><title>FOREIGN-ONLY-CLAIM</title><p>Alice Fixture Director at Scopeanchor Medical Kenya</p><a href="/contact">Contact</a></html>';
const startUrl = 'https://scopeanchor.test/start';

function writeConfig(overrides: Record<string, unknown> = {}) {
  fs.writeFileSync(process.env.EDGEVIEW_CONFIG!, JSON.stringify({
    serper_enabled: true, serper_api_key: 'synthetic-search-key',
    hunter_enabled: false, nvidia_enabled: false,
    groq_enabled: true, groq_api_key: 'synthetic-ai-key', groq_model: 'synthetic-model', primary_ai_provider: 'GROQ',
    ...overrides,
  }));
}

function extractionPayload(body: string) {
  const sent = JSON.parse(body);
  const request = JSON.parse(sent.messages[1].content);
  if (!request.chunks) {
    return Response.json({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify([
      `${request.company_name} ${request.country} official`, `${request.company_name} ${request.country} contact`,
    ]) } }] });
  }
  if (scenario === 'cross' || scenario === 'same') {
    return Response.json({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '{"claims":[]}' } }] });
  }
  const chunk = request.chunks[0];
  const valid = { field: 'leader', value: 'Alice Fixture', role: 'Director', source_chunk_id: chunk.id, quote: 'Alice Fixture Director' };
  const claims = request.batch === 1 ? [valid] : [];
  if (scenario === 'grounded' && request.batch === 1) claims.push({ ...valid, role: 'Chief Executive Officer' });
  let content = JSON.stringify({ claims });
  if (scenario === 'trailing') content += ' {"claims":[';
  const role = scenario === 'wrong_role' ? 'user' : 'assistant';
  const finishReason = scenario === 'length' ? 'length' : 'stop';
  return Response.json({ choices: [{ finish_reason: finishReason, message: { role, content } }] });
}

globalThis.fetch = (async (input: any, init: any = {}) => {
  wireCalls++;
  const url = new URL(String(input));
  if (scenario === 'stall' && url.hostname === 'google.serper.dev') {
    return new Promise<Response>((_, reject) => {
      const signal = init.signal as AbortSignal | undefined;
      const abort = () => reject(signal?.reason instanceof Error ? signal.reason : new Error('synthetic abort'));
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
    });
  }
  if (url.hostname === 'api.groq.com' && url.pathname.endsWith('/chat/completions')) {
    aiWireCalls++;
    const body = String(init.body || '');
    const sent = JSON.parse(body);
    const request = JSON.parse(sent.messages[1].content);
    if (scenario === 'hard401' || (scenario === 'hard401_extraction' && request.chunks)) {
      return Response.json({ error: 'synthetic account refusal', padding: 'x'.repeat(8 * 1024 * 1024) }, { status: 401 });
    }
    return extractionPayload(body);
  }
  if (url.hostname === 'google.serper.dev') {
    if (scenario === 'empty' || scenario === 'stall') return Response.json({ organic: [] });
    return Response.json({ organic: [{ position: 1, title: 'Scopeanchor Medical Kenya official', snippet: 'Scopeanchor Medical Kenya office', link: scenario === 'cross' || scenario === 'same' ? startUrl : 'https://scopeanchor.test/' }] });
  }
  if (url.hostname === 'scopeanchor.test' && url.pathname === '/start' && (scenario === 'cross' || scenario === 'same')) {
    const location = scenario === 'cross' ? 'https://foreign.test/landing' : 'https://scopeanchor.test/final';
    return new Response('', { status: 302, headers: { location, 'content-type': 'text/html' } });
  }
  if (url.hostname === 'foreign.test') {
    return new Response(foreignHtml, { headers: { 'content-type': 'text/html' } });
  }
  if (url.hostname === 'scopeanchor.test') {
    return new Response(officialHtml, { headers: { 'content-type': 'text/html' } });
  }
  if (scenario === 'provider_echo' && url.pathname.endsWith('/models')) {
    const credential = url.hostname === 'api.groq.com' ? 'gsk-synthetic/echo?secret' : 'nvapi-synthetic/echo?secret';
    return Response.json({ error: { message: `Rejected ${credential}; encoded ${encodeURIComponent(credential)}` } }, { status: 400 });
  }
  if (scenario === 'model_ok' && url.pathname.endsWith('/models')) {
    return Response.json({ data: [{ id: 'synthetic-model', active: true }] });
  }
  throw new Error(`Unexpected synthetic request: ${url.href}`);
}) as typeof fetch;

try {
  writeConfig();
  const engine = await import('../v1_engine');
  const { NvidiaProvider, GroqProvider } = await import('../ai_providers');

  for (const adversarial of ['wrong_role', 'length', 'trailing'] as const) {
    scenario = adversarial;
    writeConfig();
    engine.resetV1ProviderFailureState('groq');
    const run = await engine.runV1Enrichment('Scopeanchor Medical', 'Kenya', { profile: 'bulk', timeoutMs: 5_000 });
    assert.deepEqual(run.evidence_workspace?.accepted_claims, [], `${adversarial} must not admit claims`);
    assert.ok(run.raw_records.some(record => record.provider === 'groq-extraction' && record.response && record.failure), `${adversarial} raw response and failure must both survive`);
  }

  scenario = 'grounded';
  writeConfig();
  engine.resetV1ProviderFailureState('groq');
  const grounded = await engine.runV1Enrichment('Scopeanchor Medical', 'Kenya', { profile: 'bulk', timeoutMs: 5_000 });
  assert.equal(grounded.evidence_workspace?.accepted_claims.length, 1, 'a complete assistant response with an exactly quoted role remains usable');
  assert.equal(grounded.evidence_workspace?.accepted_claims[0].role, 'Director');
  assert.ok(grounded.evidence_workspace?.rejected_claims.some(item => item.reason.includes('role')), 'an invented role cannot ride along with a grounded person/name quote');
  console.log('PASS H09 assistant role, truncation, complete JSON and quoted-role extraction controls');

  for (const redirect of ['cross', 'same'] as const) {
    scenario = redirect;
    writeConfig();
    engine.resetV1ProviderFailureState('groq');
    const run = await engine.runV1Enrichment('Scopeanchor Medical', 'Kenya', { profile: 'interactive', timeoutMs: 5_000 });
    const finalUrl = redirect === 'cross' ? 'https://foreign.test/landing' : 'https://scopeanchor.test/final';
    const projected = run.results.find(result => result.metadata.original_url === startUrl);
    assert.ok(projected, 'the requested URL remains available as result metadata');
    assert.equal(projected.url, finalUrl);
    assert.equal(projected.links[0], new URL('/contact', finalUrl).href, 'relative links use the final response URL');
    const raw = run.raw_records.find(record => record.provider === 'direct-http' && record.request.url === startUrl);
    assert.ok(raw?.response, 'redirect capture remains raw evidence');
    assert.equal((raw.response as any).provenance.finalUrl, finalUrl);
    if (redirect === 'cross') {
      assert.ok(run.evidence_workspace?.chunks.every(chunk => chunk.url !== finalUrl && !chunk.text.includes('FOREIGN-ONLY-CLAIM')), 'a cross-domain final response cannot become official-domain evidence');
      assert.match(JSON.stringify(raw.response), /FOREIGN-ONLY-CLAIM/, 'excluding foreign evidence does not erase its raw capture');
    } else {
      assert.ok(run.evidence_workspace?.chunks.some(chunk => chunk.url === finalUrl), 'a same-domain final response remains a positive official evidence control');
    }
  }
  console.log('PASS H10 final-URL authority, original-URL metadata, final-base links and raw redirect preservation');

  scenario = 'hard401';
  writeConfig({ serper_enabled: false });
  engine.resetV1ProviderFailureState('groq');
  const beforeHardFailure = wireCalls;
  const hardFailure = await engine.runV1Enrichment('Scopeanchor Medical', 'Kenya', { profile: 'bulk', timeoutMs: 3_000 });
  const aiFailure = hardFailure.raw_records.find(record => record.provider === 'groq');
  assert.equal(aiFailure?.http_status, 401);
  assert.equal(aiFailure?.failure?.status, 401, 'HTTP status survives a response-body capture failure');
  const callsAfterFailure = wireCalls;
  await engine.runV1Enrichment('Scopeanchor Medical', 'Kenya', { profile: 'bulk', timeoutMs: 3_000 });
  const hardFailureCalls = wireCalls - beforeHardFailure;
  assert.equal(wireCalls, callsAfterFailure, 'a hard AI account failure is suppressed on the next run even though capture threw');
  assert.ok(hardFailureCalls >= 1);
  engine.resetV1ProviderFailureState('groq');

  scenario = 'hard401_extraction';
  writeConfig();
  const beforeExtractionFailure = aiWireCalls;
  const extractionFailure = await engine.runV1Enrichment('Scopeanchor Medical', 'Kenya', { profile: 'bulk', timeoutMs: 5_000 });
  const failedExtraction = extractionFailure.raw_records.find(record => record.provider === 'groq-extraction');
  assert.equal(failedExtraction?.http_status, 401);
  assert.equal(failedExtraction?.failure?.status, 401);
  const aiCallsAfterExtractionFailure = aiWireCalls;
  assert.ok(aiCallsAfterExtractionFailure > beforeExtractionFailure);
  await engine.runV1Enrichment('Scopeanchor Medical', 'Kenya', { profile: 'bulk', timeoutMs: 5_000 });
  assert.equal(aiWireCalls, aiCallsAfterExtractionFailure, 'an extraction capture failure also suppresses the AI account on the next run');
  engine.resetV1ProviderFailureState('groq');
  console.log('PASS M37 query/extraction hard AI account suppression survives body-capture errors');

  scenario = 'stall';
  writeConfig({ groq_enabled: false });
  const beforeDeadline = wireCalls;
  const started = Date.now();
  const timed = await engine.runV1Enrichment('Scopeanchor Medical', 'Kenya', { profile: 'bulk', timeoutMs: 40 });
  assert.ok(Date.now() - started < 2_000, 'overall deadline returns promptly');
  assert.ok(timed.timeline.some(event => event.stage === 'run' && event.status === 'failed' && event.error === 'RUN_DEADLINE_EXCEEDED'));
  assert.equal((await engine.getV1Run(timed.id))?.status, timed.status);
  const frozen = JSON.stringify(timed);
  const callsAtReturn = wireCalls;
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(JSON.stringify(timed), frozen, 'no worker mutates a returned run after its deadline');
  assert.equal(wireCalls, callsAtReturn, 'no background request starts after the deadline');
  assert.equal(JSON.stringify(await engine.getV1Run(timed.id)), frozen, 'persisted evidence remains stable after worker drain');
  assert.ok(wireCalls >= beforeDeadline);

  scenario = 'empty';
  const completed = await engine.runV1Enrichment('Scopeanchor Medical', 'Kenya', { profile: 'bulk', timeoutMs: 1_000 });
  assert.equal(completed.status, 'COMPLETED', 'a prompt empty-search result is a positive deadline control');
  assert.ok(!completed.timeline.some(event => event.error === 'RUN_DEADLINE_EXCEEDED'));
  console.log('PASS M36 real overall deadline, worker drain, stable persistence and positive control');

  for (const [provider, credential] of [[NvidiaProvider, 'nvapi-synthetic/echo?secret'], [GroqProvider, 'gsk-synthetic/echo?secret']] as const) {
    scenario = 'provider_echo';
    await assert.rejects(provider.listModels(credential), (error: any) => {
      assert.ok(!error.message.includes(credential));
      assert.ok(!error.message.includes(encodeURIComponent(credential)));
      assert.match(error.message, /\[redacted credential\]/);
      return true;
    });
    const diagnostic = await provider.testConnection(credential);
    assert.equal(diagnostic.success, false);
    assert.ok(!diagnostic.message.includes(credential));
    assert.ok(!diagnostic.message.includes(encodeURIComponent(credential)));
    scenario = 'model_ok';
    assert.equal((await provider.listModels(credential))[0].id, 'synthetic-model', 'ordinary provider success remains usable');
  }
  console.log('PASS M39 raw and URL-encoded credential echo redaction with positive model discovery');
  console.log('PASS evidence/provider security regressions; synthetic DNS/wire only');
} finally {
  globalThis.fetch = originalFetch;
  restoreTransport();
  assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
