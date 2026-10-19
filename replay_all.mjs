import initSqlJs from 'sql.js';
import fs from 'fs';

// Copy of assessEvidenceForCountry (same as before)
const COUNTRY_TARGET_ALIASES = {
  'kenya': ['kenya', 'kenyan', 'nairobi', 'mombasa'],
  'somalia': ['somalia', 'somali', 'mogadishu'],
  'sudan': ['sudan', 'sudanese', 'khartoum'],
  'ghana': ['ghana', 'ghanaian', 'accra'],
  'nigeria': ['nigeria', 'nigerian', 'lagos', 'abuja'],
  'uganda': ['uganda', 'ugandan', 'kampala'],
  'tanzania': ['tanzania', 'tanzanian', 'dar es salaam'],
  'pakistan': ['pakistan', 'pakistani', 'karachi', 'lahore', 'islamabad'],
  'united arab emirates': ['united arab emirates', 'uae', 'emirates', 'dubai', 'abu dhabi'],
  'hong kong': ['hong kong', 'hongkong'],
  'vietnam': ['vietnam', 'vietnamese', 'hanoi', 'ho chi minh city'],
  'sri lanka': ['sri lanka', 'sri lankan', 'colombo'],
  'barbados': ['barbados'],
  'uzbekistan': ['uzbekistan', 'uzbek'],
  'philippines': ['philippines', 'filipino', 'manila'],
  'kyrgyzstan': ['kyrgyzstan', 'kyrgyz'],
  'mauritius': ['mauritius', 'mauritian'],
  'china': ['china', 'chinese', 'beijing', 'shanghai'],
};

function normalizeTargetCountry(country) { return country ? String(country).toLowerCase().trim() : ''; }
function detectCountryMentions(text) {
  if (!text) return [];
  const normalized = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  const found = [];
  for (const [country, aliases] of Object.entries(COUNTRY_TARGET_ALIASES)) {
    for (const alias of aliases) {
      if (normalized.includes(` ${alias.toLowerCase()} `)) { found.push(country); break; }
    }
  }
  return found;
}

function calculateCompanyAssociationScore(content, url, companyName, country, officialWebsite) {
  const reasons = [];
  let score = 0;
  if (!content || !companyName) return { score: 0, reasons: ['No content or company name'] };
  
  const normalizedContent = content.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const normalizedCompany = companyName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const companyTokens = normalizedCompany.split(/\s+/).filter(t => t.length > 2 && !['pvt','ltd','limited','inc','corp','gmbh','company','pharma','pharmaceutical','pharmaceuticals'].includes(t));
  
  if (normalizedContent.includes(normalizedCompany)) { score += 30; reasons.push('Full company name found'); }
  else if (companyTokens.length === 1 && normalizedContent.includes(companyTokens[0])) { score += 15; reasons.push('Single token found'); }
  else if (companyTokens.length > 1) {
    const orderedPattern = companyTokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\S]{0,60}');
    if (new RegExp(orderedPattern, 'i').test(content)) { score += 25; reasons.push('Ordered tokens found'); }
    else {
      let tokenHits = 0; for (const token of companyTokens) if (normalizedContent.includes(token)) tokenHits++;
      if (tokenHits >= Math.ceil(companyTokens.length * 0.6)) { score += 10; reasons.push(`${tokenHits}/${companyTokens.length} tokens`); }
    }
  }
  
  if (country) {
    const targetCountry = normalizeTargetCountry(country);
    if (detectCountryMentions(content).includes(targetCountry)) { score += 20; reasons.push(`Target country "${targetCountry}" mentioned`); }
  }
  
  const contactSignals = ['email', 'phone', 'address', 'contact', 'tel:', 'mailto:', '@'];
  if (contactSignals.filter(s => normalizedContent.includes(s)).length >= 2) { score += 15; reasons.push('Contact signals'); }
  
  const businessSignals = ['pharma', 'pharmaceutical', 'medical', 'healthcare', 'distributor', 'importer', 'exporter', 'trading', 'supply', 'medicine', 'drug'];
  if (businessSignals.filter(s => normalizedContent.includes(s)).length >= 2) { score += 10; reasons.push('Business signals'); }
  
  return { score, reasons };
}

