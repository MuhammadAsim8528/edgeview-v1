const record = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const strings = (value: Record<string, any>, names: string[]) => names.every(name => typeof value[name] === 'string');
const optionalStrings = (value: Record<string, any>, names: string[]) => names.every(name => value[name] === undefined || typeof value[name] === 'string');

/** Validate display inputs without mutating/truncating immutable provider data. */
export function validResearchRun(value: unknown, expectedId: string): boolean {
  if (!record(value) || value.id !== expectedId || !strings(value, ['id','company_name','country','status','started_at'])) return false;
  if (!Array.isArray(value.queries) || !value.queries.every(item => typeof item === 'string')) return false;
  if (!Array.isArray(value.results) || !value.results.every(item => record(item)
    && strings(item, ['id','raw_record_id','query','provider','title','url','snippet','status'])
    && optionalStrings(item, ['text','markdown','html','error'])
    && Array.isArray(item.links) && item.links.every(link => typeof link === 'string'))) return false;
  if (!Array.isArray(value.raw_records) || !value.raw_records.every(item => record(item) && strings(item, ['id','kind','provider','sha256']))) return false;
  if (!Array.isArray(value.timeline) || !value.timeline.every(item => record(item)
    && strings(item, ['at','stage','status','message']) && optionalStrings(item, ['query','provider','error']))) return false;
  return true;
}

export function validResearchSummaries(value: unknown): boolean {
  return Array.isArray(value) && value.every(item => record(item) && strings(item, ['id','company_name','country','status','started_at']));
}

/** A bounded recent index is not authoritative proof that older runs vanished. */
export function chooseResearchRunId(current: string, saved: string, recent: Array<{ id: string }>): string {
  return current || saved || recent[0]?.id || '';
}
