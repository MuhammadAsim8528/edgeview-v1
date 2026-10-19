import assert from 'node:assert/strict';
import path from 'node:path';

process.env.EDGEVIEW_TEST_MODE = '1';
process.env.EDGEVIEW_TEST_DB_DIR = path.join(process.cwd(), '.test-cache', `full-list-e2e-${process.pid}-${Date.now()}`);
process.env.GEMINI_API_KEY = 'TEST-' + 'GEMINI-FIXTURE-000000000000';

const { db } = await import('../db');
const { createJob, getJob, runJobLoop } = await import('../job_manager');
const { saveEnrichedData, getCachedCompany } = await import('../enrichment');
const { applyEnrichmentDetailsToContact } = await import('../contact_projection');
const { extractContactsList } = await import('../export_manager');
const { normalizeContactInfo, normalizePeople } = await import('../contact_report_model');

const contacts = [
  ['full-easy', 'Full List Easy Pharma', 'Kenya'],
  ['full-obscure', 'Obscure Medical Trading', 'Uganda'],
  ['full-same-ke', 'Shared Health Company', 'Kenya'],
  ['full-same-gh', 'Shared Health Company', 'Ghana'],
  ['full-multi', 'Multi Contact Pharma', 'Kenya'],
  ['full-leaders', 'Leadership Pharma', 'Tanzania'],
  ['full-provider-fail', 'Provider Failure Pharma', 'Kenya'],
  ['full-misleading', 'Misleading Source Pharma', 'Kenya'],
  ['full-no-data', 'No Public Contact Pharma', 'Kenya'],
  ['full-resume', 'Resume Pharma', 'Kenya'],
].map(([id, company_name, country]) => ({
  id, company_name, country, type: 'Importer', entity_key: `${String(company_name).toLowerCase()}__${String(country).toLowerCase()}`,
  email: '', phone: '', website: '', address: '', ceo: '', whatsapp: '', linkedin: '', message_sent: false,
  last_updated: new Date().toISOString(),
}));
for (const contact of contacts) db.contacts.set(contact.id, contact as any);
db.rebuildIndexes();

const calls = new Map<string, number>();
(globalThis as any).__edgeviewTestResearchRunner = async (companyName: string, context: any) => {
  calls.set(`${companyName}|${context?.country || ''}`, (calls.get(`${companyName}|${context?.country || ''}`) || 0) + 1);
  await new Promise((resolve) => setTimeout(resolve, 15));
  if (companyName === 'Provider Failure Pharma') throw new Error('SEARCH_PROVIDER_FAILURE: deterministic fixture');

  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const domain = `${slug}.example`;
  const rich = companyName === 'Multi Contact Pharma';
  const noData = companyName === 'No Public Contact Pharma';
  const branchPrefix = context.country === 'Ghana' ? 'ghana' : 'contact';
  const primaryEmail = rich ? `info@${domain}` : `${branchPrefix}@${domain}`;
  return saveEnrichedData({
    company_name: companyName,
    country: context.country,
    website: noData ? '' : `https://${domain}`,
    email: noData ? '' : primaryEmail,
    emails_list: noData ? [] : (rich ? ['info', 'sales', 'procurement', 'operations'].map((name) => `${name}@${domain}`) : [`${branchPrefix}@${domain}`]),
    phone: noData ? '' : (context.country === 'Ghana' ? '+233 20 000 0001' : '+254 700 000 001'),
    phones_list: noData ? [] : (rich ? [1, 2, 3, 4, 5].map((n) => `+254 700 000 00${n}`) : [context.country === 'Ghana' ? '+233 20 000 0001' : '+254 700 000 001']),
    fax_numbers: rich ? ['+254 20 100 0001', '+254 20 100 0002'] : [],
    address: noData ? '' : (rich ? 'Office 1, Nairobi, Kenya' : `${context.country} Head Office`),
    addresses: noData ? [] : (rich ? [1, 2, 3].map((n) => ({ address: `Office ${n}, Nairobi, Kenya`, source_url: `https://${domain}/locations` })) : [{ address: `${context.country} Head Office`, source_url: `https://${domain}/contact` }]),
    contact_persons: noData ? [] : (rich || companyName === 'Leadership Pharma' ? Array.from({ length: 7 }, (_, i) => ({
      name: `Leader ${i + 1}`, designation: i === 0 ? 'Managing Director' : 'Department Director',
      email: `leader${i + 1}@${domain}`, phone: `+254 711 000 00${i + 1}`,
      linkedin_url: `https://linkedin.com/in/${slug}-${i + 1}`, source_url: `https://${domain}/team`,
    })) : []),
    linkedin_urls: noData ? [] : [`https://linkedin.com/company/${slug}`],
    socials: noData ? [] : [{ platform: 'LinkedIn', url: `https://linkedin.com/company/${slug}`, verified: true }],
    company_contacts: noData ? [] : [{ type: 'sales', email: `sales@${domain}`, source_url: `https://${domain}/contact` }],
    sources: noData ? [] : [{ url: `https://${domain}/contact`, title: `${companyName} Contact`, source_type: 'official_website' }],
    evidence: noData ? [] : [{ field: 'email', value: primaryEmail, source_url: `https://${domain}/contact`, confidence: 0.95 }],
    research_trace: [{ stage: 'fixture', decision: noData ? 'NO_EVIDENCE' : 'ADMIT' }],
    objectives: { IDENTITY: { status: noData ? 'PARTIAL' : 'SATISFIED' } },
    quality_status: noData ? 'NOT_FOUND' : (rich || companyName === 'Leadership Pharma' ? 'COMPLETE' : 'PARTIAL'),
    isPartial: noData || !(rich || companyName === 'Leadership Pharma'),
    source: 'full-list-e2e',
  } as any);
};

