export type TruthStatus = 'VERIFIED' | 'PARTIAL' | 'UNKNOWN';
export interface TruthFact { field: string; value?: string | number; status: TruthStatus; source_url?: string; source_authority?: string; note?: string; }
export interface TruthEntity { company: string; country: string; cohort: string; facts: TruthFact[]; }
export interface BenchmarkScore { verified_total: number; verified_recovered: number; verified_missed: number; recall: number | null; unknown_excluded: number; partial_excluded: number; false_positive_count: number; }

const norm = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const digits = (value: unknown) => String(value ?? '').replace(/\D/g, '');
const host = (value: unknown) => { try { return new URL(/^https?:/i.test(String(value)) ? String(value) : `https://${value}`).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
const flatten = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).flatMap(flatten);
  return value === undefined || value === null ? [] : [String(value)];
};

/** Scores only manually VERIFIED facts. PARTIAL and UNKNOWN are never silently treated as negatives. */
export function scoreTruthEntity(entity: TruthEntity, projection: Record<string, unknown>, falsePositiveValues: string[] = []): BenchmarkScore {
  const rawCorpus = flatten(projection).filter(Boolean);
  const corpus = rawCorpus.map(norm).filter(Boolean);
  const verified = entity.facts.filter((fact) => fact.status === 'VERIFIED' && fact.value !== undefined);
  const recovered = verified.filter((fact) => {
    const expected = norm(fact.value);
    const field = fact.field.toLowerCase();
    if (field === 'phone' || field === 'fax') {
      const wanted = digits(fact.value); return wanted.length >= 6 && rawCorpus.some((candidate) => digits(candidate) === wanted);
    }
    if (field === 'email') return rawCorpus.some((candidate) => String(candidate).trim().toLowerCase() === String(fact.value).trim().toLowerCase());
    if (field === 'website') { const wanted = host(fact.value); return Boolean(wanted && rawCorpus.some((candidate) => host(candidate) === wanted)); }
    if (field === 'address') {
      const wanted = new Set(expected.split(' ').filter((token) => token.length > 2));
      return corpus.some((candidate) => {
        const found = new Set(candidate.split(' ').filter((token) => token.length > 2));
        const overlap = [...wanted].filter((token) => found.has(token)).length;
        return overlap >= Math.min(4, wanted.size) && overlap / Math.max(1, Math.min(wanted.size, found.size)) >= 0.65;
      });
    }
    if ((field === 'leaders' || field === 'leadership') && typeof fact.value === 'number') {
      const people = (projection.contact_persons || projection.decision_makers) as unknown;
      return Array.isArray(people) && people.length >= fact.value;
    }
    return expected.length > 0 && corpus.some((candidate) => candidate === expected || candidate.includes(expected) || expected.includes(candidate));
  }).length;
  return {
    verified_total: verified.length,
    verified_recovered: recovered,
    verified_missed: verified.length - recovered,
    recall: verified.length ? Number((recovered / verified.length).toFixed(4)) : null,
    unknown_excluded: entity.facts.filter((fact) => fact.status === 'UNKNOWN').length,
    partial_excluded: entity.facts.filter((fact) => fact.status === 'PARTIAL').length,
    false_positive_count: falsePositiveValues.filter((value) => corpus.some((candidate) => candidate.includes(norm(value)))).length,
  };
}

export type LossBoundary = 'QUERY_NOT_GENERATED' | 'SEARCH_RESULT_NOT_RETRIEVED' | 'SOURCE_NOT_SHORTLISTED' | 'PAGE_FETCH_FAILED' | 'PARSER_MISSED' | 'NEIGHBORHOOD_OWNERSHIP_REJECTED' | 'ADMISSION_REJECTED' | 'MODEL_EXTRACTION_MISSED' | 'VALIDATION_REJECTED' | 'FUSION_DROPPED' | 'PERSISTENCE_DROPPED' | 'UI_PROJECTION_DROPPED' | 'UNTRACED';

export function firstLossBoundary(trace: Partial<Record<LossBoundary, boolean>>): LossBoundary {
  const order: LossBoundary[] = ['QUERY_NOT_GENERATED','SEARCH_RESULT_NOT_RETRIEVED','SOURCE_NOT_SHORTLISTED','PAGE_FETCH_FAILED','PARSER_MISSED','NEIGHBORHOOD_OWNERSHIP_REJECTED','ADMISSION_REJECTED','MODEL_EXTRACTION_MISSED','VALIDATION_REJECTED','FUSION_DROPPED','PERSISTENCE_DROPPED','UI_PROJECTION_DROPPED'];
  return order.find((stage) => trace[stage] === false) || 'UNTRACED';
}
