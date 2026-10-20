import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { FileRecord } from './db';
import { computeSummary } from './summary';
import { getJsonPersistencePath, getJsonLegacyPersistencePath, isTestProcess } from './db_paths';

function getJsonPaths(): { main: string; legacy: string } {
  return { main: getJsonPersistencePath(), legacy: getJsonLegacyPersistencePath() };
}

export interface UploadedFileRecord {
  id: string;
  file_name: string;
  file_hash: string;
  row_count: number;
  total_value: number;
  unique_countries: number;
  unique_importers: number;
  uploaded_at: string;
  source: 'real' | 'test';
  provenance_version?: 1;
  file_type: string;
  size: number;
  file_data: {
    columns?: any[];
    rows?: any[];
    summary?: any;
    raw_text?: string;
    doc_tables?: any[];
  };
}

export interface HistoryDataRow {
  id: string | number;
  file_id: string;
  file_name: string;
  be_link?: string;
  be_date?: string;
  hs_code?: string;
  item?: string;
  importer?: string;
  exporter?: string;
  country?: string;
  tot_fc?: number;
  qty?: number;
  unit?: string;
  agent_name?: string;
  source: 'real' | 'test';
  uploaded_at: string;
  raw_row?: Record<string, any>;
}

export function isTestRecord(id?: string, fileName?: string): boolean {
  const nameLower = (fileName || '').toLowerCase().trim();
  const idLower = (id || '').toLowerCase().trim();
  return (
    /^(?:file[-_])?(?:sample|test|demo|mock)(?:[-_.\s]|$)/.test(idLower) ||
    /^(?:sample|test|demo|mock)(?:[-_.\s]|$)/.test(nameLower) ||
    /^(?:pharma_imports_2026|shipments_q2|suppliers_master|trade_manifest|compliance_audit_report)(?:\.[a-z0-9]+)?$/.test(nameLower)
  );
}

/** Legacy filename hints never override versioned, explicitly recorded origin. */
export function resolveDatasetSource(record: { id?: string; file_name?: string; source?: unknown; provenance_version?: unknown }, testProcess = isTestProcess()): 'real' | 'test' {
  if (record.provenance_version === 1 && (record.source === 'real' || record.source === 'test')) return record.source;
  if (record.source === 'test' || isTestRecord(record.id, record.file_name)) return 'test';
  if (record.source === 'real') return 'real';
  return testProcess ? 'test' : 'real';
}

/** True when a persistence DB file has been created on disk before this boot (not a fresh first run). */
export function persistenceDatabaseExists(): boolean {
  const { main, legacy } = getJsonPaths();
  return fs.existsSync(main) || (legacy ? fs.existsSync(legacy) : false);
}

