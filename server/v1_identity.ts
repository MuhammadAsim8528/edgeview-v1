import { countryCcTlds, detectAffirmedCountryNames, detectExplicitCountryNames, detectNegatedCountryNames }
  from '../src/utils/countryNormalizer';

export interface DomainEvidence {
  url: string;
  title?: string;
  snippet?: string;
  provider?: string;
  rank?: number;
}

export interface DomainCandidate {
  domain: string;
  score: number;
  accepted: boolean;
  reasons: string[];
  evidence_urls: string[];
}

export interface DomainResolution {
  official_domain: string;
  confidence: 'high' | 'medium' | 'none';
  candidates: DomainCandidate[];
}

const DIRECTORY_DOMAINS = [
  'volza.com', 'trademo.com', 'eximpedia.app', 'recordowl.com', 'ng-check.com',
  'en.nbd.ltd', 'nbd.ltd', 'medpath.com', 'tradeatlas.com', 'seair.co.in',
  'marketinsidedata.com', 'panjiva.com', 'companies.sg', 'straitsdata.com',
  'sgpbusiness.com', 'sgbizdb.com', 'listcompany.org', 'keepital.com',
  'dnb.com', 'zoominfo.com', 'datanyze.com', 'crunchbase.com', 'bloomberg.com',
  'tradeindia.com', 'chemdmart.com', 'importgenius.com', 'exportgenius.in',
  'linkedin.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'youtube.com', 'wikipedia.org', 'google.com', 'googleusercontent.com',
  'opencorporates.com', 'businesslist.com', 'yellowpages.com', 'app.com',
  'clearwebstats.com', 'africabz.com', 'contact.page', 'business.site', 'sites.google.com',
  'tradeint.com', 'contactout.com', 'finalscout.com', 'magicport.ai', 'verif.com',
  'highperformr.ai', 'intuitionlabs.ai', 'pissedconsumer.com', 'quickcompany.in',
  'yellowpages.ae', 'citysearch.ae', '2gis.ae',
];

const LEGAL_WORDS = new Set([
  'm', 's', 'ms', 'the', 'and', 'of', 'company', 'co', 'corporation', 'corp',
  'limited', 'ltd', 'private', 'pvt', 'llc', 'plc', 'inc', 'incorporated',
  'holdings', 'group', 'services',
  'pharmaceutical', 'pharmaceuticals', 'pharma', 'medical', 'healthcare',
  'import', 'export', 'importer', 'exporter', 'fz', 'fze', 'pte', 'sdn', 'bhd',
]);

const GENERIC_IDENTITY_WORDS = new Set([
  'international', 'global', 'trading', 'trade', 'business', 'pharma',
  'pharmaceutical', 'pharmaceuticals', 'medical', 'healthcare', 'health',
  'logistics', 'cargo', 'foundation', 'construction', 'technology', 'technologies',
  'state', 'motor', 'pharmacy', 'hospital', 'care', 'foods', 'freight', 'dubai', 'uae',
  'life', 'line', 'solutions', 'solution', 'enterprise', 'enterprises', 'supply', 'supplies',
  'products', 'product', 'united', 'active', 'rose', 'crown', 'general',
]);

function words(value: string): string[] {
  return value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/).filter(Boolean);
}

export function normalizedHostname(value: string): string {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, ''); }
  catch { return ''; }
}

export function registrableDomain(value: string): string {
  const host = value.includes('://') ? normalizedHostname(value) : value.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  const labels = host.split('.').filter(Boolean);
  if (labels.length <= 2) return host;
  const commonSecondLevel = new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu']);
  const take = commonSecondLevel.has(labels.at(-2) || '') && (labels.at(-1) || '').length === 2 ? 3 : 2;
  return labels.slice(-take).join('.');
}

export function isDirectoryOrPlatformDomain(domain: string): boolean {
  const host = domain.toLowerCase().replace(/^www\./, '');
  const root = registrableDomain(host);
  return DIRECTORY_DOMAINS.some(blocked => host === blocked || host.endsWith(`.${blocked}`) || root === blocked || root.endsWith(`.${blocked}`));
}

