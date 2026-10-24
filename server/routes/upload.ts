import express from 'express';
import multer from 'multer';
import { db } from '../db';
import { parseFile, ParsedResult } from '../parsers';
import { computeSummary } from '../summary';
import {
  saveFileToDb,
  computeFileHash,
  findFileByHash,
  deleteFileFromHistory,
} from '../sqlite_persistence';
import { captureMonitoringEvent, classifyMonitoringError } from '../monitoring';

export const uploadRouter = express.Router();

const ALLOWED_EXTENSIONS = ['nvl', 'dbf', 'csv', 'tsv', 'xlsx', 'docx', 'txt'];

export function validateUploadFileName(name: string): boolean {
  // Validate the exact multipart name: trimming would disagree with parser dispatch.
  if (!name || /[<>:"/\\|?*\x00-\x1f\x7f]/.test(name) || /[ .]$/.test(name)) return false;
  if (/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$)(?:[. ]|$)/i.test(name)) return false;
  const dot = name.lastIndexOf('.');
  return dot > 0 && Boolean(name.slice(0, dot).replace(/[.\s]/g, ''))
    && ALLOWED_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase());
}

function unsupportedFile(res: express.Response) {
  return res.status(400).json({
    success: false,
    error: 'Unsupported or unsafe upload filename. Choose a supported file with a normal filename.',
    code: 'UNSUPPORTED_FILE_TYPE',
    details: `Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`,
  });
}

// Configure multer storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  // Keep wire paths visible to validation instead of silently repairing them.
  preservePath: true,
  defParamCharset: 'utf8',
  fileFilter: (_req, file, callback) => {
    if (!validateUploadFileName(file.originalname)) {
      return callback(Object.assign(new Error('Invalid upload filename'), { code: 'UNSUPPORTED_FILE_TYPE' }));
    }
    callback(null, true);
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Middleware to catch Multer errors (e.g. file size limit) gracefully as JSON
function uploadFileHandler(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader('Content-Type', 'application/json');
  
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'UNSUPPORTED_FILE_TYPE') return unsupportedFile(res);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'File size exceeds the 50MB maximum limit.',
            code: 'FILE_TOO_LARGE',
            details: 'Maximum allowed file size is 50MB.',
          });
        }
        return res.status(400).json({
          success: false,
          error: `Upload error: ${err.message}`,
          code: 'MULTER_ERROR',
          details: err.message,
        });
      }
      return res.status(400).json({
        success: false,
        error: err?.message || 'File upload failed',
        code: 'UPLOAD_FAILED',
      });
    }
    next();
  });
}

