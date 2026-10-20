import assert from 'node:assert/strict';
import { appendBoundedResponseChunk, isPrivateIPv6, isSafeExternalUrl } from '../url_safety';
import './outbound_connection_binding.test';

assert.equal(isSafeExternalUrl('http://user:pass@example.com/'), false, 'credentialed URLs must be rejected');
assert.equal(isPrivateIPv6('fe90::1'), true, 'the complete IPv6 link-local /10 must be rejected');
assert.equal(isPrivateIPv6('febf::1'), true, 'the complete IPv6 link-local /10 must be rejected');

const chunks: Buffer[] = [];
assert.equal(appendBoundedResponseChunk(chunks, Buffer.alloc(16), 0, 32), 16);
assert.throws(() => appendBoundedResponseChunk(chunks, Buffer.alloc(17), 16, 32), /RETRIEVAL_BODY_LIMIT_EXCEEDED/);
console.log('PASS URL predicates and bounded chunks plus synthetic transport contract');
