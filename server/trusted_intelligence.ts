import { createHash } from 'node:crypto';
import { canonicalEntityIdentityKey } from './company_identity';

export type ClaimStatus = 'supported' | 'disputed' | 'rejected' | 'superseded';

export interface IntelligenceClaim {
  id: string;
  entity_key: string;
  subject_type: 'company' | 'person';
  predicate: string;
  value: string;
  normalized_value: string;
  evidence_refs: string[];
  source_refs: string[];
  entity_match: 'established';
  country_match: 'target' | 'global';
  grounding_strength: 'exact';
  source_authority: 'official' | 'third-party';
  observed_at?: string;
  retrieved_at: string;
  valid_from?: string;
  valid_until?: string;
  status: ClaimStatus;
  contradicts: string[];
}

export interface IntelligenceContradiction {
  id: string;
  entity_key: string;
  predicate: string;
  claim_ids: string[];
  status: 'unresolved' | 'resolved' | 'superseded';
}

export interface ResearchAssessment {
  coverage: 'LOW' | 'MEDIUM' | 'HIGH';
  evidence_strength: 'WEAK' | 'MODERATE' | 'STRONG';
  provenance: 'PARTIAL' | 'TRACEABLE' | 'COMPLETE';
  unresolved_contradictions: number;
  basis: string;
}

interface EvidenceLike {
  field: string;
  value: string;
  source_url: string;
  evidence_text?: string;
}

const normalize = (value: string) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const digest = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 20);

function sourceIsOfficial(sourceUrl: string, website: string): boolean {
  try {
    const sourceHost = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, '');
    const officialHost = new URL(website).hostname.toLowerCase().replace(/^www\./, '');
    return sourceHost === officialHost || sourceHost.endsWith(`.${officialHost}`);
  } catch (_) {
    return false;
  }
}

function claimPredicate(field: string, value: string): { predicate: string; subject: 'company' | 'person' } | null {
  const normalizedField = normalize(field).replace(/[^a-z0-9]+/g, '_');
  if (normalizedField.includes('decision_maker') || normalizedField.includes('contact_person')) {
    const role = value.match(/\(([^)]+)\)\s*$/)?.[1]?.trim();
    return { predicate: role ? `leadership_role:${normalize(role)}` : 'leadership_person', subject: 'person' };
  }
  if (normalizedField.includes('email')) return { predicate: 'email', subject: 'company' };
  if (normalizedField.includes('phone')) return { predicate: 'phone', subject: 'company' };
  if (normalizedField.includes('address')) return { predicate: 'address', subject: 'company' };
  if (normalizedField.includes('website')) return { predicate: 'website', subject: 'company' };
  if (normalizedField.includes('linkedin') || normalizedField.includes('professional')) return { predicate: 'professional_profile', subject: 'company' };
  if (normalizedField.includes('legal') && normalizedField.includes('name')) return { predicate: 'legal_name', subject: 'company' };
  return null;
}

/** Builds an additive claim ledger from already validated, source-grounded evidence. */
export function buildTrustedIntelligence(
  companyName: string,
  country: string,
  website: string,
  evidence: EvidenceLike[],
  presentFieldCount: number
): { claims: IntelligenceClaim[]; contradictions: IntelligenceContradiction[]; assessment: ResearchAssessment } {
  const entityKey = canonicalEntityIdentityKey(companyName, country);
  const retrievedAt = new Date().toISOString();
  const claimsByKey = new Map<string, IntelligenceClaim>();

  for (const item of evidence || []) {
    if (!item?.source_url || !item?.value) continue;
    const mapped = claimPredicate(item.field, item.value);
    if (!mapped) continue;
    const normalizedValue = normalize(item.value);
    const key = `${mapped.predicate}\u0000${normalizedValue}\u0000${normalize(item.source_url)}`;
    if (claimsByKey.has(key)) continue;
    const id = `claim_${digest(`${entityKey}\u0000${key}`)}`;
    claimsByKey.set(key, {
      id,
      entity_key: entityKey,
      subject_type: mapped.subject,
      predicate: mapped.predicate,
      value: String(item.value).trim(),
      normalized_value: normalizedValue,
      evidence_refs: [`evidence_${digest(`${item.field}\u0000${item.value}\u0000${item.source_url}`)}`],
      source_refs: [item.source_url],
      entity_match: 'established',
      country_match: country ? 'target' : 'global',
      grounding_strength: 'exact',
      source_authority: sourceIsOfficial(item.source_url, website) ? 'official' : 'third-party',
      retrieved_at: retrievedAt,
      status: 'supported',
      contradicts: [],
    });
  }

  const claims = Array.from(claimsByKey.values());
  const contradictions: IntelligenceContradiction[] = [];
  const contradictionPredicates = new Set(['website', 'legal_name']);
  for (const predicate of new Set(claims.map((claim) => claim.predicate))) {
    const group = claims.filter((claim) => claim.predicate === predicate);
    const values = new Set(group.map((claim) => claim.normalized_value));
    if (values.size < 2 || (!contradictionPredicates.has(predicate) && !predicate.startsWith('leadership_role:'))) continue;
    const claimIds = group.map((claim) => claim.id);
    const contradictionId = `contradiction_${digest(`${entityKey}\u0000${predicate}\u0000${claimIds.sort().join('|')}`)}`;
    contradictions.push({ id: contradictionId, entity_key: entityKey, predicate, claim_ids: claimIds, status: 'unresolved' });
    for (const claim of group) {
      claim.status = 'disputed';
      claim.contradicts = claimIds.filter((id) => id !== claim.id);
    }
  }

  const sourcedCount = claims.filter((claim) => claim.source_refs.length > 0).length;
  const officialCount = claims.filter((claim) => claim.source_authority === 'official').length;
  const coverage: ResearchAssessment['coverage'] = presentFieldCount >= 5 ? 'HIGH' : presentFieldCount >= 3 ? 'MEDIUM' : 'LOW';
  const evidenceStrength: ResearchAssessment['evidence_strength'] = officialCount >= 2 || sourcedCount >= 5
    ? 'STRONG'
    : sourcedCount >= 2
      ? 'MODERATE'
      : 'WEAK';
  const provenance: ResearchAssessment['provenance'] = claims.length > 0 && sourcedCount === claims.length
    ? (claims.every((claim) => claim.evidence_refs.length > 0) ? 'COMPLETE' : 'TRACEABLE')
    : sourcedCount > 0
      ? 'TRACEABLE'
      : 'PARTIAL';

  return {
    claims,
    contradictions,
    assessment: {
      coverage,
      evidence_strength: evidenceStrength,
      provenance,
      unresolved_contradictions: contradictions.length,
      basis: 'Deterministic field coverage and source-grounding categories; not a calibrated probability.',
    },
  };
}
