import { saveEnrichedData, getCachedCompany } from '../enrichment';
import { isContaminatedPerson, isAcademicEmail, filterCleanPeople, filterCleanEmails, getEmailDomain } from '../corporate_validation';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Academic Contamination Pipeline Test Failed: ${msg}`);
}

async function run() {
  console.log('--- RUNNING ACADEMIC CONTAMINATION PIPELINE GUARD TEST ---');

  // Test 1: Pure helper rejects academic registrar
  const registrar = { name: 'Mrs. Kalpana Nathiparan', designation: 'Senior Assistant Registrar', email: 'sar@pim.sjp.ac.lk' };
  assert(isContaminatedPerson(registrar) === true, 'Academic registrar must be flagged contaminated');
  assert(isAcademicEmail('director@pim.sjp.ac.lk') === true, '.ac.lk academic email must be flagged');
  assert(isAcademicEmail('info@emerchemie.lk') === false, 'Corporate email must NOT be flagged');
  assert(getEmailDomain('director@pim.sjp.ac.lk') === 'pim.sjp.ac.lk', 'email domain extraction works');
  console.log('   [1] Helper guards verified.');

  // Test 2: saveEnrichedData strips academic emails + contaminated people at the cache choke point
  const company = 'AcadGuard Test Company ' + Date.now();
  const saved = await saveEnrichedData({
    company_name: company,
    emails_list: ['director@pim.sjp.ac.lk', 'sar@pim.sjp.ac.lk', 'info@emerchemie.lk'],
    email: 'dean@science.cmb.ac.lk',
    phones_list: ['+94 112 689639'],
    address: '28, Lesley Ranagala Mawatha, Colombo 08, Sri Lanka',
    website: 'http://www.emerchemie.lk',
    decision_makers: [
      { name: 'Mrs. Kalpana Nathiparan', designation: 'Senior Assistant Registrar', emails: [{ value: 'sar@pim.sjp.ac.lk' }] },
      { name: 'Dilip Fernando', designation: 'Managing Director', emails: [{ value: 'dilip@emerchemie.lk' }] }
    ],
    contact_persons: [
      { name: 'Prof. A. Perera', designation: 'Professor', email: 'registrar@science.cmb.ac.lk' },
      { name: 'Dilip Fernando', designation: 'Managing Director', email: 'dilip@emerchemie.lk' }
    ]
  });

  assert(!saved.emails_list.includes('director@pim.sjp.ac.lk'), 'Academic email must be stripped from emails_list');
  assert(!saved.emails_list.includes('dean@science.cmb.ac.lk'), 'Academic primary email must be stripped');
  assert(saved.emails_list.includes('info@emerchemie.lk'), 'Corporate email must be retained');
  assert(saved.email !== 'dean@science.cmb.ac.lk', 'Primary email must not be academic');
  assert(!saved.decision_makers?.some((dm: any) => dm.name.includes('Nathiparan')), 'Academic registrar must NOT be a decision maker');
  assert(saved.decision_makers?.some((dm: any) => dm.name === 'Dilip Fernando'), 'Corporate MD must remain a decision maker');
  assert(!saved.contact_persons?.some((cp: any) => cp.name.includes('Perera') || cp.designation?.toLowerCase().includes('professor')), 'Academic professor must be stripped from contacts');
  assert(saved.contact_persons?.some((cp: any) => cp.name === 'Dilip Fernando'), 'Corporate MD must remain a contact');
  console.log('   [2] saveEnrichedData cache write guard verified.');

  // Test 3: Persisted cache row is clean
  const cached = await getCachedCompany(company);
  assert(cached !== null, 'Cached row exists');
  assert(!cached?.emails_list?.includes('director@pim.sjp.ac.lk'), 'Cached emails clean');
  assert(!cached?.decision_makers?.some((dm: any) => dm.name.includes('Nathiparan')), 'Cached decision makers clean');
  console.log('   [3] Persisted cache verification passed.');

  console.log('\n✅ ALL ACADEMIC CONTAMINATION PIPELINE GUARD TESTS PASSED 100%.');
}

run().catch((e) => { console.error('❌', e); process.exit(1); });