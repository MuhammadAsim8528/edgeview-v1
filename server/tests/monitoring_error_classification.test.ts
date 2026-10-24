import assert from 'node:assert/strict';
import { classifyMonitoringError } from '../monitoring';

const cases: Array<[unknown,string]> = [
  [new Error('401 unauthorized provider credential rejected'), 'PROVIDER_AUTH_FAILED'],
  [new Error('429 quota rate limit'), 'PROVIDER_RATE_LIMITED'],
  [new Error('request timed out'), 'PROVIDER_TIMEOUT'],
  [new Error('invalid provider response schema'), 'PROVIDER_SCHEMA_INVALID'],
  [new Error('fetch failed ECONNRESET'), 'PROVIDER_UNAVAILABLE'],
  [Object.assign(new Error('no space left on device'), { code: 'ENOSPC' }), 'DISK_FULL'],
  [new Error('sqlite database unavailable'), 'DATABASE_UNAVAILABLE'],
  [new Error('persistence write failed'), 'PERSISTENCE_WRITE_FAILED'],
  [new Error('SYNTHETIC_COMPANY contact@example.test private prompt'), 'UNEXPECTED_ERROR'],
];
for (const [input, expected] of cases) assert.equal(classifyMonitoringError(input), expected);
console.log('PASS monitoring error classifier emits only fixed privacy-safe codes');
