// Set environment variables BEFORE importing modules
process.env.NVIDIA_ENABLED = 'false';
process.env.FIRECRAWL_ENABLED = 'false';
process.env.GROQ_ENABLED = 'true';

import { enrichCompanyDetails } from '../enrichment';
import { getAppSettings } from '../settings';

async function testSingleEnrichment() {
  const settings = getAppSettings();
  console.log('Settings loaded:', {
    nvidia_enabled: settings.nvidia_enabled,
    firecrawl_enabled: settings.firecrawl_enabled,
    groq_enabled: settings.groq_enabled,
    primary_ai_provider: settings.primary_ai_provider
  });
  
  console.log('Testing enrichment for SLIM PHARMACEUTICALS PVT LTD...');
  
  const extraContext = {
    country: 'Sri Lanka',
    role: 'Importer' as const,
    deep_recovery: true,
  };
  
  try {
    const result = await enrichCompanyDetails('SLIM PHARMACEUTICALS PVT LTD', true, extraContext);
    console.log('Result:', JSON.stringify(result, null, 2).substring(0, 3000));
  } catch (err) {
    console.error('Error:', err);
  }
}

testSingleEnrichment().catch(console.error);