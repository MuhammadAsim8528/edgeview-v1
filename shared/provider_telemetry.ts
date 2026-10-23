export const PROVIDER_DIAGNOSTIC_FRESHNESS_MS = 120_000;

export type V1ProviderUsage = Record<'serper' | 'hunter' | 'nvidia' | 'groq', number | null>;
/** Public projection only: historical internal counters remain unchanged. */
export function projectV1ProviderUsage(value: unknown): V1ProviderUsage {
  return Object.fromEntries(['serper', 'hunter', 'nvidia', 'groq'].map(key => {
    const count = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : null;
    return [key, typeof count === 'number' && Number.isFinite(count) && count >= 0 ? count : null];
  })) as V1ProviderUsage;
}

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
