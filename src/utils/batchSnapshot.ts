import { projectV1ProviderUsage, type V1ProviderUsage } from '../../shared/provider_telemetry';
export type BatchUsage = V1ProviderUsage;
export const observedBatchUsage = projectV1ProviderUsage;

export interface CompanyResearchState {
  id: string; name: string; status: 'pending' | 'processing' | 'completed' | 'failed'; stage: string;
  error?: string; durationMs?: number; resourceUsage: BatchUsage;
  metrics?: { emailsFound: number; phonesFound: number; socialsFound: number; leadershipFound: boolean; websiteFound: boolean };
}
export interface ResearchJob {
  id: string;
  status: 'PENDING' | 'DISCOVERING' | 'CRAWLING' | 'EXTRACTING' | 'VERIFYING' | 'COMPLETED' | 'FAILED' | 'PAUSED' | 'RESOURCE_LIMITED' | 'STOPPED';
  importer_exporter_mode: 'importer' | 'exporter'; total_companies: number; completed_companies: number;
  current_company: string; current_stage: string; company_ids: string[];
  company_states: Record<string, CompanyResearchState>; resource_usage: BatchUsage; error_message?: string;
}

/** Accept both the bounded active-job summary and complete job response. */
export function normalizeBatchJobSnapshot(value: unknown): ResearchJob | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const job = value as Record<string, any>;
  if (typeof job.id !== 'string' || !job.id || !['PENDING','DISCOVERING','CRAWLING','EXTRACTING','VERIFYING','COMPLETED','FAILED','PAUSED','RESOURCE_LIMITED','STOPPED'].includes(job.status)
    || !['importer','exporter'].includes(job.importer_exporter_mode)
    || ![job.total_companies, job.completed_companies].every(count => Number.isSafeInteger(count) && count >= 0)) return null;
  const states = job.company_states && typeof job.company_states === 'object' && !Array.isArray(job.company_states) ? job.company_states : {};
  const company_states = Object.fromEntries(Object.entries(states).flatMap(([id, input]) => {
    const state = input as any;
    if (!state || typeof state !== 'object' || typeof state.name !== 'string' || !['pending','processing','completed','failed'].includes(state.status)) return [];
    return [[id, { ...state, id: typeof state.id === 'string' ? state.id : id, stage: typeof state.stage === 'string' ? state.stage : '', resourceUsage: observedBatchUsage(state.resourceUsage) }]];
  }));
  return {
    id: job.id, status: job.status, importer_exporter_mode: job.importer_exporter_mode,
    total_companies: job.total_companies, completed_companies: job.completed_companies,
    current_company: typeof job.current_company === 'string' ? job.current_company : '',
    current_stage: typeof job.current_stage === 'string' ? job.current_stage : '',
    company_ids: Array.isArray(job.company_ids) ? job.company_ids.filter((id: unknown) => typeof id === 'string') : [],
    company_states, resource_usage: observedBatchUsage(job.resource_usage),
    ...(typeof job.error_message === 'string' ? { error_message: job.error_message } : {}),
  };
}
