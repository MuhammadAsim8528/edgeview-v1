export function formatObservedRate(successes: number, completed: number): string {
  if (!Number.isFinite(successes) || !Number.isFinite(completed) || completed <= 0 || successes < 0 || successes > completed) return 'Unknown';
  return `${Math.round(successes / completed * 100)}%`;
}

export function formatObservedLatency(milliseconds: number | null | undefined): string {
  return typeof milliseconds === 'number' && Number.isFinite(milliseconds) && milliseconds >= 0
    ? `${milliseconds} ms` : 'Unknown';
}