function domainLabel(domain: string): string {
  return domain.split('.')[0].replace(/[^a-z0-9]/g, '');
}

const COUNTRY_ALIASES: Record<string, string[]> = {
  kazakistan: ['kazakistan', 'kazakhstan'],
  'bahrain/kingdom of b': ['bahrain'],
  'cambodia/kampuchea d': ['cambodia', 'kampuchea'],
  'congo, democratic re': ['democratic republic of the congo'],
  'hong kong, china': ['hong kong'],
  'ivory coast / cote d': ['ivory coast', "cote d'ivoire", 'cote divoire'],
  'korea (south)': ['south korea', 'korea'],
  "lao people's democra": ['laos', "lao people's democratic republic"],
  'libyan arab jamhirya': ['libya'],
  'moldova, republic of': ['moldova'],
  'tajikistan/tasmania': ['tajikistan'],
  turkemanistan: ['turkmenistan', 'turkemanistan'],
  'upper volta/burkina': ['burkina faso', 'upper volta'],
  'virgin island britis': ['british virgin islands'],
};

function countryVariants(country: string): string[] {
  const normalized = country.toLowerCase().replace(/\s+/g, ' ').trim();
  return COUNTRY_ALIASES[normalized] || [normalized];
}

function countryTargetNames(country: string): Set<string> {
  return new Set(countryVariants(country).flatMap(variant => detectExplicitCountryNames(variant)));
}
function countryMentionSupported(country: string, evidenceText: string): boolean {
  const targets = countryTargetNames(country);
  return detectAffirmedCountryNames(evidenceText).some(name => targets.has(name));
}
function countryMentionNegated(country: string, evidenceText: string): boolean {
  const targets = countryTargetNames(country);
  return detectNegatedCountryNames(evidenceText).some(name => targets.has(name));
}
function supportedCountrySuffixes(country: string): string[] {
  return [...new Set(countryVariants(country).flatMap(variant => countryCcTlds(variant)))];
}
function countrySupported(domain: string, country: string, evidenceText: string): boolean {
  return countryMentionSupported(country, evidenceText) || countrySuffixSupported(domain, country);
}

function countrySuffixSupported(domain: string, country: string): boolean {
  const suffix = domain.split('.').at(-1) || '';
  return supportedCountrySuffixes(country).includes(suffix);
}