function readRecordsFromDisk(): UploadedFileRecord[] {
  const { main, legacy } = getJsonPaths();
  try {
    const targetPath = fs.existsSync(main) ? main : legacy && fs.existsSync(legacy) ? legacy : null;

    if (!targetPath) return [];
    const raw = fs.readFileSync(targetPath, 'utf-8');
    if (!raw.trim()) return [];

    const items = JSON.parse(raw);
    if (!Array.isArray(items)) return [];

    return items.map((r: any, idx: number) => {
      const fName = r.file_name || r.filename || r.name || 'uploaded_file';
      const fId = r.id || r.file_id || r.fileId || `file-persisted-${idx + 1}`;
      const recordSource = resolveDatasetSource({ id: fId, file_name: fName, source: r.source, provenance_version: r.provenance_version });

      const cols = r.file_data?.columns || r.columns || [];
      const rws = r.file_data?.rows || r.rows || [];
      const sum = r.file_data?.summary || r.summary || {};

      return {
        id: fId,
        file_name: fName,
        file_hash: r.file_hash || '',
        row_count: r.row_count !== undefined ? r.row_count : (rws.length || r.total_rows || 0),
        total_value: r.total_value !== undefined ? r.total_value : computeTotalValue(rws),
        unique_countries: r.unique_countries !== undefined ? r.unique_countries : computeUniqueCountries(rws),
        unique_importers: r.unique_importers !== undefined ? r.unique_importers : computeUniqueImporters(rws),
        uploaded_at: r.uploaded_at || r.upload_time || new Date().toISOString(),
        source: recordSource,
        ...(r.provenance_version === 1 ? { provenance_version: 1 as const } : {}),
        file_type: r.file_type || 'Unknown',
        size: r.size || 0,
        file_data: {
          columns: cols,
          rows: rws,
          summary: sum,
          raw_text: r.file_data?.raw_text || r.raw_text,
          doc_tables: r.file_data?.doc_tables || r.doc_tables,
        },
      };
    });
  } catch (err) {
    console.error('Failed to read persistence DB from disk:', err);
    // Back up the unreadable file instead of silently returning [] and later
    // overwriting the only copy of the data. Mirrors the sqlite.ts corrupt-DB
    // backup pattern so a corrupt JSON DB is never lost.
    try {
      const targetPath = fs.existsSync(main) ? main : legacy && fs.existsSync(legacy) ? legacy : null;
      if (targetPath) {
        const backupPath = `${targetPath}.corrupt.${Date.now()}`;
        fs.renameSync(targetPath, backupPath);
        console.warn(`Corrupted persistence DB backed up to ${backupPath}`);
      }
    } catch (backupErr) {
      console.error('Failed to back up corrupted persistence DB file:', backupErr);
    }
    return [];
  }
}

export class PersistenceWriteError extends Error {
  code: 'DISK_FULL' | 'PERSISTENCE_WRITE_FAILED';
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    const rawCode = String((cause as any)?.code || '').toUpperCase();
    const code = rawCode === 'ENOSPC' || rawCode === 'EDQUOT' ? 'DISK_FULL' : 'PERSISTENCE_WRITE_FAILED';
    super(message);
    this.name = 'PersistenceWriteError';
    this.code = code;
    this.cause = cause;
  }
}

function writeRecordsToDisk(records: UploadedFileRecord[]): void {
  const main = getJsonPersistencePath();
  const dir = path.dirname(main);
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tempPath = `${main}.${process.pid}.${Date.now()}.tmp`;
  let handle: number | undefined;
  try {
    handle = fs.openSync(tempPath, 'wx');
    fs.writeFileSync(handle, JSON.stringify(records, null, 2), { encoding: 'utf8' });
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = undefined;
    fs.renameSync(tempPath, main);
  } catch (err) {
    if (handle !== undefined) {
      try { fs.closeSync(handle); } catch { /* best-effort cleanup */ }
    }
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch { /* best-effort cleanup */ }
    console.error('Failed to write persistence DB to disk:', err);
    throw new PersistenceWriteError('EdgeView could not durably save the dataset database.', err);
  }
}

function computeTotalValue(rows: any[]): number {
  if (!Array.isArray(rows)) return 0;
  let total = 0;
  for (const r of rows) {
    const v = r['Total Value (USD)'] || r['Total FC (USD)'] || r.TOT_FC || r.VAL_USD || r.total_cost_usd || r.AMOUNT || 0;
    const num = typeof v === 'number' ? v : parseFloat(String(v)) || 0;
    total += num;
  }
  return Math.round(total * 100) / 100;
}

function computeUniqueCountries(rows: any[]): number {
  if (!Array.isArray(rows)) return 0;
  const set = new Set<string>();
  for (const r of rows) {
    const c = r.Country || r.COUNTRY || r.DESTINATION_COUNTRY || r.cntry || r.ORIGIN;
    if (c && String(c).trim() && String(c).toLowerCase() !== 'unknown' && String(c).toLowerCase() !== 'null') {
      set.add(String(c).trim().toLowerCase());
    }
  }
  return set.size;
}

function computeUniqueImporters(rows: any[]): number {
  if (!Array.isArray(rows)) return 0;
  const set = new Set<string>();
  for (const r of rows) {
    const imp = r.Importer || r.IMPORTER || r.BUYER || r.BUYER_NAME || r.Consignee;
    if (imp && String(imp).trim() && !String(imp).toLowerCase().includes('unknown')) {
      set.add(String(imp).trim().toLowerCase());
    }
  }
  return set.size;
}

