import { enrichCompanyDetails } from './server/enrichment.ts';
import { getCachedCompany } from './server/enrichment.ts';

async function testSlim() {
  console.log('=== Testing Slim Pharmaceuticals Extraction (with timeout) ===');
  
  // First check cached data
  const cached = await getCachedCompany('SLIM PHARMACEUTICALS PVT LTD', 'Sri Lanka');
  if (cached) {
    console.log('Cached data:');
    console.log('Website:', cached.website);
    console.log('Quality:', cached.quality_status);
    console.log('Emails:', cached.emails_list);
    console.log('Phones:', cached.phones_list);
    console.log('Addresses:', cached.addresses);
    console.log('People:', cached.contact_persons);
  }
  
  // Force fresh extraction with shorter timeout
  console.log('\n--- Running force fresh extraction (30s timeout) ---');
  const startTime = Date.now();
  try {
    const result = await Promise.race([
      enrichCompanyDetails('SLIM PHARMACEUTICALS PVT LTD', true, { country: 'Sri Lanka' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT after 60s')), 60000))
    ]);
    
    console.log('\n=== Extraction Result ===');
    console.log('Time:', Date.now() - startTime, 'ms');
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
  } catch (e) {
    console.log('Error:', e.message);
    console.log('Time:', Date.now() - startTime, 'ms');
  }
}

testSlim().catch(console.error);