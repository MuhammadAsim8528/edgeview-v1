import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';
import { parseFile } from './server/parsers';
import { normalizeRow, groupShipmentRows } from './server/grouping';
import { computeSummary } from './server/summary';
import { statsRouter } from './server/stats_router';
import { uploadRouter } from './server/routes/upload';
import {
  saveFileToDb,
  loadAllFilesFromDb,
  getHistoryFilesFromDb,
  computeFileHash,
  findFileByHash,
  deleteFileFromHistory,
  persistenceDatabaseExists,
  isTestRecord,
} from './server/sqlite_persistence';
import {
  getAppSettings,
  saveAppSettings,
  testSerperKey,
  testNvidiaKey,
  testGroqKey,
  testHunterKey,
  resolveApiKey,
  getConfigPath,
  protectStoredCredentialsAtStartup,
} from './server/settings';
import { processExportRequest, transformFullDatasetRecords, FULL_DATASET_COLUMNS, generateCsvData, generateXlsxWorkbook, contactReportColumns, flattenContactReportRows } from './server/export_manager';
import { buildContactReport } from './server/contact_report_model';
import { ExportValidationError } from './server/export_validation';
import { getSafeContentDisposition, getSafeAsciiHeaderValue } from './server/utils/header_encoder';
import { getBackendLockPath, getProjectRoot, getSqlitePath, isTestProcess } from './server/db_paths';
import { selectContactEntity } from './server/contact_projection';
import { canonicalCompanyIdentityKey } from './server/company_identity';
import { getV1EngineDiagnostics, getV1ProviderMetrics, getV1Run, listV1RunSummaries, runV1Enrichment, resetV1ProviderFailureState } from './server/v1_engine';
import { persistV1ContactOverlay, projectHistoricalContactFields } from './server/job_manager';
import { installRuntimeLogging, readRuntimeLogs } from './server/runtime_log';
import { installFatalErrorHandlers } from './server/fatal_errors';
import { hasRecentProviderObservation } from './shared/provider_telemetry';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
// Production/static mode is the safe default. Vite middleware must be opted
// into explicitly so a launcher or service missing NODE_ENV cannot serve an
// HMR client under the production CSP and leave the UI blank.
const useViteDevServer = process.env.EDGEVIEW_DEV_SERVER === '1';
const API_VERSION = '1.0';
const V1_PROVIDER_IDS = new Set(['serper', 'hunter', 'nvidia', 'groq']);
const V1_SETTING_FIELDS = new Set([
  'serper_api_key','hunter_api_key','nvidia_api_key','groq_api_key',
  'serper_enabled','hunter_enabled','nvidia_enabled','groq_enabled',
  'nvidia_model','nvidia_fallback_model','groq_model','groq_fallback_model',
  'nvidia_base_url','nvidia_reasoning_mode','primary_ai_provider',
  'nvidia_temperature','groq_temperature','nvidia_max_tokens','groq_max_tokens','api_timeout_seconds',
]);
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
if (!isTestProcess()) installRuntimeLogging(getProjectRoot());
if (!isTestProcess()) installFatalErrorHandlers();

function boundedText(value: unknown, field: string, maxLength: number, required = false): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${field} must be text.`);
  const clean = value.trim();
  if (required && !clean) throw new Error(`${field} is required.`);
  if (clean.length > maxLength) throw new Error(`${field} must be ${maxLength} characters or fewer.`);
  if (CONTROL_CHARACTERS.test(clean)) throw new Error(`${field} contains unsupported control characters.`);
  return clean;
}

function publicV1Settings(settings: ReturnType<typeof getAppSettings>) {
  return {
    serper_api_key: '',
    hunter_api_key: '',
    nvidia_api_key: '',
    groq_api_key: '',
    serper_enabled: Boolean(settings.serper_enabled),
    hunter_enabled: Boolean(settings.hunter_enabled),
    nvidia_enabled: Boolean(settings.nvidia_enabled),
    groq_enabled: Boolean(settings.groq_enabled),
    nvidia_model: settings.nvidia_model,
    nvidia_fallback_model: settings.nvidia_fallback_model,
    nvidia_base_url: settings.nvidia_base_url,
    nvidia_reasoning_mode: settings.nvidia_reasoning_mode,
    nvidia_temperature: settings.nvidia_temperature,
    nvidia_max_tokens: settings.nvidia_max_tokens,
    groq_model: settings.groq_model,
    groq_fallback_model: settings.groq_fallback_model,
    groq_temperature: settings.groq_temperature,
    groq_max_tokens: settings.groq_max_tokens,
    primary_ai_provider: settings.primary_ai_provider,
    api_timeout_seconds: settings.api_timeout_seconds,
    has_serper_key: Boolean(settings.serper_api_key?.trim()),
    has_hunter_key: Boolean(settings.hunter_api_key?.trim()),
    has_nvidia_key: Boolean(settings.nvidia_api_key?.trim()),
    has_groq_key: Boolean(settings.groq_api_key?.trim()),
    has_ai_key: Boolean(settings.nvidia_api_key?.trim() || settings.groq_api_key?.trim()),
  };
}

// EdgeView is a local-first application. Refuse DNS-rebinding and cross-origin
// browser requests even if a future launcher accidentally changes networking.
app.disable('x-powered-by');
app.set('trust proxy', false);
app.use((req, res, next) => {
  const host = String(req.headers.host || '').toLowerCase();
  const origin = String(req.headers.origin || '').toLowerCase();
  const allowedHosts = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`]);
  const allowedOrigins = new Set([`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`, `http://[::1]:${PORT}`]);
  if (host && !allowedHosts.has(host)) return res.status(403).json({ error: 'Local EdgeView host required.' });
  if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ error: 'Cross-origin requests are not allowed.' });
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', useViteDevServer
    ? "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:* ws://localhost:*; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    : "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
});

const mutationWindows = new Map<string, { startedAt: number; count: number }>();
app.use((req, res, next) => {
  const modelDiscovery = req.path === '/api/ai/models';
  if (!modelDiscovery && !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  // Fixed bucket names avoid unbounded map growth from attacker-chosen paths.
  // Apply to upload aliases outside /api as well as API mutations.
  const key = modelDiscovery ? 'model-discovery' : 'local-mutations';
  const limit = modelDiscovery ? 12 : 120;
  const now = Date.now();
  const entry = mutationWindows.get(key);
  if (!entry || now - entry.startedAt >= 60_000) {
    mutationWindows.set(key, { startedAt: now, count: 1 });
    return next();
  }
  entry.count += 1;
  if (entry.count > limit) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((60_000 - (now - entry.startedAt)) / 1000))));
    return res.status(429).json({ success: false, code: 'LOCAL_RATE_LIMITED', message: 'Too many local requests. Try again in a moment.', recoverable: true });
  }
  next();
});

// Enable Gzip compression for fast API responses
app.use(compression());