export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

export async function saveFileToDb(fileRecord: FileRecord, fileHash: string, explicitSource?: 'real' | 'test'): Promise<UploadedFileRecord> {
  const records = readRecordsFromDisk();
  const rows = fileRecord.rows || [];
  const rowCount = rows.length;

  // Source classification logic
  let source: 'real' | 'test' = explicitSource || 'real';
  if (isTestProcess() || (explicitSource !== 'real' && isTestRecord(fileRecord.id, fileRecord.name))) {
    source = 'test';
  }

  const newRecord: UploadedFileRecord = {
    id: fileRecord.id,
    file_name: fileRecord.name,
    file_hash: fileHash,
    row_count: rowCount,
    total_value: computeTotalValue(rows),
    unique_countries: computeUniqueCountries(rows),
    unique_importers: computeUniqueImporters(rows),
    uploaded_at: fileRecord.upload_time || new Date().toISOString(),
    source,
    provenance_version: 1,
    file_type: fileRecord.file_type || 'Unknown',
    size: fileRecord.size || 0,
    file_data: {
      columns: fileRecord.columns || [],
      rows, // Keep full rows so large files reload with their complete dataset
      summary: fileRecord.summary || {},
      raw_text: undefined,
      doc_tables: fileRecord.doc_tables,
    },
  };

  const existingIdx = records.findIndex((r) => r.id === fileRecord.id || (r.file_hash && r.file_hash === fileHash));
  if (existingIdx >= 0) {
    records[existingIdx] = newRecord;
  } else {
    records.unshift(newRecord);
  }

  writeRecordsToDisk(records);
  return newRecord;
}

export async function loadAllFilesFromDb(): Promise<FileRecord[]> {
  const records = readRecordsFromDisk();
  records.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

  return records.map((row, idx) => {
    const id = row.id || `file-${Date.now()}-${idx + 1}`;
    const columns = row.file_data?.columns || [];
    const rows = row.file_data?.rows || [];
    const summary =
      row.file_data?.summary && Object.keys(row.file_data.summary).length > 0
        ? row.file_data.summary
        : computeSummary(columns, rows);

    return {
      id,
      name: row.file_name || 'uploaded_file',
      file_type: (row.file_type as FileRecord['file_type']) || 'Unknown',
      size: row.size || 0,
      upload_time: row.uploaded_at || new Date().toISOString(),
      columns,
      rows,
      summary,
      raw_text: row.file_data?.raw_text,
      doc_tables: row.file_data?.doc_tables,
    };
  });
}

export async function getHistoryFilesFromDb(): Promise<UploadedFileRecord[]> {
  const records = readRecordsFromDisk();
  // Filter strictly for real records, excluding any test records
  const realRecords = records.filter(
    (r) => r.source === 'real'
  );
  realRecords.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  return realRecords;
}

export async function findFileByHash(fileHash: string): Promise<FileRecord | null> {
  const records = readRecordsFromDisk();
  const found = records.find((r) => r.file_hash === fileHash);

  if (!found) return null;

  return {
    id: found.id,
    name: found.file_name,
    file_type: (found.file_type as FileRecord['file_type']) || 'Unknown',
    size: found.size || 0,
    upload_time: found.uploaded_at || new Date().toISOString(),
    columns: found.file_data?.columns || [],
    rows: found.file_data?.rows || [],
    summary: found.file_data?.summary || {},
    raw_text: found.file_data?.raw_text,
    doc_tables: found.file_data?.doc_tables,
  };
}

export async function deleteFileFromHistory(fileId: string): Promise<boolean> {
  let records = readRecordsFromDisk();
  const initialCount = records.length;
  records = records.filter((r) => r.id !== fileId && String(r.id) !== String(fileId));

  if (records.length < initialCount) {
    writeRecordsToDisk(records);
    return true;
  }
  return false;
}
