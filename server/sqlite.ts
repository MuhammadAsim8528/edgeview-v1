import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { getSqlitePath, isTestProcess } from './db_paths';
import { pruneMigrationBackups } from './migration_backup_retention';

export interface DatabaseWrapper {
  exec(sql: string): Promise<void>;
  get(sql: string, params?: any[]): Promise<any>;
  all(sql: string, params?: any[]): Promise<any[]>;
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;
  flush(): Promise<void>;
  prepare(sql: string): Promise<{
    run: (...params: any[]) => Promise<void>;
    finalize: () => Promise<void>;
    free: () => void;
  }>;
}

let dbInstance: DatabaseWrapper | null = null;
let initPromise: Promise<DatabaseWrapper> | null = null;
let operationalStatus: 'unknown' | 'initializing' | 'ok' | 'degraded' = 'unknown';
export function getOperationalDatabaseStatus() {
  return { status: operationalStatus, code: operationalStatus === 'degraded' ? 'DATABASE_UNAVAILABLE' : null };
}
/** Do not initialize/create a database merely because the process is closing. */
export async function flushInitializedDatabase(): Promise<void> {
  if (initPromise) await initPromise;
  if (dbInstance) await dbInstance.flush();
}
const CURRENT_SCHEMA_VERSION = 2;

/** Re-open the isolated on-disk database for persistence regression tests. */
export function resetDbInstanceForTests(): void {
  if (!isTestProcess()) throw new Error('resetDbInstanceForTests is test-only');
  dbInstance = null;
  initPromise = null;
  operationalStatus = 'unknown';
}

