import initSqlJs from 'sql.js';
import fs from 'fs';
import { URL } from 'url';

// ---- Copy of production functions ----
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

// focusEvidenceForTargetCountry (simplified from page_content.ts)
function focusEvidenceForTargetCountry(content, country, url) {
  const text = String(content || '').trim();
  const target = String(country || '').trim();
  if (!text || !target) return text;
  const path = String(url || '').toLowerCase();
  if (!/(?:worldwide|\/locations\/?(?:[?#].*)?$)/i.test(path)) return text;
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = new RegExp(`^#{1,3}\\s+${escaped}\\s*$`, 'i');
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(line => heading.test(line.trim()));
  if (start < 0) {
    const word = new RegExp(`\\b${escaped}\\b`, 'i');
    const slug = target.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const matchingBlocks = text.split(/\n\s*\n/).map(b=>b.trim()).filter(b=>b.length>0 && b.length<=2000).filter(b=>word.test(b) || (slug && b.toLowerCase().includes(`/locations/${slug}`)));
    return matchingBlocks.length>0 ? `[EdgeView target-country blocks retained from multi-country directory: ${target}]\n${matchingBlocks.join('\n\n')}` : text;
  }
  let end = lines.length;
  for (let i=start+1;i<lines.length;i++) if (/^#{1,3}\s+\S/.test(lines[i].trim())) { end=i; break; }
  const section = lines.slice(start,end).join('\n').trim();
  return section ? `[EdgeView target-country section retained from multi-country directory: ${target}]\n${section}` : text;
}

// focusEvidenceForCompany
function focusEvidenceForCompany(content, companyName, radius = 1200) {
  const tokens = String(companyName || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(t=>t.length>2 && !['pvt','ltd','limited','inc','corp','gmbh','company'].includes(t));
  if (!content || tokens.length===0) return content;
  const pattern = new RegExp(tokens.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[\\s\\S]{0,60}'), 'ig');
  const ranges=[]; let match;
  while ((match=pattern.exec(content)) && ranges.length<8) {
    ranges.push([Math.max(0,match.index-radius), Math.min(content.length, match.index+match[0].length+radius)]);
  }
  if (ranges.length===0) return content;
  return ranges.map(([s,e])=>content.slice(s,e)).join('\n\n[ENTITY CONTEXT WINDOW]\n\n');
}

// Classification helper
function classify(assessment) {
  if (assessment.admissible) return 'ADMIT';
  if (assessment.decision==='REJECT' && assessment.reasons.some(r=>r.includes('foreign'))) return 'CONTRADICTED';
  return 'UNPROVEN';
}

// Lost signal detection
function lostSignal(rawAssess, trimmedAssess) {
  const lost=[];
  if (rawAssess.entityMatch==='explicit-name' && trimmedAssess.entityMatch!=='explicit-name') lost.push('FULL_ORDERED_NAME');
  if (rawAssess.targetCountryMatch && !trimmedAssess.targetCountryMatch) lost.push('COUNTRY');
  // domain, relationship, registry not directly tracked here
  return lost.length?lost:['OTHER'];
}

async function main() {
  const DB_PATH = 'edgeview.db';
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  // Failed companies from job state (23)
  const failedCompanies = [
    'SIXA PHARMACEUTICAL TRADING COMPANY','SURAD MEDICAL SUPPLIES COMPANY','SALAMA PHARMACEUTICAL LTD',
    'SHAFICI PHARMACEUTICAL MEDICAL SUPPLIES WHOLESALER','ZEE PHARMACEUTICALS LTD','MOUMIN GROUP OF COMPANIES',
    'GLOBE PHARMACY LTD.','Raheeg Medical Co LTD','PHARMAKEN LTD','M/S. GLOBE PHARMACY LIMITED.',
    'ABUUBAKAR SADIIQ PHARMACEUTICAL CO','STAR PHARMACEUTICALS LTD','PHARM ACTIV FZCO',
    'MOUMIN GROUP COMPANIES','Astra Pharma (U) Ltd','GETZ PHARMA INTERNATIONAL FZ - LLC',
    'ASTRA  PHARMA LTD','GLOBE PHARMACY LIMITED,','HEALTH SOLUTIONS LTD','Q PHARMA DMCC',
    'CARE PHARMACY','ABACUS PHARMA (A) LTD','TAWAKAL PHARMACEUTICALS'
  ];

  // Get latest run per failed company
  const runMap={};
  for (const company of failedCompanies) {
    const r=db.exec(`SELECT research_id, country FROM research_ledger_runs WHERE company=? ORDER BY started_at DESC LIMIT 1`,[company]);
    if (r[0]?.values[0]) runMap[company]= {research_id:r[0].values[0][0], country:r[0].values[0][1]};
  }

  // Collect cached URLs for each company (using simple name token match)
  const urlMap={};
  for (const company of failedCompanies) {
    const token = company.toLowerCase().split(' ')[0];
    const urls=db.exec(`SELECT url, content FROM scraped_url_cache WHERE url LIKE ?`,[`%${token}%`]);
    if (urls[0]?.values?.length) urlMap[company]=urls[0].values;
  }

  // ---- RAW vs TRIMMED matrix ----
  const matrix={ADMIT:{ADMIT:0,UNPROVEN:0,CONTRADICTED:0},UNPROVEN:{ADMIT:0,UNPROVEN:0,CONTRADICTED:0},CONTRADICTED:{ADMIT:0,UNPROVEN:0,CONTRADICTED:0}};
  const transitions=[];
  let rawAdmitCount=0, rawAdmitToUnproven=0, rawAdmitToContradicted=0;
  for (const company of failedCompanies) {
    const run=runMap[company]; if(!run) continue;
    const urls=urlMap[company]||[];
    for (const [url, content] of urls) {
      const rawAssess=assessEvidenceForCountry(content,url,company,run.country,undefined,{sourceType:'web'});
      const trimmedContent=focusEvidenceForTargetCountry(content,run.country,url);
      const trimmedAssess=assessEvidenceForCountry(trimmedContent,url,company,run.country,undefined,{sourceType:'web'});
      const rawCls=classify(rawAssess);
      const trimmedCls=classify(trimmedAssess);
      matrix[rawCls][trimmedCls]++;
      if (rawCls==='ADMIT') {
        rawAdmitCount++;
        if (trimmedCls==='UNPROVEN') { rawAdmitToUnproven++; transitions.push({company,url,type:'TYPE1',lost:lostSignal(rawAssess,trimmedAssess)}); }
        else if (trimmedCls==='CONTRADICTED') { rawAdmitToContradicted++; transitions.push({company,url,type:'TYPE1C',lost:lostSignal(rawAssess,trimmedAssess)}); }
      } else if (rawCls==='UNPROVEN' && trimmedCls==='UNPROVEN') {
        // TYPE2 or 3 or 4 - need check if raw had explicit name
        if (rawAssess.entityMatch==='explicit-name') transitions.push({company,url,type:'TYPE3',lost:['ORDERED_NAME_NOT_IN_RAW']});
        else transitions.push({company,url,type:'TYPE4'});
      }
    }
  }

  console.log('=== RAW->TRIMMED MATRIX ===');
  console.log(matrix);
  console.log(`Raw ADMIT total: ${rawAdmitCount}`);
  console.log(`Raw ADMIT -> TRIMMED UNPROVEN: ${rawAdmitToUnproven}`);
  console.log(`Raw ADMIT -> TRIMMED CONTRADICTED: ${rawAdmitToContradicted}`);

  // TYPE counts
  const typeCounts={TYPE1:0,TYPE1C:0,TYPE2:0,TYPE3:0,TYPE4:0};
  for (const t of transitions) typeCounts[t.type]++;
  console.log('TYPE counts:',typeCounts);

  // ---- Source authority breakdown of 118 raw ADMITTABLE ----
  // Need to classify hosts of raw ADMITTABLE URLs
  const hostClass={};
  for (const company of failedCompanies) {
    const urls=urlMap[company]||[];
    for (const [url, content] of urls) {
      const rawAssess=assessEvidenceForCountry(content,url,company,runMap[company]?.country||'',undefined,{sourceType:'web'});
      if (!rawAssess.admissible) continue;
      const host=new URL(url).hostname.replace(/^www\./,'');
      // simple heuristic classification
      let cat='OTHER';
      if (/(tendata|tradeatlas|volza|tradedata|eximpedia|seair|rocketreach|zoominfo|importgenius|marketinsidedata|panjiva|importgenius)/i.test(host)) cat='DIRECTORY';
      else if (/(gov|registry|regulation)/i.test(host)) cat='GOVERNMENT';
      else if (/\.com$/i.test(host) && (content.toLowerCase().includes(company.toLowerCase().replace(/[^a-z0-9]+/g,'')))) cat='PLAUSIBLE_OFFICIAL';
      hostClass[cat]=(hostClass[cat]||0)+1;
    }
  }
  console.log('Source authority breakdown of raw ADMITTABLE:',hostClass);

  // ---- Zero-gain trace for three companies ----
  const traceCompanies=['SIXA PHARMACEUTICAL TRADING COMPANY','SALAMA PHARMACEUTICAL LTD','MOUMIN GROUP OF COMPANIES'];
  for (const company of traceCompanies) {
    const run=runMap[company]; if(!run) continue;
    const actions=db.exec(`SELECT iteration, action_type, target_type, provider, query, status, information_gain FROM research_ledger_actions WHERE research_id=? ORDER BY iteration`,[run.research_id]);
    console.log(`\n=== Zero-gain trace ${company} ===`);
    if (actions[0]) actions[0].values.forEach(a=>console.log(JSON.stringify(Object.fromEntries(actions[0].columns.map((c,i)=>[c,a[i]])))));
  }

  // ---- Failed companies pipeline stage ----
  const stageCounts={PRE_PERSISTENCE:0,PERSISTENCE:0,POST_PERSISTENCE:0,UNKNOWN:0};
  for (const company of failedCompanies) {
    const run=runMap[company]; if(!run) continue;
    const actions=db.exec(`SELECT action_type FROM research_ledger_actions WHERE research_id=?`,[run.research_id]);
    const hasFinalize=actions[0]?.values?.some(v=>v[0]==='FINALIZE');
    const hasExtract=actions[0]?.values?.some(v=>v[0]==='EXTRACT_INFORMATION');
    const hasAdmit=actions[0]?.values?.some(v=>v[0]==='EXECUTE_QUERY' && v[2]==='official_website');
    if (hasFinalize) stageCounts.POST_PERSISTENCE++;
    else if (hasExtract) stageCounts.PERSISTENCE++;
    else if (hasAdmit) stageCounts.PRE_PERSISTENCE++;
    else stageCounts.UNKNOWN++;
  }
  console.log('Failed pipeline stage counts:',stageCounts);

  // ---- Duplicate entity detection in contact_cache ----
  const cacheRows=db.exec(`SELECT company_name, country, website, email, phone, address FROM contact_cache`);
  const norm=(s)=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'').trim();
  const pairs=[];
  if (cacheRows[0]) {
    const rows=cacheRows[0].values.map(v=>Object.fromEntries(cacheRows[0].columns.map((c,i)=>[c,v[i]])));
    for (let i=0;i<rows.length;i++) for (let j=i+1;j<rows.length;j++) {
      const a=rows[i], b=rows[j];
      if (norm(a.company_name)===norm(b.company_name) && (a.country||'')===(b.country||'')) {
        pairs.push({a: a.company_name, b: b.company_name, country:a.country});
      }
    }
  }
  console.log('Duplicate canonical name+country pairs:',pairs.length);
  pairs.slice(0,20).forEach(p=>console.log(p));

  // ---- Memory / network amplification ----
  const completed=31; const total=203; const pollSec=1.5;
  const avgPerCompanyKb=50; // approx 30-70 KiB
  const currentPayloadKb=1900; // 1.9 MiB
  const projectedPayloadKb=avgPerCompanyKb*total/1024; // MiB
  const bytesPerMinNow=currentPayloadKb*1024*60/pollSec;
  const bytesPerMinProj=projectedPayloadKb*1024*60/pollSec;
  console.log(`Memory: current poll ${currentPayloadKb}KB, projected ${projectedPayloadKb.toFixed(1)}MiB`);
  console.log(`Network per min now: ${(bytesPerMinNow/1e6).toFixed(1)} MB/min`);
  console.log(`Network per min at 203: ${(bytesPerMinProj/1e6).toFixed(1)} MB/min`);

  // ---- Job state counters invariant ----
  console.log('Job counters: total=203 completed=31 failed=22 pending=171 (pending+completed+failed=224>203) -> failed counted in completed?');

  // ---- NIVIDA logical vs physical ----
  // From telemetry: SURAD nvidia requests=7 failures=8 -> suggests retries counted as failures.
  console.log('NVIDIA accounting: logical requests vs physical attempts (retries) - need ResourceGovernor code');

  // ---- Successful vs failed bootstrap sample ----
  // Pick 5 successful recent completed runs
  const successRuns=db.exec(`SELECT research_id, company, country FROM research_ledger_runs WHERE status='COMPLETED' AND company NOT IN (${failedCompanies.map(()=>'?').join(',')}) ORDER BY started_at DESC LIMIT 5`, failedCompanies);
  console.log('Sample successful runs:', successRuns[0]?.values?.map(v=>Object.fromEntries(successRuns[0].columns.map((c,i)=>[c,v[i]])))||[]);

  // Save matrix and transitions to file for review
  fs.writeFileSync('matrix_report.json', JSON.stringify({matrix, typeCounts, hostClass, stageCounts, transitions: transitions.slice(0,20)}, null, 2));
  console.log('\nReport written to matrix_report.json');
}
main().catch(console.error);