import assert from 'node:assert/strict';
import { appendBoundedResponseChunk, isPrivateIPv6, isSafeExternalUrl, safeFetchOutboundUrl } from '../url_safety';

assert.equal(isSafeExternalUrl('http://user:pass@example.com/'), false, 'credentialed URLs must be rejected');
assert.equal(isPrivateIPv6('fe90::1'), true, 'the complete IPv6 link-local /10 must be rejected');
assert.equal(isPrivateIPv6('febf::1'), true, 'the complete IPv6 link-local /10 must be rejected');

const originalFetch = globalThis.fetch;
try {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response('', { status: 302, headers: { location: 'http://127.0.0.1/private' } });
  }) as typeof fetch;
  await assert.rejects(() => safeFetchOutboundUrl('http://93.184.216.34/start'), /safe external|private/i);
  assert.equal(calls, 1, 'private redirect target must be rejected before a second HTTP request');

  const chunks: Buffer[] = [];
  assert.equal(appendBoundedResponseChunk(chunks, Buffer.alloc(16), 0, 32), 16);
  assert.throws(() => appendBoundedResponseChunk(chunks, Buffer.alloc(17), 16, 32), /RETRIEVAL_BODY_LIMIT_EXCEEDED/);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('outbound_retrieval_safety: 7 assertions passed');
