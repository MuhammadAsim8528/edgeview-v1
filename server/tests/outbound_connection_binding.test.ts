import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { safeFetchOutboundText, safeFetchOutboundUrl, safeFetchProviderRequest } from '../url_safety';
import { readProviderResponse } from '../provider_response';
import { NvidiaProvider } from '../ai_providers';

// Synthetic DNS/transport only: no external or private-network connections.
const original = { lookup: dns.lookup, resolve4: dns.resolve4, http: http.request, https: https.request };
const calls: any[] = [];
const bodies: Array<Buffer | undefined> = [];
let lookups = 0;
let lookup = async (_host: string): Promise<any> => [{ address: '93.184.216.34', family: 4 }];
let respond: (incoming: any) => void = incoming => incoming.end('ok');
let status = 200;
let headers: Record<string, string> = { 'content-type': 'text/html' };
const transport = ((options: any, callback: (incoming: any) => void) => {
  const request = new EventEmitter() as any;
  let incoming: any; let destroyed = false;
  calls.push(options);
  const abort = () => request.destroy(options.signal.reason);
  request.setTimeout = () => request;
  request.destroy = (error: Error) => {
    if (!destroyed) { destroyed = true; incoming?.destroy(error); request.emit('error', error); }
    return request;
  };
  request.end = (body?: Buffer) => { bodies.push(body); return queueMicrotask(() => {
    if (options.signal.aborted) return abort();
    incoming = new PassThrough(); incoming.statusCode = status; incoming.headers = { ...headers };
    incoming.once('close', () => options.signal.removeEventListener('abort', abort));
    options.signal.addEventListener('abort', abort, { once: true });
    callback(incoming);
    if (!incoming.destroyed) respond(incoming);
  }); };
  return request;
}) as typeof http.request;
const reset = () => {
  calls.length = 0; bodies.length = 0; lookups = 0; status = 200; headers = { 'content-type': 'text/html' };
  lookup = async () => [{ address: '93.184.216.34', family: 4 }]; respond = incoming => incoming.end('ok');
};
try {
  dns.lookup = (async (host: string) => { lookups++; return lookup(host); }) as typeof dns.lookup;
  dns.resolve4 = (async () => { throw new Error('Second resolver must never run'); }) as typeof dns.resolve4;
  http.request = transport; https.request = transport as typeof https.request;
  const captured = await safeFetchOutboundText('https://company.test:8443/contact?q=one');
  assert.equal(captured.text, 'ok'); assert.equal(captured.response.status, 200); assert.equal(lookups, 1);
  assert.equal(calls[0].hostname, '93.184.216.34'); assert.equal(calls[0].family, 4);
  assert.equal(calls[0].servername, 'company.test'); assert.equal(calls[0].headers.host, 'company.test:8443');
  assert.equal(calls[0].path, '/contact?q=one');
  reset();
  const payload = '{"text":"医薬品 🧪","messages":[]}';
  await safeFetchProviderRequest('https://company.test:8443/custom/v1/chat/completions?q=one', {
    method: 'POST', body: payload, headers: { Authorization: 'Bearer synthetic-wire-key', 'Content-Type': 'application/json' },
  });
  assert.equal(lookups, 1);
  assert.equal(calls[0].hostname, '93.184.216.34');
  assert.equal(calls[0].servername, 'company.test');
  assert.equal(calls[0].headers.host, 'company.test:8443');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].path, '/custom/v1/chat/completions?q=one');
  assert.equal(calls[0].headers.authorization, 'Bearer synthetic-wire-key');
  assert.equal(calls[0].headers['content-length'], String(Buffer.byteLength(payload)));
  assert.deepEqual(bodies[0], Buffer.from(payload));
  reset();
  const opaqueBytes = new Uint8Array([0, 255, 195, 40]);
  await safeFetchProviderRequest('https://company.test/v1', { method: 'POST', body: opaqueBytes });
  assert.deepEqual(bodies[0], Buffer.from(opaqueBytes), 'byte bodies must not be decoded and re-encoded');
  for (const url of ['http://company.test/v1', 'https://127.0.0.1/v1', 'https://[::1]/v1', 'https://user:password@company.test/v1']) {
    reset(); await assert.rejects(safeFetchProviderRequest(url, { method: 'POST', body: payload }));
    assert.equal(calls.length, 0, 'unsafe credentials destination never receives bytes');
  }
  for (const addresses of [[{ address: '127.0.0.1', family: 4 }], [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }]]) {
    reset(); lookup = async () => addresses;
    await assert.rejects(safeFetchProviderRequest('https://company.test/v1', { method: 'POST', body: payload }), /private/);
    assert.equal(calls.length, 0);
  }
  for (const redirect of [301, 302, 303, 307, 308]) for (const destination of ['/other', 'https://other.test/steal', 'http://company.test/downgrade', 'https://127.0.0.1/private']) {
    reset(); status = redirect; headers.location = destination;
    await assert.rejects(safeFetchProviderRequest('https://company.test/v1', { method: 'POST', body: payload, redirect: 'follow' }), /REDIRECT_REJECTED/);
    assert.equal(calls.length, 1, 'no redirect target receives the request or credentials');
  }
  reset();
  status = 302;
  await assert.rejects(safeFetchProviderRequest('https://company.test/v1'), /REDIRECT_REJECTED/, 'redirect status without Location is still rejected');
  reset();
  await assert.rejects(safeFetchProviderRequest('https://company.test/v1', { method: 'POST', body: new FormData() }), /Unsupported provider request body/);
  assert.equal(calls.length, 0);
  await assert.rejects(safeFetchProviderRequest('https://company.test/v1', { method: 'POST', body: 'x'.repeat(2 * 1024 * 1024 + 1) }), /body limit/);
  reset(); headers = { 'content-type': 'application/json' };
  respond = incoming => incoming.end(Buffer.concat([Buffer.from('{"data":[{"id":"'), Buffer.from([255]), Buffer.from('"}]}')]));
  const malformed = await readProviderResponse(await safeFetchOutboundUrl('https://company.test/models'));
  assert.equal(malformed.failure?.name, 'ProviderSchemaError', 'provider UTF-8 failures must not be repaired');
  assert.equal((malformed.body as any).encoding, 'base64');
  reset(); headers = { 'content-type': 'application/json' }; status = 201;
  respond = incoming => incoming.end('{"data":[{"id":"synthetic-model"}]}');
  let observedStatus: number | undefined;
  const models = await NvidiaProvider.listModels('synthetic-binding-key', 'https://company.test/v1', value => { observedStatus = value; });
  assert.equal(models[0].id, 'synthetic-model'); assert.equal(observedStatus, 201);
  assert.equal(lookups, 1, 'NVIDIA must not do an unbounded preliminary DNS check');
  assert.equal(calls[0].path, '/v1/models');
  reset(); lookup = () => new Promise(() => {});
  const originalTimer = globalThis.setTimeout;
  try {
    globalThis.setTimeout = ((callback: any, milliseconds: number, ...args: any[]) => originalTimer(callback, milliseconds === 20_000 ? 10 : milliseconds, ...args)) as typeof setTimeout;
    await assert.rejects(NvidiaProvider.listModels('synthetic-binding-key', 'https://company.test/v1'), /RETRIEVAL_TIMEOUT/);
    assert.equal(calls.length, 0);
  } finally { globalThis.setTimeout = originalTimer; }
  reset(); lookup = async () => [{ address: '2001:4860:4860::8888', family: 6 }];
  await safeFetchOutboundText('https://company.test/'); assert.equal(calls[0].family, 6);
  reset(); await safeFetchOutboundText('http://[2001:4860:4860::8888]:8080/');
  assert.equal(lookups, 0); assert.equal(calls[0].headers.host, '[2001:4860:4860::8888]:8080');
  for (const answers of [[], [{ address: 'bad', family: 4 }], [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }]]) {
    reset(); lookup = async () => answers;
    await assert.rejects(safeFetchOutboundText('http://company.test/'), /Blocked/); assert.equal(calls.length, 0);
  }
  for (const location of ['http://127.0.0.1/private', 'http://user:pass@company.test/', 'file:///secret']) {
    reset(); status = 302; headers.location = location;
    await assert.rejects(safeFetchOutboundUrl('http://company.test/'), /safe external|private/i); assert.equal(calls.length, 1);
  }
  reset(); status = 302; headers.location = '/next'; respond = () => {};
  await assert.rejects(safeFetchOutboundText('http://company.test/', { maxRedirects: 1 }), /Maximum redirect/);
  assert.equal(calls.length, 2);
  reset(); status = 302; headers.location = '/contact';
  lookup = async () => {
    if (lookups > 1) { status = 200; headers = { 'content-type': 'text/html' }; }
    return [{ address: '93.184.216.34', family: 4 }];
  };
  assert.equal((await safeFetchOutboundText('https://company.test/start')).text, 'ok');
  assert.equal(calls[1].path, '/contact');
  reset(); status = 302; headers.location = '/next';
  lookup = () => new Promise(resolve => setTimeout(() => resolve([{ address: '93.184.216.34', family: 4 }]), 10));
  await assert.rejects(safeFetchOutboundText('https://company.test/', { timeoutMs: 25, maxRedirects: 10 }), /RETRIEVAL_TIMEOUT/);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(calls.length < 10, 'redirect hops share one deadline');
  reset(); status = 302; headers.location = '/next';
  await assert.rejects(safeFetchOutboundUrl('https://company.test/', { redirect: 'error' }), /REDIRECT_REJECTED/);
  assert.equal(calls.length, 1);
  reset(); lookup = () => new Promise(resolve => setTimeout(() => resolve([{ address: '93.184.216.34', family: 4 }]), 60));
  await assert.rejects(safeFetchOutboundText('http://company.test/', { timeoutMs: 10 }), /RETRIEVAL_TIMEOUT/);
  await new Promise(resolve => setTimeout(resolve, 80)); assert.equal(calls.length, 0, 'late DNS cannot start transport');
  reset(); respond = incoming => {
    const interval = setInterval(() => incoming.write('.'), 2);
    incoming.once('close', () => clearInterval(interval));
  };
  await assert.rejects(safeFetchOutboundText('http://company.test/', { timeoutMs: 20 }), /RETRIEVAL_TIMEOUT|aborted/i);
  reset(); const controller = new AbortController(); controller.abort();
  await assert.rejects(safeFetchOutboundText('http://company.test/', { signal: controller.signal }), /RETRIEVAL_ABORTED/);
  assert.equal(calls.length, 0);
  reset(); lookup = () => new Promise(resolve => setTimeout(() => resolve([{ address: '93.184.216.34', family: 4 }]), 30));
  const duringDns = new AbortController();
  setTimeout(() => duringDns.abort(), 5);
  await assert.rejects(safeFetchOutboundText('http://company.test/', { signal: duringDns.signal }), /RETRIEVAL_ABORTED/);
  await new Promise(resolve => setTimeout(resolve, 40)); assert.equal(calls.length, 0);
  reset(); respond = incoming => incoming.end('1234');
  assert.equal((await safeFetchOutboundText('http://company.test/', { maxBytes: 4 })).text, '1234');
  await assert.rejects(safeFetchOutboundText('http://company.test/', { maxBytes: 3 }), /BODY_LIMIT/);
  reset(); headers['content-length'] = '9';
  await assert.rejects(safeFetchOutboundText('http://company.test/', { maxBytes: 4 }), /BODY_LIMIT/);
  for (const value of [{ 'content-type': 'image/png' }, { 'content-encoding': 'gzip' }]) {
    reset(); headers = value; await assert.rejects(safeFetchOutboundText('http://company.test/'), /UNSUPPORTED/);
  }
  for (const value of [204, 205, 304]) {
    reset(); status = value; respond = incoming => incoming.end();
    assert.equal((await safeFetchOutboundText('http://company.test/')).response.body, null);
  }
  console.log('PASS pinned DNS/IPv6/TLS authority, redirects, absolute DNS/body deadlines, cancellation and bounds; synthetic transport');
} finally {
  dns.lookup = original.lookup; dns.resolve4 = original.resolve4; http.request = original.http; https.request = original.https;
}
