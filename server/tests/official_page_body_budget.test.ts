import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { safeFetchOutboundText } from '../url_safety';

// Actual engine + pinned/bounded transport; only DNS, wire responses and search
// provider are synthetic. No live provider quota, operational state or company
// facts are used. Large facts at the tail catch silent 2 MiB truncation.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-official-body-'));
process.env.EDGEVIEW_CONFIG = path.join(scratch, 'config.json');
process.env.EDGEVIEW_V1_DATA_DIR = path.join(scratch, 'runs');
fs.writeFileSync(process.env.EDGEVIEW_CONFIG, JSON.stringify({ serper_api_key: 'synthetic-search', serper_enabled: true,
  hunter_enabled: false, nvidia_enabled: false, groq_enabled: false }));
const original = { lookup: dns.lookup, http: http.request, https: https.request, fetch: globalThis.fetch };
const MiB = 1024 * 1024;
// Country attribution is independent of the transport body budget. This positive
// fixture explicitly scopes its tail facts; a .co.ke URL alone is insufficient.
// Each structured person needs its own country evidence: nearby Kenyan prose
// must not supply the missing scope of another JSON-LD graph sibling.
const tail = '<p>Trustanchor Medical Limited Kenya office</p><a href="/contact-us.php">Contact</a><a href="/leadership.php">Corporate management</a>'
  + '<p>Contact: public@trustanchor.co.ke</p><script type="application/ld+json">'
  + '{"@graph":[{"@type":"Person","name":"Alice Fixture","jobTitle":"Managing Director","address":{"@type":"PostalAddress","addressCountry":"KE"}},'
  + '{"@type":"Person","name":"Foreign Fixture","jobTitle":"Director","address":{"@type":"PostalAddress","addressCountry":"PK"}},'
  + '{"@type":"Person","name":"Unknown Fixture","jobTitle":"Director"}]}</script>';
