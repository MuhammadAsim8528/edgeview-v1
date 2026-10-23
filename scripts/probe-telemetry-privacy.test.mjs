import assert from 'node:assert/strict';
import { probeTelemetryPrivacy } from './probe-telemetry-privacy.mjs';
const source = `const TOKEN_PATTERNS: RegExp[] = [];
export function scrubSentryEvent(event: Record<string, any>) { return event; }
export function initTelemetry() { throw new Error('must never initialize SDK'); }`;
assert.equal(probeTelemetryPrivacy(source).checks.filter(check => check.status === 'FAIL').length, 9);
const dropping = source.replace('return event;', 'return {};');
assert.equal(probeTelemetryPrivacy(dropping).status, 'NOT VERIFIED', 'empty output does not prove useful monitoring/delivery');
assert.throws(() => probeTelemetryPrivacy('unsupported source shape'));
assert.equal(probeTelemetryPrivacy(source).sourceSha256.length, 64);
console.log('PASS offline privacy probe detects nine marker leaks, never runs init, rejects unknown shape and never grants delivery/readiness');