// Configure JSON body parser and file uploads
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use('/api', (req, res, next) => {
  const requestId = `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();
  res.setHeader('X-Request-Id', requestId);
  res.on('finish', () => {
    console.log(JSON.stringify({
      event: 'api_request',
      request_id: requestId,
      method: req.method,
      route: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - startedAt,
    }));
  });
  next();
});

// Temp storage for uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// ==========================================
// REST API ROUTES (EDGEVIEW V1)
// ==========================================

// Force JSON Content-Type on all API and Upload endpoints
app.use(['/api', '/upload', '/files'], (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Health Check — reports application/database/provider status without any
// secret material and WITHOUT network calls, so it stays healthy (HTTP 200)
// even when every provider is down or a provider circuit has tripped.
app.get('/api/health', (req, res) => {
  const database: any = { status: 'ok', files: 0, persistence: false };
  try {
    database.files = db.files.size;
    database.persistence = persistenceDatabaseExists();
  } catch (err: any) {
    database.status = 'degraded';
    database.message = err?.message || 'Database status check failed';
  }

  let settings: ReturnType<typeof getAppSettings>;
  try {
    settings = getAppSettings();
  } catch (err: any) {
    console.error('Failed to read app settings for /api/health:', err);
    settings = { nvidia_api_key: '', groq_api_key: '', serper_api_key: '', firecrawl_api_key: '', hunter_api_key: '', tavily_api_key: '', exa_api_key: '', linkup_api_key: '', apify_api_key: '' } as ReturnType<typeof getAppSettings>;
  }

  const providerStatus = (configured: boolean, enabled = true) => ({
    configured,
    enabled,
    // This endpoint deliberately makes no network calls. A configured key is
    // not proof of authentication, quota, or reachability.
    reachable: null,
    status: !enabled ? 'disabled' : !configured ? 'not_configured' : 'configured_unverified',
  });

  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());

  res.json({
    status: 'ok',
    api_version: API_VERSION,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
    memory: (() => {
      const usage = process.memoryUsage();
      const mb = (bytes: number) => Math.round(bytes / 1024 / 1024 * 10) / 10;
      return { rss_mb: mb(usage.rss), heap_used_mb: mb(usage.heapUsed), heap_total_mb: mb(usage.heapTotal), external_mb: mb(usage.external), array_buffers_mb: mb(usage.arrayBuffers) };
    })(),
    v1_engine: getV1EngineDiagnostics(),
    app: {
      status: 'ok',
      name: 'edgeview',
      pid: process.pid,
      project_root: getProjectRoot(),
      node: process.version,
      port: PORT,
      env: process.env.NODE_ENV || 'development',
    },
    database,
    providers: {
      nvidia: providerStatus(Boolean(settings.nvidia_api_key?.trim()), settings.nvidia_enabled),
      groq: providerStatus(Boolean(settings.groq_api_key?.trim()), settings.groq_enabled),
      serper: providerStatus(Boolean(settings.serper_api_key?.trim()), settings.serper_enabled),
      hunter: providerStatus(Boolean(settings.hunter_api_key?.trim()), settings.hunter_enabled),
    },
  });
});

// Stats Router
app.use('/api/stats', statsRouter);

// Upload Router (Handles /api/files/upload, /api/upload, /upload, /files/upload)
app.use(['/api/upload', '/api/files/upload', '/upload', '/files/upload'], uploadRouter);

// 1. Files Endpoints
app.get('/api/files', (req, res) => {
  try {
    const fileList = Array.from(db.files.values()).map((f) => ({
      id: f.id || '',
      name: f.name || 'Untitled File',
      file_type: f.file_type || 'Unknown',
      size: f.size || 0,
      upload_time: f.upload_time || new Date().toISOString(),
      columns: f.columns || [],
      total_rows: Array.isArray(f.rows) ? f.rows.length : 0,
      summary: f.summary || {},
    }));
    res.json(fileList);
  } catch (err: any) {
    console.error('Error in /api/files route:', err);
    res.status(500).json({ error: err?.message || 'Failed to load files', success: false });
  }
});

app.get('/api/files/:id', (req, res) => {
  try {
    const rawId = req.params.id;
    let decodedId = rawId;
    try {
      decodedId = decodeURIComponent(rawId);
    } catch (_) {}

    const file = db.getFileById(decodedId) || db.getFileById(rawId);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: `File not found for ID: "${rawId}"`,
        code: 'FILE_NOT_FOUND',
      });
    }
    const includeRows = req.query.include_rows === 'true';
    res.json({
      ...file,
      rows: includeRows ? (file.rows || []).map(normalizeRow) : [],
    });
  } catch (err: any) {
    console.error('Error fetching file details:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to fetch file details',
    });
  }
});

// Explicit endpoint to save current file to History DB
app.post(['/api/files/:id/save-to-history', '/api/stats/save-to-history'], async (req, res) => {
  try {
    const fileId = req.params.id || req.body?.file_id;
    if (!fileId) {
      return res.status(400).json({ success: false, error: 'File ID is required' });
    }
    const file = db.getFileById(fileId);
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found in active session' });
    }

    const fileHash = computeFileHash(Buffer.from(JSON.stringify(file.rows || [])));
    const saved = await saveFileToDb(file, fileHash, 'real');

    return res.json({
      success: true,
      message: 'Data saved to History successfully',
      data: saved,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to save file to history' });
  }
});

// Optimized Paginated Data Endpoint with filter, sort, limit, offset & grouping support
app.get('/api/files/:id/data', (req, res) => {
  try {
    const file = db.getFileById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
    if ((req.query.limit !== undefined && (typeof req.query.limit !== 'string' || !/^\d+$/.test(req.query.limit))) || !Number.isInteger(limit) || limit < 1 || limit > 1000
      || (req.query.offset !== undefined && (typeof req.query.offset !== 'string' || !/^\d+$/.test(req.query.offset))) || !Number.isSafeInteger(offset) || offset < 0) return res.status(400).json({ error: 'Pagination requires limit 1–1000 and a non-negative integer offset.' });
    const search = (req.query.search as string || '').toLowerCase().trim();
    const sortBy = req.query.sort_by as string;
    const sortDir = (req.query.sort_dir as string || 'asc').toLowerCase();

    const isGrouped = req.query.group_shipments === 'true' || req.query.group === 'true';
    const productFilter = (req.query.product as string || '').toLowerCase().trim();
    const countryFilter = (req.query.country as string || '').toLowerCase().trim();
    const importerFilter = (req.query.importer as string || '').toLowerCase().trim();
    const startDate = (req.query.start_date as string || '').trim();
    const endDate = (req.query.end_date as string || '').trim();

    let rows = (file.rows || []).map(normalizeRow);

    if (isGrouped) {
      rows = groupShipmentRows(rows);
    }

    if (productFilter) {
      rows = rows.filter((r) => String(r.Item || r.item || '').toLowerCase().includes(productFilter));
    }

    if (countryFilter) {
      rows = rows.filter((r) => String(r.Country || r.country || '').toLowerCase() === countryFilter);
    }

    if (importerFilter) {
      rows = rows.filter((r) => String(r.Importer || r.importer || '').toLowerCase() === importerFilter);
    }

    if (startDate || endDate) {
      rows = rows.filter((r) => {
        const d = String(r.Date || r.date || '').trim();
        if (!d) return true;
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      });
    }

    if (search) {
      rows = rows.filter((r) =>
        Object.values(r).some((v) => String(v).toLowerCase().includes(search))
      );
    }

    if (sortBy) {
      rows = [...rows].sort((a, b) => {
        const valA = a[sortBy];
        const valB = b[sortBy];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDir === 'asc' ? valA - valB : valB - valA;
        }
        const strA = String(valA ?? '').toLowerCase();
        const strB = String(valB ?? '').toLowerCase();
        if (strA < strB) return sortDir === 'asc' ? -1 : 1;
        if (strA > strB) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const paginatedRows = rows.slice(offset, offset + limit);

    res.json({
      id: file.id,
      file_id: file.id,
      name: file.name,
      total_count: rows.length,
      total_rows: rows.length,
      limit,
      offset,
      columns: file.columns,
      rows: paginatedRows,
      data: paginatedRows,
      filter_options: {
        countries: file.summary?.countries_list || [],
        importers: file.summary?.importers_list || [],
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch file data' });
  }
});

// File upload routes handled by uploadRouter (/api/files/upload and /api/upload)

// Delete File
app.delete('/api/files/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!db.files.has(id)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = db.files.get(id)!;

    // 1. Persist the primary file deletion first so it cannot reappear after
    // restart. JSON persistence throws on an undurable write.
    const diskDeleted = await deleteFileFromHistory(id);

    // 2. Purge the derived shipment index and cross an explicit durability
    // barrier before claiming all associated history was removed.
    let historyCleanupError: string | null = null;
    try {
      const { getDb } = await import('./server/sqlite');
      const sqliteDb = await getDb();
      await sqliteDb.run('DELETE FROM history_data WHERE file_name = ?', [file.name]);
      await sqliteDb.flush();
    } catch (sqlErr: any) {
      historyCleanupError = String(sqlErr?.message || sqlErr);
      console.warn('Delete history_data durability warning:', sqlErr);
    }

    // 3. Memory follows the durable primary store even if derived-index cleanup
    // needs repair, preventing runtime state from disagreeing with restart state.
    db.files.delete(id);

    // 4. Re-sync company contacts and prune contacts that no longer have a
    //    source file so stale companies do not persist until restart.
    try {
      db.syncCompaniesFromFiles();
      db.pruneOrphanedContacts();
    } catch (syncErr) {
      console.warn('Sync companies warning during delete:', syncErr);
    }

    if (historyCleanupError) {
      return res.status(207).json({
        success: true,
        partial: true,
        message: 'File deletion was durably saved, but derived history cleanup needs retry.',
        deleted_id: id,
        persisted: diskDeleted,
        warning: historyCleanupError,
      });
    }
    return res.json({
      success: true,
      message: 'File and associated history records deleted durably',
      deleted_id: id,
      persisted: diskDeleted,
    });
  } catch (err: any) {
    console.error('File delete route error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to delete file' });
  }
});

// Reset / Re-seed sample data
app.post('/api/sample-data/seed', (req, res) => {
  if (process.env.EDGEVIEW_ENABLE_SAMPLE_DATA !== '1') return res.status(404).json({ error: 'Sample data is disabled.' });
  db.seedInitialData();
  res.json({ success: true, message: 'Sample files reseeded successfully' });
});

// 2. Contacts Endpoints
async function hydrateContactsFromCache(): Promise<void> {
  // V1 results are immutable run records, not projections from the retired
  // autonomous contact-cache engine. Kept as a no-op for stable API callers.
}

app.get('/api/companies', async (req, res) => {
  await hydrateContactsFromCache();

  const contactsList = Array.from(db.contacts.values());
  res.json(contactsList);
});

// Canonical International Importer Directory (concise projection, excl. Pakistan, A→Z)
app.get('/api/international-importer-directory', async (req, res) => {
  await hydrateContactsFromCache();
  const { getInternationalImporterDirectory } = await import('./server/international_importer_directory');
  const contactsList = Array.from(db.contacts.values());
  const directory = await getInternationalImporterDirectory(contactsList as any);
  res.json(directory);
});

app.get('/api/companies/:id', async (req, res) => {
  await hydrateContactsFromCache();
  const contact = Array.from(db.contacts.values()).find((c) => c.id === req.params.id);
  if (!contact) {
    return res.status(404).json({ error: 'Company contact not found' });
  }
  res.json(contact);
});

// Read-only, canonical trusted-intelligence projection. Opening this endpoint
// never starts research and never creates a second company-data store.
app.get('/api/companies/:id/intelligence', async (req, res) => {
  await hydrateContactsFromCache();
  const contact = Array.from(db.contacts.values()).find((c) => c.id === req.params.id);
  if (!contact) return res.status(404).json({ error: 'Company contact not found' });
  return res.json({
    entity_key: (contact as any).entity_key,
    company_name: contact.company_name,
    country: (contact as any).country || '',
    canonical: contact,
    claims: (contact as any).claims || [],
    contradictions: (contact as any).contradictions || [],
    research_assessment: (contact as any).research_assessment || null,
    evidence: (contact as any).evidence || [],
    sources: (contact as any).sources || [],
  });
});

// Retired pre-V1 enrichment endpoint. Keep an explicit tombstone so stale
// clients cannot accidentally discover or revive the old mutation path.
app.post('/api/companies/:id/enrich', (_req, res) => {
  return res.status(410).json({
    success: false,
    code: 'LEGACY_FEATURE_REMOVED',
    message: 'This pre-V1 enrichment endpoint has been retired. Use POST /api/enrich/company.',
    recoverable: true,
    remediation: 'Refresh EdgeView and use Fetch Details from the Contacts view.',
  });
});

// Settings API Endpoints
app.get('/api/settings', (req, res) => {
  try {
    res.json(publicV1Settings(getAppSettings()));
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retrieve settings' });
  }
});

// Dynamic AI Model Discovery Endpoints
app.get('/api/ai/models', async (req, res) => {
  try {
    const { fetchProviderModels } = await import('./server/ai_providers');
    const provider = String(req.query.provider || 'nvidia').toLowerCase();
    if (!['nvidia', 'groq'].includes(provider)) return res.status(400).json({ success: false, error: 'Only NVIDIA and Groq models are supported by EdgeView V1.' });
    const key = req.query.key ? String(req.query.key) : undefined;
    const baseUrl = req.query.baseUrl ? String(req.query.baseUrl) : undefined;
    const refresh = req.query.refresh === 'true';

    const result = await fetchProviderModels(provider, key, baseUrl, refresh);
    res.json({
      success: true,
      provider,
      models: result.models,
      count: result.models.length,
      cached: result.cached,
      last_updated: result.lastUpdated,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err?.message || 'Failed to retrieve AI models',
    });
  }
});

app.post('/api/ai/models', async (req, res) => {
  try {
    const { fetchProviderModels } = await import('./server/ai_providers');
    const { provider, key, baseUrl, refresh } = req.body;
    const providerName = String(provider || 'nvidia').toLowerCase();
    if (!['nvidia', 'groq'].includes(providerName)) return res.status(400).json({ success: false, error: 'Only NVIDIA and Groq models are supported by EdgeView V1.' });

    const result = await fetchProviderModels(providerName, key, baseUrl, Boolean(refresh));
    res.json({
      success: true,
      provider: providerName,
      models: result.models,
      count: result.models.length,
      cached: result.cached,
      last_updated: result.lastUpdated,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err?.message || 'Failed to retrieve AI models',
    });
  }
});

app.post('/api/ai/test', async (req, res) => {
  try {
    const { getProvider } = await import('./server/ai_providers');
    const { provider, service, key, model, baseUrl } = req.body;
    const targetProvider = String(provider || service || 'nvidia').toLowerCase();
    if (!['nvidia', 'groq'].includes(targetProvider)) return res.status(400).json({ success: false, message: 'Only NVIDIA and Groq are supported by EdgeView V1.' });
    const p = getProvider(targetProvider);
    const settings = getAppSettings();

    const storedKey = p.name === 'GROQ' ? settings.groq_api_key : settings.nvidia_api_key;
    const effectiveKey = resolveApiKey(key, storedKey);
    const effectiveBaseUrl = baseUrl || settings.nvidia_base_url;
    const effectiveModel = model || (p.name === 'GROQ' ? settings.groq_model : settings.nvidia_model);

    const result = await p.testConnection(effectiveKey, effectiveModel, effectiveBaseUrl);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Connection test failed' });
  }
});

app.post('/api/ai/nvidia/diagnostics', async (_req, res) => {
  res.status(410).json({ success: false, message: 'Legacy AI diagnostics removed. Use the V1 provider test and captured run timeline.' });
});

app.post('/api/settings/reset', async (req, res) => {
  try {
    if (req.body?.confirm !== 'RESET_SETTINGS') {
      return res.status(400).json({ success: false, error: 'Explicit reset confirmation is required' });
    }
    const { resetAppSettings } = await import('./server/settings');
    const reset = resetAppSettings();
    res.json({
      success: true,
      message: 'Settings reset to default values',
      settings: publicV1Settings(reset),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to reset settings' });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, code: 'INVALID_SETTINGS', message: 'Settings must be a JSON object.', recoverable: true });
    }
    const input = req.body;
    if (Object.keys(input).some(key => !V1_SETTING_FIELDS.has(key))) {
      return res.status(400).json({ success: false, code: 'UNSUPPORTED_V1_SETTING', message: 'One or more settings are not supported by EdgeView V1.', recoverable: true, remediation: 'Use the V1 provider configuration form.' });
    }
    const sanitized: Record<string, unknown> = {};
    for (const key of ['serper_api_key', 'hunter_api_key', 'nvidia_api_key', 'groq_api_key']) {
      if (Object.prototype.hasOwnProperty.call(input, key)) sanitized[key] = boundedText(input[key], key, 512) ?? '';
    }
    for (const key of ['serper_enabled', 'hunter_enabled', 'nvidia_enabled', 'groq_enabled']) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        if (typeof input[key] !== 'boolean') return res.status(400).json({ error: `${key} must be true or false.` });
        sanitized[key] = input[key];
      }
    }
    for (const key of ['nvidia_model', 'nvidia_fallback_model', 'groq_model', 'groq_fallback_model']) {
      if (Object.prototype.hasOwnProperty.call(input, key)) sanitized[key] = boundedText(input[key], key, 200, true);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'nvidia_base_url')) {
      const value = boundedText(input.nvidia_base_url, 'nvidia_base_url', 500) ?? '';
      if (value && !/^https:\/\//i.test(value)) return res.status(400).json({ error: 'nvidia_base_url must use HTTPS.' });
      sanitized.nvidia_base_url = value;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'nvidia_reasoning_mode')) {
      if (!['INSTRUCT', 'THINKING'].includes(input.nvidia_reasoning_mode)) return res.status(400).json({ error: 'Invalid NVIDIA reasoning mode.' });
      sanitized.nvidia_reasoning_mode = input.nvidia_reasoning_mode;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'primary_ai_provider')) {
      if (!['NVIDIA', 'GROQ'].includes(input.primary_ai_provider)) return res.status(400).json({ error: 'Primary AI provider must be NVIDIA or GROQ.' });
      sanitized.primary_ai_provider = input.primary_ai_provider;
    }
    for (const [key, min, max] of [['nvidia_temperature', 0, 2], ['groq_temperature', 0, 2], ['nvidia_max_tokens', 64, 32768], ['groq_max_tokens', 64, 32768], ['api_timeout_seconds', 1, 120]] as const) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        const value = Number(input[key]);
        if (!Number.isFinite(value) || value < min || value > max) return res.status(400).json({ error: `${key} must be between ${min} and ${max}.` });
        sanitized[key] = value;
      }
    }
    // Legacy provider credentials remain recoverable in the private config but
    // cannot be enabled or changed through the V1 UI/API.
    const before = getAppSettings();
    const updated = saveAppSettings({ ...sanitized, firecrawl_enabled: false, gemini_enabled: false, tavily_enabled: false, exa_enabled: false, linkup_enabled: false, apify_enabled: false });
    for (const provider of ['serper','hunter','nvidia','groq'] as const) {
      const connectionChanged = before[`${provider}_api_key`] !== updated[`${provider}_api_key`]
        || (provider === 'nvidia' && (before.nvidia_model !== updated.nvidia_model || before.nvidia_base_url !== updated.nvidia_base_url))
        || (provider === 'groq' && before.groq_model !== updated.groq_model);
      if (connectionChanged) resetV1ProviderFailureState(provider);
      if (connectionChanged || before[`${provider}_enabled`] !== updated[`${provider}_enabled`]) v1ProviderTests.delete(provider);
    }
    res.json({
      success: true,
      message: 'Settings saved successfully to config.json',
      settings: publicV1Settings(updated),
    });
  } catch (err: any) {
    const message = err?.message || 'Failed to save settings';
    const invalid = /must be|contains unsupported|invalid/i.test(message);
    res.status(invalid ? 400 : 500).json({ error: message });
  }
});

app.post('/api/settings/test', async (req, res) => {
  try {
    const { service, key, model, baseUrl } = req.body;
    if (typeof service !== 'string' || !V1_PROVIDER_IDS.has(service)) {
      return res.status(400).json({ success: false, message: 'Only EdgeView V1 providers can be tested.' });
    }
    const settings = getAppSettings();
    
    // Add dynamic imports for test functions to avoid top-level issues if any
    const { 
      testSerperKey, 
      testNvidiaKey, 
      testGroqKey,
      testHunterKey,
    } = await import('./server/settings');

    if (service === 'serper') {
      const testKey = resolveApiKey(key, settings.serper_api_key);
      const result = await testSerperKey(testKey);
      return res.json(result);
    } else if (service === 'nvidia') {
      const testKey = resolveApiKey(key, settings.nvidia_api_key);
      const testModel = model || settings.nvidia_model;
      const testUrl = baseUrl || settings.nvidia_base_url;
      const result = await testNvidiaKey(testKey, testModel, testUrl);
      return res.json(result);
    } else if (service === 'groq') {
      const testKey = resolveApiKey(key, settings.groq_api_key);
      const testModel = model || settings.groq_model;
      const result = await testGroqKey(testKey, testModel);
      return res.json(result);
    } else if (service === 'hunter') {
      const testKey = resolveApiKey(key, settings.hunter_api_key);
      const result = await testHunterKey(testKey);
      return res.json(result);
    } else {
      return res.status(400).json({ success: false, message: 'Invalid service.' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Key validation test failed' });
  }
});

// EdgeView V1: exact company + country -> AI query generation -> deterministic
// provider retrieval, immutable raw capture, normalization and display.
app.post('/api/enrich/company', async (req, res) => {
  try {
    const { company_name, id, forceFetch, country, entity_key } = req.body;
    let cleanCompany: string;
    let cleanCountry: string | undefined;
    try {
      cleanCompany = boundedText(company_name, 'Company name', 300, true)!;
      cleanCountry = boundedText(country, 'Country', 120);
      boundedText(id, 'Contact id', 200);
      boundedText(entity_key, 'Entity key', 500);
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error?.message || 'Invalid enrichment input.' });
    }

    let resolvedCountry = cleanCountry || '';
    const contactList = Array.from(db.contacts.values());
    let ctxContact = selectContactEntity(contactList, { id, company_name: cleanCompany, country: resolvedCountry, entity_key });
    if (!ctxContact && !id && !country && !entity_key) {
      const matches = contactList.filter((contact) => canonicalCompanyIdentityKey(contact.company_name) === canonicalCompanyIdentityKey(cleanCompany));
      if (matches.length > 1) {
        return res.status(409).json({ success: false, error: 'Company name is ambiguous. Supply contact id, entity_key, or country.' });
      }
    }
    if (!resolvedCountry && ctxContact) resolvedCountry = String(ctxContact.country || ctxContact.normalized_country || '').trim();
    if (!resolvedCountry) return res.status(400).json({ success: false, error: 'Country is required for identity-anchored V1 enrichment.' });
    const capability = buildV1Capabilities().company_enrichment;
    if (!capability.available) return unavailableCapabilityResponse(res, capability);
    const run = await runV1Enrichment(cleanCompany, resolvedCountry);
    if (ctxContact) {
      const projected = projectHistoricalContactFields(run);
      Object.assign(ctxContact, projected, {
        edgeview_v1_run_id: run.id,
        last_updated: new Date().toISOString(),
      });
      await persistV1ContactOverlay(ctxContact.id, run.id, projected, true);
      db.rebuildIndexes();
    }
    // A provider-level FAILED run is still a successfully captured V1 record.
    // Return it to the UI so the user can inspect every failure instead of
    // turning a transparent provider failure into an opaque HTTP error.
    // Keep the interactive response small. Full immutable payloads stay
    // available through /api/v1/runs/:id and the Research UI; returning them
    // here made the Enrich button transfer megabytes before it could settle.
    res.status(200).json({
      success: true,
      run: {
        id: run.id,
        status: run.status,
        company_name: run.company_name,
        country: run.country,
        result_count: run.results.length,
        raw_record_count: run.raw_records.length,
        completed_at: run.completed_at,
      },
      contact_id: ctxContact?.id || null,
    });
  } catch (err: any) {
    console.error('Error in /api/enrich/company:', err);
    res.status(400).json({ success: false, error: err?.message || 'Failed to enrich company details' });
  }
});

app.get('/api/v1/runs', (_req, res) => {
  res.json({ success: true, runs: listV1RunSummaries(Number(_req.query.limit) || 200) });
});

app.get('/api/v1/runs/:id', (req, res) => {
  const run = getV1Run(req.params.id);
  if (!run) return res.status(404).json({ success: false, error: 'V1 run not found' });
  res.json({ success: true, run });
});

app.post('/api/enrich/batch', async (req, res) => {
  try {
    const { company_ids, forceFetch } = req.body;
    if (!Array.isArray(company_ids) || company_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Please select at least one company.' });
    }

    const capability = buildV1Capabilities().batch_enrichment;
    if (!capability.available) return unavailableCapabilityResponse(res, capability);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (type: string, data: any) => {
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    let processedCount = 0;
    const totalCount = company_ids.length;

    let summaryStats = {
      completed: 0,
      partial: 0,
      not_found: 0,
      failed: 0,
    };

    const executeWithLimit = async (limit: number, items: string[]) => {
      let index = 0;
      const executeNext = async (): Promise<void> => {
        if (index >= items.length) return;
        const currentId = items[index++];
        const contact = db.getContactById(currentId);

        if (!contact) {
          processedCount++;
          summaryStats.failed++;
          sendEvent('progress', {
            processed: processedCount,
            total: totalCount,
            status: `❌ ID ${currentId} not found`,
            id: currentId,
            company_name: `ID ${currentId}`,
            quality: 'FAILED',
            success: false,
          });
          return executeNext();
        }

        sendEvent('progress', {
          processed: processedCount,
          total: totalCount,
          status: `⏳ Searching for ${contact.company_name}...`,
          id: currentId,
          company_name: contact.company_name,
          stage: 'Searching',
        });

        try {
          const country = String(contact.country || '').trim();
          if (!country) throw new Error('Exact country is required for V1 enrichment');
          const run = await runV1Enrichment(String(contact.company_name || '').trim(), country);
          contact.last_updated = new Date().toISOString();

          processedCount++;

          const qStatus = run.status === 'COMPLETED' ? 'COMPLETE' : run.status === 'PARTIAL' ? 'PARTIAL' : 'FAILED';
          if (qStatus === 'COMPLETE') summaryStats.completed++;
          else if (qStatus === 'PARTIAL') summaryStats.partial++;
          else summaryStats.failed++;

          const statusBadge = qStatus === 'COMPLETE' ? '✅ Complete' : qStatus === 'PARTIAL' ? '⚡ Partial' : '⚠️ Not Found';
          const statusText = `${statusBadge}: ${contact.company_name}`;

          sendEvent('progress', {
            processed: processedCount,
            total: totalCount,
            status: statusText,
            id: currentId,
            company_name: contact.company_name,
            quality: qStatus,
            success: true,
            details: { edgeview_v1_run_id: run.id, queries: run.queries.length, results: run.results.length, raw_records: run.raw_records.length },
            summary: summaryStats,
          });
        } catch (err: any) {
          processedCount++;
          summaryStats.failed++;
          sendEvent('progress', {
            processed: processedCount,
            total: totalCount,
            status: `❌ ${contact.company_name} → Error: ${err.message}`,
            id: currentId,
            company_name: contact.company_name,
            quality: 'FAILED',
            success: false,
            error: err.message,
            summary: summaryStats,
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
        return executeNext();
      };

      const workers = Array.from({ length: Math.min(limit, items.length) }, () => executeNext());
      await Promise.all(workers);
    };

    await executeWithLimit(3, company_ids);
    sendEvent('done', { message: 'Batch enrichment complete', summary: summaryStats });
    res.end();
  } catch (err: any) {
    console.error('Error in /api/enrich/batch:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'Failed to start batch enrichment' });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err?.message })}\n\n`);
      res.end();
    }
  }
});