export async function getDb(): Promise<DatabaseWrapper> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  operationalStatus = 'initializing';
  initPromise = (async () => {
    const DB_PATH = getSqlitePath();
    const SQL = await initSqlJs();
    let db: SqlJsDatabase;

    if (fs.existsSync(DB_PATH)) {
      try {
        const fileBuffer = fs.readFileSync(DB_PATH);
        if (!fileBuffer.length) throw new Error('Existing operational database is empty');
        db = new SQL.Database(fileBuffer);
        const integrity = db.exec('PRAGMA integrity_check;');
        const integrityResult = String(integrity?.[0]?.values?.[0]?.[0] || '').toLowerCase();
        if (integrityResult !== 'ok') throw new Error(`SQLite integrity check failed: ${integrityResult || 'no result'}`);
      } catch (err) {
        throw Object.assign(new Error('DATABASE_UNAVAILABLE: Existing operational database is invalid or unreadable. Original file retained; restore a verified backup and restart.', { cause: err }), { code: 'DATABASE_UNAVAILABLE' });
      }
    } else {
      db = new SQL.Database();
    }

    let saveTimer: NodeJS.Timeout | null = null;
    let initializing = true;
    let pendingPersistenceError: Error | null = null;
    const persistenceError = (err: unknown) => {
      const rawCode = String((err as any)?.code || '').toUpperCase();
      const error = new Error(rawCode === 'ENOSPC' || rawCode === 'EDQUOT'
        ? 'DISK_FULL: EdgeView could not persist the operational database because storage is full.'
        : 'PERSISTENCE_WRITE_FAILED: EdgeView could not persist the operational database.');
      (error as any).code = rawCode === 'ENOSPC' || rawCode === 'EDQUOT' ? 'DISK_FULL' : 'PERSISTENCE_WRITE_FAILED';
      (error as any).cause = err;
      return error;
    };
    const saveToDisk = () => {
      // sql.js schema changes stay private in memory until every initialization
      // step succeeds. Failed migration cannot publish a partial disk image.
      if (initializing) return;
      const tempPath = `${DB_PATH}.${process.pid}.${Date.now()}.tmp`;
      let handle: number | undefined;
      try {
        const data = db.export();
        const buffer = Buffer.from(data);
        handle = fs.openSync(tempPath, 'wx');
        fs.writeFileSync(handle, buffer);
        fs.fsyncSync(handle);
        fs.closeSync(handle);
        handle = undefined;
        fs.renameSync(tempPath, DB_PATH);
        pendingPersistenceError = null;
        operationalStatus = 'ok';
      } catch (err) {
        if (handle !== undefined) {
          try { fs.closeSync(handle); } catch { /* best-effort cleanup */ }
        }
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch { /* best-effort cleanup */ }
        pendingPersistenceError = persistenceError(err);
        operationalStatus = 'degraded';
        console.error('Failed to persist SQLite db to disk:', err);
        throw pendingPersistenceError;
      }
    };

    // Prepared bulk inserts coalesce intermediate writes, but finalize() is a
    // mandatory durable barrier. Errors are retained so finalize cannot report
    // success after a background persistence failure.
    const debouncedSaveToDisk = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveTimer = null;
        try { saveToDisk(); } catch { /* surfaced by finalize or next mutation */ }
      }, 300);
    };
    const flushPendingSave = () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      // Retry a previously failed persistence attempt here. If storage was
      // repaired (for example, disk space was freed), the same process can
      // recover without a restart; otherwise saveToDisk throws again.
      saveToDisk();
    };

    const wrapper: DatabaseWrapper = {
      async exec(sql: string) {
        try {
          db.exec(sql);
        } catch (e) {
          // Fallback to run if exec fails
          db.run(sql);
        }
        saveToDisk();
      },

      async get(sql: string, params: any[] = []) {
        const stmt = db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        let result: any = undefined;
        if (stmt.step()) {
          result = stmt.getAsObject();
        }
        stmt.free();
        return result;
      },

      async all(sql: string, params: any[] = []) {
        const stmt = db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        const results: any[] = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      },

      async run(sql: string, params: any[] = []) {
        if (pendingPersistenceError) saveToDisk();
        db.run(sql, params);
        debouncedSaveToDisk();
        return { changes: db.getRowsModified() };
      },

      async flush() {
        flushPendingSave();
      },

      async prepare(sql: string) {
        const stmt = db.prepare(sql);
        return {
          async run(...params: any[]) {
            const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
            stmt.run(bindParams);
            debouncedSaveToDisk();
          },
          async finalize() {
            try {
              stmt.free();
            } catch (e) {
              // ignore if already freed
            }
            flushPendingSave();
          },
          free() {
            try {
              stmt.free();
            } catch (e) {
              // ignore if already freed
            }
            flushPendingSave();
          }
        };
      }
    };

    const versionResult = db.exec('PRAGMA user_version;');
    const existingSchemaVersion = Number(versionResult?.[0]?.values?.[0]?.[0] || 0);
    if (existingSchemaVersion > CURRENT_SCHEMA_VERSION) {
      throw new Error(`Database schema ${existingSchemaVersion} is newer than this EdgeView build (${CURRENT_SCHEMA_VERSION}). Refusing an unsafe downgrade.`);
    }
    let migrationBackup: string | undefined;
    if (existingSchemaVersion < CURRENT_SCHEMA_VERSION && fs.existsSync(DB_PATH)) {
      migrationBackup = `${DB_PATH}.pre-migration-v${existingSchemaVersion}-${Date.now()}.bak`;
      fs.copyFileSync(DB_PATH, migrationBackup, fs.constants.COPYFILE_EXCL);
      console.log(`Created pre-migration database backup: ${migrationBackup}`);
    }

    // Run idempotent migrations. Advance the version only after success.
    await wrapper.exec(`
      CREATE TABLE IF NOT EXISTS history_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          be_link TEXT,
          be_date TEXT,
          hs_code TEXT,
          item TEXT,
          importer TEXT,
          exporter TEXT,
          country TEXT,
          tot_fc REAL,
          qty REAL,
          unit TEXT,
          agent_name TEXT,
          file_name TEXT,
          source TEXT DEFAULT 'real',
          uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS contact_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_name TEXT UNIQUE,
          address TEXT,
          phone TEXT,
          email TEXT,
          linkedin TEXT,
          industry TEXT,
          website TEXT,
          details_json TEXT,
          fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          source TEXT DEFAULT 'api'
      );

      CREATE TABLE IF NOT EXISTS search_query_cache (
          query TEXT PRIMARY KEY,
          response TEXT,
          cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS scraped_url_cache (
          url TEXT PRIMARY KEY,
          content TEXT,
          cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
      );

      CREATE TABLE IF NOT EXISTS research_jobs (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          importer_exporter_mode TEXT,
          total_companies INTEGER,
          completed_companies INTEGER,
          current_company TEXT,
          current_stage TEXT,
          company_ids TEXT,
          company_states TEXT,
          resource_usage TEXT,
          error_message TEXT,
          is_pilot INTEGER DEFAULT 0,
          pilot_authorized INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS v1_contact_enrichment (
          company_id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          overlay_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS research_campaigns (
          id TEXT PRIMARY KEY,
          request_key TEXT NOT NULL,
          entity_key TEXT NOT NULL,
          company TEXT NOT NULL,
          country TEXT NOT NULL DEFAULT '',
          force_fetch INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 0,
          objective TEXT NOT NULL,
          context_json TEXT NOT NULL,
          budget_json TEXT NOT NULL,
          result_json TEXT,
          error_message TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_research_campaigns_request_status
        ON research_campaigns(request_key, status);
      CREATE TABLE IF NOT EXISTS research_campaign_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          actor TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(campaign_id, version)
      );
      CREATE INDEX IF NOT EXISTS idx_research_campaign_events_campaign
        ON research_campaign_events(campaign_id, version);
      CREATE TABLE IF NOT EXISTS research_campaign_tasks (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL,
          objective TEXT NOT NULL,
          capability TEXT NOT NULL,
          query_text TEXT,
          target_country TEXT NOT NULL DEFAULT '',
          hypothesis TEXT NOT NULL DEFAULT '',
          desired_source_types_json TEXT NOT NULL DEFAULT '[]',
          preferred_providers_json TEXT NOT NULL DEFAULT '[]',
          arguments_json TEXT NOT NULL DEFAULT '{}',
          priority INTEGER NOT NULL DEFAULT 50,
          reason TEXT NOT NULL DEFAULT '',
          origin_agent TEXT NOT NULL,
          reviewer_agent TEXT,
          review_status TEXT NOT NULL DEFAULT 'PENDING',
          status TEXT NOT NULL DEFAULT 'PENDING',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_research_campaign_tasks_campaign
        ON research_campaign_tasks(campaign_id, created_at);
      CREATE TABLE IF NOT EXISTS research_campaign_sources (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL,
          canonical_url TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          source_type TEXT NOT NULL DEFAULT 'web',
          authority TEXT NOT NULL DEFAULT 'unknown',
          entity_match TEXT NOT NULL DEFAULT 'unknown',
          country_match TEXT NOT NULL DEFAULT 'unknown',
          fetch_status TEXT NOT NULL DEFAULT 'DISCOVERED',
          discovered_by_json TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(campaign_id, canonical_url)
      );
      CREATE TABLE IF NOT EXISTS research_campaign_claims (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL,
          predicate TEXT NOT NULL,
          value_json TEXT NOT NULL,
          source_ids_json TEXT NOT NULL DEFAULT '[]',
          observation_ids_json TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'CANDIDATE',
          proposed_by TEXT NOT NULL,
          challenged_by TEXT,
          challenge_reason TEXT,
          entity_key TEXT NOT NULL DEFAULT '',
          country_attribution TEXT NOT NULL DEFAULT '',
          fact_ownership TEXT NOT NULL DEFAULT '',
          source_authority TEXT NOT NULL DEFAULT '',
          validation_result TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_research_campaign_claims_campaign
        ON research_campaign_claims(campaign_id, created_at);
      CREATE TABLE IF NOT EXISTS research_campaign_observations (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL,
          source_id TEXT NOT NULL,
          fetch_method TEXT NOT NULL,
          fetch_provider TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          content_ref TEXT,
          normalized_content TEXT,
          country_entity_context TEXT,
          retrieval_metadata_json TEXT NOT NULL DEFAULT '{}',
          status TEXT NOT NULL DEFAULT 'FETCHED'
      );
      CREATE INDEX IF NOT EXISTS idx_research_campaign_observations_campaign
        ON research_campaign_observations(campaign_id, source_id);
      CREATE TABLE IF NOT EXISTS research_campaign_candidate_facts (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL,
          observation_id TEXT NOT NULL,
          field_type TEXT NOT NULL,
          raw_value TEXT NOT NULL,
          normalized_value TEXT,
          validator TEXT NOT NULL,
          validation_result TEXT NOT NULL,
          confidence REAL NOT NULL DEFAULT 0.5,
          proposed_by TEXT NOT NULL,
          created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_research_campaign_candidate_facts_campaign
        ON research_campaign_candidate_facts(campaign_id, created_at);
    `);

    const hasColumn = (table: string, column: string) => db.exec(`PRAGMA table_info(${table});`)[0]?.values.some(row => row[1] === column);
    if (!hasColumn('history_data', 'file_id')) {
      await wrapper.exec('ALTER TABLE history_data ADD COLUMN file_id TEXT;');
    }
    await wrapper.exec('CREATE INDEX IF NOT EXISTS idx_history_file_id ON history_data(file_id);');
    if (!hasColumn('contact_cache', 'details_json')) {
      await wrapper.exec(`ALTER TABLE contact_cache ADD COLUMN details_json TEXT;`);
    }

    if (!hasColumn('research_jobs', 'is_pilot')) {
      await wrapper.exec(`ALTER TABLE research_jobs ADD COLUMN is_pilot INTEGER DEFAULT 0;`);
    }

    if (!hasColumn('research_jobs', 'pilot_authorized')) {
      await wrapper.exec(`ALTER TABLE research_jobs ADD COLUMN pilot_authorized INTEGER DEFAULT 0;`);
    }

    if (existingSchemaVersion < CURRENT_SCHEMA_VERSION) {
      await wrapper.exec(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION};`);
    }

    initializing = false;
    saveToDisk();
    if (migrationBackup) {
      // A successful write alone is insufficient authority to delete recovery.
      const reopened = new SQL.Database(fs.readFileSync(DB_PATH));
      try {
        if (reopened.exec('PRAGMA integrity_check;')[0]?.values?.[0]?.[0] !== 'ok'
          || Number(reopened.exec('PRAGMA user_version;')[0]?.values?.[0]?.[0]) !== CURRENT_SCHEMA_VERSION) {
          throw new Error('Migrated database failed on-disk acceptance; recovery backups retained.');
        }
      } finally { reopened.close(); }
      const retention = pruneMigrationBackups(DB_PATH, migrationBackup);
      if (retention.errors || retention.skipped) console.warn('Migration backup retention incomplete', retention);
    }
    dbInstance = wrapper;
    return wrapper;
  })().catch(error => { operationalStatus = 'degraded'; throw error; });

  return initPromise;
}
