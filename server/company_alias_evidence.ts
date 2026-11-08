import crypto from 'node:crypto';
import { canonicalCompanyIdentityKey, canonicalCountryIdentityKey, classifyCompanyAliasCandidate,
  type CompanyAliasIdentity } from './company_identity';
import { detectExplicitCountryNames, normalizeCountryExact } from '../src/utils/countryNormalizer';
import type { V1Run } from './v1_engine';

export const COMPANY_ALIAS_PROOF_POLICY = 1;
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function authority(value: unknown): string {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      ? url.hostname.toLowerCase().replace(/^www\./, '') : '';
  } catch { return ''; }
}

/** A deliberately narrow proof gate. Inputs must be backend-loaded records and
 * an immutable run, never client-provided company objects or source content.
 * This verifies an explicit local legal-name statement, not legal ownership of
 * a domain. Admission still needs durable registry/race checks and owner review.
 * Unsupported markup/language/layout abstains rather than guessing. */
export function verifyCompanyAliasEvidence(left: CompanyAliasIdentity, right: CompanyAliasIdentity,
  run: V1Run, rawRecordId: string) {
  const reject = (code: string) => ({ verified: false as const, code });
  const candidate = classifyCompanyAliasCandidate(left, right);
  if (candidate.tier === 'DISTINCT' || candidate.reason === 'MISSING_BOUNDED_IDENTITY'
    || candidate.reason === 'INVALID_REGISTRATION_SIGNALS' || candidate.reason === 'GENERIC_WORDS_ONLY') {
    return reject('ALIAS_IDENTITY_REFUSED');
  }
  const country = normalizeCountryExact(left.country || '');
  if (canonicalCountryIdentityKey(run.country) !== canonicalCountryIdentityKey(country)
    || ![left.company_name, right.company_name].some(name =>
      canonicalCompanyIdentityKey(name) === canonicalCompanyIdentityKey(run.company_name))
    || !['COMPLETED', 'PARTIAL'].includes(run.status)) return reject('ALIAS_RUN_IDENTITY_REFUSED');
  const domain = String(run.identity_resolution?.official_domain || '').toLowerCase().replace(/^www\./, '');
  if (!domain || !run.identity_resolution?.candidates.some(item => item.accepted
    && item.domain.toLowerCase().replace(/^www\./, '') === domain)) return reject('ALIAS_OFFICIAL_SOURCE_REQUIRED');
  const matches = run.raw_records.filter(record => record.id === rawRecordId);
  if (matches.length !== 1) return reject('ALIAS_CAPTURE_REQUIRED');
  const raw = matches[0];
  const payload = raw.response as { status?: number; body?: unknown;
    provenance?: { finalUrl?: unknown; redirectCount?: unknown } } | undefined;
  if (raw.run_id !== run.id || raw.kind !== 'scrape' || raw.provider !== 'direct-http' || raw.failure
    || payload?.status !== 200 || typeof payload.body !== 'string'
    || Buffer.byteLength(payload.body, 'utf8') > 4 * 1024 * 1024
    || hash(JSON.stringify(payload)) !== raw.sha256) return reject('ALIAS_CAPTURE_INTEGRITY_REFUSED');
  const provenance = payload.provenance;
  if (!provenance || authority(provenance.finalUrl) !== domain
    || !Number.isInteger(provenance.redirectCount) || Number(provenance.redirectCount) < 0
    || Number(provenance.redirectCount) > 5) return reject('ALIAS_CAPTURE_DESTINATION_REFUSED');
  // Restrict the initial carrier grammar rather than pretending a regular
  // expression models browser visibility. Any attributes, comments, raw-text,
  // embedded content, stylesheets or unsupported tags force abstention. Rich
  // official pages remain evidence for human inspection, not alias admission.
  const html = payload.body;
  if (html.replace(/<\/?(?:html|head|body|p)\s*>/giu, '').includes('<')) {
    return reject('ALIAS_UNSUPPORTED_EVIDENCE_CARRIER');
  }
  const names = [left.company_name, right.company_name].map(name => name.normalize('NFKC').replace(/\s+/g, ' ').trim());
  const statement = (a: string, b: string) => new RegExp(`^${escape(a)} (?:is also known as|trades as) ${escape(b)} in ${escape(country)}\\.?$`, 'iu');
  const patterns = [statement(names[0], names[1]), statement(names[1], names[0])];
  const quotes: string[] = [];
  for (const paragraph of html.matchAll(/<p\s*>([^<>]{1,1200})<\/p\s*>/giu)) {
    const quote = paragraph[1].normalize('NFKC').replace(/\s+/g, ' ').trim();
    const countries = detectExplicitCountryNames(quote);
    if (countries.length !== 1 || canonicalCountryIdentityKey(countries[0]) !== canonicalCountryIdentityKey(country)) continue;
    if (patterns.some(pattern => pattern.test(quote))) quotes.push(quote);
  }
  const unique = [...new Set(quotes)];
  if (unique.length !== 1) return reject('ALIAS_EXPLICIT_LOCAL_STATEMENT_REQUIRED');
  return { verified: true as const, code: 'ALIAS_EXPLICIT_LOCAL_STATEMENT', policy_version: COMPANY_ALIAS_PROOF_POLICY,
    run_id: run.id, raw_record_id: raw.id, source_url: String(provenance.finalUrl),
    response_sha256: raw.sha256, quote: unique[0], quote_sha256: hash(unique[0]), country };
}
