// adversarial_email_host_admission.test.ts
// Ensures that emails from partner hosts are not admitted for the target company.

import assert from 'assert';
import { shouldAdmitRegexEmailSource } from '../research_director';

// Target company official host
const officialHost = 'official-a.com';
// Partner host containing an email
const partnerHost = 'partner-b.com';

// Email source is partner host – should be rejected when the target host is official-a.com
assert.strictEqual(
  shouldAdmitRegexEmailSource(partnerHost, officialHost),
  false,
  'Email from partner host must be rejected for the target company'
);

// Same host (official) – should be accepted
assert.strictEqual(
  shouldAdmitRegexEmailSource('www.official-a.com', officialHost),
  true,
  'Email from official host should be admitted'
);

console.log('✅ adversarial_email_host_admission test passed');
