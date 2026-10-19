// Schema & Aliases — verifies the dynamic column-alias resolver and the
// contact-list extractor handle the many real-world column naming conventions
// (Importer/Exporter/Buyer/uppercase variants, country/date/value aliases)
// used across trade datasets and the Contacts table.

import * as assert from 'assert';
import { resolveColumnAlias, extractContactsList } from '../export_manager';

async function main() {
  // Dynamic alias resolution: importer
  const rowA = { Importer: 'Acme Corp', Buyer: 'Ignored', country: 'USA' };
  assert.ok(resolveColumnAlias(rowA, ['Importer', 'IMPORTER', 'Buyer', 'Buyer Name', 'Consignee']) === 'Acme Corp', 'importer alias resolution');

  const rowB = { Buyer_Name: 'Beta Ltd', country: 'DE' };
  assert.ok(resolveColumnAlias(rowB, ['Importer', 'IMPORTER', 'Buyer', 'Buyer Name', 'Buyer_Name', 'Consignee']) === 'Beta Ltd', 'Buyer_Name alias resolution');

  // Country aliases
  const rowC = { DESTINATION: 'Pakistan', COST: '$100' };
  assert.ok(resolveColumnAlias(rowC, ['Country', 'COUNTRY', 'Origin', 'DESTINATION', 'ORIGIN']) === 'Pakistan', 'country alias resolution');

  // Value aliases (skip empties)
  const rowD = { 'Total FC': '', 'TOTAL_VALUE': '5000' };
  assert.ok(resolveColumnAlias(rowD, ['total value', 'tot_fc', 'val_usd', 'invoice_value', 'TOTAL_VALUE']) === '5000', 'value alias resolution (skips empty)');

  // Missing -> fallback
  assert.ok(resolveColumnAlias({}, ['Country'], 'Not Specified') === 'Not Specified', 'fallback when absent');
  assert.ok(resolveColumnAlias(null as any, ['Country'], 'Not Specified') === 'Not Specified', 'fallback for null record');

  // Extract contacts from varied record shapes.
  const mixed = [
    { Importer: 'Alpha Traders', country: 'Pakistan', id: 'x1' },
    { Buyer: 'Beta Pharma', Country: 'India', email: 'b@beta.in', id: 'x2' },
    { company_name: 'Gamma LLC', country: 'USA', ceo: 'Joe', email: 'j@g.us', id: 'x3' },
  ];
  const list = extractContactsList(mixed);
  assert.ok(list.length === 3, 'extract list length');
  assert.ok(list[0].company_name === 'Alpha Traders', 'record 0 name via Importer alias');
  assert.ok(list[0].country === 'Pakistan', 'record 0 country');
  assert.ok(list[1].company_name === 'Beta Pharma', 'record 1 name via Buyer alias');
  assert.ok(list[1].country === 'India', 'record 1 country');
  assert.ok(list[1].email === 'b@beta.in', 'record 1 email');
  assert.ok(list[2].company_name === 'Gamma LLC', 'record 2 name via company_name');
  assert.ok(list[2].ceo === 'Joe', 'record 2 ceo');

  // CompanyContact-shaped record passes through with leadership/contact preserved.
  const shaped = {
    id: 'c-9',
    company_name: 'Zeta Pharma (Pvt) Ltd',
    country: 'Pakistan',
    ceo: 'Imran',
    email: 'i@z.pk',
    contact_persons: [{ name: 'Ayesha', designation: 'Head' }],
    sources: [{ url: 'https://s.com/z', title: 't' }],
  };
  const [one] = extractContactsList([shaped]);
  assert.ok(one.id === 'c-9', 'shaped id');
  assert.ok(one.contact_persons && one.contact_persons.length === 1, 'shaped contact_persons preserved');
  assert.ok(one.sources && one.sources.length === 1, 'shaped sources preserved');

  // No-country defaults to Not Specified.
  const noCountry = extractContactsList([{ company_name: 'No Country Co' }]);
  assert.ok(noCountry[0].country === 'Not Specified', 'default country Not Specified');

  console.log('contact_directory_schema_aliases OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});