export function resolveOfficialDomain(companyName: string, country: string, evidence: DomainEvidence[]): DomainResolution {
  const primaryCompanyName = companyName.split(/\b(?:c\s*\/\s*o|ship\s+to)\b/i)[0].trim() || companyName;
  const companyWords = words(primaryCompanyName);
  const businessName = (tokens: string[]) => tokens.flatMap(word =>
    /^(pharmaceuticals?|pharma)$/.test(word) ? ['pharma'] : word === 'healthcare' ? [word] : LEGAL_WORDS.has(word) ? [] : [word]).join('');
  const fullName = businessName(companyWords);
  const distinctive = companyWords.filter(word => word.length >= 3 && !LEGAL_WORDS.has(word));
  const compactCompany = distinctive.join('');
  const brandTokens = distinctive.filter(token => !GENERIC_IDENTITY_WORDS.has(token));
  const coreCompact = brandTokens.join('');
  const acronym = companyWords.filter(word => word.length >= 3 && !LEGAL_WORDS.has(word)).map(word => word[0]).join('');
  const grouped = new Map<string, DomainEvidence[]>();
  for (const item of evidence) {
    const hostname = normalizedHostname(item.url);
    const domain = registrableDomain(hostname);
    if (!domain || !domain.includes('.')) continue;
    grouped.set(domain, [...(grouped.get(domain) || []), item]);
  }

  const candidates: DomainCandidate[] = [];
  for (const [domain, items] of grouped) {
    const reasons: string[] = [];
    if (isDirectoryOrPlatformDomain(domain)) {
      candidates.push({ domain, score: -100, accepted: false, reasons: ['known directory, registry, social, or data-platform domain'], evidence_urls: [...new Set(items.map(i => i.url))] });
      continue;
    }
    const label = domainLabel(domain);
    const matched = distinctive.filter(token => token.length >= 4 && (label.includes(token) || (label.length >= 5 && token.includes(label))));
    const matchedBrandTokens = brandTokens.filter(token => token.length >= 4 && label.includes(token));
    const coreCompactMatch = coreCompact.length >= 4 && (label.includes(coreCompact) || (label.length >= 6 && coreCompact.startsWith(label)))
      && !(brandTokens.length === 1 && brandTokens[0].length <= 4 && !countrySuffixSupported(domain, country));
    let score = 0;
    if (matched.length) { score += matched.some(token => token.length >= 5) ? 45 : 28; reasons.push(`domain matches company token: ${matched.join(', ')}`); }
    if (coreCompactMatch) { score += 35; reasons.push('domain matches core company identity'); }
    const evidenceTextRaw = items.map(item => `${item.title || ''} ${item.snippet || ''}`).join(' ');
    const evidenceText = evidenceTextRaw.toLowerCase();
    const titleMatches = distinctive.filter(token => evidenceText.includes(token));
    const identityRatio = distinctive.length ? titleMatches.length / distinctive.length : 0;
    if (identityRatio >= 0.75) { score += 25; reasons.push('search evidence strongly matches company identity'); }
    else if (identityRatio >= 0.5) { score += 12; reasons.push('search evidence partly matches company identity'); }
    if (country && countryMentionSupported(country, evidenceTextRaw)) { score += 8; reasons.push('search evidence affirmatively mentions target country'); }
    const providers = new Set(items.map(item => item.provider).filter(Boolean));
    if (providers.size >= 2) { score += 10; reasons.push('supported by multiple search providers'); }
    if (items.some(item => Number(item.rank || 99) <= 2)) score += 5;
    // A domain must itself match the company. Repeated directory-style pages or
    // title/snippet mentions alone never establish ownership.
    const geographicIdentity = countrySupported(domain, country, evidenceTextRaw);
    const negatedCountryIdentity = countryMentionNegated(country, evidenceTextRaw);
    if (negatedCountryIdentity) reasons.push('search evidence explicitly negates the target country');
    if (geographicIdentity) reasons.push('domain or evidence matches target country');
    else reasons.push('no evidence connects this domain to the target country');
    const domainIdentityRatio = distinctive.length ? matched.length / distinctive.length : 0;
    const compactMatch = compactCompany.length >= 5 && (distinctive.length >= 2
      ? label.includes(compactCompany)
      : label === compactCompany);
    const singleBrandMatch = brandTokens.length === 1 && brandTokens[0].length >= 4 && (label.includes(brandTokens[0]) || (label.length >= 6 && brandTokens[0].startsWith(label)))
      && (brandTokens[0].length >= 5 || countrySuffixSupported(domain, country));
    const multiBrandMatch = brandTokens.length >= 2 && matchedBrandTokens.length >= Math.ceil(brandTokens.length / 2) && matchedBrandTokens.some(token => label.startsWith(token));
    const shortExactAcronym = (distinctive.some(token => token.length === 3 && !GENERIC_IDENTITY_WORDS.has(token) && label === token)
      || (acronym.length >= 3 && acronym.length <= 6 && label === acronym)) && countrySuffixSupported(domain, country);
    const industryWord = companyWords.some(word => /^(?:pharma|pharmaceutical|pharmaceuticals|pharmacy)$/.test(word))
      ? 'pharma'
      : companyWords.some(word => /^(?:healthcare)$/.test(word)) || (companyWords.includes('health') && companyWords.includes('care')) ? 'healthcare' : '';
    const exactShortIndustryBrand = brandTokens.length === 1 && brandTokens[0].length === 4 && Boolean(industryWord)
      && label === `${brandTokens[0]}${industryWord}`;
    if (exactShortIndustryBrand) { score += 25; reasons.push('domain exactly matches short brand plus industry identity'); }
    if (shortExactAcronym) { score += 35; reasons.push('country-code domain exactly matches the company acronym'); }
    // A short bare host can be a different local organisation's acronym.
    // A sponsor mention in its snippets cannot establish ownership.
    const bareIndustryBrand = industryWord && brandTokens.length === 1 && label === brandTokens[0] && label.length <= 4;
    const genericIndustryName = Boolean(industryWord) && !brandTokens.length;
    const homepageNamesCompany = (!bareIndustryBrand && !genericIndustryName) || items.some(item => {
      const url = new URL(item.url);
      const heading = (item.title || '').split(/\s*[|–—]\s*|\s+-\s+/)[0];
      return url.pathname === '/' && businessName(words(heading)) === fullName;
    });
    const geographicBusinessName = genericIndustryName && homepageNamesCompany && supportedCountrySuffixes(country)
      .some(code => label.replace(/pharmaceuticals?/g, 'pharma') === fullName + code) && geographicIdentity;
    const sufficientlySpecificDomain = homepageNamesCompany && (genericIndustryName ? geographicBusinessName :
      compactMatch || coreCompactMatch || singleBrandMatch || multiBrandMatch || shortExactAcronym || exactShortIndustryBrand);
    if (!sufficientlySpecificDomain) reasons.push('domain matches too little of the exact company identity');
    // A globally-used .com often omits the country from both its domain and
    // search snippet. Do not reject an otherwise exact, top-ranked identity
    // solely for that omission. This path still requires a highly specific
    // company/domain match and near-complete identity evidence; generic-token
    // matches and directory/platform domains cannot qualify.
    const topRanked = items.some(item => Number(item.rank || 99) <= 3);
    // A foreign country-code domain is not geographically neutral. Require
    // explicit target-country evidence before treating it as this local entity.
    // A parent company's target-country page may still establish that link.
    const suffix = domain.split('.').at(-1) || '';
    // Every two-letter TLD is treated conservatively as country-coded. This
    // avoids silently accepting an unlisted/new ccTLD as a neutral global domain.
    const foreignCountryDomain = /^[a-z]{2}$/.test(suffix) && !countrySuffixSupported(domain, country);
    if (foreignCountryDomain && !geographicIdentity) reasons.push('foreign country-code domain lacks target-country evidence');
    const exactGlobalIdentity = !foreignCountryDomain && !negatedCountryIdentity && sufficientlySpecificDomain
      && (compactMatch || coreCompactMatch || exactShortIndustryBrand)
      && identityRatio >= 0.75
      && topRanked
      && score >= 65;
    if (exactGlobalIdentity && !geographicIdentity) reasons.push('exact top-ranked global identity accepted without a country-bearing domain');
    const accepted = !negatedCountryIdentity
      && (matched.length > 0 || compactMatch || coreCompactMatch || shortExactAcronym || exactShortIndustryBrand)
      && sufficientlySpecificDomain && identityRatio >= 0.5 && score >= 45 && (geographicIdentity || exactGlobalIdentity);
    if (!accepted) reasons.push('insufficient domain-to-company ownership evidence');
    candidates.push({ domain, score, accepted, reasons, evidence_urls: [...new Set(items.map(i => i.url))] });
  }
  candidates.sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));
  const winner = candidates.find(candidate => candidate.accepted);
  return { official_domain: winner?.domain || '', confidence: winner ? (winner.score >= 70 ? 'high' : 'medium') : 'none', candidates };
}

export function sameDomainOrSubdomain(url: string, domain: string): boolean {
  const host = normalizedHostname(url);
  return Boolean(host && domain && (host === domain || host.endsWith(`.${domain}`)));
}
