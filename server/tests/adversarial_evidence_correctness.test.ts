import {
  calculateCompanyAssociationScore,
  isValidCorporateContactPerson,
} from '../research_director';
import { processContactExport } from '../export_manager';
import JSZip from 'jszip';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Adversarial Evidence Correctness Test Failed: ${msg}`);
  }
}

async function runAdversarialEvidenceTests() {
  console.log('--- RUNNING ADVERSARIAL EVIDENCE & ASSOCIATION CORRECTNESS TESTS ---');

  // Test 1: Association Score for Unrelated University Page
  console.log('\n[Test 1] Testing Association Score for Unrelated University Page...');
  const targetCompany = 'Emerchemie NB Ceylon Limited';
  const universityPageContent = `
    Welcome to the University of Colombo Faculty of Science.
    Registrar Office Staff:
    Mrs. A. Perera, Senior Assistant Registrar
    Contact: registrar@science.cmb.ac.lk, Phone: +94 11 258 8301
    Incidental note: Emerchemie NB Ceylon Limited donated equipment in 2018.
  `;
  const uniUrl = 'https://science.cmb.ac.lk/faculty/staff';

  const uniScore = calculateCompanyAssociationScore(universityPageContent, uniUrl, targetCompany, 'Sri Lanka');
  console.log(`   University Page Association Score: ${uniScore.score} (Associated: ${uniScore.isAssociated})`);
  console.log('   Reasons:', uniScore.reasons.join('; '));

  assert(uniScore.score < 8.0, 'Incidental mention on university page must receive low association score');
  console.log('   ✅ Academic / University Association Filter verified.');

  // Test 2: Validation of Corporate Contact Person vs Academic Staff
  console.log('\n[Test 2] Testing Corporate Contact Person Validation...');
  const validCorporatePerson = {
    name: 'Dilip Fernando',
    designation: 'Managing Director & CEO',
    department: 'Executive Board'
  };

  const academicStaffPerson = {
    name: 'Mrs. A. Perera',
    designation: 'Senior Assistant Registrar',
    department: 'University Administration'
  };

  const isValidCorp = isValidCorporateContactPerson(validCorporatePerson);
  const isValidAcad = isValidCorporateContactPerson(academicStaffPerson);

  console.log(`   Corporate MD Valid: ${isValidCorp}`);
  console.log(`   University Registrar Valid: ${isValidAcad}`);

  assert(isValidCorp === true, 'Corporate MD must be valid contact person');
  assert(isValidAcad === false, 'University Registrar must be REJECTED');
  console.log('   ✅ Contact Person Validation verified.');

  // Test 3: Multi-Country Dynamic Schema Export Processing
  console.log('\n[Test 3] Testing Multi-Country Dynamic Schema Export Processing...');
  const dynamicPayload = {
    dataset: 'contacts',
    title: 'Adversarial Dynamic Schema Export',
    format: 'docx' as const,
    records: [
      {
        BUYER_NAME: 'Emerchemie NB Ceylon Limited',
        DESTINATION: 'Sri Lanka',
        WEBSITE: 'https://www.emerchemie.lk',
        EMAIL: 'info@emerchemie.lk',
        PHONE: '+94 11 269 5143',
        ADDRESS: '107 Park Road, Colombo 05, Sri Lanka',
        contacts: [
          { name: 'Dilip Fernando', designation: 'Managing Director', email: 'dilip@emerchemie.lk' }
        ]
      },
      {
        IMPORTER: 'Getz Pharma (Pvt) Ltd',
        COUNTRY: 'Pakistan',
        Website: 'https://www.getzpharma.com',
        Email: 'info@getzpharma.com',
        Phone: '+92 21 111 111 500',
        Address: '29-30/27, Korangi Industrial Area, Karachi, Pakistan',
        contact_persons: [
          { name: 'Khalid Mahmood', designation: 'CEO', email: 'khalid@getzpharma.com' }
        ]
      }
    ]
  };

  const exportResult = await processContactExport(dynamicPayload as any);
  const buf = exportResult.buffer as Buffer;
  console.log(`   Exported DOCX Filename: ${exportResult.filename}`);
  console.log(`   Exported DOCX Buffer Size: ${buf.length} bytes`);

  // Self-contained validity assertions. The DOCX size threshold intentionally
  // does NOT depend on trade-history rows from any database: under test
  // isolation buildTradeIndex sees an empty store, so a non-trivial but
  // deterministic document (~4KB) is the correct baseline.
  assert(buf.subarray(0, 2).toString('latin1') === 'PK', 'DOCX must be a valid zip (PK header)');
  assert(buf.length > 1500, `DOCX must be a non-trivial document, got ${buf.length} bytes`);
  const zip = await JSZip.loadAsync(buf);
  const docXml = await zip.file('word/document.xml')!.async('string');
  assert(docXml.includes('EMERCHEMIE NB CEYLON LIMITED'), 'DOCX must contain the Emerchemie record');
  assert(docXml.includes('GETZ PHARMA'), 'DOCX must contain the Getz Pharma record');
  console.log('   ✅ Multi-Country Dynamic Schema Export verified.');

  console.log('\n✅ ALL ADVERSARIAL EVIDENCE & ASSOCIATION CORRECTNESS TESTS PASSED 100%.');
}

runAdversarialEvidenceTests().catch(err => {
  console.error('❌ Adversarial Evidence Test Failed:', err);
  process.exit(1);
});
