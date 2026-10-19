// Standalone copy of assessEvidenceForCountry and dependencies

const COUNTRY_TARGET_ALIASES = {
  'afghanistan': ['afghanistan', 'afghan'],
  'albania': ['albania', 'albanian'],
  'angola': ['angola', 'angolan'],
  'australia': ['australia', 'australian'],
  'azerbaijan': ['azerbaijan', 'azerbaijani'],
  'bahamas': ['bahamas', 'bahamian'],
  'bangladesh': ['bangladesh', 'bangladeshi', 'dhaka'],
  'barbados': ['barbados'],
  'belgium': ['belgium', 'belgian'],
  'belize': ['belize'],
  'benin': ['benin'],
  'botswana': ['botswana'],
  'brunei darussalam': ['brunei'],
  'bulgaria': ['bulgaria', 'bulgarian'],
  'burkina faso': ['burkina faso', 'burkinabe'],
  'burundi': ['burundi'],
  'cabo verde': ['cabo verde', 'cape verde'],
  'cambodia': ['cambodia', 'cambodian'],
  'cameroon': ['cameroon', 'cameroonian'],
  'canada': ['canada', 'canadian'],
  'central african republic': ['central african republic'],
  'chad': ['chad', 'chadian'],
  'chile': ['chile', 'chilean'],
  'china': ['china', 'chinese', 'beijing', 'shanghai'],
  'colombia': ['colombia', 'colombian'],
  'comoros': ['comoros'],
  'congo': ['congo', 'congolese'],
  'costa rica': ['costa rica', 'costa rican'],
  'croatia': ['croatia', 'croatian'],
  'cuba': ['cuba', 'cuban'],
  'cyprus': ['cyprus', 'cypriot'],
  'czech republic': ['czech republic', 'czech', 'czechoslovakia'],
  'denmark': ['denmark', 'danish'],
  'djibouti': ['djibouti'],
  'dominica': ['dominica'],
  'dominican republic': ['dominican republic', 'dominican'],
  'ecuador': ['ecuador', 'ecuadorian'],
  'egypt': ['egypt', 'egyptian', 'cairo'],
  'el salvador': ['el salvador', 'salvadoran'],
  'equatorial guinea': ['equatorial guinea'],
  'eritrea': ['eritrea', 'eritrean'],
  'estonia': ['estonia', 'estonian'],
  'eswatini': ['eswatini', 'swaziland'],
  'ethiopia': ['ethiopia', 'ethiopian', 'addis ababa'],
  'fiji': ['fiji', 'fijian'],
  'finland': ['finland', 'finnish'],
  'france': ['france', 'french', 'paris'],
  'gabon': ['gabon', 'gabonese'],
  'gambia': ['gambia', 'gambian'],
  'georgia': ['georgia', 'georgian'],
  'germany': ['germany', 'german', 'berlin'],
  'ghana': ['ghana', 'ghanaian', 'accra'],
  'greece': ['greece', 'greek'],
  'grenada': ['grenada', 'grenadian'],
  'guatemala': ['guatemala', 'guatemalan'],
  'guinea': ['guinea', 'guinean'],
  'guinea-bissau': ['guinea-bissau', 'guinea bissau'],
  'guyana': ['guyana', 'guyanese'],
  'haiti': ['haiti', 'haitian'],
  'honduras': ['honduras', 'honduran'],
  'hong kong': ['hong kong', 'hongkong'],
  'hungary': ['hungary', 'hungarian'],
  'iceland': ['iceland', 'icelandic'],
  'india': ['india', 'indian', 'mumbai', 'delhi', 'bangalore'],
  'indonesia': ['indonesia', 'indonesian', 'jakarta'],
  'iran': ['iran', 'iranian', 'tehran'],
  'iraq': ['iraq', 'iraqi', 'baghdad'],
  'ireland': ['ireland', 'irish', 'dublin'],
  'israel': ['israel', 'israeli', 'tel aviv'],
  'italy': ['italy', 'italian', 'rome', 'milan'],
  'jamaica': ['jamaica', 'jamaican'],
  'japan': ['japan', 'japanese', 'tokyo'],
  'jordan': ['jordan', 'jordanian'],
  'kazakhstan': ['kazakhstan', 'kazakh'],
  'kenya': ['kenya', 'kenyan', 'nairobi', 'mombasa'],
  'kiribati': ['kiribati'],
  'korea': ['korea', 'korean', 'seoul'],
  'kuwait': ['kuwait', 'kuwaiti'],
  'kyrgyzstan': ['kyrgyzstan', 'kyrgyz'],
  'laos': ['laos', 'laotian'],
  'latvia': ['latvia', 'latvian'],
  'lebanon': ['lebanon', 'lebanese', 'beirut'],
  'lesotho': ['lesotho', 'basotho'],
  'liberia': ['liberia', 'liberian'],
  'libya': ['libya', 'libyan'],
  'liechtenstein': ['liechtenstein'],
  'lithuania': ['lithuania', 'lithuanian'],
  'luxembourg': ['luxembourg', 'luxembourger'],
  'madagascar': ['madagascar', 'malagasy'],
  'malawi': ['malawi', 'malawian'],
  'malaysia': ['malaysia', 'malaysian', 'kuala lumpur'],
  'maldives': ['maldives'],
  'mali': ['mali', 'malian'],
  'malta': ['malta', 'maltese'],
  'marshall islands': ['marshall islands'],
  'mauritania': ['mauritania', 'mauritanian'],
  'mauritius': ['mauritius', 'mauritian'],
  'mexico': ['mexico', 'mexican'],
  'micronesia': ['micronesia'],
  'moldova': ['moldova', 'moldovan'],
  'monaco': ['monaco', 'monacan'],
  'mongolia': ['mongolia', 'mongolian'],
  'montenegro': ['montenegro', 'montenegrin'],
  'morocco': ['morocco', 'moroccan'],
  'mozambique': ['mozambique', 'mozambican'],
  'myanmar': ['myanmar', 'burma', 'burmese'],
  'namibia': ['namibia', 'namibian'],
  'nauru': ['nauru'],
  'nepal': ['nepal', 'nepalese', 'kathmandu'],
  'netherlands': ['netherlands', 'dutch', 'amsterdam'],
  'new zealand': ['new zealand', 'new zealander', 'auckland'],
  'nicaragua': ['nicaragua', 'nicaraguan'],
  'niger': ['niger', 'nigerien'],
  'nigeria': ['nigeria', 'nigerian', 'lagos', 'abuja'],
  'north macedonia': ['north macedonia', 'macedonia'],
  'norway': ['norway', 'norwegian'],
  'oman': ['oman', 'omani'],
  'pakistan': ['pakistan', 'pakistani', 'karachi', 'lahore', 'islamabad'],
  'palau': ['palau'],
  'panama': ['panama', 'panamanian'],
  'papua new guinea': ['papua new guinea', 'png'],
  'paraguay': ['paraguay', 'paraguayan'],
  'peru': ['peru', 'peruvian'],
  'philippines': ['philippines', 'filipino', 'manila'],
  'poland': ['poland', 'polish'],
  'portugal': ['portugal', 'portuguese'],
  'qatar': ['qatar', 'qatari'],
  'romania': ['romania', 'romanian'],
  'russia': ['russia', 'russian', 'moscow'],
  'rwanda': ['rwanda', 'rwandan'],
  'saint kitts and nevis': ['saint kitts', 'nevis'],
  'saint lucia': ['saint lucia'],
  'saint vincent and the grenadines': ['saint vincent', 'grenadines'],
  'samoa': ['samoa', 'samoan'],
  'san marino': ['san marino'],
  'sao tome and principe': ['sao tome', 'principe'],
  'saudi arabia': ['saudi arabia', 'saudi', 'riyadh', 'jeddah'],
  'senegal': ['senegal', 'senegalese'],
  'serbia': ['serbia', 'serbian'],
  'seychelles': ['seychelles'],
  'sierra leone': ['sierra leone', 'sierraleone'],
  'singapore': ['singapore', 'singaporean'],
  'slovakia': ['slovakia', 'slovak'],
  'slovenia': ['slovenia', 'slovenian'],
  'solomon islands': ['solomon islands'],
  'somalia': ['somalia', 'somali', 'mogadishu'],
  'south africa': ['south africa', 'south african', 'johannesburg', 'cape town'],
  'south sudan': ['south sudan'],
  'spain': ['spain', 'spanish', 'madrid', 'barcelona'],
  'sri lanka': ['sri lanka', 'sri lankan', 'colombo'],
  'sudan': ['sudan', 'sudanese', 'khartoum'],
  'suriname': ['suriname', 'surinamese'],
  'sweden': ['sweden', 'swedish', 'stockholm'],
  'switzerland': ['switzerland', 'swiss', 'zurich', 'geneva'],
  'syria': ['syria', 'syrian', 'damascus'],
  'taiwan': ['taiwan', 'taiwanese', 'taipei'],
  'tajikistan': ['tajikistan', 'tajik'],
  'tanzania': ['tanzania', 'tanzanian', 'dar es salaam'],
  'thailand': ['thailand', 'thai', 'bangkok'],
  'timor-leste': ['timor-leste', 'east timor'],
  'togo': ['togo', 'togolese'],
  'tonga': ['tonga', 'tongan'],
  'trinidad and tobago': ['trinidad', 'tobago', 'trinidad and tobago'],
  'tunisia': ['tunisia', 'tunisian'],
  'turkey': ['turkey', 'turkish', 'istanbul', 'ankara'],
  'turkmenistan': ['turkmenistan', 'turkmen'],
  'tuvalu': ['tuvalu'],
  'uganda': ['uganda', 'ugandan', 'kampala'],
  'ukraine': ['ukraine', 'ukrainian', 'kyiv', 'kiev'],
  'united arab emirates': ['united arab emirates', 'uae', 'emirates', 'dubai', 'abu dhabi'],
  'united kingdom': ['united kingdom', 'uk', 'britain', 'british', 'london', 'england', 'scotland', 'wales', 'northern ireland'],
  'united states': ['united states', 'usa', 'us', 'america', 'american', 'new york', 'california', 'texas'],
  'uruguay': ['uruguay', 'uruguayan'],
  'uzbekistan': ['uzbekistan', 'uzbek'],
  'vanuatu': ['vanuatu'],
  'vatican city': ['vatican city', 'vatican'],
  'venezuela': ['venezuela', 'venezuelan'],
  'vietnam': ['vietnam', 'vietnamese', 'hanoi', 'ho chi minh city'],
  'yemen': ['yemen', 'yemeni'],
  'zambia': ['zambia', 'zambian'],
  'zimbabwe': ['zimbabwe', 'zimbabwean']
};

