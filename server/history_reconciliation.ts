import { createHash } from 'node:crypto';
import { HISTORY_VALUE_COLUMNS, historyInsertValues } from './history_row_projection';
import type { UploadedFileRecord } from './sqlite_persistence';

const MAX_ROWS = 50000, MAX_BYTES = 32 * 1024 * 1024;
type Code = 'INVALID_INPUT' | 'LIMIT_EXCEEDED' | 'NO_PRIMARY_DATASET' | 'UNMATCHED_HISTORY_ROW' | 'EXCESS_HISTORY_ROWS' | 'OWNED_HISTORY_MISMATCH';
class Refusal extends Error { constructor(readonly code: Code) { super(code); } }

/** Internal non-mutating preflight only. Caller must bind actual durable source
 * bytes under exclusive maintenance and preserve the original DB before apply.
 * RECONCILABLE means a replacement index can be built FROM primary rows; it does
 * not attribute ambiguous historical row IDs, authorize writes or accept release.
 * The projection fingerprint is NOT a full JSON snapshot/version token.
 * Fingerprints are private support material, never monitoring properties. */
export function planHistoryReconciliation(name: string, files: UploadedFileRecord[], rows: Record<string, unknown>[],
  limits = { maxRows: MAX_ROWS, maxBytes: MAX_BYTES }) {
  try {
    if (!name || typeof name !== 'string' || !Array.isArray(files) || !Array.isArray(rows) || files.length > 512
      || !Number.isSafeInteger(limits.maxRows) || limits.maxRows < 1 || limits.maxRows > MAX_ROWS
      || !Number.isSafeInteger(limits.maxBytes) || limits.maxBytes < 1 || limits.maxBytes > MAX_BYTES) throw new Refusal('INVALID_INPUT');
    let bytes = 0, primaryRows = 0, ownedRows = 0, legacyRows = 0;
    const fingerprint = createHash('sha256');
    const expected = new Map<string, number>(), owned = new Map<string, Map<string, number>>();
    const legacyCounts = new Map<string, number>(), ids = new Set<string>(), rowIds = new Set<number>();
    const add = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) || 0) + 1);
    const signature = (values: unknown[], source: unknown) => {
      if (source !== 'real' && source !== 'test') throw new Refusal('INVALID_INPUT');
      const normalized = values.map((value, index) => {
        if (value === null) return null;
        if (index === 7 || index === 8) {
          if (typeof value !== 'number' || !Number.isFinite(value)) throw new Refusal('INVALID_INPUT');
          return value;
        }
        if (!['string', 'number', 'boolean'].includes(typeof value)) throw new Refusal('INVALID_INPUT');
        const text = typeof value === 'boolean' ? String(Number(value)) : String(value);
        if (text.length > 1024 * 1024) throw new Refusal('LIMIT_EXCEEDED');
        bytes += Buffer.byteLength(text);
        if (bytes > limits.maxBytes) throw new Refusal('LIMIT_EXCEEDED');
        return text;
      });
      return JSON.stringify([...normalized, source]);
    };
    const selected = files.filter(file => file?.file_name === name)
      .sort((a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);
    if (!selected.length) throw new Refusal('NO_PRIMARY_DATASET');
    for (const file of selected) {
      if ((file.source !== 'real' && file.source !== 'test')
        || typeof file.id !== 'string' || !file.id || file.id.length > 256 || ids.has(file.id)
        || typeof file.file_hash !== 'string' || file.file_hash.length > 128
        || !Array.isArray(file.file_data?.rows) || !Number.isSafeInteger(file.row_count)
        || file.row_count !== file.file_data.rows.length) throw new Refusal('INVALID_INPUT');
      ids.add(file.id); const counts = new Map<string, number>(); owned.set(file.id, counts);
      fingerprint.update(JSON.stringify([file.id, file.file_name, file.file_hash]));
      for (const row of file.file_data.rows) {
        if (++primaryRows > limits.maxRows) throw new Refusal('LIMIT_EXCEEDED');
        const key = signature(historyInsertValues(row, name, file.id).slice(0, 12), file.source);
        add(expected, key); add(counts, key); fingerprint.update(key);
      }
    }
    if (rows.length > limits.maxRows) throw new Refusal('LIMIT_EXCEEDED');
    for (const row of rows) {
      if (!Number.isSafeInteger(row.id) || Number(row.id) < 1 || rowIds.has(Number(row.id)) || row.file_name !== name) throw new Refusal('INVALID_INPUT');
      rowIds.add(Number(row.id));
      const key = signature(HISTORY_VALUE_COLUMNS.slice(0, 12).map(column => row[column]), row.source);
      if (!expected.has(key)) throw new Refusal('UNMATCHED_HISTORY_ROW');
      if (row.file_id === null || row.file_id === '') { legacyRows++; add(legacyCounts, key); }
      else {
        const counts = typeof row.file_id === 'string' ? owned.get(row.file_id) : undefined;
        if (!counts || !(counts.get(key)! > 0)) throw new Refusal('OWNED_HISTORY_MISMATCH');
        counts.set(key, counts.get(key)! - 1); expected.set(key, expected.get(key)! - 1); ownedRows++;
      }
    }
    for (const [key, count] of legacyCounts) if (count > expected.get(key)!) throw new Refusal('EXCESS_HISTORY_ROWS');
    const missingRows = primaryRows - ownedRows - legacyRows;
    return { status: legacyRows || missingRows ? 'RECONCILABLE' as const : 'CURRENT' as const,
      primaryRows, ownedRows, legacyRows, missingRows, projectionFingerprint: fingerprint.digest('hex'),
      requiresPreimageBackup: true, appliesChanges: false };
  } catch (error) {
    return { status: 'BLOCKED' as const, code: error instanceof Refusal ? error.code : 'INVALID_INPUT' as const, appliesChanges: false };
  }
}