try {
  const jobId = await createJob(contacts.map((contact) => contact.id), 'importer');
  assert.equal(await runJobLoop(jobId, true), true, 'first start must claim the job');
  assert.equal(await runJobLoop(jobId, true), false, 'duplicate start must not launch a second worker');

  let job = await getJob(jobId);
  const deadline = Date.now() + 15_000;
  while (job && !['COMPLETED', 'FAILED', 'RESOURCE_LIMITED'].includes(job.status) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    job = await getJob(jobId);
  }
  assert.equal(job?.status, 'COMPLETED');
  assert.equal(job?.company_states['full-provider-fail'].status, 'failed', 'one failed company must not kill the list');
  assert.equal(job?.company_states['full-resume'].status, 'completed', 'companies after a failure must still run');
  assert.equal(contacts.length, 10, 'company count must remain unchanged');

  const richMemory: any = db.getContactById('full-multi');
  assert.equal(richMemory.emails_list.length, 4);
  assert.equal(richMemory.phones_list.length, 5);
  assert.equal(richMemory.fax_numbers.length, 2);
  assert.equal(richMemory.addresses.length, 3);
  assert.equal(richMemory.contact_persons.length, 7);
  assert.ok(richMemory.evidence.length >= 1, 'evidence must survive canonical save');

  const cached = await getCachedCompany('Multi Contact Pharma', 'Kenya', 'Importer');
  assert.ok(cached, 'canonical cache must contain the completed company');
  const reloaded: any = { id: 'reload', company_name: 'Multi Contact Pharma', country: 'Kenya', type: 'Importer' };
  applyEnrichmentDetailsToContact(reloaded, cached);
  for (const field of ['emails_list', 'phones_list', 'fax_numbers', 'addresses', 'contact_persons', 'linkedin_urls', 'evidence', 'company_contacts', 'research_trace', 'objectives']) {
    assert.deepEqual(reloaded[field], richMemory[field], `${field} must survive save and reload projection`);
  }

  const exported = extractContactsList([reloaded])[0];
  const exportInfo = normalizeContactInfo(exported);
  assert.equal(exportInfo.emails.length, 4);
  assert.equal(exportInfo.phones.length, 5);
  assert.equal(exportInfo.fax_numbers.length, 2);
  assert.equal(exportInfo.addresses.length, 3);
  assert.equal(normalizePeople(exported).length, 7);
  assert.equal(exportInfo.linkedin_urls.length, 1);

  const kenyaBranch: any = db.getContactById('full-same-ke');
  const ghanaBranch: any = db.getContactById('full-same-gh');
  assert.equal(kenyaBranch.country, 'Kenya');
  assert.equal(ghanaBranch.country, 'Ghana');
  assert.notEqual(kenyaBranch.email, ghanaBranch.email, 'same-name country branches must remain isolated');

  const completedCallsBeforeResume = calls.get('Multi Contact Pharma|Kenya');
  assert.equal(await runJobLoop(jobId, true), true);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(calls.get('Multi Contact Pharma|Kenya'), completedCallsBeforeResume, 'resume must not repeat completed companies');

  const scaleContacts = Array.from({ length: 25 }, (_, index) => ({
    id: `scale-${index + 1}`, company_name: `Scale Pharma ${index + 1}`, country: 'Kenya', type: 'Importer',
    entity_key: `scale pharma ${index + 1}__kenya`, email: '', phone: '', website: '', address: '', ceo: '',
    whatsapp: '', linkedin: '', message_sent: false, last_updated: new Date().toISOString(),
  }));
  for (const contact of scaleContacts) db.contacts.set(contact.id, contact as any);
  db.rebuildIndexes();
  const scaleJobId = await createJob(scaleContacts.map((contact) => contact.id), 'importer');
  assert.equal(await runJobLoop(scaleJobId, true), true);
  let scaleJob = await getJob(scaleJobId);
  const scaleDeadline = Date.now() + 25_000;
  while (scaleJob && scaleJob.status !== 'COMPLETED' && Date.now() < scaleDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    scaleJob = await getJob(scaleJobId);
  }
  assert.equal(scaleJob?.status, 'COMPLETED', '25-entity bounded scale run must complete');
  assert.equal(Object.values(scaleJob?.company_states || {}).filter((state: any) => state.status === 'completed').length, 25);
  assert.equal(scaleContacts.reduce((sum, contact) => sum + (calls.get(`${contact.company_name}|Kenya`) || 0), 0), 25, 'scale run must execute each entity exactly once');

  console.log('full_list_contact_extraction_e2e: 38 assertions passed');
} finally {
  delete (globalThis as any).__edgeviewTestResearchRunner;
}
