import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dns from 'node:dns/promises';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-ai-destination-'));
process.env.EDGEVIEW_CONFIG = path.join(root, 'config.json');
process.env.EDGEVIEW_V1_DATA_DIR = path.join(root, 'runs');
fs.writeFileSync(process.env.EDGEVIEW_CONFIG, JSON.stringify({
  nvidia_enabled: true, nvidia_api_key: 'synthetic-saved-key', nvidia_model: 'synthetic-model',
  nvidia_base_url: 'https://private-ai.test/v1', groq_enabled: false,
  serper_enabled: true, serper_api_key: 'synthetic-search', hunter_enabled: false,
}));
const original = { fetch: globalThis.fetch, lookup: dns.lookup, request: https.request };
let unsafeFetchCalls = 0;
let privateDnsChecks = 0;
const wireAuthorities: string[] = [];
try {
  dns.lookup = (async (host: string) => {
    if (host === 'private-ai.test') { privateDnsChecks++; return [{ address: '10.0.0.1', family: 4 }]; }
    return [{ address: '93.184.216.34', family: 4 }];
  }) as unknown as typeof dns.lookup;
  globalThis.fetch = (async (input: string | URL | Request) => {
    if (String(input).includes('private-ai.test')) {
      unsafeFetchCalls++;
      return Response.json({ choices: [{ message: { content: '["Trust Anchor Kenya official", "Trust Anchor Kenya contact"]' } }] });
    }
    assert.match(String(input), /^https:\/\/google\.serper\.dev\//);
    return Response.json({ organic: [{ position: 1, title: 'Trust Anchor Kenya', link: 'https://trustanchor.co.ke/', snippet: 'Trust Anchor Kenya official website and public contact' }] });
  }) as typeof fetch;
  https.request = ((options: any, callback: (incoming: any) => void) => {
    wireAuthorities.push(options.headers.host);
    const request = new EventEmitter() as any;
    request.setTimeout = () => request;
    request.destroy = (error: Error) => { request.emit('error', error); return request; };
    request.end = () => queueMicrotask(() => {
      const incoming = new PassThrough() as any;
      const search = options.headers.host === 'google.serper.dev';
      incoming.statusCode = 200; incoming.headers = { 'content-type': search ? 'application/json' : 'text/html' };
      callback(incoming);
      incoming.end(search ? JSON.stringify({ organic: [{ position: 1, title: 'Trust Anchor Kenya', link: 'https://trustanchor.co.ke/', snippet: 'Trust Anchor Kenya official website and public contact' }] }) : '<html><title>Trust Anchor Kenya</title><body>Trust Anchor Kenya official company. Contact public@trustanchor.co.ke for corporate management.</body></html>');
    });
    return request;
  }) as typeof https.request;
  const { runV1Enrichment, getV1Run } = await import('../v1_engine');
  const run = await runV1Enrichment('Trust Anchor', 'Kenya');
  assert.equal(unsafeFetchCalls, 0, 'neither AI stage may use unprotected global fetch');
  assert.ok(privateDnsChecks >= 2, 'query generation AND evidence extraction must validate the destination');
  assert.ok(wireAuthorities.length > 0 && wireAuthorities.every(host => host !== 'private-ai.test'));
  for (const provider of ['nvidia', 'nvidia-extraction']) {
    assert.ok(run.raw_records.some(record => record.provider === provider && /private IPv4/.test(record.failure?.message || '')), `${provider}: structured blocked-request failure retained`);
  }
  assert.ok(run.results.some(result => result.status === 'success'), 'failed AI extraction must not erase captured search results');
  const retained = getV1Run(run.id);
  assert.ok(retained?.raw_records.some(record => record.provider === 'nvidia-extraction' && record.failure));
  const onDisk = JSON.parse(fs.readFileSync(path.join(root, 'runs', `${run.id}.json`), 'utf8'));
  assert.ok(onDisk.raw_records.some((record: any) => record.provider === 'nvidia-extraction' && record.failure), 'structured failure must be durable, not merely cached');
  console.log('PASS both engine AI stages block private DNS before credentials leave; evidence/failures persist');
} finally {
  globalThis.fetch = original.fetch; dns.lookup = original.lookup; https.request = original.request;
  fs.rmSync(root, { recursive: true, force: true });
}