function assessEvidenceForCountry(content, url, companyName, country, officialWebsite, options = {}) {
  const { sourceType = 'web', relationshipEstablished = false } = options;
  const association = calculateCompanyAssociationScore(content, url, companyName, country, officialWebsite);
  const targetCountry = normalizeTargetCountry(country || '');
  const mentioned = detectCountryMentions(content);

  let foreign = targetCountry ? mentioned.filter(m => m !== targetCountry) : [];
  const companyLower = (companyName || '').toLowerCase();
  foreign = foreign.filter(m => { const tokens = COUNTRY_TARGET_ALIASES[m] || [m]; return !tokens.some(t => t.length >= 2 && companyLower.includes(t)); });

  const targetCountryMatch = Boolean(targetCountry) && mentioned.includes(targetCountry);
  const geographyCompatible = !(targetCountry && foreign.length > 0 && !targetCountryMatch);

  let officialDomain = false;
  if (officialWebsite) {
    try { const oh = new URL(officialWebsite).hostname.toLowerCase().replace(/^www\./, ''); const ph = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); officialDomain = ph === oh || ph.endsWith(`.${oh}`); } catch (_) {}
  }

  const normalizedCompany = companyName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const companyTokens = normalizedCompany.split(/\s+/).filter(t => t.length > 2 && !['pvt','ltd','limited','inc','corp','gmbh','company','pharma','pharmaceutical','pharmaceuticals'].includes(t));
  const normalizedHaystack = `${url} ${content}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const orderedTokenPattern = companyTokens.length > 1 ? new RegExp(companyTokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(?:\\s|[^a-z0-9]){0,60}')) : null;
  const explicitNameMatch = Boolean(normalizedCompany && normalizedHaystack.includes(normalizedCompany)) || (companyTokens.length === 1 && normalizedHaystack.includes(companyTokens[0])) || Boolean(orderedTokenPattern?.test(normalizedHaystack));
  const authoritative = sourceType === 'authoritative_registry' && explicitNameMatch;
  const establishedRelationship = sourceType === 'official_relationship' && relationshipEstablished === true && explicitNameMatch;
  const entityEstablished = officialDomain || explicitNameMatch || authoritative || establishedRelationship;

  let decision = 'ADMIT';
  const reasons = [...association.reasons];
  if (!entityEstablished) { decision = sourceType === 'candidate_official' ? 'HOLD' : 'REJECT'; reasons.push(sourceType === 'candidate_official' ? 'Held: candidate website does not establish target company' : 'Rejected: target-company association not established'); }
  else if (!geographyCompatible) { decision = 'REJECT'; reasons.push('Rejected: foreign branch without target-country context'); }
  else if (authoritative) { reasons.push('Admitted: authoritative registry with exact match'); }
  else if (establishedRelationship) { reasons.push('Admitted: official relationship established'); }

  const entityMatch = officialDomain ? 'official-domain' : authoritative || establishedRelationship ? 'authoritative' : explicitNameMatch ? 'explicit-name' : 'unestablished';
  const countryMatch = !geographyCompatible ? 'foreign' : targetCountryMatch ? 'target' : 'global';

  return { admissible: decision === 'ADMIT', decision, associationScore: association.score, isAssociated: entityEstablished, entityMatch, countryMatch, targetCountryMatch, foreignCountryMentions: foreign, reasons };
}

async function main() {
  const DB_PATH = 'edgeview.db';
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  const failedCompanies = [
    'SIXA PHARMACEUTICAL TRADING COMPANY', 'SURAD MEDICAL SUPPLIES COMPANY', 'SALAMA PHARMACEUTICAL LTD',
    'SHAFICI PHARMACEUTICAL MEDICAL SUPPLIES WHOLESALER', 'ZEE PHARMACEUTICALS LTD', 'MOUMIN GROUP OF COMPANIES',
    'GLOBE PHARMACY LTD.', 'Raheeg Medical Co LTD', 'PHARMAKEN LTD', 'M/S. GLOBE PHARMACY LIMITED.',
    'ABUUBAKAR SADIIQ PHARMACEUTICAL CO', 'STAR PHARMACEUTICALS LTD', 'PHARM ACTIV FZCO',
    'MOUMIN GROUP COMPANIES', 'Astra Pharma (U) Ltd', 'GETZ PHARMA INTERNATIONAL FZ - LLC',
    'ASTRA  PHARMA LTD', 'GLOBE PHARMACY LIMITED,', 'HEALTH SOLUTIONS LTD', 'Q PHARMA DMCC',
    'CARE PHARMACY', 'ABACUS PHARMA (A) LTD', 'TAWAKAL PHARMACEUTICALS'
  ];

  const summary = { ADMITTABLE: 0, UNPROVEN: 0, CONTRADICTED: 0, TOTAL_URLS: 0 };
  const details = [];

  for (const company of failedCompanies) {
    const runResult = db.exec(`SELECT research_id, company, country FROM research_ledger_runs WHERE company=? ORDER BY started_at DESC LIMIT 1`, [company]);
    if (!runResult[0]?.values[0]) continue;
    const run = Object.fromEntries(runResult[0].columns.map((c,i)=>[c,runResult[0].values[0][i]]));
    
    // Get all cached URLs that might be related to this company
    const cachedUrls = db.exec(`SELECT url, content FROM scraped_url_cache WHERE url LIKE ? OR url LIKE ? OR url LIKE ?`, 
      [`%${company.toLowerCase().split(' ')[0]}%`, `%${company.toLowerCase().replace(/\s+/g, '')}%`, `%${company.toLowerCase().replace(/\s+/g, '-')}%`]);
    
    if (!cachedUrls[0]?.values?.length) continue;
    
    console.log(`\n=== ${company} (${run.country}) ===`);
    
    for (const [url, content] of cachedUrls[0].values) {
      summary.TOTAL_URLS++;
      const assessment = assessEvidenceForCountry(content, url, company, run.country, undefined, { sourceType: 'web' });
      
      let classification = 'UNKNOWN';
      if (assessment.admissible) classification = 'ADMITTABLE';
      else if (assessment.decision === 'REJECT' && assessment.reasons.some(r => r.includes('foreign'))) classification = 'CONTRADICTED';
      else classification = 'UNPROVEN';
      summary[classification]++;
      
      const host = new URL(url).hostname.replace(/^www\./, '');
      console.log(`  ${host}: ${classification} | score:${assessment.associationScore} | entityMatch:${assessment.entityMatch} | countryMatch:${assessment.countryMatch} | targetCountry:${assessment.targetCountryMatch} | foreign:${assessment.foreignCountryMentions.join(',')||'none'}`);
      console.log(`    reasons: ${assessment.reasons.slice(-2).join('; ')}`);
      
      details.push({ company, country: run.country, url, host, classification, ...assessment });
    }
  }
  
  console.log('\n=== FINAL SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  
  // Show ADMITTABLE candidates (should be 0 currently)
  const admittable = details.filter(d => d.classification === 'ADMITTABLE');
  if (admittable.length) {
    console.log('\n=== ADMITTABLE CANDIDATES ===');
    admittable.forEach(d => console.log(`${d.company} | ${d.host} | ${d.url}`));
  }
  
  // Show top UNPROVEN by score
  const unproven = details.filter(d => d.classification === 'UNPROVEN').sort((a,b) => b.associationScore - a.associationScore);
  console.log('\n=== TOP UNPROVEN CANDIDATES (by score) ===');
  unproven.slice(0, 20).forEach(d => console.log(`${d.company} | ${d.host} | score:${d.associationScore} | entityMatch:${d.entityMatch} | countryMatch:${d.countryMatch} | foreign:${d.foreignCountryMentions.join(',')||'none'}`));
}

main().catch(console.error);