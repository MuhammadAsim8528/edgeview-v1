import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

/** Read-only/offline test of actual scrubber code, never vendor SDK init. */
export function probeTelemetryPrivacy(source) {
  if (typeof source !== 'string' || Buffer.byteLength(source) > 1024 * 1024) throw new Error('Unsupported adapter size.');
  const start = source.indexOf('const TOKEN_PATTERNS');
  const end = source.indexOf('export function initTelemetry');
  if (start < 0 || end <= start) throw new Error('Unsupported adapter shape; no result inferred.');
  const code = stripTypeScriptTypes(source.slice(start, end), { mode: 'strip' }).replace(/export\s+function\s/g, 'function ');
  const context = vm.createContext({});
  new vm.Script(`${code}\nglobalThis.probeScrub = scrubSentryEvent;`).runInContext(context, { timeout: 1000 });
  const cases = [
    ['company in message', { message: 'Research failed for SYNTHETIC_BUSINESS_MARKER' }, 'SYNTHETIC_BUSINESS_MARKER'],
    ['contact in context', { contexts: { company: { email: 'synthetic-contact@example.test' } } }, 'synthetic-contact@example.test'],
    ['raw evidence in extra', { extra: { evidence: 'SYNTHETIC_EVIDENCE_MARKER' } }, 'SYNTHETIC_EVIDENCE_MARKER'],
    ['prompt in breadcrumb', { breadcrumbs: [{ message: 'SYNTHETIC_PROMPT_MARKER' }] }, 'SYNTHETIC_PROMPT_MARKER'],
    ['exception message', { exception: { values: [{ type: 'Error', value: 'SYNTHETIC_EXCEPTION_MARKER' }] } }, 'SYNTHETIC_EXCEPTION_MARKER'],
    ['local stack path', { exception: { values: [{ stacktrace: { frames: [{ filename: 'C:\\Users\\synthetic-user\\private\\server.ts' }] } }] } }, 'synthetic-user'],
    ['query in request URL', { request: { url: 'https://example.test/?company=SYNTHETIC_URL_MARKER' } }, 'SYNTHETIC_URL_MARKER'],
    ['NVIDIA credential pattern', { message: `nvapi-${'Q'.repeat(64)}` }, `nvapi-${'Q'.repeat(64)}`],
    ['Groq credential pattern', { message: `gsk_${'R'.repeat(64)}` }, `gsk_${'R'.repeat(64)}`],
  ];
  const checks = cases.map(([name, event, marker]) => {
    // Inputs contain synthetic markers only. No installation config or SDK is read.
    context.probeInput = structuredClone(event);
    const result = new vm.Script('probeScrub(probeInput)').runInContext(context, { timeout: 1000 });
    return { name, status: JSON.stringify(result).includes(marker) ? 'FAIL' : 'PASS' };
  });
  return { sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
    scope: 'Extracted pure actual adapter scrubber; no SDK/network/delivery or full app integration tested',
    status: checks.some(check => check.status === 'FAIL') ? 'FAIL' : 'NOT VERIFIED', checks };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new Error('Adapter path required.');
    const target = path.resolve(process.argv[2]);
    if (fs.statSync(target).size > 1024 * 1024) throw new Error('Unsupported adapter size.');
    const source = fs.readFileSync(target, 'utf8');
    const result = probeTelemetryPrivacy(source);
    if (fs.readFileSync(target, 'utf8') !== source) throw new Error('Adapter changed during probe; discard result.');
    console.log(JSON.stringify(result, null, 2));
    if (result.status === 'FAIL') process.exitCode = 1;
  } catch {
    console.error('Privacy probe unavailable or adapter shape changed; no PASS inferred.');
    process.exitCode = 2;
  }
}
