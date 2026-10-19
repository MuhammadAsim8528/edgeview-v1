const NON_COMPANY_HOSTS = /(?:^|\.)(?:linkedin|facebook|twitter|x|instagram|youtube|panjiva|importgenius|volza|zoominfo|crunchbase|dnb|kompass|yellowpages|wikipedia|bloomberg|google|bing|yahoo|reuters)\.(?:com|org|net|co|io)$/i;

const GENERIC = new Set([
  'company', 'trading', 'pharma', 'pharm', 'pharmaceutical', 'pharmaceuticals',
  'limited', 'group', 'international', 'medical', 'medics', 'solutions', 'global',
  'enterprise', 'enterprises', 'industries', 'industry', 'corp', 'corporation',
  'holdings', 'holding', 'services', 'products', 'commercial'
]);

export interface DomainBinding {
  domain: string;
  entity_key: string;
  status: 'CANDIDATE' | 'VERIFIED' | 'REJECTED';
  proofRoute: 'LEXICAL' | 'CONTENT_BACKED' | 'MANUAL';
  proofSignals: string[];
}

/**
 * Route A: Lexical Domain Proof.
 * A candidate domain contains distinctive target-name tokens or acronym initials.
 */
export function isPlausibleOfficialCompanyUrlCandidate(url: string, companyName: string): boolean {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (NON_COMPANY_HOSTS.test(host)) return false;

    const cleanHost = host.replace(/[^a-z0-9]/g, '');
    const domainRoot = host.split('.')[0].replace(/[^a-z0-9]/g, '');

    // Split words including camelCase (e.g. GlaxoSmithKline -> Glaxo Smith Kline)
    const expandedName = String(companyName || '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[^a-z0-9]+/gi, ' ')
      .trim();

    const words = expandedName
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 0) return false;

    // 1. Check distinctive words (length >= 3 and not generic)
    const distinctive = words.filter((token) => token.length >= 3 && !GENERIC.has(token));
    if (distinctive.some((token) => cleanHost.includes(token))) {
      return true;
    }

    // 2. Check acronym initialism (e.g. "GlaxoSmithKline" -> "gsk", "General Electric" -> "ge")
    if (words.length >= 2) {
      const acronym = words.map((w) => w[0]).join('');
      if (acronym.length >= 2 && (cleanHost.startsWith(acronym) || domainRoot === acronym)) {
        return true;
      }
    }

    // 3. Check combined words (e.g. "Unguja Pharmacy" -> "ungujapharmacy")
    const combined = words.slice(0, 3).join('');
    if (combined.length >= 4 && cleanHost.includes(combined)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/** Backward compatibility alias */
export const isPlausibleOfficialCompanyUrl = isPlausibleOfficialCompanyUrlCandidate;

/**
 * Route B: Content-Backed Domain Proof.
 * Evaluates retrieved page content to confirm the page explicitly establishes target legal identity.
 */
export function verifyContentBackedDomainProof(
  pageContent: string,
  domainUrl: string,
  companyName: string,
  country = ''
): DomainBinding {
  const host = (() => {
    try {
      return new URL(domainUrl.startsWith('http') ? domainUrl : `https://${domainUrl}`).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return domainUrl.toLowerCase();
    }
  })();

  const signals: string[] = [];
  const lowerContent = String(pageContent || '').toLowerCase();
  const cleanName = String(companyName || '').toLowerCase().trim();

  // 1. Lexical proof check
  const hasLexical = isPlausibleOfficialCompanyUrlCandidate(domainUrl, companyName);
  if (hasLexical) {
    signals.push('lexical_hostname_match');
  }

  // 2. Explicit company name mention in page body or copyright/footer
  const hasDirectNameMention = lowerContent.includes(cleanName);
  if (hasDirectNameMention) {
    signals.push('direct_name_mention');
  }

  // 3. Country mention corroboration
  if (country && lowerContent.includes(country.toLowerCase().trim())) {
    signals.push('country_corroboration');
  }

  // 4. Contact / Corporate markers
  if (/(?:contact us|headquarters|about us|registered office|our office)/i.test(lowerContent)) {
    signals.push('corporate_structure_markers');
  }

  // Decision rule:
  // If lexical proof + direct name mention -> VERIFIED
  // If direct name mention + country corroboration + corporate markers -> VERIFIED (Route B)
  // If directory/competing signals dominate -> REJECTED
  if (NON_COMPANY_HOSTS.test(host)) {
    return {
      domain: host,
      entity_key: companyName,
      status: 'REJECTED',
      proofRoute: 'LEXICAL',
      proofSignals: ['non_company_host_blacklist'],
    };
  }

  if (hasLexical && hasDirectNameMention) {
    return {
      domain: host,
      entity_key: companyName,
      status: 'VERIFIED',
      proofRoute: 'LEXICAL',
      proofSignals: signals,
    };
  }

  if (hasDirectNameMention && signals.length >= 2) {
    return {
      domain: host,
      entity_key: companyName,
      status: 'VERIFIED',
      proofRoute: 'CONTENT_BACKED',
      proofSignals: signals,
    };
  }

  return {
    domain: host,
    entity_key: companyName,
    status: 'CANDIDATE',
    proofRoute: hasLexical ? 'LEXICAL' : 'CONTENT_BACKED',
    proofSignals: signals,
  };
}
