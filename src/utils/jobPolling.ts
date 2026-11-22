import { normalizeBatchJobSnapshot, type CompanyResearchState, type ResearchJob } from './batchSnapshot';

export const TERMINAL_JOB_STATUSES = new Set([
  'COMPLETED',
  'FAILED',
  'STOPPED',
  'RESOURCE_LIMITED',
  'PAUSED',
  'AWAITING_AUTHORIZATION',
  'CANCELLED',
  'CANCELED',
]);
export const MAX_POLL_FAILURES = 5;
export const POLL_TIMEOUT_MS = 15_000;

export function isTerminalJobStatus(status: unknown): boolean {
  return typeof status === 'string' && TERMINAL_JOB_STATUSES.has(status.trim().toUpperCase());
}

export function recentJobStates(job: ResearchJob | null, recent: Array<Partial<CompanyResearchState> & { id?: string }> = []): Array<[string, CompanyResearchState]> {
  if (!job) return [];
  const byId = new Map(Object.entries(job.company_states));
  return recent.flatMap(state => {
    const id = typeof state.id === 'string' ? state.id : job.company_ids.find(companyId => byId.get(companyId)?.name === state.name);
    const prior = id ? byId.get(id) : undefined;
    return id && prior ? [[id, { ...prior, ...state, id }] as [string, CompanyResearchState]] : [];
  });
}

export function mergeJobProgress(previous: ResearchJob | null, progress: unknown): ResearchJob | null {
  if (!previous) return normalizeBatchJobSnapshot(progress);
  const update = normalizeBatchJobSnapshot(progress);
  if (!update || update.id !== previous.id) return previous;
  const input = progress as { recent_results?: Array<Partial<CompanyResearchState> & { id?: string }> };
  const states = Object.fromEntries(recentJobStates(previous, Array.isArray(input.recent_results) ? input.recent_results : [])) as Record<string, CompanyResearchState>;
  return normalizeBatchJobSnapshot({ ...previous, ...update, company_ids: previous.company_ids,
    company_states: { ...previous.company_states, ...(update.company_states || {}), ...states } }) || previous;
}

export function nextPollDelay(failures: number): number {
  return Math.min(30_000, 3000 * 2 ** Math.min(4, Math.max(0, failures)));
}
