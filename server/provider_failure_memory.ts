import { createHash } from 'node:crypto';
import { getDb } from './sqlite';

export type ProviderFailureClass = 'TIMEOUT' | 'RATE_LIMIT' | 'HTTP_SERVER' | 'HTTP_CLIENT' | 'MODEL_UNAVAILABLE' | 'CONTEXT_SIZE' | 'SCHEMA_OR_RESPONSE' | 'CIRCUIT_OPEN' | 'CONFIGURATION' | 'OTHER';
export interface ProviderFailureRecord { provider: string; action: string; context_fingerprint: string; failure_class: ProviderFailureClass; reason: string; attempts: number; at: string; }

export function classifyProviderFailure(error: unknown): ProviderFailureClass {
  const message = String((error as any)?.message || error || '').toLowerCase();
  const status = Number((error as any)?.status || message.match(/\b([45]\d\d)\b/)?.[1] || 0);
  if (/timeout|aborted|aborterror/.test(message) || status === 408) return 'TIMEOUT';
  if (/rate.?limit|quota|resource_exhausted/.test(message) || status === 429) return 'RATE_LIMIT';
  if (/circuit_tripped/.test(message)) return 'CIRCUIT_OPEN';
  if (/missing .*key|disabled|not configured/.test(message)) return 'CONFIGURATION';
  if (/context|token.*limit|too large/.test(message)) return 'CONTEXT_SIZE';
  if (/model.*(?:unavailable|not found)|unsupported.*model/.test(message)) return 'MODEL_UNAVAILABLE';
  if (/json|schema|invalid response|empty response/.test(message)) return 'SCHEMA_OR_RESPONSE';
  if (status >= 500) return 'HTTP_SERVER';
  if (status >= 400) return 'HTTP_CLIENT';
  return 'OTHER';
}

export function failureContextFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

export function shouldSuppressEquivalentFailure(memory: ProviderFailureRecord[], provider: string, action: string, contextFingerprint: string): boolean {
  return memory.some((record) => record.provider === provider && record.action === action && record.context_fingerprint === contextFingerprint && record.attempts >= 1);
}

export function rememberProviderFailure(memory: ProviderFailureRecord[], provider: string, action: string, contextFingerprint: string, error: unknown): ProviderFailureRecord[] {
  const failureClass = classifyProviderFailure(error);
  const reason = String((error as any)?.message || error || 'unknown failure').slice(0, 300);
  const existing = memory.find((record) => record.provider === provider && record.action === action && record.context_fingerprint === contextFingerprint && record.failure_class === failureClass);
  if (existing) { existing.attempts++; existing.at = new Date().toISOString(); return memory; }
  memory.push({ provider, action, context_fingerprint: contextFingerprint, failure_class: failureClass, reason, attempts: 1, at: new Date().toISOString() });
  while (memory.length > 20) {
    memory.shift();
  }
  return memory;
}

function suppressionTtlMs(failureClass: ProviderFailureClass): number {
  switch (failureClass) {
    case 'CONFIGURATION':
    case 'MODEL_UNAVAILABLE': return 24 * 60 * 60 * 1000;
    case 'HTTP_CLIENT': return 60 * 60 * 1000;
    case 'CONTEXT_SIZE': return 30 * 60 * 1000;
    case 'SCHEMA_OR_RESPONSE': return 10 * 60 * 1000;
    case 'RATE_LIMIT':
    case 'HTTP_SERVER': return 5 * 60 * 1000;
    case 'TIMEOUT':
    case 'CIRCUIT_OPEN': return 2 * 60 * 1000;
    default: return 60 * 1000;
  }
}

function sanitizedReason(error: unknown): string {
  return String((error as any)?.message || error || 'unknown failure')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:nvapi|gsk|AIza)[-_A-Za-z0-9]+\b/g, '[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

let initialized = false;

async function ensurePersistentFailureTable(): Promise<void> {
  if (initialized) return;
  const db = await getDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS provider_failure_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      action TEXT NOT NULL,
      context_fingerprint TEXT NOT NULL,
      failure_class TEXT NOT NULL,
      reason TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 1,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      suppress_until TEXT NOT NULL,
      UNIQUE(provider, action, context_fingerprint, failure_class)
    );
    CREATE INDEX IF NOT EXISTS idx_provider_failure_suppression
      ON provider_failure_memory(provider, action, context_fingerprint, suppress_until);
  `);
  initialized = true;
}

export class PersistentProviderFailureMemory {
  static async shouldSuppress(provider: string, action: string, contextFingerprint: string): Promise<boolean> {
    await ensurePersistentFailureTable();
    const db = await getDb();
    const row = await db.get(
      `SELECT id FROM provider_failure_memory
       WHERE provider = ? AND action = ? AND context_fingerprint = ? AND suppress_until > ?
       LIMIT 1`,
      [provider, action, contextFingerprint, new Date().toISOString()],
    );
    return Boolean(row);
  }

  static async remember(provider: string, action: string, contextFingerprint: string, error: unknown): Promise<void> {
    await ensurePersistentFailureTable();
    const db = await getDb();
    const failureClass = classifyProviderFailure(error);
    const now = new Date();
    const suppressUntil = new Date(now.getTime() + suppressionTtlMs(failureClass)).toISOString();
    await db.run(
      `INSERT INTO provider_failure_memory
       (provider, action, context_fingerprint, failure_class, reason, attempts, first_seen, last_seen, suppress_until)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
       ON CONFLICT(provider, action, context_fingerprint, failure_class) DO UPDATE SET
         reason = excluded.reason,
         attempts = provider_failure_memory.attempts + 1,
         last_seen = excluded.last_seen,
         suppress_until = excluded.suppress_until`,
      [provider, action, contextFingerprint, failureClass, sanitizedReason(error), now.toISOString(), now.toISOString(), suppressUntil],
    );
    await db.run('DELETE FROM provider_failure_memory WHERE suppress_until < ?', [new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()]);
    await db.run(`DELETE FROM provider_failure_memory WHERE id NOT IN (
      SELECT id FROM provider_failure_memory ORDER BY last_seen DESC LIMIT 500
    )`);
  }

  static async clear(provider: string, action: string, contextFingerprint: string): Promise<void> {
    await ensurePersistentFailureTable();
    const db = await getDb();
    await db.run(
      'DELETE FROM provider_failure_memory WHERE provider = ? AND action = ? AND context_fingerprint = ?',
      [provider, action, contextFingerprint],
    );
  }

  static async list(limit = 100): Promise<ProviderFailureRecord[]> {
    await ensurePersistentFailureTable();
    const db = await getDb();
    const rows = await db.all(
      `SELECT provider, action, context_fingerprint, failure_class, reason, attempts, last_seen AS at
       FROM provider_failure_memory ORDER BY last_seen DESC LIMIT ?`,
      [Math.max(1, Math.min(500, limit))],
    );
    return rows as ProviderFailureRecord[];
  }
}
