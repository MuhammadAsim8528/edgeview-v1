export type ImporterFailureCategory =
  | 'ENTITY_RESOLUTION' | 'QUERY_PLANNING' | 'SOURCE_DISCOVERY' | 'SOURCE_RETRIEVAL'
  | 'SOURCE_ADMISSION' | 'FACT_EXTRACTION' | 'FACT_VALIDATION' | 'FUSION'
  | 'STALE_CACHE' | 'RESEARCH_STOPPED_TOO_EARLY' | 'PROVIDER_ALLOCATION'
  | 'NO_PUBLIC_EVIDENCE' | 'UI_PROJECTION' | 'NONE';

export interface ImporterBenchmarkObservation {
  entity: 'correct' | 'wrong' | 'ambiguous';
  discoveredUrls?: number;
  retrievedPages?: number;
  admittedSources?: number;
  extractedFacts?: number;
  validatedFacts?: number;
  persistedFacts?: number;
  projectedFacts?: number;
  zeroGainStopped?: boolean;
  complementaryProviderAttempted?: boolean;
  staleCacheObserved?: boolean;
  publicEvidenceKnown?: boolean;
}

/** Deterministic loss-boundary taxonomy for benchmark feedback, not a confidence model. */
export function classifyBenchmarkFailure(row: ImporterBenchmarkObservation): ImporterFailureCategory {
  if (row.entity === 'wrong') return 'ENTITY_RESOLUTION';
  if (row.staleCacheObserved) return 'STALE_CACHE';
  if (row.entity === 'ambiguous' && !row.discoveredUrls) return row.complementaryProviderAttempted ? 'NO_PUBLIC_EVIDENCE' : 'SOURCE_DISCOVERY';
  if ((row.discoveredUrls || 0) > 0 && !row.retrievedPages) return 'SOURCE_RETRIEVAL';
  if ((row.retrievedPages || 0) > 0 && !row.admittedSources) return 'SOURCE_ADMISSION';
  if ((row.admittedSources || 0) > 0 && !row.extractedFacts) return 'FACT_EXTRACTION';
  if ((row.extractedFacts || 0) > 0 && !row.validatedFacts) return 'FACT_VALIDATION';
  if ((row.validatedFacts || 0) > (row.persistedFacts || 0)) return 'FUSION';
  if ((row.persistedFacts || 0) > (row.projectedFacts || 0)) return 'UI_PROJECTION';
  if (row.zeroGainStopped && !row.complementaryProviderAttempted && row.entity === 'ambiguous') return 'RESEARCH_STOPPED_TOO_EARLY';
  if (row.entity === 'ambiguous' && row.publicEvidenceKnown === false) return 'NO_PUBLIC_EVIDENCE';
  return 'NONE';
}
