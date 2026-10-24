import assert from 'node:assert/strict';
import { projectDeterministicContactFields } from '../job_manager';

const officialText = `
Your Excellent Link to Affordable Healthcare
By Email surgimail@surgilinksltd.com; info@surgilinksltd.com;
By Phone +254 111 041600
By Cell +254 715 685100 (accounts); +254 722 204929 (sales); +254 707 597825 (administration);
Fax: +254 20 555 1212
By Address P.O.Box: 14461-00800 Nairobi, Kenya
`;

const projected = projectDeterministicContactFields({
  company_name: 'SURGILINKS LIMITED',
  country: 'Kenya',
  identity_resolution: { official_domain: 'surgilinksltd.com', confidence: 'high', candidate_domains: [] } as any,
  evidence_workspace: { chunks: [], accepted_claims: [], rejected_claims: [] } as any,
  results: [
    {
      id: 'search-1', provider: 'serper', status: 'success', rank: 1,
      title: 'Surgilinks Limited', url: 'https://surgilinksltd.com/', snippet: 'Official Surgilinks website',
      text: officialText, html: `<html><body>${officialText}</body></html>`, links: [],
      metadata: {},
    } as any,
  ],
});

for (const phone of ['+254 111 041600', '+254 715 685100', '+254 722 204929', '+254 707 597825']) {
  assert.ok(projected.phones_list.some((value: string) => value.replace(/\D/g, '') === phone.replace(/\D/g, '')), `missing official phone ${phone}`);
}
assert.ok(!projected.phones_list.some((value: string) => value.replace(/\D/g, '') === '+254 20 555 1212'.replace(/\D/g, '')), 'fax must not be promoted as an ordinary phone');
console.log('official phone recall regression passed');
