export const PROVIDER_DIAGNOSTIC_FRESHNESS_MS = 120_000;

export function hasRecentProviderObservation(timestamp: string | undefined, now = Date.now()): boolean {
  if (!timestamp) return false;
  const age = now - Date.parse(timestamp);
  return Number.isFinite(age) && age >= 0 && age <= PROVIDER_DIAGNOSTIC_FRESHNESS_MS;
}
