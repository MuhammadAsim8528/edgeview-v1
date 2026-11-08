import { createHash } from 'node:crypto';
import initSqlJs, { type Database } from 'sql.js';
import { decodePersistenceRecords } from './sqlite_persistence';
import { planHistoryReconciliation } from './history_reconciliation';
import { HISTORY_VALUE_COLUMNS, historyInsertValues } from './history_row_projection';

const MAX_BYTES = 64 * 1024 * 1024;
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function records(db: Database, sql: string, args: string[] = []): Record<string, unknown>[] {
  const statement = db.prepare(sql);
  try {
    statement.bind(args);
    const result: Record<string, unknown>[] = [];
    while (statement.step()) {
      if (result.length >= 50001) throw new Error('LIMIT_EXCEEDED');
      result.push(statement.getAsObject());
    }
    return result;
  } finally { statement.free(); }
}
const key = (values: unknown[]) => JSON.stringify(values.map((value, index) =>
  value === null ? null : index === 7 || index === 8 ? Number(value)
    : typeof value === 'boolean' ? String(Number(value)) : String(value)));

/** Offline bytes only. No paths, writes, live connections or apply authorization.
 * Keep both input preimages for a separately verified maintenance transaction.
 * Hashes are private recovery metadata and must never enter remote telemetry. */
export async function buildHistoryRepairCandidate(primary: Uint8Array, original: Uint8Array, name: string) {
  let db: Database | undefined;
  try {
    if (!(primary instanceof Uint8Array) || !(original instanceof Uint8Array)
      || !primary.length || !original.length || primary.length > MAX_BYTES || original.length > MAX_BYTES) {
      throw new Error('INVALID_INPUT');
    }
    // Capture both generations before the first await; callers may reuse buffers.
    primary = Uint8Array.from(primary); original = Uint8Array.from(original);
    const files = decodePersistenceRecords(primary, false);
    const SQL = await initSqlJs();
    db = new SQL.Database(original);
    if (db.exec('PRAGMA integrity_check')[0]?.values[0]?.[0] !== 'ok'
      || ![2, 3].includes(Number(db.exec('PRAGMA user_version')[0]?.values[0]?.[0]))) throw new Error('UNSUPPORTED_DATABASE');
    // Refuse nonstandard dependencies rather than silently changing related state.
    if (records(db, "SELECT name FROM sqlite_master WHERE type='trigger'").length) throw new Error('UNSUPPORTED_DATABASE');
    if (records(db, 'PRAGMA foreign_key_list(history_data)').length) throw new Error('UNSUPPORTED_DATABASE');
    for (const table of records(db, "SELECT name FROM sqlite_master WHERE type='table'")) {
      const quoted = String(table.name).replace(/"/g, '""');
      if (records(db, `PRAGMA foreign_key_list("${quoted}")`).some(row => row.table === 'history_data')) {
        throw new Error('UNSUPPORTED_DATABASE');
      }
    }
    const rows = records(db, 'SELECT * FROM history_data WHERE file_name=? ORDER BY id LIMIT 50001', [name]);
    const plan = planHistoryReconciliation(name, files, rows);
    if (plan.status === 'BLOCKED') return { status: 'BLOCKED' as const, code: plan.code, appliesChanges: false };
    const binding = { primarySha256: digest(primary), databaseSha256: digest(original) };
    if (plan.status === 'CURRENT') return { status: 'CURRENT' as const, ...binding, appliesChanges: false };
    const owned = new Map<string, number>();
    for (const row of rows.filter(row => row.file_id !== null && row.file_id !== '')) {
      const signature = key([...HISTORY_VALUE_COLUMNS.map(column => row[column]), row.source]);
      owned.set(signature, (owned.get(signature) || 0) + 1);
    }
    db.run('BEGIN');
    db.run("DELETE FROM history_data WHERE file_name=? AND (file_id IS NULL OR file_id='')", [name]);
    const insert = db.prepare(`INSERT INTO history_data (${HISTORY_VALUE_COLUMNS.join(',')},source) VALUES (${Array(14).fill('?').join(',')})`);
    let insertedRows = 0;
    try {
      for (const file of files.filter(file => file.file_name === name)) {
        for (const row of file.file_data.rows) {
          const values = [...historyInsertValues(row, name, file.id), file.source];
          const signature = key(values), count = owned.get(signature) || 0;
          if (count) { owned.set(signature, count - 1); continue; }
          insert.run(values as (string | number | null)[]); insertedRows++;
        }
      }
    } finally { insert.free(); }
    db.run('COMMIT');
    const candidate = db.export();
    if (candidate.length > MAX_BYTES) throw new Error('LIMIT_EXCEEDED');
    const reopened = new SQL.Database(candidate);
    try {
      if (reopened.exec('PRAGMA integrity_check')[0]?.values[0]?.[0] !== 'ok'
        || planHistoryReconciliation(name, files,
          records(reopened, 'SELECT * FROM history_data WHERE file_name=? ORDER BY id LIMIT 50001', [name])).status !== 'CURRENT') {
        throw new Error('CANDIDATE_INVALID');
      }
    } finally { reopened.close(); }
    return { status: 'CANDIDATE_ONLY' as const, ...binding, candidateSha256: digest(candidate),
      candidate, insertedRows, removedLegacyRows: plan.legacyRows, appliesChanges: false };
  } catch {
    // Never return SQL, customer row values, decoder causes or filesystem paths.
    return { status: 'BLOCKED' as const, code: 'CANDIDATE_REFUSED', appliesChanges: false };
  } finally { db?.close(); }
}
