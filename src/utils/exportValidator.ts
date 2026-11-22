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

function hasValidPdfStructure(bytes: Uint8Array): boolean {
  if (bytes.length < 32 || !String.fromCharCode(...bytes.slice(0, 5)).startsWith('%PDF-')) return false;
  const tail = Array.from(bytes.slice(-1024), (b) => String.fromCharCode(b)).join('');
  const match = tail.match(/startxref\s+(\d+)\s+%%EOF\s*$/);
  if (!match) return false;
  const xrefOffset = Number(match[1]);
  return Number.isSafeInteger(xrefOffset) && xrefOffset > 5 && xrefOffset < bytes.length - 8;
}

function validateArchiveStructure(bytes: Uint8Array, format: string): boolean {
  if (bytes.length < 22) return false;
  const startsArchive = bytes[0] === 0x50 && bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) || (bytes[2] === 0x05 && bytes[3] === 0x06));
  if (!startsArchive) return false;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const firstEocd = Math.max(0, bytes.length - 22 - 65535);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= firstEocd; i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0 || view.getUint16(eocd + 4, true) !== 0 || view.getUint16(eocd + 6, true) !== 0) return false;

  const entriesOnDisk = view.getUint16(eocd + 8, true);
  const entries = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (entries === 0 || entries !== entriesOnDisk || entries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) return false;
  if (centralOffset > eocd || centralSize !== eocd - centralOffset) return false;

  const decoder = new TextDecoder();
  const names = new Set<string>();
  let cursor = centralOffset;
  for (let index = 0; index < entries; index++) {
    if (cursor + 46 > eocd || view.getUint32(cursor, true) !== 0x02014b50) return false;
    const flags = view.getUint16(cursor + 8, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if ((flags & 1) !== 0 || compressedSize === 0xffffffff || localOffset === 0xffffffff || next > eocd) return false;
    if (localOffset + 30 > centralOffset || view.getUint32(localOffset, true) !== 0x04034b50) return false;

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset > centralOffset || compressedSize > centralOffset - dataOffset) return false;
    if (localNameLength !== nameLength || localOffset + 30 + nameLength > bytes.length) return false;
    const centralName = bytes.slice(cursor + 46, cursor + 46 + nameLength);
    const localName = bytes.slice(localOffset + 30, localOffset + 30 + nameLength);
    if (!centralName.every((value, i) => value === localName[i])) return false;

    names.add(decoder.decode(centralName));
    cursor = next;
  }
  if (cursor !== eocd) return false;
  if (!names.has('[Content_Types].xml')) return format === 'all';
  if (format === 'docx') return names.has('word/document.xml');
  if (format === 'xlsx') return names.has('xl/workbook.xml');
  return format === 'all';
}

export async function processAndValidateExportResponse(
  response: Response,
  expectedFormat: string
): Promise<ValidatedExportResult> {
  const contentType = (response.headers.get('Content-Type') || '').toLowerCase();

  // 1. Check HTTP Status
  if (!response.ok) {
    let errMsg = `Export server error (HTTP ${response.status})`;
    // Infrastructure failures can contain private paths or exception details.
    // Retain the status for support without displaying an upstream raw message.
    if (response.status >= 500) throw new Error(errMsg);
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

  // A valid ZIP can still be incomplete. The server explicitly reports failed
  // formats; do not download it and then claim all requested formats succeeded.
  if (response.headers.get('X-Export-Failed-Formats')?.trim()) {
    throw new Error('Export incomplete: one or more requested formats could not be generated. Retry, or export an individual format.');
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

  // Validate format-specific structure. CSV is tabular text: markup in a cell is
  // data, not proof of an HTML fallback, so only non-CSV formats get this scan.
  const format = expectedFormat.toLowerCase();
  if (format !== 'csv') {
    const documentPrefix = headerStr.replace(/^(?:\s|<!--[\s\S]*?-->|<\?xml[\s\S]*?\?>)+/i, '');
    if (
      /^(?:<!doctype\b|<(?:html|head|body|style|script)\b)/i.test(documentPrefix) ||
      /^(?:__aistudio_warmup_failed|your application failed to start)/i.test(documentPrefix)
    ) {
      throw new Error('Export failed. Server returned HTML error page instead of valid export file content.');
    }
  }

  if (format === 'pdf') {
    if (!hasValidPdfStructure(new Uint8Array(arrayBuffer))) {
      throw new Error('Export failed. Received file content is not a valid PDF document.');
    }
  } else if (format === 'xlsx' || format === 'docx' || format === 'all') {
    if (!validateArchiveStructure(new Uint8Array(arrayBuffer), format)) {
      throw new Error(`Export failed. Received file content is not a valid ${format.toUpperCase()} archive package.`);
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
