import { getDb } from './sqlite';

export interface ResearchLedgerAction {
  research_id: string;
  iteration: number;
  action_type: string;
  target_type?: string;
  provider?: string;
  query?: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  information_gain: number;
  latency_ms: number;
  error?: string;
}

let initialized = false;

function cleanError(value: unknown): string {
  return String((value as any)?.message || value || '')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:nvapi|gsk|AIza)[-_A-Za-z0-9]+\b/g, '[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

async function ensureTables(): Promise<void> {
  if (initialized) return;
  const db = await getDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS research_ledger_runs (
      research_id TEXT PRIMARY KEY,
      company TEXT NOT NULL,
      country TEXT NOT NULL,
      objective TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      iterations INTEGER NOT NULL DEFAULT 0,
      evidence_count INTEGER NOT NULL DEFAULT 0,
      pages_retrieved INTEGER NOT NULL DEFAULT 0,
      summary_json TEXT
    );
    CREATE TABLE IF NOT EXISTS research_ledger_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      research_id TEXT NOT NULL,
      iteration INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      target_type TEXT,
      provider TEXT,
      query TEXT,
      status TEXT NOT NULL,
      information_gain INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_research_ledger_actions_run
      ON research_ledger_actions(research_id, iteration);
  `);
  initialized = true;
}

export class ResearchLedger {
  static async start(input: { research_id: string; company: string; country: string; objective: string; started_at: string }): Promise<void> {
    try {
      await ensureTables();
      const db = await getDb();
      await db.run(
        `INSERT OR IGNORE INTO research_ledger_runs
         (research_id, company, country, objective, status, started_at)
         VALUES (?, ?, ?, ?, 'RUNNING', ?)`,
        [input.research_id, input.company, input.country, input.objective, input.started_at],
      );
    } catch (error) {
      console.warn(`[ResearchLedger] start failed: ${cleanError(error)}`);
    }
  }

  static async action(input: ResearchLedgerAction): Promise<void> {
    try {
      await ensureTables();
      const db = await getDb();
      await db.run(
        `INSERT INTO research_ledger_actions
         (research_id, iteration, action_type, target_type, provider, query, status, information_gain, latency_ms, error, at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.research_id, input.iteration, input.action_type, input.target_type || null, input.provider || null,
          input.query || null, input.status, Math.max(0, input.information_gain), Math.max(0, input.latency_ms),
          input.error ? cleanError(input.error) : null, new Date().toISOString()],
      );
    } catch (error) {
      console.warn(`[ResearchLedger] action failed: ${cleanError(error)}`);
    }
  }

  static async complete(input: {
    research_id: string;
    status: 'COMPLETED' | 'FAILED';
    iterations: number;
    evidence_count: number;
    pages_retrieved: number;
    summary?: unknown;
  }): Promise<void> {
    try {
      await ensureTables();
      const db = await getDb();
      await db.run(
        `UPDATE research_ledger_runs SET status = ?, completed_at = ?, iterations = ?,
         evidence_count = ?, pages_retrieved = ?, summary_json = ? WHERE research_id = ?`,
        [input.status, new Date().toISOString(), input.iterations, input.evidence_count, input.pages_retrieved,
          input.summary === undefined ? null : JSON.stringify(input.summary), input.research_id],
      );
    } catch (error) {
      console.warn(`[ResearchLedger] completion failed: ${cleanError(error)}`);
    }
  }
}
