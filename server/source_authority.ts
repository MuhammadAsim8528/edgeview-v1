export type CanonicalSourceAuthority = 'OFFICIAL_COMPANY' | 'OFFICIAL_BRANCH' | 'GOVERNMENT' | 'REGISTRY' | 'CHAMBER' | 'OFFICIAL_PARTNER' | 'PROFESSIONAL_PROFILE' | 'INDUSTRY' | 'TRADE_DATABASE' | 'BUSINESS_DIRECTORY' | 'OTHER';

const hostOf = (url: string) => { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
const isHost = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

export function classifyCanonicalSourceAuthority(url: string, sourceType = '', officialWebsite = ''): CanonicalSourceAuthority {
  const host = hostOf(url); const type = String(sourceType || '').toLowerCase(); const official = hostOf(officialWebsite);
  if (official && isHost(host, official) && /official|verified/i.test(type)) return /branch|location/i.test(type) ? 'OFFICIAL_BRANCH' : 'OFFICIAL_COMPANY';
  if (/official[_ -]?(?:partner|supplier|distributor|relationship)/i.test(type)) return 'OFFICIAL_PARTNER';
  if (/government|\.gov\b/i.test(type) || /(?:\.gov\.|\.gov$)/.test(host)) return 'GOVERNMENT';
  if (/registry|registrar|legal filing/i.test(type) || /companieshouse\.gov\.uk/.test(host)) return 'REGISTRY';
  if (/chamber|association/i.test(type) || /chamber|association/.test(host)) return 'CHAMBER';
  if (/linkedin\.com|professional|social/.test(`${host} ${type}`)) return 'PROFESSIONAL_PROFILE';
  if (/panjiva|tendata|volza|importgenius|trademo|tradeatlas|marketinsidedata|trade database/.test(`${host} ${type}`)) return 'TRADE_DATABASE';
  if (/industry|trade publication|regulator/.test(type)) return 'INDUSTRY';
  if (/directory|dnb\.com|kompass\.com|yellowpages/.test(`${host} ${type}`)) return 'BUSINESS_DIRECTORY';
  return 'OTHER';
}
