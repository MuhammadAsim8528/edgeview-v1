import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isSafeExternalUrl, assertSafeOutboundUrl, isPrivateIPv4, isPrivateIPv6 } from '../url_safety';
import { fetchProviderModels, NvidiaProvider } from '../ai_providers';

const URL_GUARD_MESSAGE = /^Blocked: URL is not a safe external http\(s\) address \(SSRF guard\)$/;
const PROVIDER_GUARD_MESSAGE = /^Blocked: NVIDIA base URL is not a safe external http\(s\) address \(SSRF guard\)$/;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`SSRF Security Guard Test Failed: ${msg}`);
}

// A refusal only counts if it is the SSRF guard speaking. Bare `catch` blocks would also
// accept a missing key, a credential-origin error, or a malformed URL, which is how a
// deleted or reordered guard can stay green.
async function expectGuardRefusal(call: () => Promise<unknown>, expected: RegExp, label: string): Promise<void> {
  try {
    await call();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    assert(expected.test(message), `${label} was refused for the wrong reason: ${message}`);
    return;
  }
  assert(false, `${label} was not refused`);
}

async function run() {
  console.log('--- RUNNING SSRF / KEY-EXFILTRATION SECURITY GUARD TESTS ---');

  // Test 1: sync guard closes IPv4-mapped IPv6 canonical hex bypasses
  console.log('\n[Test 1] IPv4-mapped IPv6 canonical hex bypass forms...');
  assert(!isSafeExternalUrl('http://[::ffff:7f00:1]/'), '::ffff:7f00:1 (127.0.0.1) must be blocked');
  assert(!isSafeExternalUrl('http://[::ffff:c0a8:101]/'), '::ffff:c0a8:101 (192.168.1.1) must be blocked');
  assert(!isSafeExternalUrl('http://[::ffff:a9fe:a9fe]/'), '::ffff:a9fe:a9fe (169.254.169.254) must be blocked');
  assert(!isSafeExternalUrl('http://[::ffff:a00:1]/'), '::ffff:a00:1 (10.0.0.1) must be blocked');
  assert(!isSafeExternalUrl('http://[::ffff:ac10:101]/'), '::ffff:ac10:101 (172.16.1.1) must be blocked');
  console.log('   [1] IPv4-mapped IPv6 hex forms blocked.');

  // Test 2: trailing-dot / localhost variants
  console.log('\n[Test 2] Trailing dot and localhost variants...');
  assert(!isSafeExternalUrl('http://localhost./admin'), 'localhost. must be blocked');
  assert(!isSafeExternalUrl('http://127.0.0.1./'), '127.0.0.1. must be blocked');
  assert(!isSafeExternalUrl('http://10.0.0.5./internal'), '10.0.0.5. must be blocked');
  console.log('   [2] Trailing-dot variants blocked.');

  // Test 3: decimal/hex/octal/mixed IP forms (URL normalizes to 127.0.0.1)
  console.log('\n[Test 3] Numeric IP encodings...');
  assert(!isSafeExternalUrl('http://2130706433/'), 'decimal 2130706433 must be blocked');
  assert(!isSafeExternalUrl('http://0x7f000001/'), 'hex 0x7f000001 must be blocked');
  assert(!isSafeExternalUrl('http://0177.0.0.1/'), 'octal 0177.0.0.1 must be blocked');
  assert(!isSafeExternalUrl('http://127.1/'), '127.1 must be blocked');
  assert(!isSafeExternalUrl('http://127.0.0.1.nip.io/x'), '127.0.0.1.nip.io must be blocked');
  console.log('   [3] Numeric encodings blocked.');

  // Test 4: standard private/link-local/metadata + non-http
  console.log('\n[Test 4] Standard SSRF cases + protocols...');
  assert(!isSafeExternalUrl('http://169.254.169.254/latest/meta-data/'), 'AWS metadata must be blocked');
  assert(!isSafeExternalUrl('http://127.0.0.1:3000/api/files'), 'loopback must be blocked');
  assert(!isSafeExternalUrl('http://[fe80::1]/'), 'IPv6 link-local must be blocked');
  assert(!isSafeExternalUrl('javascript:alert(1)'), 'non-http protocol must be blocked');
  assert(!isSafeExternalUrl('file:///etc/passwd'), 'file:// must be blocked');
  assert(!isSafeExternalUrl('http://10.0.0.5/internal'), '10.x private must be blocked');
  assert(!isSafeExternalUrl('http://192.168.1.1/router'), '192.168.x must be blocked');
  assert(!isSafeExternalUrl('http://100.64.0.1/internal'), 'CGNAT must be blocked');
  assert(!isSafeExternalUrl('http://127.0.0.2:8080/'), '127.0.0.2 loopback alias must be blocked');
  assert(!isSafeExternalUrl('http://0.0.0.0:3901/api/health'), '0.0.0.0 must be blocked');
  console.log('   [4] Standard cases blocked.');

  // Test 5: public URLs still allowed
  console.log('\n[Test 5] Public URLs allowed...');
  assert(isSafeExternalUrl('https://example.com/about-us'), 'public https must be allowed');
  assert(isSafeExternalUrl('http://pharma-company.org/contact'), 'public http must be allowed');
  assert(isSafeExternalUrl('https://integrate.api.nvidia.com/v1'), 'NVIDIA endpoint must be allowed');
  assert(isSafeExternalUrl('https://api.groq.com/openai/v1/models'), 'Groq endpoint must be allowed');
  console.log('   [5] Public URLs allowed.');

  // Test 6: helper IP predicates
  console.log('\n[Test 6] IP predicate helpers...');
  assert(isPrivateIPv4('127.0.0.1') === true, '127.0.0.1 private');
  assert(isPrivateIPv4('127.0.0.2') === true, '127.0.0.2 private');
  assert(isPrivateIPv4('10.1.2.3') === true, '10.x private');
  assert(isPrivateIPv4('169.254.169.254') === true, '169.254.x link-local');
  assert(isPrivateIPv4('172.16.0.1') === true, '172.16.x private');
  assert(isPrivateIPv4('8.8.8.8') === false, '8.8.8.8 public');
  assert(isPrivateIPv6('::1') === true, '::1 loopback');
  assert(isPrivateIPv6('fe80::1') === true, 'fe80 link-local');
  assert(isPrivateIPv6('fc00::1') === true, 'fc00 ULA');
  assert(isPrivateIPv6('fd12::1') === true, 'fd00 ULA');
  assert(isPrivateIPv6('::ffff:7f00:1') === true, '::ffff:7f00:1 mapped loopback');
  assert(isPrivateIPv6('2001:4860:4860::8888') === false, 'public IPv6');
  console.log('   [6] IP predicates correct.');

  // Test 7: async DNS guard rejects private hostnames (localhost resolution)
  console.log('\n[Test 7] Async URL guard literal controls (no external DNS lookup)...');
  await expectGuardRefusal(() => assertSafeOutboundUrl('http://localhost:9999/'), URL_GUARD_MESSAGE, 'localhost');
  await expectGuardRefusal(() => assertSafeOutboundUrl('http://127.0.0.1:9999/'), URL_GUARD_MESSAGE, '127.0.0.1');

  // A public IP literal proves the async guard's allow path without any DNS lookup,
  // so the suite stays green on an offline machine.
  let allowed = true;
  try {
    await assertSafeOutboundUrl('https://203.0.113.10/');
  } catch { allowed = false; }
  assert(allowed, 'the permitted documentation-address literal must pass without DNS');
  console.log('   [7] Async literal controls passed; DNS binding is a separate acceptance scope.');

  // Test 8: fetchProviderModels choke point rejects SSRF baseUrl BEFORE sending the key.
  // An isolated config removes the stored keys from .test-cache, so the missing-key branch
  // is reachable: if the key check ran first it would throw "API Key is not configured"
  // instead of the SSRF message, and this test would fail.
  const isolatedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-ssrf-'));
  const previousConfig = process.env.EDGEVIEW_CONFIG;
  fs.writeFileSync(path.join(isolatedDir, 'config.json'), JSON.stringify({ nvidia_api_key: '', groq_api_key: '' }));
  process.env.EDGEVIEW_CONFIG = path.join(isolatedDir, 'config.json');
  try {
    console.log('\n[Test 8] fetchProviderModels rejects SSRF baseUrl (key never sent)...');
    await expectGuardRefusal(
      () => fetchProviderModels('nvidia', undefined, 'http://127.0.0.1:35471', true),
      PROVIDER_GUARD_MESSAGE,
      'fetchProviderModels with no key and a private baseUrl'
    );
    await expectGuardRefusal(
      () => fetchProviderModels('nvidia', 'nvapi-synthetic-unsaved-key', 'http://[::ffff:7f00:1]:35471', true),
      PROVIDER_GUARD_MESSAGE,
      'fetchProviderModels with an unsaved key and a mapped-IPv6 baseUrl'
    );
    await expectGuardRefusal(
      () => fetchProviderModels('nvidia', 'nvapi-synthetic-unsaved-key', 'http://localhost:35471', true),
      PROVIDER_GUARD_MESSAGE,
      'fetchProviderModels with an unsaved key and a localhost baseUrl'
    );
    console.log('   [8] fetchProviderModels SSRF guard verified (no key exfiltration).');

    // Test 9: NvidiaProvider.listModels direct call is guarded
    console.log('\n[Test 9] NvidiaProvider.listModels defense-in-depth...');
    await expectGuardRefusal(
      () => NvidiaProvider.listModels('nvapi-synthetic-unsaved-key', 'http://127.0.0.1:35471'),
      PROVIDER_GUARD_MESSAGE,
      'NvidiaProvider.listModels'
    );
    console.log('   [9] NvidiaProvider.listModels guard verified.');
  } finally {
    if (previousConfig === undefined) delete process.env.EDGEVIEW_CONFIG;
    else process.env.EDGEVIEW_CONFIG = previousConfig;
    fs.rmSync(isolatedDir, { recursive: true, force: true });
  }

  console.log('\n=============================================');
  console.log('  SUCCESS: All SSRF security guard tests passed!');
  console.log('=============================================\n');
}

run().catch((err) => {
  console.error('Security guard test failed:', err);
  process.exit(1);
});
