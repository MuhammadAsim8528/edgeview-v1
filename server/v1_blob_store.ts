import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync, createGunzip } from 'node:zlib';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const V1_BLOB_MAX_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;
export const V1_BLOB_MAX_COMPRESSED_BYTES = 16 * 1024 * 1024;

export const V1_BLOB_THRESHOLD_BYTES = 4 * 1024;
const BLOB_FORMAT = 1;
const STORAGE_FORMAT = 2;

type BlobRef = {
  __edgeview_blob_ref__: {
    format: typeof BLOB_FORMAT;
    sha256: string;
    encoding: 'gzip-json';
    uncompressed_bytes: number;
  };
};

type PersistedEnvelope = {
  _edgeview_storage?: {
    format: typeof STORAGE_FORMAT;
    blob_format: typeof BLOB_FORMAT;
    threshold_bytes: number;
    externalized_values: number;
  };
  [key: string]: any;
};

function serializeValue(value: unknown): Buffer | null {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return null;
  return Buffer.from(serialized, 'utf8');
}

function digest(bytes: Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function blobPath(dataDir: string, sha256: string): string {
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw storageError('V1_BLOB_REFERENCE_INVALID', 'Invalid V1 evidence blob reference.');
  return path.join(dataDir, 'blobs', 'sha256', sha256.slice(0, 2), `${sha256}.json.gz`);
}

function storageError(code: string, message: string, cause?: unknown): Error {
  const error = new Error(message);
  error.name = 'V1BlobStorageError';
  (error as any).code = code;
  if (cause !== undefined) (error as any).cause = cause;
  return error;
}

function writeBlob(dataDir: string, bytes: Buffer, sha256: string): void {
  const target = blobPath(dataDir, sha256);
  if (fs.existsSync(target)) return;
  const dir = path.dirname(target);
  fs.mkdirSync(dir, { recursive: true });
  const temp = path.join(dir, `.${sha256}.${process.pid}.${crypto.randomBytes(5).toString('hex')}.tmp`);
  let handle: number | undefined;
  try {
    const compressed = gzipSync(bytes, { level: 6 });
    handle = fs.openSync(temp, 'wx');
    fs.writeFileSync(handle, compressed);
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = undefined;
    if (fs.existsSync(target)) {
      fs.unlinkSync(temp);
      return;
    }
    fs.renameSync(temp, target);
  } catch (cause) {
    if (handle !== undefined) {
      try { fs.closeSync(handle); } catch { /* best-effort cleanup */ }
    }
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch { /* best-effort cleanup */ }
    throw storageError('V1_BLOB_WRITE_FAILED', 'EdgeView could not durably persist an evidence blob.', cause);
  }
}

function makeRef(dataDir: string, value: unknown): { value: unknown; externalized: boolean } {
  const bytes = serializeValue(value);
  if (!bytes || bytes.length < V1_BLOB_THRESHOLD_BYTES) return { value, externalized: false };
  const sha256 = digest(bytes);
  writeBlob(dataDir, bytes, sha256);
  const ref: BlobRef = {
    __edgeview_blob_ref__: {
      format: BLOB_FORMAT,
      sha256,
      encoding: 'gzip-json',
      uncompressed_bytes: bytes.length,
    },
  };
  return { value: ref, externalized: true };
}

export function isV1BlobRef(value: unknown): value is BlobRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ref = (value as any).__edgeview_blob_ref__;
  return Boolean(
    ref
    && ref.format === BLOB_FORMAT
    && ref.encoding === 'gzip-json'
    && /^[a-f0-9]{64}$/.test(String(ref.sha256 || ''))
    && Number.isFinite(ref.uncompressed_bytes)
    && ref.uncompressed_bytes >= 0
  );
}

async function readRef(dataDir: string, ref: BlobRef): Promise<unknown> {
  const metadata = ref.__edgeview_blob_ref__;
  const target = blobPath(dataDir, metadata.sha256);
  if (!Number.isSafeInteger(metadata.uncompressed_bytes) || metadata.uncompressed_bytes < 0 || metadata.uncompressed_bytes > V1_BLOB_MAX_UNCOMPRESSED_BYTES) {
    throw storageError('V1_BLOB_REFERENCE_INVALID', 'Evidence blob exceeds the safe decompression limit.');
  }
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > V1_BLOB_MAX_COMPRESSED_BYTES) throw storageError('V1_BLOB_MISSING', 'Evidence blob is missing or exceeds the safe compressed-size limit.');
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    const collector = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        size += chunk.length;
        if (size > metadata.uncompressed_bytes) callback(storageError('V1_BLOB_INTEGRITY_ERROR', 'Evidence blob exceeds its declared size.'));
        else { chunks.push(chunk); callback(); }
      },
    });
    await pipeline(fs.createReadStream(target), createGunzip(), collector);
    const bytes = Buffer.concat(chunks);
    if (bytes.length !== metadata.uncompressed_bytes || digest(bytes) !== metadata.sha256) {
      throw storageError('V1_BLOB_INTEGRITY_ERROR', 'Evidence blob failed its size or SHA-256 integrity check.');
    }
    return JSON.parse(bytes.toString('utf8'));
  } catch (cause: any) {
    if (cause?.name === 'V1BlobStorageError') throw cause;
    throw storageError('V1_BLOB_INTEGRITY_ERROR', `Evidence blob ${metadata.sha256} could not be decoded safely.`, cause);
  }
}

