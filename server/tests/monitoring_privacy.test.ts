import assert from 'node:assert/strict';
import { projectMonitoringEvent } from '../../shared/monitoring_privacy';

const identity = { version: '1.0.0-beta.2', build_id: 'a'.repeat(64), channel: 'beta', installation_id: 'a5ac169c-5820-4f77-b50d-678e2f243237' };
const markers = ['SYNTHETIC_COMPANY', 'contact@example.test', '+94112345678', 'SYNTHETIC_EVIDENCE', 'SYNTHETIC_PROMPT', 'synthetic-user', 'nvapi-' + 'Q'.repeat(64), 'gsk_' + 'R'.repeat(64)];
const secret = markers.join(' ');
const input: any = {
  message: secret, exception: { values: [{ value: secret, stacktrace: { frames: [{ filename: 'C:\\Users\\synthetic-user\\private.ts' }] } }] },
  extra: { evidence: secret }, contexts: { contact: secret }, breadcrumbs: [{ message: secret }],
  request: { url: `https://example.test/?company=${secret}`, headers: { cookie: secret } },
  provider: 'serper', stage: 'search', outcome: 'failed', error_code: 'PROVIDER_RATE_LIMITED',
  duration_ms: 123.5, http_status: 429, rss_bytes: 134217728,
  company: secret, email: secret, phone: secret, prompt: secret,
};
const before = JSON.stringify(input);
const error = projectMonitoringEvent('runtime_error', input, identity)!;
assert.ok(error, 'dropping every event is not useful privacy acceptance');
assert.equal(error.provider, 'serper'); assert.equal(error.http_status, 429);
assert.equal(error.duration_ms, 123.5); assert.equal(error.stage, 'search');
assert.equal(error.error_code, 'PROVIDER_RATE_LIMITED');
assert.equal(error.message, 'Provider request rate limited');
assert.equal(error.build_id, identity.build_id); assert.equal(error.installation_id, identity.installation_id);
assert.deepEqual(Object.keys(error).sort(), ['version', 'build_id', 'channel', 'installation_id', 'event', 'provider', 'stage', 'outcome', 'duration_ms', 'http_status', 'rss_bytes', 'error_code', 'message'].sort());
assert.ok(Object.isFrozen(error)); assert.equal(Object.getPrototypeOf(error), null);
for (const marker of markers) assert.ok(!JSON.stringify(error).includes(marker), 'private class leaked');
assert.equal(JSON.stringify(input), before, 'projection must not mutate local diagnostic evidence');
for (const name of ['research_completed', 'export_failed', 'update_success', 'rollback_started', 'operation_timing', 'resource_sample']) {
  const event = projectMonitoringEvent(name, input, identity)!;
  assert.equal(event.event, name);
  for (const marker of markers) assert.ok(!JSON.stringify(event).includes(marker));
  assert.equal(event.message, undefined);
}
assert.equal(projectMonitoringEvent(secret, input, identity), null);
for (const key of Object.keys(identity)) assert.equal(projectMonitoringEvent('app_started', {}, { ...identity, [key]: secret }), null);
for (const key of ['version', 'build_id', 'installation_id'] as const) assert.equal(projectMonitoringEvent('app_started', {}, { ...identity, [key]: identity[key] + '\n' }), null);
assert.equal(projectMonitoringEvent('research_started', { operation_id: identity.installation_id }, identity)!.operation_id, undefined, 'UUID-shaped business/job IDs must not be forwarded from properties');
assert.equal(projectMonitoringEvent('app_started', {}, Object.create(identity)), null);
const identityGetter = { ...identity };
Object.defineProperty(identityGetter, 'version', { get() { throw new Error('getter must not execute'); } });
assert.equal(projectMonitoringEvent('app_started', {}, identityGetter), null);
const revoked = Proxy.revocable({}, {}); revoked.revoke();
assert.equal(projectMonitoringEvent('app_started', revoked.proxy, identity), null);
assert.equal(projectMonitoringEvent('app_started', {}, revoked.proxy), null);
for (const value of [NaN, Infinity, -1, Number.MAX_VALUE, secret, { value: 1 }]) {
  const event = projectMonitoringEvent('operation_timing', { duration_ms: value, http_status: value }, identity)!;
  assert.equal(event.duration_ms, undefined); assert.equal(event.http_status, undefined);
}
const poison = { ...input, provider: secret, stage: secret, outcome: secret, operation_id: secret, error_code: secret };
const projected = projectMonitoringEvent('runtime_error', poison, identity)!;
assert.equal(projected.provider, undefined); assert.equal(projected.error_code, 'UNEXPECTED_ERROR');
assert.equal(projected.message, 'Unexpected EdgeView error');
for (const code of ['constructor', '__proto__', 'toString']) assert.equal(projectMonitoringEvent('runtime_error', { error_code: code }, identity)!.error_code, 'UNEXPECTED_ERROR');
assert.equal(projectMonitoringEvent('operation_timing', { http_status: 200.5 }, identity)!.http_status, undefined);
for (const [key, maximum] of Object.entries({ duration_ms: 3600000, http_status: 599, rss_bytes: 1024 ** 4, heap_used_bytes: 1024 ** 4, cpu_percent: 25600 })) {
  assert.equal(projectMonitoringEvent('resource_sample', { [key]: maximum }, identity)![key], maximum);
  assert.equal(projectMonitoringEvent('resource_sample', { [key]: maximum + 1 }, identity)![key], undefined);
}
let invoked = false;
const dangerous = Object.create({ provider: secret });
Object.defineProperty(dangerous, 'stage', { get() { invoked = true; throw new Error(secret); } });
dangerous.toJSON = () => { invoked = true; return secret; };
assert.equal(projectMonitoringEvent('research_failed', dangerous, identity)!.provider, undefined);
assert.equal(invoked, false);
assert.equal(projectMonitoringEvent('app_started', new Proxy({}, { getOwnPropertyDescriptor() { throw new Error(secret); } }), identity), null);
let nested: any = { evidence: secret };
for (let index = 0; index < 10000; index++) nested = { child: nested };
assert.equal(projectMonitoringEvent('app_started', nested, identity)!.event, 'app_started', 'no recursive traversal');
assert.equal(projectMonitoringEvent('app_started', null, identity)!.event, 'app_started');
assert.equal(projectMonitoringEvent('app_started', [], identity)!.event, 'app_started');
console.log('PASS strict monitoring projection retains useful bounded metadata, rejects private content and never invokes getters/toJSON');