const largeHtml = '<html><body><!--' + 'x'.repeat(Math.floor(3.67 * MiB)) + '-->' + tail + '</body></html>';
let privateDns = false;
let transportCalls = 0;
const attempts = new Map<string, number>();
const wire = ((options: any, callback: (incoming: any) => void) => {
  const request = new EventEmitter() as any;
  let incoming: any;
  let destroyed = false;
  const abort = () => request.destroy(options.signal.reason);
  request.setTimeout = () => request;
  request.destroy = (error: Error) => {
    if (!destroyed) { destroyed = true; incoming?.destroy(error); request.emit('error', error); }
    return request;
  };
  request.end = () => queueMicrotask(() => {
    if (options.signal.aborted) return abort();
    transportCalls++;
    const host = String(options.headers.host);
    const route = String(options.path);
    const attemptKey = `${host}${route}`;
    attempts.set(attemptKey, (attempts.get(attemptKey) || 0) + 1);
    if (host === 'trustanchor.co.ke' && ((['/', '/leadership.php'].includes(route) && attempts.get(attemptKey) === 1) || route === '/contact-connection-error')) {
      request.destroy(new Error('socket hang up')); return;
    }
    incoming = new PassThrough();
    incoming.statusCode = 200;
    incoming.headers = { 'content-type': 'text/html; charset=utf-8' };
    let body = largeHtml;
    if (route === '/redirect-external') {
      incoming.statusCode = 302; incoming.headers.location = 'https://outside.example/big'; body = '';
    } else if (route === '/redirect-internal') {
      incoming.statusCode = 302; incoming.headers.location = 'https://www.trustanchor.co.ke/big'; body = '';
    } else if (route === '/exact4') {
      body = 'x'.repeat(4 * MiB);
    } else if (route === '/utf8-over') {
      body = 'ø'.repeat(2 * MiB + 1);
    } else if (route === '/management-error') {
      incoming.statusCode = 503; body = '<html>Controlled upstream failure</html>';
    } else if (route.includes('oversize')) {
      body = 'x'.repeat(4 * MiB + 1);
    } else if (!['/', '/contact-us.php', '/leadership.php', '/big'].includes(route)) {
      body = '<html><body>Ordinary small page</body></html>';
    }
    if (host === 'outside.example' && route === '/big') body = largeHtml;
    const compressed = String(options.headers['accept-encoding']).includes('gzip') && host.endsWith('trustanchor.co.ke');
    const bytes = compressed ? gzipSync(Buffer.from(body)) : Buffer.from(body);
    if (compressed) incoming.headers['content-encoding'] = 'gzip';
    if (!route.includes('chunked')) incoming.headers['content-length'] = String(bytes.length);
    incoming.once('close', () => options.signal.removeEventListener('abort', abort));
    options.signal.addEventListener('abort', abort, { once: true });
    callback(incoming);
    if (!incoming.destroyed) {
      for (let offset = 0; offset < bytes.length && !incoming.destroyed; offset += 64 * 1024) incoming.write(bytes.subarray(offset, offset + 64 * 1024));
      if (!incoming.destroyed) incoming.end();
    }
  });
  return request;
}) as typeof http.request;
try {
  dns.lookup = (async () => [{ address: privateDns ? '127.0.0.1' : '93.184.216.34', family: 4 }]) as unknown as typeof dns.lookup;
  http.request = wire; https.request = wire as typeof https.request;
  await assert.rejects(safeFetchOutboundText('https://outside.example/big'), /RETRIEVAL_BODY_LIMIT_EXCEEDED/, 'generic default remains 2 MiB');
  const scoped = { maxBytes: 4 * MiB, maxBytesDomain: 'trustanchor.co.ke' };
  assert.equal((await safeFetchOutboundText('https://trustanchor.co.ke/big', scoped)).text, largeHtml);
  assert.equal(Buffer.byteLength((await safeFetchOutboundText('https://trustanchor.co.ke/exact4', scoped)).text), 4 * MiB, 'inclusive exact-byte ceiling');
  assert.equal((await safeFetchOutboundText('https://trustanchor.co.ke/redirect-internal', scoped)).text, largeHtml, 'official subdomain redirect preserves allowance');
  await assert.rejects(safeFetchOutboundText('https://trustanchor.co.ke/redirect-external', scoped), /RETRIEVAL_BODY_LIMIT_EXCEEDED/, 'external redirect cannot inherit official allowance');
  for (const route of ['/oversize', '/oversize-chunked']) await assert.rejects(safeFetchOutboundText(`https://trustanchor.co.ke${route}`, scoped), /RETRIEVAL_BODY_LIMIT_EXCEEDED/, '4 MiB ceiling holds with or without declared length');
  await assert.rejects(safeFetchOutboundText('https://trustanchor.co.ke/utf8-over', scoped), /RETRIEVAL_BODY_LIMIT_EXCEEDED/, 'budget counts bytes, not UTF-16 characters');
  privateDns = true;
  const callsBefore = transportCalls;
  await assert.rejects(safeFetchOutboundText('https://trustanchor.co.ke/big', scoped), /private IPv4/);
  assert.equal(transportCalls, callsBefore, 'larger body budget does not bypass private DNS guard');
  privateDns = false;
  globalThis.fetch = (async (input: string | URL | Request) => {
    assert.match(String(input), /^https:\/\/google\.serper\.dev\//, 'no model or unrelated provider transport permitted');
    return Response.json({ organic: [
      { title: 'Trustanchor Medical Limited Kenya official website', link: 'https://trustanchor.co.ke/contact-us.php', snippet: 'Trustanchor Medical Limited Kenya official contact' },
      { title: 'Directory result', link: 'https://outside.example/big', snippet: 'Retain this search evidence despite downstream failure' },
      { title: 'Trustanchor leadership', link: 'https://trustanchor.co.ke/leadership-oversize', snippet: 'Oversized capture must be recorded' },
      { title: 'Trustanchor management', link: 'https://trustanchor.co.ke/management-error', snippet: 'HTTP error body must be retained' },
      { title: 'Trustanchor contact page', link: 'https://trustanchor.co.ke/contact-connection-error', snippet: 'Persistent transient failure must stay bounded' },
    ] });
  }) as typeof fetch;
  const { runV1Enrichment, getV1Run } = await import('../v1_engine');
  const callsBeforeRun = transportCalls;
  const run = await runV1Enrichment('Trustanchor Medical Limited', 'Kenya');
  assert.equal(run.identity_resolution?.official_domain, 'trustanchor.co.ke');
  const officialPages = run.results.filter(item => item.provider === 'direct-http' && item.status === 'success' && item.html === largeHtml);
  for (const suffix of ['/', '/contact-us.php', '/leadership.php']) assert.ok(officialPages.some(page => new URL(page.url).pathname === suffix), `large official page captured: ${suffix}`);
  assert.ok(run.results.some(item => item.provider === 'direct-http' && item.status === 'failed' && item.url.includes('oversize')), 'over-limit official result remains visible');
  assert.ok(run.raw_records.some(record => record.kind === 'scrape' && record.failure?.message.includes('RETRIEVAL_BODY_LIMIT_EXCEEDED') && record.request.max_bytes === 4 * MiB), 'official size failure retained with bounded request');
  assert.ok(run.raw_records.some(record => record.kind === 'scrape' && record.request.url === 'https://outside.example/big' && record.failure && record.request.max_bytes === 2 * MiB), 'generic failure recorded at original budget');
  const scrapeRecords = run.raw_records.filter(record => record.kind === 'scrape');
  assert.ok(scrapeRecords.some(record => !record.failure && (record.response as any)?.transport?.contentEncoding === 'gzip'
    && (record.response as any).body === largeHtml), 'official gzip retains complete decoded HTML and explicit wire metadata');
  for (const suffix of ['/', '/leadership.php']) {
    const records = scrapeRecords.filter(record => record.request.url === `https://trustanchor.co.ke${suffix}`);
    assert.equal(records.length, 2, 'transient official failure receives exactly one bounded retry');
    assert.ok(records[0].failure && !records[1].failure, 'both original failure and subsequent success remain immutable evidence');
  }
  assert.equal(scrapeRecords.filter(record => record.request.url === 'https://trustanchor.co.ke/contact-connection-error').length, 2,
    'initial search retrieval and official attempt only: two used retry slots cannot become unlimited retries');
  assert.equal(scrapeRecords.length, transportCalls - callsBeforeRun, 'each actual attempt gets exactly one raw response/failure, including repeat URLs');
  const failedOfficial = scrapeRecords.find(record => record.request.max_bytes === 4 * MiB && record.request.url === 'https://trustanchor.co.ke/leadership-oversize');
  assert.ok(failedOfficial);
  assert.ok(run.results.some(result => result.provider === 'direct-http' && result.raw_record_id.split(',').includes(failedOfficial.id)), 'failure raw payload referenced by normalized official result');
  const upstreamFailures = scrapeRecords.filter(record => record.request.url === 'https://trustanchor.co.ke/management-error');
  assert.equal(upstreamFailures.length, 2, 'initial and official HTTP failures each recorded once, never duplicated or suppressed');
  assert.ok(upstreamFailures.every(record => record.failure && (record.response as any).status === 503 && (record.response as any).body.includes('Controlled upstream failure')));
  assert.ok(run.results.some(item => item.snippet === 'Retain this search evidence despite downstream failure' && item.status === 'success'), 'failed page retrieval cannot erase search evidence');
  assert.ok(run.results.filter(item => item.provider === 'direct-http').length <= run.limits.max_scrapes, 'official crawl page-count bound unchanged');
  const persisted = getV1Run(run.id);
  assert.ok(persisted);
  assert.equal(persisted.raw_records.length, run.raw_records.length);
  for (const page of officialPages) assert.equal(persisted.results.find(item => item.id === page.id)?.html, largeHtml, 'full large HTML survives immutable storage');
  const { projectDeterministicContactFields } = await import('../job_manager');
  const projection = projectDeterministicContactFields(persisted);
  assert.ok(projection.emails_list.includes('public@trustanchor.co.ke'), 'tail contact reached projection');
  assert.ok(projection.contact_persons.some(person => person.name === 'Alice Fixture'), 'tail structured leadership reached projection');
  assert.ok(!projection.contact_persons.some(person => ['Foreign Fixture', 'Unknown Fixture'].includes(person.name)), 'large-page allowance must not turn a foreign or unscoped graph sibling into a Kenyan leader');
  console.log('PASS large official capture/storage/projection; 2 MiB generic and 4 MiB official bounds; redirects, chunked ceiling, private DNS and failure retention; synthetic transport, UI/live companies NOT VERIFIED');
} finally {
  dns.lookup = original.lookup; http.request = original.http; https.request = original.https; globalThis.fetch = original.fetch;
  fs.rmSync(scratch, { recursive: true, force: true });
}
