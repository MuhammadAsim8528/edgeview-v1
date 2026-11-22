import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import { assertSafeOutboundUrl, isPrivateIPv6, isSafeExternalUrl } from '../url_safety';

for (const address of ['fec0::1', 'fed0::1', 'fef0::1', 'feff::1']) {
  assert.equal(isPrivateIPv6(address), true, `${address} is in deprecated fec0::/10 site-local space`);
  assert.equal(isSafeExternalUrl(`https://[${address}]/`), false);
  await assert.rejects(assertSafeOutboundUrl(`https://[${address}]/`), /SSRF guard/);
}
assert.equal(isPrivateIPv6('fe00::1'), false, 'the site-local block does not overreach outside fec0::/10');
assert.equal(isPrivateIPv6('2001:4860:4860::8888'), false);
assert.equal(isSafeExternalUrl('https://[2001:4860:4860::8888]/'), true);
await assertSafeOutboundUrl('https://[2001:4860:4860::8888]/');

const originalLookup = dns.lookup;
try {
  dns.lookup = (async () => [{ address: 'fec0::1', family: 6 }]) as unknown as typeof dns.lookup;
  await assert.rejects(assertSafeOutboundUrl('https://synthetic-site-local.test/'), /private IPv6/);
  dns.lookup = (async () => [{ address: '2001:4860:4860::8888', family: 6 }]) as unknown as typeof dns.lookup;
  await assertSafeOutboundUrl('https://synthetic-public.test/');
} finally { dns.lookup = originalLookup; }
console.log('PASS M38 literal and DNS fec0::/10 SSRF rejection with public IPv6 controls');
