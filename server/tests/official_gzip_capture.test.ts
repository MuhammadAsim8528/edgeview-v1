import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { safeFetchOutboundText, safeFetchProviderRequest } from '../url_safety';

const original = { lookup: dns.lookup, request: https.request };
let payload = gzipSync(Buffer.from('<p>Public local office — Kenya</p>'));
let headers: Record<string, string> = { 'content-type': 'text/html', 'content-encoding': 'gzip' };
let status = 200;
let stall = false;
let redirectOutside = false;
const calls: any[] = [];
const scope = { allowGzip: true, maxBytesDomain: 'official.test', maxBytes: 1024, timeoutMs: 1000 };
try {
  dns.lookup = (async () => [{ address: '93.184.216.34', family: 4 }]) as unknown as typeof dns.lookup;
  https.request = ((options: any, callback: (incoming: any) => void) => {
    calls.push(options);
    const request = new EventEmitter() as any;
    let incoming: PassThrough | undefined;
    const abort = () => request.destroy(options.signal.reason);
    request.setTimeout = () => request;
    request.destroy = (error: Error) => { incoming?.destroy(error); request.emit('error', error); return request; };
    request.end = () => queueMicrotask(() => {
      incoming = new PassThrough(); Object.assign(incoming, { statusCode: status, headers: { ...headers } });
      if (redirectOutside && options.headers.host === 'official.test') Object.assign(incoming, {
        statusCode: 302, headers: { location: 'https://foreign.test/contact' },
      });
      incoming.once('close', () => options.signal.removeEventListener('abort', abort));
      options.signal.addEventListener('abort', abort, { once: true });
      callback(incoming);
      if (!incoming.destroyed) { if (stall) incoming.write(payload.subarray(0, 12)); else incoming.end(payload); }
    });
    return request;
  }) as typeof https.request;
  const captured = await safeFetchOutboundText('https://official.test/contact', scope);
  assert.equal(captured.text, '<p>Public local office — Kenya</p>');
  assert.equal(await captured.response.text(), captured.text);
  assert.equal(captured.response.headers.get('content-encoding'), null, 'decoded Response cannot claim wire gzip bytes');
  assert.equal(captured.transport?.contentEncoding, 'gzip');
  assert.equal(captured.transport?.encodedBytes, payload.length);
  assert.equal(captured.transport?.decodedBytes, Buffer.byteLength(captured.text));
  assert.equal(calls[0].headers['accept-encoding'], 'gzip, identity');
  assert.equal(calls[0].hostname, '93.184.216.34');
  for (const body of [Buffer.from('not gzip'), payload.subarray(0, payload.length - 6)]) {
    payload = body;
    await assert.rejects(safeFetchOutboundText('https://official.test/contact', scope), /RETRIEVAL_DECOMPRESSION_FAILED/);
  }
  payload = gzipSync(Buffer.from('x'.repeat(1025)));
  await assert.rejects(safeFetchOutboundText('https://official.test/contact', scope), /RETRIEVAL_BODY_LIMIT_EXCEEDED/, 'decoded expansion must stop at the same byte cap');
  payload = gzipSync(Buffer.from('x'.repeat(1024)));
  assert.equal((await safeFetchOutboundText('https://official.test/contact', scope)).text.length, 1024);
  payload = Buffer.concat([gzipSync(Buffer.alloc(512, 'x')), gzipSync(Buffer.alloc(513, 'y'))]);
  await assert.rejects(safeFetchOutboundText('https://official.test/contact', scope), /RETRIEVAL_BODY_LIMIT_EXCEEDED/, 'concatenated gzip members share one decoded budget');
  payload = Buffer.alloc(1025);
  await assert.rejects(safeFetchOutboundText('https://official.test/contact', scope), /RETRIEVAL_BODY_LIMIT_EXCEEDED/, 'wire input is bounded even without Content-Length');
  payload = gzipSync(Buffer.from('ordinary'));
  await assert.rejects(safeFetchOutboundText('https://foreign.test/contact', scope), /UNSUPPORTED_CONTENT_ENCODING/, 'redirected/foreign hosts cannot inherit gzip scope');
  assert.equal(calls.at(-1).headers['accept-encoding'], 'identity');
  redirectOutside = true;
  await assert.rejects(safeFetchOutboundText('https://official.test/contact', scope), /UNSUPPORTED_CONTENT_ENCODING/);
  assert.equal(calls.at(-2).headers['accept-encoding'], 'gzip, identity');
  assert.equal(calls.at(-1).headers['accept-encoding'], 'identity', 'redirect cannot transfer the compression allowance');
  redirectOutside = false;
  await assert.rejects(safeFetchOutboundText('https://official.test/contact'), /UNSUPPORTED_CONTENT_ENCODING/, 'generic callers retain identity-only behavior');
  await assert.rejects(safeFetchProviderRequest('https://official.test/models'), /UNSUPPORTED_CONTENT_ENCODING/, 'provider payload decoding contract stays unchanged');
  const beforeInvalid = calls.length;
  await assert.rejects(safeFetchOutboundText('https://official.test/contact', { allowGzip: true }), /Compressed retrieval requires official page scope/);
  await assert.rejects(safeFetchProviderRequest('https://official.test/models', { allowGzip: true, maxBytesDomain: 'official.test' } as any), /Compressed retrieval requires official page scope/);
  assert.equal(calls.length, beforeInvalid, 'unsupported gzip contexts never open a connection');
  status = 302; headers = { 'content-type': 'text/html', location: 'https://127.0.0.1/private' };
  const before = calls.length;
  await assert.rejects(safeFetchOutboundText('https://official.test/contact', scope), /Blocked: URL is not a safe external http\(s\) address \(SSRF guard\)/);
  assert.equal(calls.length, before + 1, 'private redirect never receives a connection');
  status = 200; headers = { 'content-type': 'text/html', 'content-encoding': 'gzip' }; stall = true;
  await assert.rejects(safeFetchOutboundText('https://official.test/contact', { ...scope, timeoutMs: 25 }), /RETRIEVAL_TIMEOUT/);
  console.log('PASS opt-in official gzip: decoded/wire caps, corrupt/truncated/slow streams, pinned authority, scope and provider isolation');
} finally { dns.lookup = original.lookup; https.request = original.request; }
