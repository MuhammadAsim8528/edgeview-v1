// slim_email_survival_regression.test.ts
// Reproduces the email loss case for Slim Pharmaceuticals and verifies recovery.

import assert from 'assert';
import { enrichCompanyDetails } from '../enrichment';

console.log('--- RUNNING SLIM EMAIL SURVIVAL REGRESSION TEST ---');

(async () => {
  // Force a fresh run to avoid cached partial records.
  const extraContext = { country: 'Sri Lanka', role: 'Importer' } as any;
  const result = await enrichCompanyDetails('SLIM PHARMACEUTICALS PVT LTD', true, extraContext);

  console.log('Enrichment result:', {
    email: result.email,
    emails_list: result.emails_list,
    quality_status: result.quality_status,
    website: result.website,
    country: result.country,
  });

  const expected = 'info@slimpharma.com';
  // Primary email field should be populated.
  assert.strictEqual((result.email || '').toLowerCase(), expected, 'Primary email should match expected value');
  // Email list should contain the email as well.
  assert.ok(Array.isArray(result.emails_list) && result.emails_list.includes(expected), 'Emails list must include expected email');
  // Verify the country is correctly retained as Sri Lanka
  assert.strictEqual((result.country || '').toLowerCase(), 'sri lanka', 'Result country should be Sri Lanka');

  console.log('✅ Slim email recovered successfully.');
})();
