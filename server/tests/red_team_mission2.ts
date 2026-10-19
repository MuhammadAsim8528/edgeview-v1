import { getAppSettings } from '../settings';
import { enrichCompanyDetails } from '../enrichment';
import { ResearchTaskPlanner } from '../research_fabric';
import { buildCanonicalResearchRequest } from '../canonical_research';

const settings = getAppSettings();

async function testPlanner() {
  console.log('=== MISSION 2: DESTROY THE PLANNER ===\n');
  
  // Test 1: Check what queries the planner generates for known benchmark entities
  const testEntities = [
    { company: 'MEDISENSE TANZANIA LIMITED', country: 'Tanzania', knownSource: 'https://tmda.go.tz/pages/list-of-local-technical-representatives-recognized-by-tmda' },
    { company: 'UNGUJA PHARMACY LIMITED', country: 'Tanzania', knownSource: 'https://www.tmda.go.tz/uploads/1678454665-T21H0477SmPCv1.pdf' },
    { company: 'ALPHACEUTICALS LIMITADA', country: 'Angola', knownSource: 'https://www.volza.com/company-profile/alphaceuticals-limitada-64102761/' },
    { company: 'CROWN SOLUTIONS LTD.', country: 'Kenya', knownSource: 'https://cdnc.heyzine.com/files/uploaded/bcf08e47b4e023c1e7e9d5fc3f0349a9d1f9b7e4.pdf' },
    { company: 'MEDEA PHARM', country: 'Kyrgyzstan', knownSource: 'https://kg.kompass.com/c/medea-pharm-%D0%BE%D1%81%D0%BE%D0%BE/kg016653/' },
    { company: 'FEROZSONS LABORATRIES LIMITED', country: 'Sri Lanka', knownSource: 'https://ferozsons-labs.com/global-presence' },
  ];
  
  console.log('=== TESTING RESEARCH TASK PLANNER ===\n');
  
  for (const entity of testEntities) {
    console.log(`\n--- ${entity.company} (${entity.country}) ---`);
    console.log(`Known source: ${entity.knownSource}`);
    
    const tasks = ResearchTaskPlanner.plan(entity.company, { 
      country: entity.country, 
      role: 'Importer' 
    }, { 
      serper_enabled: true, 
      serper_api_key: 'test',
      tavily_enabled: true,
      tavily_api_key: 'test',
      exa_enabled: true,
      exa_api_key: 'test',
      linkup_enabled: true,
      linkup_api_key: 'test',
      hunter_enabled: true,
      hunter_api_key: 'test',
      firecrawl_enabled: true,
      firecrawl_api_key: 'test',
      nvidia_enabled: true,
      nvidia_api_key: 'test',
      groq_enabled: true,
      groq_api_key: 'test',
      gemini_enabled: true,
      primary_ai_provider: 'NVIDIA',
      nvidia_model: 'test',
      groq_model: 'test',
      gemini_model: 'test',
      apify_enabled: true,
      apify_api_key: 'test',
      nvidia_base_url: 'https://integrate.api.nvidia.com/v1',
    } as any, []);
    
    console.log('Planned tasks:');
    tasks.forEach((t, i) => {
      console.log(`  ${i+1}. [${t.targetType}] ${t.query}`);
      console.log(`     Provider: ${t.providerId}, Reason: ${t.reason}`);
    });
    
    // Check if government/registry queries are generated
    const hasGovQuery = tasks.some(t => 
      t.query.toLowerCase().includes('government') || 
      t.query.toLowerCase().includes('registry') ||
      t.query.toLowerCase().includes('tmda') ||
      t.query.toLowerCase().includes('official') ||
      t.query.toLowerCase().includes('pdf')
    );
    console.log(`  Has government/registry query: ${hasGovQuery ? 'YES' : 'NO'}`);
    
    // Check if procurement/trade queries are generated
    const hasProcurementQuery = tasks.some(t => 
      t.query.toLowerCase().includes('procurement') || 
      t.query.toLowerCase().includes('import') ||
      t.query.toLowerCase().includes('export') ||
      t.query.toLowerCase().includes('supply') ||
      t.query.toLowerCase().includes('trade')
    );
    console.log(`  Has procurement/trade query: ${hasProcurementQuery ? 'YES' : 'NO'}`);
  }
  
  // Test 2: Check what queries are generated in escalateAndPlanQueries
  console.log('\n\n=== TESTING ESCALATION QUERIES ===\n');
  
  // Simulate a state with missing fields
  const mockState = {
    name: 'MEDISENSE TANZANIA LIMITED',
    status: 'pending',
    stage: 'Stage 5 - Escalating',
    escalationStage: 5,
    plannedQueries: [],
    evidenceCorpus: [],
    extractedDetails: { email: '', phone: '', address: '' },
    hasEmail: false,
    hasPhone: false,
    hasLeadership: false,
    hasAddress: false,
    currentWebsite: '',
    objectives: {
      'EMAIL': { status: 'UNKNOWN' },
      'PHONE': { status: 'UNKNOWN' },
      'LEADERSHIP': { status: 'UNKNOWN' },
      'ADDRESS': { status: 'UNKNOWN' },
      'OFFICIAL_WEBSITE': { status: 'UNKNOWN' },
    }
  };
  
  // We can't easily call the private method, but let's check the escalation logic
  console.log('Escalation queries that would be generated:');
  console.log('  Stage 2/3: "MEDISENSE TANZANIA LIMITED Tanzania contact homepage email phone" (official_website)');
  console.log('  Stage 7/9: "MEDISENSE TANZANIA LIMITED corporate email contact address @medisense-tanzania-limited.com" (email)');
  console.log('  Stage 5/7: "MEDISENSE TANZANIA LIMITED owner director CEO linkedin" (leadership)');
  
  // Test 3: Check KnowledgeGapPlanner prompt
  console.log('\n\n=== KNOWLEDGE GAP PLANNER PROMPT ANALYSIS ===');
  console.log('The KnowledgeGapPlanner sends this context to the model:');
  console.log('  - known_information (website, country, role, address, products, traded_with, existing_contacts)');
  console.log('  - missing_information');
  console.log('  - evidence collected so far');
  console.log('  - queries_attempted');
  console.log('  - iteration, coverage');
  console.log('\nThe model is asked to propose search_web, scrape_page, discover_internal_links actions');
  console.log('Target types: website, contact_page, leadership, social_profiles, registry, directory, email, company');
  console.log('\nBLIND SPOTS:');
  console.log('  - No explicit "government", "registry", "pdf", "document" target types');
  console.log('  - No "procurement", "import", "export", "supply_chain", "trade" target types');
  console.log('  - Model must infer these from the objective text');
  console.log('  - No explicit DTF/witness target types');
}

testPlanner().catch(console.error);