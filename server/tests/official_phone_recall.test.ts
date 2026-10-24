import assert from 'node:assert/strict';
import { projectDeterministicContactFields } from '../job_manager';

function project(text: string, patch: Record<string, unknown> = {}) {
  return projectDeterministicContactFields({ company_name: 'Synthetic Medical Limited', country: 'Kenya',
    identity_resolution: { official_domain: 'synthetic-medical.test' } as any,
    results: [{ id: 'official', provider: 'direct-http', status: 'success', url: 'https://synthetic-medical.test/contact', text, ...patch } as any] });
}
const digits = (values: string[]) => values.map(value => value.replace(/\D/g, ''));
const page = `By Phone +254 111 041600
By Cell +254 715 685100 (accounts); +254 722 204929 (sales); +254 707 597825 (administration);
Fax: +254 20 555 1212
Fax number: +254 20 555 1213
P.O.Box: 14461-00800 Nairobi, Kenya
2026-01-13
+254 733 455667
00100
Phone: 020 4455667
Telephone: +254 111 041600
Foreign office: +1 631 949 9665`;
const result = project(page);
assert.deepEqual(new Set(digits(result.phones_list)), new Set(['254111041600', '254715685100', '254722204929', '254707597825', '254733455667', '0204455667']));
assert.equal(result.phones_list.length, 6, 'format variants deduplicate by digits');
assert.deepEqual(project(page, { status: 'error' }).phones_list, [], 'failed raw body is not contact proof');
assert.deepEqual(project(page, { url: 'https://directory.test/company' }).phones_list, [], 'external directory cannot inherit official-page attribution');
assert.deepEqual(project('', { markdown: '+254 733 455667' }).phones_list, ['+254 733 455667'], 'markdown-only provider content remains usable');
assert.deepEqual(project('Telephone\n2026-01-13\n14461-00800').phones_list, [], 'label must not eat unrelated following lines');
assert.deepEqual(project('Phone: +254 733 455667\n2026-01-13').phones_list, ['+254 733 455667'], 'next-line date must not destroy valid phone');
assert.deepEqual(project('Fax: +254 20 555 1212\nDate: 2026-01-13\nGPS: 13.109856\nCode: 3004900002').phones_list, []);
assert.deepEqual(project(`Phone: +254733455667${' '.repeat(45)}99999999`).phones_list, [], 'do not truncate an oversized numeric sequence into a plausible phone');
console.log('PASS official phone recall, line boundaries, fax/country exclusion, attribution, failures and markdown');
