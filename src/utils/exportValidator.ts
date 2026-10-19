/**
 * Export Response Validator
 * Validates HTTP export responses before attempting browser file downloads.
 * Prevents HTML error pages, application fallback shells, and corrupted binaries from being saved as files.
 */

export interface ValidatedExportResult {
  blob: Blob;
  filename: string;
}

export function parseContentDispositionFilename(header: string | null, fallbackExtension: string = 'export'): string {
  if (!header) return `Export_${fallbackExtension}.${fallbackExtension}`;

  // 1. Prefer filename*=UTF-8''... (RFC 6266 / RFC 8187)
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      const rawVal = utf8Match[1].trim().replace(/^["']|["']$/g, '');
      const decoded = decodeURIComponent(rawVal);
      if (decoded) return decoded;
    } catch {
      // Fall through to standard filename
    }
  }

  // 2. Fall back to standard filename="..."
  const asciiMatch = header.match(/filename=["']?([^"';]+)["']?/i);
  if (asciiMatch && asciiMatch[1]) {
    try {
      const decoded = decodeURIComponent(asciiMatch[1].trim());
      if (decoded) return decoded;
    } catch {
      return asciiMatch[1].trim();
    }
  }

  return `Export_${fallbackExtension}.${fallbackExtension}`;
}

export async function processAndValidateExportResponse(
  response: Response,
  expectedFormat: string
): Promise<ValidatedExportResult> {
  const contentType = (response.headers.get('Content-Type') || '').toLowerCase();

  // 1. Check HTTP Status
  if (!response.ok) {
    let errMsg = `Export server error (HTTP ${response.status})`;
    try {
      const text = await response.text();
      if (text.trim().startsWith('{')) {
        const json = JSON.parse(text);
        if (json.error) errMsg = json.error;
      } else if (text.toLowerCase().includes('<!doctype') || text.toLowerCase().includes('<html')) {
        errMsg = `Export failed: Server returned an HTTP ${response.status} error page.`;
      }
    } catch {
      // Ignore text parse failure
    }
    throw new Error(errMsg);
  }

  // 2. Reject HTML Content-Type for non-HTML export requests
  if (contentType.includes('text/html')) {
    throw new Error('Export failed. The server returned an HTML page instead of the requested export document.');
  }

  // 3. Extract Filename from Content-Disposition
  const contentDisposition = response.headers.get('Content-Disposition');
  const defaultExt = expectedFormat === 'all' ? 'zip' : expectedFormat;
  const filename = parseContentDispositionFilename(contentDisposition, defaultExt);

  // 4. Read Response ArrayBuffer & Validate Signatures
  const arrayBuffer = await response.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('Export failed. Server returned an empty file response.');
  }

  const headerBytes = new Uint8Array(arrayBuffer.slice(0, Math.min(1024, arrayBuffer.byteLength)));
  const headerStr = Array.from(headerBytes).map((b) => String.fromCharCode(b)).join('');
  const lowerHeader = headerStr.toLowerCase();

  // Reject HTML error signatures in body
  if (
    lowerHeader.includes('<!doctype') ||
    lowerHeader.includes('<html') ||
    lowerHeader.includes('<head') ||
    lowerHeader.includes('<style') ||
    lowerHeader.includes('<script') ||
    lowerHeader.includes('__aistudio_warmup_failed') ||
    lowerHeader.includes('your application failed to start')
  ) {
    throw new Error('Export failed. Server returned HTML error page instead of valid export file content.');
  }

  // Validate format specific byte signatures
  const format = expectedFormat.toLowerCase();

  if (format === 'pdf') {
    if (!headerStr.startsWith('%PDF-')) {
      throw new Error('Export failed. Received file content is not a valid PDF document.');
    }
  } else if (format === 'xlsx' || format === 'docx' || format === 'all') {
    // ZIP signature check: 0x50 0x4B ('PK')
    if (headerBytes.length >= 2 && !(headerBytes[0] === 0x50 && headerBytes[1] === 0x4B)) {
      throw new Error(`Export failed. Received file content is not a valid ${format.toUpperCase()} archive package.`);
    }
  } else if (format === 'csv') {
    if (lowerHeader.trim().startsWith('<!doctype') || lowerHeader.trim().startsWith('<html')) {
      throw new Error('Export failed. Server returned HTML instead of CSV data.');
    }
  }

  const blobMime = contentType || getMimeForFormat(format);
  const blob = new Blob([arrayBuffer], { type: blobMime });

  return { blob, filename };
}

function getMimeForFormat(format: string): string {
  switch (format.toLowerCase()) {
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'csv':
      return 'text/csv; charset=utf-8';
    case 'all':
      return 'application/zip';
    default:
      return 'application/octet-stream';
  }
}
