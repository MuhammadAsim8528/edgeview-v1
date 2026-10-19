import { runV1Enrichment } from '../server/v1_engine';
import { projectDeterministicContactFields } from '../server/job_manager';

const cases = [
  ['TOP PRIME TRADING CO., LTD.', 'Myanmar'],
  ['AL FAJIRI PHARMACEUTICALS LTD', 'Kenya'],
  ['M/S Shifa Pharma Limited', 'Afghanistan'],
  ['ABBOTT PRODUCTS EGYPT LLC', 'Egypt'],
  ["DR. E.M.T.D.B. EKANAYAKE, NATURE'S REMEDIES (PVT) LTD", 'Sri Lanka'],
  ['AFGHAN PHARMA CO LTD.', 'Afghanistan'],
  ['Britton Distributions, Inc.', 'Philippines'],
  ['SLIM PHARMACEUTICALS PVT LTD', 'Sri Lanka'],
] as const;

const output: unknown[] = [];
let cursor = 0;
const worker = async () => {
while (cursor < cases.length) {
  const [company, country] = cases[cursor++];
  const run = await runV1Enrichment(company, country, { profile: 'bulk' });
  const projected = projectDeterministicContactFields(run);
  output.push({
    company, country, run_id: run.id, status: run.status,
    website: projected.website, emails: projected.emails_list,
    phones: projected.phones_list, addresses: projected.addresses,
    leaders: projected.contact_persons,
    results: run.results.length, raw_records: run.raw_records.length,
  });
}
};
await Promise.all(Array.from({ length: 3 }, () => worker()));
console.log(JSON.stringify(output, null, 2));
