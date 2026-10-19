/**
 * Server-side Canonical HTTP Header Utility for EdgeView.
 * Provides RFC 6266 compliant Content-Disposition values while preserving Unicode filenames
 * and protecting against CRLF injection and ByteString errors.
 */

export function getSafeContentDisposition(filename: string, inline: boolean = false): string {
  if (!filename || typeof filename !== 'string') {
    filename = 'export';
  }

  // 1. Protection against Header Injection: Strip CR, LF, and null bytes completely
  const sanitized = filename.replace(/[\r\n\0]/g, '').trim() || 'export';

  // 2. Safe ASCII Fallback:
  // Replace any non-ASCII characters (code points > 127 or < 32) with underscores,
  // and strip double-quotes and backslashes to prevent header parameter syntax breaking.
  const safeAscii = sanitized
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_')
    .trim() || 'export';

  // 3. RFC 8187 / RFC 6266 UTF-8 percent-encoding for modern browsers:
  // Additionally percent-encode attr-char specials ' ( ) * so apostrophes in names survive HTTP headers intact.
  const utf8Encoded = encodeURIComponent(sanitized).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

  const dispositionType = inline ? 'inline' : 'attachment';

  // RFC 6266 format: filename="<ASCII_FALLBACK>"; filename*=UTF-8''<PERCENT_ENCODED_UNICODE>
  return `${dispositionType}; filename="${safeAscii}"; filename*=UTF-8''${utf8Encoded}`;
}

/**
 * Sanitizes arbitrary diagnostic/custom header values (e.g. X-Export-Failed-Formats)
 * to guarantee strict ASCII compliance without throwing ByteString exceptions.
 */
export function getSafeAsciiHeaderValue(value: string | string[]): string {
  const strVal = Array.isArray(value) ? value.join(', ') : String(value || '');
  return strVal
    .replace(/[\r\n\0]/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .trim();
}

export interface SafeHeaderValidation {
  valid: boolean;
  invalidCharIndex?: number;
  invalidCodePoint?: string;
  errorMessage?: string;
}

export function validateHttpHeaderValue(value: string, headerName: string = 'Header'): SafeHeaderValidation {
  if (value === undefined || value === null) {
    return { valid: false, errorMessage: `${headerName} value cannot be null or undefined` };
  }
  const str = String(value);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code > 255 || code === 0 || code === 10 || code === 13 || (code < 32 && code !== 9)) {
      const codePointHex = `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
      return {
        valid: false,
        invalidCharIndex: i,
        invalidCodePoint: codePointHex,
        errorMessage: `${headerName} contains an invalid HTTP-header character at index ${i} (${codePointHex}). Please check provider configuration and API keys.`
      };
    }
  }
  return { valid: true };
}

export function assertSafeHeaderValue(value: string, headerName: string = 'Header'): string {
  const result = validateHttpHeaderValue(value, headerName);
  if (!result.valid) {
    throw new Error(result.errorMessage);
  }
  return value;
}
