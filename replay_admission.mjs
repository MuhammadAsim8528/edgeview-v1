import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

// Import the actual assessEvidenceForCountry function
import { assessEvidenceForCountry, normalizeTargetCountry } from './server/research_director.ts';

async function main() {
  const DB_PATH = 'edgeview.db';
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  // Get all failed companies from job state (22 companies)
  const failedCompanies = [
    'SIXA PHARMACEUTICAL TRADING COMPANY',
    'SURAD MEDICAL SUPPLIES COMPANY', 
    'SALAMA PHARMACEUTICAL LTD',
    'SHAFICI PHARMACEUTICAL MEDICAL SUPPLIES WHOLESALER',
    'ZEE PHARMACEUTICALS LTD',
    'MOUMIN GROUP OF COMPANIES',
    'GLOBE PHARMACY LTD.',
    'Raheeg Medical Co LTD',
    'PHARMAKEN LTD',
    'M/S. GLOBE PHARMACY LIMITED.',
    'ABUUBAKAR SADIIQ PHARMACEUTICAL CO',
    'STAR PHARMACEUTICALS LTD',
    'PHARM ACTIV FZCO',
    'MOUMIN GROUP COMPANIES',
    'Astra Pharma (U) Ltd',
    'GETZ PHARMA INTERNATIONAL FZ - LLC',
    'ASTRA  PHARMA LTD',
    'GLOBE PHARMACY LIMITED,',
    'HEALTH SOLUTIONS LTD',
    'Q PHARMA DMCC',
    'CARE PHARMACY',
    'ABACUS PHARMA (A) LTD',
    'TAWAKAL PHARMACEUTICALS'
  ];

  // For each failed company, get their latest run and cached URLs
  for (const company of failedCompanies) {
    const runResult = db.exec(
      `SELECT research_id, company, country, status, iterations, evidence_count, pages_retrieved, started_at, completed_at 
       FROM research_ledger_runs 
       WHERE company=? ORDER BY started_at DESC LIMIT 1`, [company]);
    
    if (!runResult[0]?.values[0]) {
      console.log(`\n=== ${company}: NO RUN FOUND ===`);
      continue;
    }
    
    const run = Object.fromEntries(runResult[0].columns.map((c,i)=>[c,runResult[0].values[0][i]]));
    console.log(`\n=== ${company} (${run.country}) - ${run.status} - evid:${run.evidence_count} pages:${run.pages_retrieved} ===`);
    
    // Get actions for this run to see what URLs were fetched
    const actionsResult = db.exec(
      `SELECT iteration, action_type, target_type, provider, query, status, information_gain, latency_ms, error 
       FROM research_ledger_actions 
       WHERE research_id=? AND action_type='FETCH' ORDER BY iteration`, [run.research_id]);
    
    if (actionsResult[0]?.values?.length) {
      for (const action of actionsResult[0].values) {
        const act = Object.fromEntries(actionsResult[0].columns.map((c,i)=>[c,action[i]]));
        if (act.query && act.query.startsWith('http')) {
          // This is a URL that was fetched
          const url = act.query;
          const cacheResult = db.exec(`SELECT content FROM scraped_url_cache WHERE url=?`, [url]);
          if (cacheResult[0]?.values[0]?.[0]) {
            const content = cacheResult[0].values[0][0];
            console.log(`\n  URL: ${url}`);
            console.log(`  Content preview: ${content.substring(0, 200)}...`);
            
            // Replay assessEvidenceForCountry
            try {
              const assessment = assessEvidenceForCountry(
                content, 
                url, 
                company, 
                run.country || undefined,
                undefined, // no official website known yet
                { sourceType: 'web' }
              );
              
              console.log(`  ASSESSMENT:`);
              console.log(`    admissible: ${assessment.admissible}`);
              console.log(`    decision: ${assessment.decision}`);
              console.log(`    entityMatch: ${assessment.entityMatch}`);
              console.log(`    countryMatch: ${assessment.countryMatch}`);
              console.log(`    targetCountryMatch: ${assessment.targetCountryMatch}`);
              console.log(`    officialDomain: ${assessment.entityMatch === 'official-domain'}`);
              console.log(`    explicitNameMatch: ${assessment.entityMatch === 'explicit-name'}`);
              console.log(`    authoritative: ${assessment.entityMatch === 'authoritative'}`);
              console.log(`    reasons: ${assessment.reasons.slice(-2).join('; ')}`);
              
              // Classify
              let classification = 'UNKNOWN';
              if (assessment.admissible) classification = 'ADMITTABLE';
              else if (assessment.decision === 'REJECT' && assessment.reasons.some(r => r.includes('foreign') || r.includes('contradict'))) classification = 'CONTRADICTED';
              else classification = 'UNPROVEN';
              
              console.log(`    CLASSIFICATION: ${classification}`);
            } catch (e) {
              console.log(`  ASSESSMENT ERROR: ${e.message}`);
            }
          } else {
            console.log(`  URL: ${url} - NO CACHED CONTENT`);
          }
        }
      }
    }
  }
}

main().catch(console.error);