// File Upload Handler Route
async function handleUpload(req: express.Request, res: express.Response) {
  res.setHeader('Content-Type', 'application/json');
  const monitoringStartedAt = Date.now();

  try {
    // 1. Validate File Existence
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided. Please attach a file to upload.',
        code: 'NO_FILE_PROVIDED',
      });
    }

    // 2. Validate File Content & Size
    if (req.file.size === 0 || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Uploaded file is empty (0 bytes). Please upload a valid file.',
        code: 'EMPTY_FILE',
      });
    }

    const originalName = req.file.originalname || 'uploaded_file';

    // 3. Validate File Extension
    if (!validateUploadFileName(originalName)) return unsupportedFile(res);
    void captureMonitoringEvent('dataset_import_started', { stage: 'import', outcome: 'started' });

    const buffer = req.file.buffer;
    const fileHash = computeFileHash(buffer);

    // 4. Check for Duplicate Files
    try {
      const existingFile = await findFileByHash(fileHash);
      if (existingFile) {
        db.files.set(existingFile.id, existingFile);
        db.syncCompaniesFromFiles();
        void captureMonitoringEvent('dataset_import_completed', { stage: 'import', outcome: 'skipped', duration_ms: Date.now() - monitoringStartedAt });
        return res.status(200).json({
          success: true,
          data: existingFile,
          duplicate: true,
          message: 'File already exists in database',
          ...existingFile,
        });
      }
    } catch (hashErr) {
      console.warn('Duplicate check warning:', hashErr);
    }

    // 5. Graceful Parser Execution
    let parsed: ParsedResult;
    let warningMessage: string | undefined;

    try {
      parsed = await parseFile(originalName, buffer);
      if (parsed.error) throw new Error(parsed.error);
      if (!parsed.rows || parsed.rows.length === 0) {
        warningMessage = 'Parsing completed, but no data records were found in the file. Some columns or data might be missing or unformatted.';
      }
    } catch (parseErr: any) {
      console.warn('File parsing rejected:', parseErr);
      void captureMonitoringEvent('dataset_import_failed', { stage: 'import', outcome: 'failed', duration_ms: Date.now() - monitoringStartedAt });
      return res.status(422).json({
        success: false,
        error: 'The uploaded file could not be parsed safely. Verify the file format and try again.',
        code: 'FILE_PARSE_FAILED',
      });
    }

    // 6. Compute Summary safely
    let summary: any;
    try {
      summary = computeSummary(parsed.columns, parsed.rows);
    } catch (sumErr) {
      console.warn('Compute summary warning:', sumErr);
      summary = {
        total_rows: parsed.rows?.length || 0,
        exporters_count: 0,
        importers_count: 0,
        total_cost_usd: 0,
        exporters_list: [],
        importers_list: [],
      };
    }

    const fileRecord = {
      id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: originalName,
      file_type: parsed.file_type,
      size: req.file.size,
      upload_time: new Date().toISOString(),
      columns: parsed.columns || [],
      rows: parsed.rows || [],
      summary,
      raw_text: parsed.raw_text,
      doc_tables: parsed.doc_tables,
    };

    // 7. Durable persistence must succeed before the in-memory dataset is
    // published or a 201 response is returned. Otherwise a disk-full/permission
    // failure could look successful until the next restart.
    let jsonPersisted = false;
    let sqlDb: any = null;
    try {
      await saveFileToDb(fileRecord, fileHash, 'real');
      jsonPersisted = true;

      // Insert rows into history_data table. Clear the same filename first so a
      // retry after an interrupted/failed upload is idempotent rather than
      // duplicating trade rows.
      const { getDb } = await import('../sqlite');
      sqlDb = await getDb();
      await sqlDb.run('DELETE FROM history_data WHERE file_name = ?', [originalName]);
      if (parsed.rows && parsed.rows.length > 0) {
        const stmt = await sqlDb.prepare(`
          INSERT INTO history_data (
            be_link, be_date, hs_code, item, importer, exporter, country, tot_fc, qty, unit, agent_name, file_name
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of parsed.rows) {
          await stmt.run(
            r.be_link || r['BE Link'] || '',
            r.be_date || r['BE Date'] || '',
            r.hs_code || r['HS Code'] || '',
            r.item || r.Item || r.ITEM || '',
            r.importer || r.Importer || r.IMPORTER || r.BUYER || '',
            r.exporter || r.Exporter || r.EXPORTER || r.SUPPLIER || '',
            r.country || r.Country || r.COUNTRY || r.ORIGIN || '',
            typeof r['Total Value (USD)'] === 'number' ? r['Total Value (USD)'] : (typeof r['Total FC (USD)'] === 'number' ? r['Total FC (USD)'] : (typeof r.TOT_FC === 'number' ? r.TOT_FC : 0)),
            typeof r.Qty === 'number' ? r.Qty : 0,
            r.unit || r.Unit || r.UNIT || '',
            r.agent_name || r['Agent Name'] || '',
            originalName
          );
        }
        await stmt.finalize();
      }

    } catch (dbErr: any) {
      console.error('Durable save error during upload:', dbErr);
      // Prevent a half-saved JSON record from turning the next retry into a
      // false duplicate success when history_data was not durably completed.
      if (jsonPersisted) {
        try { await deleteFileFromHistory(fileRecord.id); }
        catch (rollbackErr) { console.error('Failed to roll back primary upload record:', rollbackErr); }
      }
      if (sqlDb) {
        try {
          await sqlDb.run('DELETE FROM history_data WHERE file_name = ?', [originalName]);
          await sqlDb.flush();
        } catch (cleanupErr) {
          console.error('Failed to clean partial history_data upload state:', cleanupErr);
        }
      }
      const code = dbErr?.code === 'DISK_FULL' ? 'DISK_FULL' : 'PERSISTENCE_WRITE_FAILED';
      const duration_ms = Date.now() - monitoringStartedAt;
      void captureMonitoringEvent('dataset_import_failed', { stage: 'import', outcome: 'failed', duration_ms });
      void captureMonitoringEvent('runtime_error', { stage: 'storage', outcome: 'failed', duration_ms, error_code: code });
      return res.status(507).json({
        success: false,
        code,
        error: code === 'DISK_FULL'
          ? 'EdgeView could not save the uploaded dataset because storage is full.'
          : 'EdgeView could not durably save the uploaded dataset.',
        recoverable: true,
        remediation: code === 'DISK_FULL' ? 'Free disk space and retry the upload.' : 'Check file permissions/storage health and retry.',
      });
    }

    db.files.set(fileRecord.id, fileRecord);

    // 8. Sync Contacts
    try {
      db.syncCompaniesFromFiles();
    } catch (syncErr) {
      console.error('Sync companies warning during upload:', syncErr);
    }

    // 8.5. Memory Optimization: Purge heavy raw_text string only.
    // Full dataset rows stay in memory so paginated /api/files/:id/data, CSV export and
    // full-dataset processing keep working for large files. HTTP responses omit the raw rows.
    fileRecord.raw_text = undefined;

    // 9. Return Lightweight Metadata JSON Response for Fast Client-Side Transfer
    const fileRecordResponse = {
      ...fileRecord,
      rows: [], // Omit raw rows array from HTTP payload; client queries /api/files/:id/data for paginated view
    };

    void captureMonitoringEvent('dataset_import_completed', { stage: 'import', outcome: 'success', duration_ms: Date.now() - monitoringStartedAt });
    return res.status(201).json({
      success: true,
      message: 'File uploaded and parsed successfully',
      data: fileRecordResponse,
      warning: warningMessage,
      ...fileRecordResponse,
    });
  } catch (err: any) {
    console.error('File upload route error:', err);
    const duration_ms = Date.now() - monitoringStartedAt;
    void captureMonitoringEvent('dataset_import_failed', { stage: 'import', outcome: 'failed', duration_ms });
    void captureMonitoringEvent('runtime_error', { stage: 'import', outcome: 'failed', duration_ms, error_code: classifyMonitoringError(err) });
    return res.status(500).json({
      success: false,
      error: err?.message || 'An unexpected error occurred while processing the file upload.',
      code: err?.code || 'INTERNAL_SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? err?.message : undefined,
    });
  }
}

// Support all upload route variations regardless of mount point (/api, /files/upload, /upload, etc.)
const UPLOAD_PATHS = ['/', '/upload', '/files/upload', '/api/upload', '/api/files/upload'];

uploadRouter.post(UPLOAD_PATHS, uploadFileHandler, handleUpload);

// Handle non-POST methods on upload endpoints gracefully with JSON
uploadRouter.all(UPLOAD_PATHS, (req, res, next) => {
  if (req.method === 'POST') return next();
  res.setHeader('Content-Type', 'application/json');
  return res.status(405).json({
    success: false,
    error: `Method ${req.method} not allowed for upload endpoint. Please use POST.`,
    code: 'METHOD_NOT_ALLOWED',
  });
});