/**
 * Produces a persisted-only representation. The live V1Run object is never
 * mutated, and small values remain inline for readability/debugging.
 */
export function externalizeV1RunForStorage<T extends PersistedEnvelope>(run: T, dataDir: string): T | PersistedEnvelope {
  let externalized = 0;
  const externalize = (value: unknown) => {
    const next = makeRef(dataDir, value);
    if (next.externalized) externalized++;
    return next.value;
  };

  const rawRecords = Array.isArray(run.raw_records) ? run.raw_records.map((record: any) => {
    if (!Object.prototype.hasOwnProperty.call(record, 'response')) return record;
    return { ...record, response: externalize(record.response) };
  }) : run.raw_records;

  const results = Array.isArray(run.results) ? run.results.map((result: any) => {
    let changed = false;
    const next = { ...result };
    for (const field of ['text', 'markdown', 'html'] as const) {
      if (!Object.prototype.hasOwnProperty.call(result, field)) continue;
      const value = externalize(result[field]);
      if (value !== result[field]) changed = true;
      next[field] = value;
    }
    return changed ? next : result;
  }) : run.results;

  let evidenceWorkspace = run.evidence_workspace;
  if (evidenceWorkspace && Array.isArray(evidenceWorkspace.chunks)) {
    evidenceWorkspace = {
      ...evidenceWorkspace,
      chunks: evidenceWorkspace.chunks.map((chunk: any) => {
        if (!Object.prototype.hasOwnProperty.call(chunk, 'text')) return chunk;
        const text = externalize(chunk.text);
        return text === chunk.text ? chunk : { ...chunk, text };
      }),
    };
  }

  if (externalized === 0) return run;
  return {
    ...run,
    raw_records: rawRecords,
    results,
    ...(evidenceWorkspace ? { evidence_workspace: evidenceWorkspace } : {}),
    _edgeview_storage: {
      format: STORAGE_FORMAT,
      blob_format: BLOB_FORMAT,
      threshold_bytes: V1_BLOB_THRESHOLD_BYTES,
      externalized_values: externalized,
    },
  };
}

/** Transparently reconstructs the original in-memory V1Run shape. */
export async function hydrateV1RunFromStorage<T extends PersistedEnvelope>(persisted: T, dataDir: string): Promise<T> {
  if (persisted?._edgeview_storage?.format !== STORAGE_FORMAT) return persisted;
  const hydrate = (value: unknown) => isV1BlobRef(value) ? readRef(dataDir, value) : value;

  const rawRecords = Array.isArray(persisted.raw_records) ? await Promise.all(persisted.raw_records.map(async (record: any) => (
    Object.prototype.hasOwnProperty.call(record, 'response') ? { ...record, response: await hydrate(record.response) } : record
  ))) : persisted.raw_records;

  const results = Array.isArray(persisted.results) ? await Promise.all(persisted.results.map(async (result: any) => {
    const next = { ...result };
    for (const field of ['text', 'markdown', 'html'] as const) {
      if (Object.prototype.hasOwnProperty.call(result, field)) next[field] = await hydrate(result[field]);
    }
    return next;
  })) : persisted.results;

  let evidenceWorkspace = persisted.evidence_workspace;
  if (evidenceWorkspace && Array.isArray(evidenceWorkspace.chunks)) {
    evidenceWorkspace = {
      ...evidenceWorkspace,
      chunks: await Promise.all(evidenceWorkspace.chunks.map(async (chunk: any) => (
        Object.prototype.hasOwnProperty.call(chunk, 'text') ? { ...chunk, text: await hydrate(chunk.text) } : chunk
      ))),
    };
  }

  const { _edgeview_storage: _storage, ...run } = persisted;
  return {
    ...run,
    raw_records: rawRecords,
    results,
    ...(evidenceWorkspace ? { evidence_workspace: evidenceWorkspace } : {}),
  } as unknown as T;
}

