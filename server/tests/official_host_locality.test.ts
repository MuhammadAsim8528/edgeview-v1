// official_host_locality.test.ts
// Verifies that emails from non‑official hosts are rejected by host admission logic.

import assert from 'assert';
import { shouldAdmitRegexEmailSource } from '../research_director';

// Email from a partner directory should NOT be admitted for the target company.
const partnerHost = 'partner-b.com';
const officialHost = 'hyperpharm.mu'; // example official host used in other tests

assert.strictEqual(
  shouldAdmitRegexEmailSource(partnerHost, officialHost),
  false,
  'Email from partner host must be rejected when target host is official domain'
);

// Email from the exact official host should be admitted.
assert.strictEqual(
  shouldAdmitRegexEmailSource('www.hyperpharm.mu', officialHost),
  true,
  'Email from official host should be admitted'
);

console.log('✅ official_host_locality test passed');
