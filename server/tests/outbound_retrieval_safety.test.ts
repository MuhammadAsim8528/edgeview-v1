import assert from 'node:assert/strict';
import { appendBoundedResponseChunk, isPrivateIPv6, isSafeExternalUrl } from '../url_safety';
import './outbound_connection_binding.test';

assert.equal(isSafeExternalUrl('http://user:pass@example.com/'), false, 'credentialed URLs must be rejected');
assert.equal(isPrivateIPv6('fe90::1'), true, 'the complete IPv6 link-local /10 must be rejected');
assert.equal(isPrivateIPv6('febf::1'), true, 'the complete IPv6 link-local /10 must be rejected');

// Every non-public/special-use address must fail closed before transport.
// Public control addresses prove this is a denylist correction, not a block-all change.
for (const address of [
  '192.0.2.1', '198.51.100.1', '203.0.113.1', '192.88.99.1',
  '192.31.196.1', '192.52.193.1', '192.175.48.1',
]) {
  assert.equal(isSafeExternalUrl(`http://${address}/`), false, `special-use IPv4 ${address} must be rejected`);
}
for (const address of ['8.8.8.8', '93.184.216.34']) {
  assert.equal(isSafeExternalUrl(`http://${address}/`), true, `public IPv4 ${address} remains allowed`);
}

const chunks: Buffer[] = [];
assert.equal(appendBoundedResponseChunk(chunks, Buffer.alloc(16), 0, 32), 16);
assert.throws(() => appendBoundedResponseChunk(chunks, Buffer.alloc(17), 16, 32), /RETRIEVAL_BODY_LIMIT_EXCEEDED/);
console.log('PASS URL predicates and bounded chunks plus synthetic transport contract');
