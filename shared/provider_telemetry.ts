export const PROVIDER_DIAGNOSTIC_FRESHNESS_MS = 120_000;

export function hasRecentProviderObservation(timestamp: string | undefined, now = Date.now()): boolean {
  if (!timestamp) return false;
  const age = now - Date.parse(timestamp);
  return Number.isFinite(age) && age >= 0 && age <= PROVIDER_DIAGNOSTIC_FRESHNESS_MS;
}
export function isRecentProviderOperation(requestedAt: string | null | undefined, completedAt: string | null | undefined, configurationSince: number, now = Date.now()): boolean {
  const started = Date.parse(requestedAt || '');
  const completed = Date.parse(completedAt || '');
  return Number.isFinite(started) && Number.isFinite(configurationSince)
    && started > configurationSince && started <= completed
    && hasRecentProviderObservation(completedAt || undefined, now);
}