function normalizeTargetCountry(country) {
  if (!country) return '';
  return String(country).toLowerCase().trim();
}

function detectCountryMentions(text) {
  if (!text) return [];
  const normalized = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  const found = [];
  for (const [country, aliases] of Object.entries(COUNTRY_TARGET_ALIASES)) {
    for (const alias of aliases) {
      if (normalized.includes(` ${alias.toLowerCase()} `)) {
        found.push(country);
        break;
      }
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
  
  // Company name presence
  if (normalizedContent.includes(normalizedCompany)) {
    score += 30;
    reasons.push('Full company name found in content');
  } else if (companyTokens.length === 1 && normalizedContent.includes(companyTokens[0])) {
    score += 15;
    reasons.push('Single company token found');
  } else if (companyTokens.length > 1) {
    const orderedPattern = companyTokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\S]{0,60}');
    const orderedRegex = new RegExp(orderedPattern, 'i');
    if (orderedRegex.test(content)) {
      score += 25;
      reasons.push('Ordered company tokens found');
    } else {
      let tokenHits = 0;
      for (const token of companyTokens) {
        if (normalizedContent.includes(token)) tokenHits++;
      }
      if (tokenHits >= Math.ceil(companyTokens.length * 0.6)) {
        score += 10;
        reasons.push(`${tokenHits}/${companyTokens.length} company tokens found`);
      }
    }
  }
  
  // Country presence
  if (country) {
    const targetCountry = normalizeTargetCountry(country);
    const mentions = detectCountryMentions(content);
    if (mentions.includes(targetCountry)) {
      score += 20;
      reasons.push(`Target country "${targetCountry}" mentioned`);
    }
  }
  
  // Contact signals
  const contactSignals = ['email', 'phone', 'address', 'contact', 'tel:', 'mailto:', '@'];
  let contactHits = 0;
  for (const signal of contactSignals) {
    if (normalizedContent.includes(signal)) contactHits++;
  }
  if (contactHits >= 2) {
    score += 15;
    reasons.push('Contact signals present');
  }
  
  // Business signals
  const businessSignals = ['pharma', 'pharmaceutical', 'medical', 'healthcare', 'distributor', 'importer', 'exporter', 'trading', 'supply', 'medicine', 'drug'];
  let businessHits = 0;
  for (const signal of businessSignals) {
    if (normalizedContent.includes(signal)) businessHits++;
  }
  if (businessHits >= 2) {
    score += 10;
    reasons.push('Business/pharma signals present');
  }
  
  return { score, reasons };
}

export function assessEvidenceForCountry(
  content,
  url,
  companyName,
  country,
  officialWebsite,
  options = {}
) {
  const { sourceType = 'web', relationshipEstablished = false } = options;
  
  const association = calculateCompanyAssociationScore(content, url, companyName, country, officialWebsite);
  const targetCountry = normalizeTargetCountry(country || '');
  const mentioned = detectCountryMentions(content);

  let foreign = targetCountry
    ? mentioned.filter((m) => m !== targetCountry)
    : [];

  const companyLower = (companyName || '').toLowerCase();
  foreign = foreign.filter((m) => {
    const tokens = COUNTRY_TARGET_ALIASES[m] || [m];
    return !tokens.some((t) => t.length >= 2 && companyLower.includes(t));
  });

  const targetCountryMatch = Boolean(targetCountry) && mentioned.includes(targetCountry);
  const geographyCompatible = !(targetCountry && foreign.length > 0 && !targetCountryMatch);

  let officialDomain = false;
  if (officialWebsite) {
    try {
      const officialHost = new URL(officialWebsite).hostname.toLowerCase().replace(/^www\./, '');
      const pageHost = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      officialDomain = pageHost === officialHost || pageHost.endsWith(`.${officialHost}`);
    } catch (_) {}
  }

  const normalizedCompany = companyName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const companyTokens = normalizedCompany.split(/\s+/).filter((token) =>
    token.length > 2 && !['pvt', 'ltd', 'limited', 'inc', 'corp', 'gmbh', 'company', 'pharma', 'pharmaceutical', 'pharmaceuticals'].includes(token)
  );
  const normalizedHaystack = `${url} ${content}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const orderedTokenPattern = companyTokens.length > 1
    ? new RegExp(companyTokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(?:\\s|[^a-z0-9]){0,60}'))
    : null;
  const explicitNameMatch = Boolean(normalizedCompany && normalizedHaystack.includes(normalizedCompany))
    || (companyTokens.length === 1 && normalizedHaystack.includes(companyTokens[0]))
    || Boolean(orderedTokenPattern?.test(normalizedHaystack));
  const authoritative = sourceType === 'authoritative_registry' && explicitNameMatch;
  const establishedRelationship = sourceType === 'official_relationship'
    && relationshipEstablished === true
    && explicitNameMatch;
  const entityEstablished = officialDomain || explicitNameMatch || authoritative || establishedRelationship;

  let decision = 'ADMIT';
  const reasons = [...association.reasons];
  if (!entityEstablished) {
    decision = sourceType === 'candidate_official' ? 'HOLD' : 'REJECT';
    reasons.push(sourceType === 'candidate_official'
      ? 'Held: candidate website does not establish the target company and requires independent identity evidence'
      : 'Rejected: target-company association was not deterministically established');
  } else if (!geographyCompatible) {
    decision = 'REJECT';
    reasons.push('Rejected: evidence describes a foreign branch without the target-country context');
  } else if (authoritative) {
    reasons.push('Admitted: explicitly classified authoritative registry with exact entity match');
  } else if (establishedRelationship) {
    reasons.push('Admitted: official target-company evidence establishes the third-party relationship');
  }

  const entityMatch = officialDomain
    ? 'official-domain'
    : authoritative || establishedRelationship
      ? 'authoritative'
      : explicitNameMatch
        ? 'explicit-name'
        : 'unestablished';
  const countryMatch = !geographyCompatible
    ? 'foreign'
    : targetCountryMatch
      ? 'target'
      : 'global';

  return {
    admissible: decision === 'ADMIT',
    decision,
    associationScore: association.score,
    isAssociated: entityEstablished,
    entityMatch,
    countryMatch,
    targetCountryMatch,
    foreignCountryMentions: foreign,
    reasons,
  };
}

// Test with real cached content
import initSqlJs from 'sql.js';
import fs from 'fs';

async function main() {
  const DB_PATH = 'edgeview.db';
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

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

  const summary = { ADMITTABLE: 0, UNPROVEN: 0, CONTRADICTED: 0, FETCH_FAILED: 0, NO_CACHE: 0 };

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
    
    const actionsResult = db.exec(
      `SELECT iteration, action_type, target_type, provider, query, status, information_gain, latency_ms, error 
       FROM research_ledger_actions 
       WHERE research_id=? AND action_type='FETCH' ORDER BY iteration`, [run.research_id]);
    
    if (actionsResult[0]?.values?.length) {
      for (const action of actionsResult[0].values) {
        const act = Object.fromEntries(actionsResult[0].columns.map((c,i)=>[c,action[i]]));
        if (act.query && act.query.startsWith('http')) {
          const url = act.query;
          const cacheResult = db.exec(`SELECT content FROM scraped_url_cache WHERE url=?`, [url]);
          if (cacheResult[0]?.values[0]?.[0]) {
            const content = cacheResult[0].values[0][0];
            
            const assessment = assessEvidenceForCountry(
              content, url, company, run.country || undefined, undefined, { sourceType: 'web' }
            );
            
            let classification = 'UNKNOWN';
            if (assessment.admissible) classification = 'ADMITTABLE';
            else if (assessment.decision === 'REJECT' && assessment.reasons.some(r => r.includes('foreign') || r.includes('contradict') || r.includes('wrong entity'))) classification = 'CONTRADICTED';
            else classification = 'UNPROVEN';
            
            summary[classification]++;
            
            console.log(`  URL: ${url}`);
            console.log(`    admissible: ${assessment.admissible} | decision: ${assessment.decision} | entityMatch: ${assessment.entityMatch} | countryMatch: ${assessment.countryMatch}`);
            console.log(`    score: ${assessment.associationScore} | targetCountryMatch: ${assessment.targetCountryMatch} | foreign: ${assessment.foreignCountryMentions.join(',') || 'none'}`);
            console.log(`    reasons: ${assessment.reasons.slice(-2).join('; ')}`);
            console.log(`    CLASSIFICATION: ${classification}`);
          } else {
            summary.NO_CACHE++;
            console.log(`  URL: ${url} - NO CACHED CONTENT`);
          }
        }
      }
    }
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(console.error);