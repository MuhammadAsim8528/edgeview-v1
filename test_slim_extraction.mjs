import pkg from './dist/server.cjs';
const { enrichCompanyDetails, getCachedCompany } = pkg;

async function testSlim() {
  console.log('=== Testing Slim Pharmaceuticals Extraction ===');
  
  // First check cached data
  const cached = await getCachedCompany('SLIM PHARMACEUTICALS PVT LTD', 'Sri Lanka');
  if (cached) {
    console.log('Cached data:');
    console.log('Website:', cached.website);
    console.log('Email:', cached.email);
    console.log('Phone:', cached.phone);
    console.log('Address:', cached.address);
    console.log('Quality:', cached.quality_status);
    console.log('Emails:', cached.emails_list);
    console.log('Phones:', cached.phones_list);
    console.log('Addresses:', cached.addresses);
    console.log('People:', cached.contact_persons);
    console.log('Evidence count:', cached.evidence?.length);
  }
  
  // Force fresh extraction
  console.log('\n--- Running force fresh extraction ---');
  const result = await enrichCompanyDetails('SLIM PHARMACEUTICALS PVT LTD', true, { country: 'Sri Lanka' });
  
  console.log('\n=== Extraction Result ===');
  console.log('Website:', result.website);
  console.log('Email:', result.email);
  console.log('Phone:', result.phone);
  console.log('Address:', result.address);
  console.log('Quality:', result.quality_status);
  console.log('Emails:', result.emails_list);
  console.log('Phones:', result.phones_list);
  console.log('Addresses:', result.addresses);
  console.log('People:', result.contact_persons);
  console.log('Evidence count:', result.evidence?.length);
  console.log('Source:', result.source);
  
  if (result.evidence && result.evidence.length > 0) {
    console.log('\nEvidence sources:');
    result.evidence.forEach((e, i) => {
      console.log(`  ${i+1}. ${e.url} - ${e.field}: ${e.value}`);
    });
  }
}

testSlim().catch(console.error);