// --- NEW RESEARCH JOB & RESOURCE GOVERNOR ENDPOINTS ---

app.post('/api/enrich/jobs', async (req, res) => {
  try {
    const { company_ids, mode } = req.body;
    if (!Array.isArray(company_ids) || company_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Please select at least one company.' });
    }
    const capability = buildV1Capabilities().batch_enrichment;
    if (!capability.available) return unavailableCapabilityResponse(res, capability);
    
    const { getDb } = await import('./server/sqlite');
    const db = await getDb();
    
    // Check for existing active compatible bulk enrichment job
    const existingJob = await db.get(
      `SELECT id, status, importer_exporter_mode, total_companies, completed_companies 
       FROM research_jobs 
       WHERE importer_exporter_mode = ? 
       AND status IN ('PENDING', 'DISCOVERING', 'CRAWLING', 'EXTRACTING', 'VERIFYING', 'STOPPED')
       ORDER BY created_at DESC LIMIT 1`,
      [mode || 'importer']
    );
    
    if (existingJob) {
      // Return existing job instead of creating duplicate
      return res.status(409).json({ 
        success: false, 
        error: 'ACTIVE_JOB_EXISTS',
        message: 'A compatible bulk enrichment job is already active or resumable.',
        existing_job_id: existingJob.id,
        existing_job_status: existingJob.status,
        existing_job_progress: {
          total_companies: existingJob.total_companies,
          completed_companies: existingJob.completed_companies
        }
      });
    }
    
    const { createJob } = await import('./server/job_manager');
    const jobId = await createJob(company_ids, mode || 'importer');
    res.json({ success: true, jobId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/enrich/jobs', async (req, res) => {
  try {
    const { getDb } = await import('./server/sqlite');
    const db = await getDb();
    const rows = await db.all('SELECT id, status, importer_exporter_mode, total_companies, completed_companies, current_company, current_stage, resource_usage, created_at FROM research_jobs ORDER BY created_at DESC LIMIT 50');
    const jobs = rows.map(r => ({
      id: r.id,
      status: r.status,
      importer_exporter_mode: r.importer_exporter_mode,
      total_companies: r.total_companies,
      completed_companies: r.completed_companies,
      current_company: r.current_company,
      current_stage: r.current_stage,
      resource_usage: JSON.parse(r.resource_usage || '{}'),
      created_at: r.created_at
    }));
    res.json({ success: true, jobs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get active/resumable bulk enrichment job for refresh reattachment
app.get('/api/enrich/job/active', async (req, res) => {
  try {
    const { getDb } = await import('./server/sqlite');
    const db = await getDb();
    // Include STOPPED as resumable, plus all actively running states
    const row = await db.get(
      `SELECT id, status, importer_exporter_mode, total_companies, completed_companies, current_company, current_stage, resource_usage, created_at 
       FROM research_jobs 
       WHERE status IN ('PENDING', 'DISCOVERING', 'CRAWLING', 'EXTRACTING', 'VERIFYING', 'STOPPED') 
       ORDER BY 
         CASE status 
           WHEN 'DISCOVERING' THEN 1 
           WHEN 'CRAWLING' THEN 2 
           WHEN 'EXTRACTING' THEN 3 
           WHEN 'VERIFYING' THEN 4 
           WHEN 'PENDING' THEN 5 
           WHEN 'STOPPED' THEN 6 
           ELSE 7 
         END,
         created_at DESC 
       LIMIT 1`
    );
    if (!row) {
      return res.json({ success: true, job: null });
    }
    res.json({ success: true, job: {
      id: row.id,
      status: row.status,
      importer_exporter_mode: row.importer_exporter_mode,
      total_companies: row.total_companies,
      completed_companies: row.completed_companies,
      current_company: row.current_company,
      current_stage: row.current_stage,
      resource_usage: JSON.parse(row.resource_usage || '{}'),
      created_at: row.created_at
    }});
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/enrich/job/:id', async (req, res) => {
  try {
    const jobId = req.params.id;
    const { getJob, getStatsAndProjection } = await import('./server/job_manager');
    const job = await getJob(jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    
    // Calculate stats & projections
    const remainingCount = Math.max(0, job.total_companies - job.completed_companies);
    const statsAndProjections = getStatsAndProjection(job, remainingCount);

    res.json({ success: true, job, projections: statsAndProjections });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lightweight progress endpoint - bounded payload for frequent polling
app.get('/api/enrich/job/:id/progress', async (req, res) => {
  try {
    const jobId = req.params.id;
    const { getJob, getStatsAndProjection } = await import('./server/job_manager');
    const job = await getJob(jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    
    // Build lightweight progress summary without full company_states
    const companyStates = job.company_states || {};
    const completed = Object.values(companyStates).filter(s => s.status === 'completed');
    const failed = Object.values(companyStates).filter(s => s.status === 'failed');
    const processing = Object.values(companyStates).filter(s => s.status === 'processing');
    const pending = Object.values(companyStates).filter(s => s.status === 'pending');
    
    // Recent results summary (last 5 completed/failed)
    const recent = Object.values(companyStates)
      .filter(s => s.status === 'completed' || s.status === 'failed')
      .sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0))
      .slice(0, 5)
      .map(s => ({
        name: s.name,
        status: s.status,
        stage: s.stage,
        outcome: s.outcome,
        durationMs: s.durationMs,
        error: s.error,
        metrics: s.metrics || {},
      }));
    
    const remainingCount = Math.max(0, job.total_companies - job.completed_companies);
    const statsAndProjections = getStatsAndProjection(job, remainingCount);
    
    const progress = {
      id: job.id,
      status: job.status,
      importer_exporter_mode: job.importer_exporter_mode,
      total_companies: job.total_companies,
      completed_companies: job.completed_companies,
      completed_success: completed.length,
      failed: failed.length,
      pending: pending.length,
      processing: processing.length,
      current_company: job.current_company,
      current_stage: job.current_stage,
      resource_usage: job.resource_usage,
      recent_results: recent,
      projections: statsAndProjections,
      updated_at: job.updated_at,
    };
    
    res.json({ success: true, progress });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/enrich/job/:id/start', async (req, res) => {
  try {
    const jobId = req.params.id;
    const { forceFetch } = req.body;
    const { getJob, runJobLoop } = await import('./server/job_manager');
    const job = await getJob(jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    const capability = buildV1Capabilities().batch_enrichment;
    if (!capability.available) return unavailableCapabilityResponse(res, capability);
    
    // Background execution
    const started = await runJobLoop(jobId, Boolean(forceFetch));
    if (!started) return res.status(409).json({ success: false, error: 'Job is already running' });
    res.json({ success: true, message: 'Job started successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/enrich/job/:id/stop', async (req, res) => {
  try {
    const jobId = req.params.id;
    const { stopJob } = await import('./server/job_manager');
    await stopJob(jobId);
    res.json({ success: true, message: 'Job stop request received' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/governor/stats', async (req, res) => {
  try {
    const { getLatestActiveJob } = await import('./server/job_manager');
    const active = await getLatestActiveJob();
    res.json({
      success: true,
      stats: active?.resource_usage || { serper: 0, hunter: 0, nvidia: 0, groq: 0 },
      limits: { serperMax: 48000, hunterMax: null, nvidiaMax: null, groqMax: null }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

type ProviderTestState = { success: boolean; message: string; testedAt: string; latencyMs: number; httpStatus: number | null };
const v1ProviderTests = new Map<string, ProviderTestState>();

function buildV1ProviderReport() {
  const settings = getAppSettings();
  const metrics = getV1ProviderMetrics() as Record<string, any>;
  const diagnostics = getV1EngineDiagnostics();
  const suppressed = new Map(diagnostics.suppressed_providers.map(item => [item.provider, item.reason]));
  const coolingDown = new Map(diagnostics.cooling_down_providers.map(item => [item.provider, item]));
  const config: Record<string, { configured: boolean; enabled: boolean }> = {
    serper: { configured: Boolean(settings.serper_api_key?.trim()), enabled: Boolean(settings.serper_enabled) },
    hunter: { configured: Boolean(settings.hunter_api_key?.trim()), enabled: Boolean(settings.hunter_enabled) },
    nvidia: { configured: Boolean(settings.nvidia_api_key?.trim()), enabled: Boolean(settings.nvidia_enabled) },
    groq: { configured: Boolean(settings.groq_api_key?.trim()), enabled: Boolean(settings.groq_enabled) },
  };
  return Object.fromEntries([...V1_PROVIDER_IDS].map(provider => {
    const metric = metrics[provider] || { requestCount: 0, successCount: 0, failureCount: 0, timeoutCount: 0, rateLimitCount: 0, averageLatencyMs: null, lastError: null, lastHttpStatus: null, lastCompletedAt: null };
    const testSample = v1ProviderTests.get(provider);
    const test = hasRecentProviderObservation(testSample?.testedAt) ? testSample : undefined;
    const operationAfterTest = Boolean(test && metric.lastCompletedAt && Date.parse(metric.lastCompletedAt) > Date.parse(test.testedAt));
    const suppressionReason = suppressed.get(provider) || '';
    const cooldown = coolingDown.get(provider);
    const errorText = suppressionReason || cooldown?.reason || (operationAfterTest ? metric.lastError : test?.message) || metric.lastError || '';
    const httpStatus = (suppressionReason.match(/HTTP (\d+)/)?.[1] ? Number(suppressionReason.match(/HTTP (\d+)/)?.[1]) : null)
      ?? (operationAfterTest ? metric.lastHttpStatus : test?.httpStatus) ?? metric.lastHttpStatus ?? null;
    let status = !config[provider].configured ? 'unconfigured' : !config[provider].enabled ? 'disabled' : 'unknown';
    let routingState = !config[provider].configured ? 'unconfigured' : !config[provider].enabled ? 'disabled' : 'available';
    if (!config[provider].configured || !config[provider].enabled) {
      // Current settings override diagnostics from a previously enabled key.
    } else if (suppressionReason) {
      routingState = 'suppressed';
      status = httpStatus === 401 || httpStatus === 403 ? 'auth_failed' : 'degraded';
    } else if (cooldown) {
      routingState = 'cooldown';
      status = /429|quota|rate.?limit/i.test(cooldown.reason) ? 'rate_limited' : /timeout|aborted/i.test(cooldown.reason) ? 'timeout' : 'degraded';
    } else if (test) {
      const success = operationAfterTest ? !metric.lastError : test.success;
      status = success ? 'healthy' : httpStatus === 401 || httpStatus === 403 || /unauthor|invalid.*key/i.test(errorText) ? 'auth_failed' : httpStatus === 429 || /quota|rate.?limit|billing period/i.test(errorText) ? 'rate_limited' : httpStatus === 408 || /timeout|aborted|timed out/i.test(errorText) ? 'timeout' : 'degraded';
    }
    return [provider, {
      provider,
      configured: config[provider].configured,
      enabled: config[provider].enabled,
      status,
      routingState,
      retryAt: cooldown?.retry_at || null,
      requestCount: metric.requestCount,
      successCount: metric.successCount,
      failureCount: metric.failureCount,
      timeoutCount: metric.timeoutCount,
      rateLimitCount: metric.rateLimitCount,
      retryCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageLatencyMs: metric.averageLatencyMs,
      lastDiagnosticLatencyMs: testSample?.latencyMs ?? null,
      lastError: status === 'healthy' ? null : errorText || null,
      lastHttpStatus: httpStatus,
      lastTested: testSample?.testedAt || null,
      lastCompletedAt: metric.lastCompletedAt,
      successRate: metric.requestCount ? metric.successCount / metric.requestCount : null,
    }];
  }));
}

type V1CapabilityStatus = 'READY' | 'DEGRADED' | 'UNAVAILABLE';
type V1Capability = {
  id: string;
  available: boolean;
  status: V1CapabilityStatus;
  reason: string;
  dependencies: string[];
  remediation?: string;
};

function buildV1Capabilities(providerReport: Record<string, any> = buildV1ProviderReport()): Record<string, V1Capability> {
  const serper = providerReport.serper || {};
  const nvidia = providerReport.nvidia || {};
  const groq = providerReport.groq || {};
  const hunter = providerReport.hunter || {};

  const searchBlocked = !serper.configured
    || !serper.enabled
    || serper.routingState === 'suppressed'
    || serper.routingState === 'cooldown'
    || serper.status === 'auth_failed'
    || serper.status === 'rate_limited';
  const searchDegraded = !searchBlocked && ['unknown', 'timeout', 'degraded'].includes(String(serper.status || ''));
  const searchReason = !serper.configured
    ? 'Serper search is not configured.'
    : !serper.enabled
      ? 'Serper search is disabled in Settings.'
      : serper.status === 'auth_failed'
        ? 'Serper authentication failed.'
        : serper.status === 'rate_limited'
          ? 'Serper is rate limited or out of quota.'
          : serper.routingState === 'cooldown'
            ? `Serper is temporarily cooling down${serper.retryAt ? ` until ${serper.retryAt}` : ''}.`
            : serper.routingState === 'suppressed'
              ? `Serper is temporarily suppressed${serper.lastError ? `: ${serper.lastError}` : '.'}`
              : searchDegraded
                ? `Serper is degraded${serper.lastError ? `: ${serper.lastError}` : '.'}`
                : serper.status === 'healthy'
                  ? 'Serper search is verified and ready.'
                  : 'Serper is configured; connectivity has not been verified yet.';
  const searchRemediation = !serper.configured
    ? 'Add a Serper API key in Settings.'
    : !serper.enabled
      ? 'Enable Serper in Settings.'
      : searchBlocked
        ? 'Open Settings > System Health, test Serper, or wait for provider recovery.'
        : undefined;

  const aiUsable = [nvidia, groq].some((provider: any) => provider.configured && provider.enabled && provider.routingState !== 'suppressed');
  const aiVerified = [nvidia, groq].some((provider: any) => provider.status === 'healthy');
  const hunterUsable = hunter.configured && hunter.enabled && !['suppressed', 'cooldown'].includes(String(hunter.routingState || '')) && !['auth_failed', 'rate_limited'].includes(String(hunter.status || ''));
  const runCount = listV1RunSummaries(1).length;

  const companyEnrichment: V1Capability = {
    id: 'company_enrichment',
    available: !searchBlocked,
    status: searchBlocked ? 'UNAVAILABLE' : searchDegraded ? 'DEGRADED' : 'READY',
    reason: searchReason,
    dependencies: ['serper'],
    ...(searchRemediation ? { remediation: searchRemediation } : {}),
  };

  return {
    company_enrichment: companyEnrichment,
    batch_enrichment: { ...companyEnrichment, id: 'batch_enrichment' },
    ai_query_generation: {
      id: 'ai_query_generation',
      available: true,
      status: aiVerified ? 'READY' : aiUsable ? 'DEGRADED' : 'DEGRADED',
      reason: aiVerified
        ? 'AI query generation is verified.'
        : aiUsable
          ? 'An AI provider is configured but not verified; deterministic query fallback remains available.'
          : 'No active AI provider is available; deterministic query fallback remains available.',
      dependencies: ['nvidia|groq'],
      remediation: aiVerified ? undefined : 'Optional: configure/test NVIDIA or Groq for AI-assisted query design.',
    },
    hunter_contact_enrichment: {
      id: 'hunter_contact_enrichment',
      available: Boolean(hunterUsable),
      status: hunterUsable ? (hunter.status === 'healthy' ? 'READY' : 'DEGRADED') : 'UNAVAILABLE',
      reason: hunterUsable
        ? (hunter.status === 'healthy' ? 'Hunter contact enrichment is verified.' : 'Hunter is configured but not verified.')
        : !hunter.configured ? 'Hunter is not configured; core company research can still run.' : 'Hunter is currently unavailable; core company research can still run.',
      dependencies: ['hunter'],
      remediation: hunterUsable ? undefined : 'Optional: configure or recover Hunter in Settings.',
    },
    contact_export: {
      id: 'contact_export',
      available: db.contacts.size > 0,
      status: db.contacts.size > 0 ? 'READY' : 'UNAVAILABLE',
      reason: db.contacts.size > 0 ? `${db.contacts.size} company records are available to export.` : 'No company records are loaded.',
      dependencies: ['contacts'],
      remediation: db.contacts.size > 0 ? undefined : 'Import a trade/company dataset first.',
    },
    trade_export: {
      id: 'trade_export',
      available: db.files.size > 0,
      status: db.files.size > 0 ? 'READY' : 'UNAVAILABLE',
      reason: db.files.size > 0 ? `${db.files.size} dataset(s) are loaded.` : 'No source dataset is loaded.',
      dependencies: ['dataset'],
      remediation: db.files.size > 0 ? undefined : 'Import a dataset first.',
    },
    evidence_history: {
      id: 'evidence_history',
      available: runCount > 0,
      status: runCount > 0 ? 'READY' : 'UNAVAILABLE',
      reason: runCount > 0 ? 'Immutable V1 evidence history is available.' : 'No V1 research runs exist yet.',
      dependencies: ['v1-runs'],
    },
  };
}

function unavailableCapabilityResponse(res: express.Response, capability: V1Capability) {
  return res.status(503).json({
    success: false,
    code: 'CAPABILITY_UNAVAILABLE',
    error: capability.reason,
    message: capability.reason,
    recoverable: true,
    remediation: capability.remediation,
    capability,
  });
}

app.get('/api/capabilities', (_req, res) => {
  try {
    const providers = buildV1ProviderReport();
    res.json({ success: true, capabilities: buildV1Capabilities(providers), checked_at: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ success: false, code: 'CAPABILITY_CHECK_FAILED', error: err?.message || 'Failed to determine runtime capabilities.' });
  }
});

app.get('/api/governor/provider-metrics', async (_req, res) => {
  const report = buildV1ProviderReport();
  res.json({ success: true, metrics: report, report, engine: 'edgeview-v1' });
});

app.post('/api/governor/limits', async (req, res) => {
  res.status(410).json({ success: false, error: 'Legacy governor removed. V1 limits are fixed and bounded by profile.' });
});

// System health never equates a stored key with a successful network test.
app.get('/api/system/health', async (_req, res) => {
  try { res.json({ providers: buildV1ProviderReport(), checked_at: new Date().toISOString() }); }
  catch (err: any) { res.status(500).json({ error: err?.message || 'Failed to check system health' }); }
});

app.post('/api/system/health/test', async (req, res) => {
  try {
    const settings = getAppSettings();
    const tests: Array<[string, () => Promise<{ success: boolean; message: string }>]> = [];
    if (settings.serper_enabled && settings.serper_api_key?.trim()) tests.push(['serper', () => testSerperKey(settings.serper_api_key)]);
    if (settings.hunter_enabled && settings.hunter_api_key?.trim()) tests.push(['hunter', () => testHunterKey(settings.hunter_api_key)]);
    if (settings.nvidia_enabled && settings.nvidia_api_key?.trim()) tests.push(['nvidia', () => testNvidiaKey(settings.nvidia_api_key, settings.nvidia_model, settings.nvidia_base_url)]);
    if (settings.groq_enabled && settings.groq_api_key?.trim()) tests.push(['groq', () => testGroqKey(settings.groq_api_key, settings.groq_model)]);
    await Promise.all(tests.map(async ([provider, perform]) => {
      const started = performance.now();
      try {
        const result = await perform();
        const statusMatch = result.message.match(/(?:status|HTTP)\s+(\d{3})/i);
        v1ProviderTests.set(provider, { ...result, testedAt: new Date().toISOString(), latencyMs: Math.round(performance.now() - started), httpStatus: statusMatch ? Number(statusMatch[1]) : null });
      }
      catch (error: any) { v1ProviderTests.set(provider, { success: false, message: error?.message || 'Connection test failed', testedAt: new Date().toISOString(), latencyMs: Math.round(performance.now() - started), httpStatus: null }); }
    }));
    res.json({ success: true, providers: buildV1ProviderReport(), tested_at: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to test system health' });
  }
});

app.get('/api/system/usage', async (req, res) => {
  try {
    const { getLatestActiveJob } = await import('./server/job_manager');
    const job = await getLatestActiveJob();
    const counts: Record<string, number> = job?.resource_usage || {};
    res.json({ search_requests: counts.serper || 0, hunter_requests: counts.hunter || 0, direct_pages: counts['direct-http'] || 0, nvidia_calls: counts.nvidia || 0, groq_calls: counts.groq || 0, runs_visible: listV1RunSummaries(1000).length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

let runtimeStateCache: { at: number; payload: any } | null = null;
app.get('/api/runtime/state', async (req, res) => {
  try {
    if (runtimeStateCache && Date.now() - runtimeStateCache.at < 5000) {
      return res.json(runtimeStateCache.payload);
    }
    const { getJobsCountByStatus, getLatestActiveJob } = await import('./server/job_manager');
    const { getAppSettings } = await import('./server/settings');
    const { db: pharmaDb } = await import('./server/db');

    // 1. Resources
    const recentRunSummaries = listV1RunSummaries(10);
    const recentRuns = recentRunSummaries.map(summary => getV1Run(summary.id)).filter(Boolean) as NonNullable<ReturnType<typeof getV1Run>>[];
    const usage = recentRuns.flatMap(run => run.raw_records).reduce<Record<string, number>>((acc, record) => {
      acc[record.provider] = (acc[record.provider] || 0) + 1;
      return acc;
    }, {});
    const resources = {
      serper: usage.serper || 0,
      hunter: usage.hunter || 0,
      nvidia: usage.nvidia || 0,
      groq: usage.groq || 0,
      directHttp: usage['direct-http'] || 0,
      pagesAnalyzed: recentRuns.reduce((sum, run) => sum + run.results.filter(result => result.text || result.markdown || result.html).length, 0),
      cacheHits: 0,
      cacheMisses: 0,
    };

    // 2. Jobs
    const jobCounts = await getJobsCountByStatus();
    const jobs = {
      active: jobCounts.active,
      completed: jobCounts.completed,
      failed: jobCounts.failed,
      partial: jobCounts.partial,
    };

    // 3. Enrichment status & current company
    let currentCompany = null;
    let status = 'IDLE';
    let completedCompanies = 0;
    let totalCompanies = 0;

    const activeJob = await getLatestActiveJob();
    if (activeJob) {
      currentCompany = activeJob.current_company || null;
      status = activeJob.status;
      completedCompanies = activeJob.completed_companies || 0;
      totalCompanies = activeJob.total_companies || 0;
    }

    // Quality stats across database (hydrated from persisted contact_cache so
    // these counts match the Contacts tab / /api/summary).
    await hydrateContactsFromCache();
    const contactsList = Array.from(pharmaDb.contacts.values());
    const quality = { complete: 0, partial: 0, notFound: 0, failed: 0, pending: 0 };
    for (const c of contactsList) {
      const q = (c as any).quality_status || (c.email || c.phone ? 'COMPLETE' : (c as any).address || (c as any).website ? 'PARTIAL' : 'PENDING');
      if (q === 'COMPLETE') quality.complete++;
      else if (q === 'PARTIAL') quality.partial++;
      else if (q === 'NOT_FOUND') quality.notFound++;
      else if (q === 'FAILED') quality.failed++;
      else quality.pending++;
    }

    const enrichment = {
      currentCompany,
      status,
      completedCompanies,
      totalCompanies,
      quality,
    };

    // 4. Providers — use the same factual V1 report as the Settings panel.
    // A stored key is never reported as reachable until a live test succeeds.
    const providerReport = buildV1ProviderReport();
    const capabilities = buildV1Capabilities(providerReport);
    const providers = Object.fromEntries(Object.entries(providerReport).map(([provider, value]: [string, any]) => [provider, {
      configured: value.configured,
      enabled: value.enabled,
      reachable: value.status === 'healthy',
      status: value.status,
      message: value.lastError || (value.status === 'healthy' ? `${provider} connection verified` : value.status === 'disabled' ? `${provider} is disabled` : value.status === 'unknown' ? `${provider} key configured; run connectivity test to verify` : `${provider} is not configured`),
    }]));

    // 5. Recent Logs
    const logs = recentRuns.slice(0, 10).flatMap(run => run.timeline.map(event => ({ ...event, company_name: run.company_name, run_id: run.id }))).slice(0, 50);

    const payload = {
      success: true,
      resources,
      jobs,
      enrichment,
      providers,
      capabilities,
      logs,
    };
    runtimeStateCache = { at: Date.now(), payload };
    res.json(payload);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/enrich/activity-log', async (req, res) => {
  const runs = listV1RunSummaries(20).map(summary => getV1Run(summary.id)).filter(Boolean) as NonNullable<ReturnType<typeof getV1Run>>[];
  res.json(runs.flatMap(run => run.timeline.map(event => ({ ...event, run_id: run.id, company_name: run.company_name }))));
});

app.get('/api/logs/system', async (req, res) => {
  const requested = Number(req.query.tail ?? 500);
  const tail = Number.isFinite(requested) ? Math.max(1, Math.min(1000, Math.trunc(requested))) : 500;
  res.json(readRuntimeLogs(tail));
});

app.post('/api/logs/system/clear', async (req, res) => {
  res.status(409).json({ success: false, error: 'V1 records are immutable and cannot be cleared.' });
});

app.get('/api/logs/enrichment', async (req, res) => {
  const runs = listV1RunSummaries(20).map(summary => getV1Run(summary.id)).filter(Boolean) as NonNullable<ReturnType<typeof getV1Run>>[];
  res.json(runs.flatMap(run => run.timeline.map(event => ({ ...event, run_id: run.id, company_name: run.company_name }))));
});

app.post('/api/logs/enrichment/clear', async (req, res) => {
  res.status(409).json({ success: false, error: 'V1 records are immutable and cannot be cleared.' });
});

app.get('/api/logs/sync', async (req, res) => {
  res.json([]);
});

app.post('/api/logs/sync/clear', async (req, res) => {
  res.status(409).json({ success: false, error: 'V1 records are immutable and cannot be cleared.' });
});

// 2. Summary Endpoint
app.get('/api/summary', async (req, res) => {
  // Hydrate from the persisted contact_cache first so summary counts match the
  // Contacts tab (which hydrates the same way). Without this, /api/summary
  // under-reported persisted enrichment and disagreed with the Contacts UI.
  await hydrateContactsFromCache();

  const contacts = Array.from(db.contacts.values());
  const total = contacts.length;
  let contactsFound = 0;
  let researchedCompanies = 0;
  let unresolvedAfterResearch = 0;
  let notResearched = 0;
  let excludedExporters = 0;

  for (const c of contacts) {
    const researched = Boolean((c as any).edgeview_v1_run_id);
    const hasInfo = Boolean(
      c.email || c.phone || (c as any).address || (c as any).website ||
      ((c as any).emails_list?.length || 0) > 0 ||
      ((c as any).phones_list?.length || 0) > 0 ||
      ((c as any).addresses?.length || 0) > 0 ||
      ((c as any).contact_persons?.length || 0) > 0
    );
    if (researched) {
      researchedCompanies++;
      if (hasInfo) contactsFound++;
      else unresolvedAfterResearch++;
    } else {
      const isExcludedPakistanExporter = String(c.type || '').toLowerCase() === 'exporter'
        && String(c.country || '').trim().toLowerCase() === 'pakistan';
      if (isExcludedPakistanExporter) excludedExporters++;
      else notResearched++;
    }
  }

  const sourceRecords = Array.from(db.files.values()).reduce((sum, file) => sum + (file.rows?.length || 0), 0);
  const researchScope = total - excludedExporters;

  res.json({
    total_companies: total,
    researched_companies: researchedCompanies,
    contacts_found: contactsFound,
    unresolved_after_research: unresolvedAfterResearch,
    not_researched: notResearched,
    excluded_exporters: excludedExporters,
    research_scope: researchScope,
    source_records: sourceRecords,
  });
});

// 3. Reports Endpoints
app.get('/api/reports', (req, res) => {
  const reportsList = Array.from(db.reports.values());
  res.json(reportsList);
});

app.post('/api/reports/upload', (req, res) => {
  const { title, created_by, report_type, content_text, columns, rows, source_file } = req.body;

  const newReport = {
    id: `rep-${Date.now()}`,
    title: title || 'EdgeView Report',
    created_by: created_by || 'EdgeView',
    created_at: new Date().toISOString(),
    report_type: report_type || 'text',
    content_text,
    columns,
    rows,
    source_file,
  };

  db.reports.set(newReport.id, newReport);
  res.status(201).json({ success: true, report: newReport });
});

// Helpers for security hardening and input parsing
function safeDecode(str: any): string {
  if (!str) return '';
  const s = Array.isArray(str) ? String(str[0]) : String(str);
  try {
    return decodeURIComponent(s).trim();
  } catch {
    return s.trim();
  }
}

function parseQueryString(val: any): string {
  if (Array.isArray(val)) val = val[0];
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

function sanitizeCSVCell(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

// Unified Global Export Manager Endpoint
app.post('/api/export', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.dataset || !payload.format) {
      return res.status(400).json({ error: 'Invalid export payload. Required: dataset and format.' });
    }

    const { buffer, contentType, filename, failedFormats } = await processExportRequest(payload);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', getSafeContentDisposition(filename || 'export'));
    if (failedFormats && failedFormats.length > 0) {
      res.setHeader('X-Export-Failed-Formats', getSafeAsciiHeaderValue(failedFormats));
    }

    return res.send(buffer);
  } catch (err: any) {
    console.error('Unified Export Error:', err);
    if (err instanceof ExportValidationError) return res.status(400).json({ error: err.message, code: 'INVALID_EXPORT_REQUEST' });
    return res.status(500).json({ error: err?.message || 'Failed to process export request' });
  }
});

// 5. CSV Export Endpoint
app.get('/api/export/csv/:fileId', (req, res) => {
  try {
    const file = db.getFileById(req.params.fileId);
    if (!file || !file.rows || file.rows.length === 0) {
      return res.status(404).json({ error: 'No data to export for this file' });
    }

    const transformed = transformFullDatasetRecords(file.rows);
    const csvContent = generateCsvData(FULL_DATASET_COLUMNS, transformed);
    const baseName = (file.name || 'export').replace(/\.[^/.]+$/, '');
    const exportFilename = `${baseName}_export.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', getSafeContentDisposition(exportFilename));
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to export CSV' });
  }
});

app.post('/api/export/blocks', (req, res) => {
  try {
    const { company_ids } = req.body;
    let contacts = Array.from(db.contacts.values());
    if (company_ids && Array.isArray(company_ids)) {
      contacts = contacts.filter(c => company_ids.includes(c.id));
    }
    
    // Sort by name
    contacts.sort((a, b) => a.company_name.localeCompare(b.company_name));

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>EdgeView Contact Block Export</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f3f4f6;
      color: #111827;
      margin: 0;
      padding: 32px;
    }
    h1 {
      text-align: center;
      margin-bottom: 32px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 24px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .card-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 8px;
    }
    .card-meta {
      font-size: 0.875rem;
      color: #6b7280;
      margin-bottom: 16px;
    }
    .field {
      margin-bottom: 12px;
      font-size: 0.95rem;
    }
    .label {
      font-weight: 600;
      color: #374151;
      display: inline-block;
      min-width: 80px;
    }
    .empty {
      color: #9ca3af;
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>EdgeView Exported Company Profiles</h1>
  <div class="grid">
    ${contacts.map(c => {
      const cAny = c as any;
      return `
      <div class="card">
        <h2 class="card-title">${c.company_name}</h2>
        <div class="card-meta">Added: ${new Date(cAny.first_seen || c.last_updated || Date.now()).toLocaleDateString()}</div>
        <div class="field"><span class="label">Industry:</span> ${cAny.industry || '<span class="empty">N/A</span>'}</div>
        <div class="field"><span class="label">Website:</span> ${cAny.website ? `<a href="${cAny.website}" target="_blank">${cAny.website}</a>` : '<span class="empty">N/A</span>'}</div>
        <div class="field"><span class="label">Email:</span> ${c.email || '<span class="empty">N/A</span>'}</div>
        <div class="field"><span class="label">Phone:</span> ${c.phone || '<span class="empty">N/A</span>'}</div>
        <div class="field"><span class="label">Address:</span> ${cAny.address || '<span class="empty">N/A</span>'}</div>
        <div class="field"><span class="label">LinkedIn:</span> ${c.linkedin ? `<a href="${c.linkedin}" target="_blank">View Profile</a>` : '<span class="empty">N/A</span>'}</div>
      </div>
    `;
    }).join('')}
  </div>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', getSafeContentDisposition('edgeview_blocks.html'));
    res.send(htmlContent.trim());
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to export blocks' });
  }
});

// Export Professional Report (DOCX / PDF / CSV / XLSX / ALL)
app.all(['/api/export/report', '/api/export/docx', '/api/export/pdf'], async (req, res) => {
  try {
    const { generateDocxReport } = await import('./server/docx_report');
    const { generatePdfReport } = await import('./server/pdf_report');
    const {
      generateInternationalImporterDirectoryDocx,
    } = await import('./server/docx_stream');
    const {
      generateInternationalImporterDirectoryPdf,
    } = await import('./server/pdf_report');
    const {
      getInternationalImporterDirectory,
      flattenInternationalImporterRows,
      INTERNATIONAL_IMPORTER_COLUMNS,
    } = await import('./server/international_importer_directory');
    const { getDb } = await import('./server/sqlite');
    const sqliteDb = await getDb();

    let companyIds: string[] = [];
    let format: 'docx' | 'pdf' | 'xlsx' | 'csv' | 'all' = 'docx';
    let report_type: 'importer' | 'exporter' | 'both' | 'international_importer' = 'importer';

    if (req.path.includes('pdf')) format = 'pdf';
    if (req.path.includes('docx')) format = 'docx';

    if (req.method === 'POST' && req.body) {
      if (Array.isArray(req.body.company_ids)) companyIds = req.body.company_ids;
      if (['pdf', 'docx', 'xlsx', 'csv', 'all'].includes(req.body.format)) {
        format = req.body.format;
      }
      if (['exporter', 'importer', 'both', 'international_importer'].includes(req.body.report_type)) {
        report_type = req.body.report_type;
      }
    } else if (req.query) {
      if (Array.isArray(req.query.company_ids)) {
        companyIds = req.query.company_ids as string[];
      } else if (typeof req.query.company_ids === 'string') {
        companyIds = (req.query.company_ids as string).split(',');
      }
      if (['pdf', 'docx', 'xlsx', 'csv', 'all'].includes(req.query.format as string)) {
        format = req.query.format as any;
      }
      if (['exporter', 'importer', 'both', 'international_importer'].includes(req.query.report_type as string)) {
        report_type = req.query.report_type as any;
      }
    }

    let contactsToExport = Array.from(db.contacts.values());
    if (companyIds.length > 0) {
      const idSet = new Set(companyIds);
      contactsToExport = contactsToExport.filter((c) => idSet.has(c.id));
    }

    if (contactsToExport.length === 0) {
      return res.status(400).json({ error: 'No contacts selected or available to export' });
    }

    // Export the current V1 contact projection only. The retired autonomous
    // engine's contact_cache is deliberately not consulted.
    const enrichedContacts = await Promise.all(
      contactsToExport.map(async (c) => {
        return {
          id: c.id,
          company_name: c.company_name,
          type: c.type,
          ceo: c.ceo,
          email: c.email,
          phone: c.phone,
          whatsapp: c.whatsapp,
          linkedin: c.linkedin,
          website: (c as any).website,
          address: (c as any).address,
          industry: (c as any).industry,
          country: (c as any).country,
          fax_numbers: (c as any).fax_numbers || [],
          emails_list: (c as any).emails_list || (c.email ? [c.email] : []),
          phones_list: (c as any).phones_list || (c.phone ? [c.phone] : []),
          linkedin_urls: (c as any).linkedin_urls || [],
          addresses: (c as any).addresses || ((c as any).address ? [{ address: (c as any).address }] : []),
          contact_persons: (c as any).contact_persons || [],
          decision_makers: (c as any).decision_makers || [],
          socials: (c as any).socials || [],
          sources: (c as any).sources || [],
        };
      })
    );

    const zip = new (await import('jszip')).default();
    const { TradeRelationshipResolver } = await import('./server/trade_relationship_resolver');

    // Build the trade index ONCE (single pass over the dataset) so that every
    // importer/exporter below resolves its history in O(1).
    const tradeIndex = await TradeRelationshipResolver.buildTradeIndex();

    const cleanMarkdown = (text: string | null | undefined): string => {
      if (!text) return '';
      let s = String(text).trim();
      s = s.replace(/\[([^\]]+)\]\((?:mailto:)?(?:https?:\/\/[^\)]+|[^\)]+)\)/gi, '$1');
      s = s.replace(/[\*_`~]/g, '');
      return s.trim();
    };

    // Build normalized reports (once each) from the pre-built trade index so that
    // CSV/XLSX/PDF/DOCX all share the exact same logical directory structure.
    const reportCache = new Map<'importer' | 'exporter', any>();
    const getReport = async (rt: 'importer' | 'exporter') => {
      if (!reportCache.has(rt)) {
        reportCache.set(rt, await buildContactReport(enrichedContacts as any, rt, tradeIndex));
      }
      return reportCache.get(rt)!;
    };

    // International Importer Directory — built once, consumed by every format.
    const getInternationalDirectory = async () => {
      return getInternationalImporterDirectory(enrichedContacts as any, tradeIndex);
    };

    const generateCSVBuffer = async () => {
      if (report_type === 'international_importer') {
        const columns = INTERNATIONAL_IMPORTER_COLUMNS;
        const rows = flattenInternationalImporterRows(await getInternationalDirectory(), columns as any);
        const headers = columns.map((col: any) => sanitizeCSVCell(col.header)).join(',');
        const rowLines = rows.map((rec: any) =>
          columns.map((col: any) => sanitizeCSVCell(rec[col.key] ?? '')).join(',')
        );
        return '\uFEFF' + [headers, ...rowLines].join('\r\n');
      }
      const rt: 'importer' | 'exporter' = report_type === 'exporter' ? 'exporter' : 'importer';
      const columns = contactReportColumns(rt);
      const rows = flattenContactReportRows(await getReport(rt), columns);
      const headers = columns.map((col) => sanitizeCSVCell(col.header)).join(',');
      const rowLines = rows.map((rec: any) =>
        columns.map((col) => sanitizeCSVCell(rec[col.key] ?? '')).join(',')
      );
      return '\uFEFF' + [headers, ...rowLines].join('\r\n');
    };

    const generateXLSXBuffer = async () => {
      if (report_type === 'international_importer') {
        const columns = INTERNATIONAL_IMPORTER_COLUMNS;
        const rows = flattenInternationalImporterRows(await getInternationalDirectory(), columns as any);
        return generateXlsxWorkbook('International Importers', columns as any, rows);
      }
      const rt: 'importer' | 'exporter' = report_type === 'exporter' ? 'exporter' : 'importer';
      const columns = contactReportColumns(rt);
      const rows = flattenContactReportRows(await getReport(rt), columns);
      return generateXlsxWorkbook('Contact Directory', columns, rows);
    };

    if (format === 'csv') {
      const csvContent = await generateCSVBuffer();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        getSafeContentDisposition(
          report_type === 'international_importer' ? 'EdgeView_International_Importer_Directory.csv' : 'EdgeView_Contact_Directory.csv'
        )
      );
      return res.send(csvContent);
    }

    if (format === 'xlsx') {
      const xlsxBuf = await generateXLSXBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        getSafeContentDisposition(
          report_type === 'international_importer' ? 'EdgeView_International_Importer_Directory.xlsx' : 'EdgeView_Contact_Directory.xlsx'
        )
      );
      return res.send(xlsxBuf);
    }

    if (format === 'pdf') {
      if (report_type === 'both') {
        const impPdf = await generatePdfReport(enrichedContacts, 'importer', tradeIndex);
        const expPdf = await generatePdfReport(enrichedContacts, 'exporter', tradeIndex);
        zip.file('EdgeView_Importer_Report.pdf', impPdf);
        zip.file('EdgeView_Exporter_Report.pdf', expPdf);
        const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', getSafeContentDisposition('EdgeView_Contact_Reports_PDF.zip'));
        return res.send(zipBuf);
      } else if (report_type === 'international_importer') {
        const pdfBuffer = await generateInternationalImporterDirectoryPdf(enrichedContacts, tradeIndex);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', getSafeContentDisposition('EdgeView_International_Importer_Directory.pdf'));
        return res.send(pdfBuffer);
      } else {
        const pdfBuffer = await generatePdfReport(enrichedContacts, report_type, tradeIndex);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', getSafeContentDisposition(`EdgeView_${report_type}_report.pdf`));
        return res.send(pdfBuffer);
      }
    }

    if (format === 'docx') {
      if (report_type === 'both') {
        const impDocx = await generateDocxReport(enrichedContacts, 'importer', tradeIndex);
        const expDocx = await generateDocxReport(enrichedContacts, 'exporter', tradeIndex);
        zip.file('EdgeView_Importer_Report.docx', impDocx);
        zip.file('EdgeView_Exporter_Report.docx', expDocx);
        const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', getSafeContentDisposition('EdgeView_Contact_Reports_DOCX.zip'));
        return res.send(zipBuf);
      } else if (report_type === 'international_importer') {
        const docxBuffer = await generateInternationalImporterDirectoryDocx(enrichedContacts, tradeIndex);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', getSafeContentDisposition('EdgeView_International_Importer_Directory.docx'));
        return res.send(docxBuffer);
      } else {
        const docxBuffer = await generateDocxReport(enrichedContacts, report_type, tradeIndex);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', getSafeContentDisposition(`EdgeView_${report_type}_report.docx`));
        return res.send(docxBuffer);
      }
    }

    if (format === 'all') {
      // Create ZIP of all requested assets
      const csvStr = await generateCSVBuffer();
      const xlsxBuf = await generateXLSXBuffer();
      const intlNaming = report_type === 'international_importer';
      zip.file(intlNaming ? 'EdgeView_International_Importer_Directory.csv' : 'EdgeView_Contact_Directory.csv', csvStr);
      zip.file(intlNaming ? 'EdgeView_International_Importer_Directory.xlsx' : 'EdgeView_Contact_Directory.xlsx', xlsxBuf);

      if (report_type === 'importer' || report_type === 'both') {
        const impPdf = await generatePdfReport(enrichedContacts, 'importer', tradeIndex);
        zip.file('EdgeView_Importer_Report.pdf', impPdf);
        const impDocx = await generateDocxReport(enrichedContacts, 'importer', tradeIndex);
        zip.file('EdgeView_Importer_Report.docx', impDocx);
      }

      if (report_type === 'exporter' || report_type === 'both') {
        const expPdf = await generatePdfReport(enrichedContacts, 'exporter', tradeIndex);
        zip.file('EdgeView_Exporter_Report.pdf', expPdf);
        const expDocx = await generateDocxReport(enrichedContacts, 'exporter', tradeIndex);
        zip.file('EdgeView_Exporter_Report.docx', expDocx);
      }

      if (report_type === 'international_importer') {
        const intlPdf = await generateInternationalImporterDirectoryPdf(enrichedContacts, tradeIndex);
        zip.file('EdgeView_International_Importer_Directory.pdf', intlPdf);
        const intlDocx = await generateInternationalImporterDirectoryDocx(enrichedContacts, tradeIndex);
        zip.file('EdgeView_International_Importer_Directory.docx', intlDocx);
      }

      const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', getSafeContentDisposition('EdgeView_Contact_Directory_All_Formats.zip'));
      return res.send(zipBuf);
    }

    throw new Error(`Unsupported export format: ${format}`);
  } catch (err: any) {
    console.error('Failed to generate report:', err);
    res.status(500).json({ error: err?.message || 'Failed to generate report' });
  }
});

// Generic CSV export via POST body
app.post('/api/export/csv', (req, res) => {
  try {
    const { filename, columns, rows } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows provided to export' });
    }

    const cols: string[] = columns && Array.isArray(columns) && columns.length > 0 ? columns : Object.keys(rows[0]);
    const headerRow = cols.map((c) => sanitizeCSVCell(c)).join(',');

    const dataRows = rows.map((row) =>
      cols
        .map((col) => sanitizeCSVCell(row[col]))
        .join(',')
    );

    const csvContent = [headerRow, ...dataRows].join('\n');
    const outName = filename ? String(filename) : 'pharma_viewer_export.csv';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', getSafeContentDisposition(outName));
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to export CSV' });
  }
});

// Export Full History CSV
app.get('/api/export/history/csv', async (req, res) => {
  try {
    const historyRecords = await getHistoryFilesFromDb();
    if (!historyRecords || historyRecords.length === 0) {
      return res.status(404).json({ error: 'No history records available to export' });
    }

    const headers = ['File ID', 'File Name', 'Uploaded At', 'Row Count', 'Total Value (USD)', 'Unique Countries', 'Unique Importers', 'Source'];
    const headerRow = headers.map((h) => sanitizeCSVCell(h)).join(',');

    const dataRows = historyRecords.map((r) =>
      [
        sanitizeCSVCell(r.id),
        sanitizeCSVCell(r.file_name),
        sanitizeCSVCell(r.uploaded_at),
        sanitizeCSVCell(r.row_count),
        sanitizeCSVCell(r.total_value),
        sanitizeCSVCell(r.unique_countries),
        sanitizeCSVCell(r.unique_importers),
        sanitizeCSVCell(r.source),
      ].join(',')
    );

    const csvContent = [headerRow, ...dataRows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', getSafeContentDisposition('edgeview_history_export.csv'));
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to export history CSV' });
  }
});

// Export Country Report CSV
app.get('/api/export/country/csv', (req, res) => {
  try {
    const fileId = req.query.file_id as string;
    const rows = getAllDatasetRows(fileId);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No country data available to export' });
    }

    const headers = ['Country', 'Importer', 'Exporter', 'Product', 'Quantity', 'Unit', 'Total Value (USD)'];
    const headerRow = headers.map((h) => sanitizeCSVCell(h)).join(',');

    const dataRows = rows.map((r) =>
      [
        sanitizeCSVCell(r.country),
        sanitizeCSVCell(r.importer),
        sanitizeCSVCell(r.exporter),
        sanitizeCSVCell(r.product),
        sanitizeCSVCell(r.quantity),
        sanitizeCSVCell(r.unit),
        sanitizeCSVCell(r.total_value),
      ].join(',')
    );

    const csvContent = [headerRow, ...dataRows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', getSafeContentDisposition('edgeview_country_report.csv'));
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to export country report CSV' });
  }
});

// 6. Country Dashboard API Routes
function getAllDatasetRows(fileId?: string): Array<{
  country: string;
  importer: string;
  exporter: string;
  product: string;
  total_value: number;
  quantity: number;
  unit: string;
}> {
  let rawRows: Record<string, any>[] = [];
  if (fileId) {
    rawRows = db.files.get(fileId)?.rows || [];
  } else {
    for (const f of db.files.values()) {
      rawRows.push(...(f.rows || []));
    }
  }

  return rawRows.map((row) => {
    const country = row.Country || row.COUNTRY || row.DESTINATION_COUNTRY || row.cntry || row.ORIGIN || 'Unknown';
    const importer = row.Importer || row.IMPORTER || row.BUYER || row.BUYER_NAME || row.Consignee || 'Unknown Importer';
    const exporter = row.Exporter || row.EXPORTER || row.SELLER || row.SUPPLIER || row.SUPPLIER_NAME || 'Unknown Exporter';
    const product = row.Item || row.ITEM || row.PRODUCT || row.product_name || row.DESCRIPTION || 'Unknown Product';
    
    const fcVal = row['Total Value (USD)'] || row['Total FC (USD)'] || row.TOT_FC || row.VAL_USD || row.total_cost_usd || row.AMOUNT || 0;
    const total_value = typeof fcVal === 'number' ? fcVal : (parseFloat(String(fcVal)) || 0);

    const qtyVal = row.QTY || row.qty || row.Qty || row.QUANTITY || row.GROSS || row.NET || 0;
    const quantity = typeof qtyVal === 'number' ? qtyVal : (parseFloat(String(qtyVal)) || 0);

    const unit = row.UNT || row.unit || row.UNIT || row.UOM || row.qty_unit || 'KG';

    let cleanCountry = String(country).trim();
    if (!cleanCountry || cleanCountry.toLowerCase() === 'nan' || cleanCountry === '3004') cleanCountry = 'Unknown';
    else cleanCountry = cleanCountry.charAt(0).toUpperCase() + cleanCountry.slice(1).toLowerCase();

    return {
      country: cleanCountry,
      importer: String(importer).trim() || 'Unknown Importer',
      exporter: String(exporter).trim() || 'Unknown Exporter',
      product: String(product).trim() || 'Unknown Product',
      total_value,
      quantity,
      unit: String(unit).trim().toUpperCase() || 'KG',
    };
  });
}

app.get('/api/countries', (req, res) => {
  const fileId = req.query.file_id as string;
  const rows = getAllDatasetRows(fileId);
  const countryImporters = new Map<string, Set<string>>();

  for (const r of rows) {
    if (!countryImporters.has(r.country)) {
      countryImporters.set(r.country, new Set());
    }
    if (r.importer && r.importer !== 'Unknown Importer') {
      countryImporters.get(r.country)!.add(r.importer);
    }
  }

  const sortedCountries = Array.from(countryImporters.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  const result = sortedCountries.map((c) => ({
    country: c,
    importers_count: countryImporters.get(c)!.size,
  }));

  res.json(result);
});

app.get('/api/countries/:country/summary', (req, res) => {
  try {
    const countryParam = safeDecode(req.params.country).toLowerCase();
    const fileId = parseQueryString(req.query.file_id);
    const rows = getAllDatasetRows(fileId);

    const matched = rows.filter((r) => r.country.toLowerCase() === countryParam);

    const importers = new Set<string>();
    const exporters = new Set<string>();
    let totalExportValue = 0;

    for (const r of matched) {
      if (r.importer && r.importer !== 'Unknown Importer') importers.add(r.importer);
      if (r.exporter && r.exporter !== 'Unknown Exporter') exporters.add(r.exporter);
      totalExportValue += r.total_value;
    }

    const displayCountry = matched.length > 0 ? matched[0].country : safeDecode(req.params.country);

    res.json({
      country: displayCountry,
      importers_count: importers.size,
      total_export_value: Math.round(totalExportValue * 100) / 100,
      exporters_count: exporters.size,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch country summary' });
  }
});

app.get('/api/countries/:country/importers', (req, res) => {
  try {
    const countryParam = safeDecode(req.params.country).toLowerCase();
    const fileId = parseQueryString(req.query.file_id);
    const rows = getAllDatasetRows(fileId);

    const matched = rows.filter((r) => r.country.toLowerCase() === countryParam);

    const importerMap = new Map<string, { importer: string; total_export_value: number; exporters: Set<string> }>();

    for (const r of matched) {
      if (!importerMap.has(r.importer)) {
        importerMap.set(r.importer, {
          importer: r.importer,
          total_export_value: 0,
          exporters: new Set(),
        });
      }
      const item = importerMap.get(r.importer)!;
      item.total_export_value += r.total_value;
      if (r.exporter && r.exporter !== 'Unknown Exporter') {
        item.exporters.add(r.exporter);
      }
    }

    const result = Array.from(importerMap.values())
      .map((item) => ({
        importer: item.importer,
        total_export_value: Math.round(item.total_export_value * 100) / 100,
        exporters_count: item.exporters.size,
      }))
      .sort((a, b) => a.importer.localeCompare(b.importer, undefined, { sensitivity: 'base' }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch country importers' });
  }
});

app.get('/api/countries/:country/:importer/details', (req, res) => {
  try {
    const countryParam = safeDecode(req.params.country).toLowerCase();
    const importerParam = safeDecode(req.params.importer).toLowerCase();
    const fileId = parseQueryString(req.query.file_id);
    const rows = getAllDatasetRows(fileId);

    const matched = rows.filter(
      (r) =>
        r.country.toLowerCase() === countryParam && r.importer.toLowerCase() === importerParam
    );

    const aggregated = new Map<string, { exporter: string; product: string; quantity: number; unit: string; total_value: number }>();

    for (const r of matched) {
      const key = `${r.exporter}_${r.product}_${r.unit}`;
      if (!aggregated.has(key)) {
        aggregated.set(key, {
          exporter: r.exporter,
          product: r.product,
          quantity: 0,
          unit: r.unit,
          total_value: 0,
        });
      }
      const item = aggregated.get(key)!;
      item.quantity += r.quantity;
      item.total_value += r.total_value;
    }

    const result = Array.from(aggregated.values())
      .map((item) => ({
        exporter: item.exporter,
        product: item.product,
        quantity: Math.round(item.quantity * 100) / 100,
        unit: item.unit,
        total_value: Math.round(item.total_value * 100) / 100,
      }))
      .sort((a, b) => a.exporter.localeCompare(b.exporter, undefined, { sensitivity: 'base' }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch country importer details' });
  }
});

// Catch-all for API endpoints to prevent falling through to Vite HTML fallback
app.all(['/api/*', '/api', '/upload*', '/files*'], (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  return res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND',
  });
});

// Express Error Handler for API routes (always returns JSON, never HTML)
const globalErrorHandler: express.ErrorRequestHandler = (err, req, res, next) => {
  console.error('Express server error handler caught exception:', err);
  res.setHeader('Content-Type', 'application/json');
  const status = err.status || err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const disclose = status < 500 || process.env.NODE_ENV === 'development';
  return res.status(status).json({
    success: false,
    error: disclose ? (err?.message || 'Request failed') : 'Internal Server Error',
    code: disclose ? (err?.code || 'REQUEST_ERROR') : 'INTERNAL_ERROR',
    details: disclose ? err?.details : undefined,
  });
};

app.use(globalErrorHandler);

// ==========================================
// VITE MIDDLEWARE & SERVER STARTUP
// ==========================================
async function startServer() {
  let lockHandle: number | null = null;
  if (!isTestProcess()) {
    const lockPath = getBackendLockPath();
    if (fs.existsSync(lockPath)) {
      let ownerPid = 0;
      try { ownerPid = Number(fs.readFileSync(lockPath, 'utf8').trim()); } catch (_) {}
      let ownerAlive = false;
      if (ownerPid > 0) {
        try { process.kill(ownerPid, 0); ownerAlive = true; } catch (_) {}
      }
      if (!ownerAlive) {
        try { fs.unlinkSync(lockPath); } catch (_) {}
      }
    }
    try {
      lockHandle = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(lockHandle, String(process.pid));
      const releaseLock = () => {
        if (lockHandle !== null) {
          try { fs.closeSync(lockHandle); } catch (_) {}
          lockHandle = null;
        }
        try { fs.unlinkSync(lockPath); } catch (_) {}
      };
      process.once('exit', releaseLock);
      process.once('SIGINT', () => { releaseLock(); process.exit(0); });
      process.once('SIGTERM', () => { releaseLock(); process.exit(0); });
    } catch (error: any) {
      let owner = 'unknown';
      try { owner = fs.readFileSync(lockPath, 'utf8').trim() || owner; } catch (_) {}
      throw new Error(`Another EdgeView backend owns the authoritative database (PID ${owner}). Lock: ${lockPath}`, { cause: error });
    }
  }

  // Credential failure must abort startup, not skip hydration and serve an
  // apparently empty installation through the persistence recovery catch.
  protectStoredCredentialsAtStartup();
  try {
    const loadedFiles = await loadAllFilesFromDb();
    const persistedIds = new Set(loadedFiles.map((f) => f.id));
    const firstBoot = !persistenceDatabaseExists();

    for (const file of loadedFiles) {
      db.files.set(file.id, file);
    }

    if (loadedFiles && loadedFiles.length > 0) {
      console.log(`Loaded ${loadedFiles.length} persisted files from SQLite database.`);
    } else if (firstBoot) {
      // Genuine first-ever boot. Seeded sample files stay in-memory ONLY for
      // the demo; they are never persisted into production persistence, so no
      // automatic fake/sample data can enter the production database.
      console.log('First boot detected. Keeping seeded sample files in-memory only (not persisted to production).');
    } else {
      // The persistence DB exists but has no files: the user deleted them all.
      // Do NOT re-create deleted sample files (neither on disk nor in memory).
      console.log('No persisted files found and persistence DB exists. Skipping sample re-seed to avoid resurrecting deleted files.');
    }

    // Reconcile in-memory seed samples against what is actually persisted.
    // Sample files the user deleted must NOT reappear in memory on restart.
    // Only run when a persistence DB already exists (not the first boot above).
    if (!firstBoot) {
      for (const [id, file] of Array.from(db.files.entries())) {
        if (isTestRecord(id, file.name) && !persistedIds.has(id)) {
          db.files.delete(id);
        }
      }
    }

    db.syncCompaniesFromFiles();
    db.pruneOrphanedContacts();

    // Reset any interrupted jobs to PAUSED on server restart
    try {
      const { initializeJobsState, hydrateV1ContactEnrichment } = await import('./server/job_manager');
      const hydrated = await hydrateV1ContactEnrichment();
      if (hydrated > 0) console.log(`Hydrated ${hydrated} V1 contact enrichment overlays.`);
      await initializeJobsState();
    } catch (jobInitErr: any) {
      console.error('Failed to initialize jobs/counters state on startup:', jobInitErr.message);
    }
  } catch (dbErr) {
    console.error('Failed to initialize SQLite persistence on startup:', dbErr);
  }

  // Handle unmapped API routes with JSON 404 so they don't fall through to SPA HTML
  app.all('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: `API endpoint not found: ${req.method} ${req.path}` });
  });

  // Frontend middleware must NEVER take the whole server offline: if Vite (dev)
  // or the static build cannot be initialized, the API surface (including
  // /api/health) still starts and keeps running.
  try {
    if (useViteDevServer) {
      const vite = await createViteServer({
        root: getProjectRoot(),
        configFile: path.join(getProjectRoot(), 'vite.config.ts'),
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(getProjectRoot(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  } catch (frontendErr) {
    console.error('Failed to initialize frontend middleware; continuing in API-only mode.', frontendErr);
  }

  // Re-attach error handler after Vite/Static middleware to catch any late exceptions
  app.use(globalErrorHandler);

  const HOST = process.env.HOST || '127.0.0.1';
  const server = app.listen(PORT, HOST, () => {
    console.log(`Pharma AI EdgeView backend listening on http://${HOST}:${PORT}`);
    console.log(JSON.stringify({
      event: 'startup_contract', pid: process.pid, projectRoot: getProjectRoot(),
      configPath: getConfigPath(), databasePath: getSqlitePath(),
      apiUrl: `http://${HOST}:${PORT}`, apiVersion: API_VERSION,
    }));
  });
  server.on('error', (err: any) => {
    if (err?.code === 'EADDRINUSE') {
      console.error(`EdgeView failed to bind port ${PORT}: port already in use. Stop the existing instance first.`);
    } else {
      console.error('EdgeView server listen error:', err);
    }
    process.exitCode = 1;
  });
}

startServer();
