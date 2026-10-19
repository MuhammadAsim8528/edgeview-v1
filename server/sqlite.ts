import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { getSqlitePath, isTestProcess } from './db_paths';

export interface DatabaseWrapper {
  exec(sql: string): Promise<void>;
  get(sql: string, params?: any[]): Promise<any>;
  all(sql: string, params?: any[]): Promise<any[]>;
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;
  prepare(sql: string): Promise<{
    run: (...params: any[]) => Promise<void>;
    finalize: () => Promise<void>;
    free: () => void;
  }>;
}

let dbInstance: DatabaseWrapper | null = null;
let initPromise: Promise<DatabaseWrapper> | null = null;
const CURRENT_SCHEMA_VERSION = 1;

/** Re-open the isolated on-disk database for persistence regression tests. */
export function resetDbInstanceForTests(): void {
  if (!isTestProcess()) throw new Error('resetDbInstanceForTests is test-only');
  dbInstance = null;
  initPromise = null;
}

export async function getDb(): Promise<DatabaseWrapper> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const DB_PATH = getSqlitePath();
    const SQL = await initSqlJs();
    let db: SqlJsDatabase;

    if (fs.existsSync(DB_PATH)) {
      try {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
        const integrity = db.exec('PRAGMA integrity_check;');
        const integrityResult = String(integrity?.[0]?.values?.[0]?.[0] || '').toLowerCase();
        if (integrityResult !== 'ok') throw new Error(`SQLite integrity check failed: ${integrityResult || 'no result'}`);
      } catch (err) {
        console.error('Failed to load existing SQLite db (corrupted or invalid). Creating backup and initializing in-memory fallback:', err);
        try {
          if (fs.existsSync(DB_PATH)) {
            const backupPath = `${DB_PATH}.corrupt.${Date.now()}`;
            fs.renameSync(DB_PATH, backupPath);
            console.warn(`Original corrupted database safely backed up to ${backupPath}`);
          }
        } catch (backupErr) {
          console.error('Failed to create backup of corrupted database file:', backupErr);
        }
        db = new SQL.Database();
      }
    } else {
      db = new SQL.Database();
    }

    let saveTimer: NodeJS.Timeout | null = null;
    const saveToDisk = () => {
      try {
        const data = db.export();
        const buffer = Buffer.from(data);
        const tempPath = `${DB_PATH}.tmp`;
        fs.writeFileSync(tempPath, buffer);
        fs.renameSync(tempPath, DB_PATH);
      } catch (err) {
        console.error('Failed to persist SQLite db to disk:', err);
      }
    };

    const debouncedSaveToDisk = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveToDisk();
      }, 300);
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
        db.run(sql, params);
        debouncedSaveToDisk();
        return { changes: db.getRowsModified() };
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
            saveToDisk();
          },
          free() {
            try {
              stmt.free();
            } catch (e) {
              // ignore if already freed
            }
            saveToDisk();
          }
        };
      }
    };

    const versionResult = db.exec('PRAGMA user_version;');
    const existingSchemaVersion = Number(versionResult?.[0]?.values?.[0]?.[0] || 0);
    if (existingSchemaVersion > CURRENT_SCHEMA_VERSION) {
      throw new Error(`Database schema ${existingSchemaVersion} is newer than this EdgeView build (${CURRENT_SCHEMA_VERSION}). Refusing an unsafe downgrade.`);
    }
    if (existingSchemaVersion < CURRENT_SCHEMA_VERSION && fs.existsSync(DB_PATH)) {
      const migrationBackup = `${DB_PATH}.pre-migration-v${existingSchemaVersion}-${Date.now()}.bak`;
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

    try {
      await wrapper.exec(`ALTER TABLE contact_cache ADD COLUMN details_json TEXT;`);
    } catch (e) {
      // Column already exists, ignore error
    }

    try {
      await wrapper.exec(`ALTER TABLE research_jobs ADD COLUMN is_pilot INTEGER DEFAULT 0;`);
    } catch (e) {}

    try {
      await wrapper.exec(`ALTER TABLE research_jobs ADD COLUMN pilot_authorized INTEGER DEFAULT 0;`);
    } catch (e) {}

    if (existingSchemaVersion < CURRENT_SCHEMA_VERSION) {
      await wrapper.exec(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION};`);
    }

    dbInstance = wrapper;
    return wrapper;
  })();

  return initPromise;
}
