export function formatObservedRate(successes: number | null | undefined, completed: number | null | undefined): string {
  if (typeof successes !== 'number' || typeof completed !== 'number' || !Number.isFinite(successes) || !Number.isFinite(completed) || completed <= 0 || successes < 0 || successes > completed) return 'Unknown';
  return `${Math.round(successes / completed * 100)}%`;
}
export function formatObservedCount(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : 'Unknown';
}

export function formatObservedLatency(milliseconds: number | null | undefined): string {
  return typeof milliseconds === 'number' && Number.isFinite(milliseconds) && milliseconds >= 0
    ? `${milliseconds} ms` : 'Unknown';
}
