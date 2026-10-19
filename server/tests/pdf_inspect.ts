import zlib from 'zlib';

/**
 * Lightweight PDF inspector used by the contact-directory tests to verify real
 * generated PDFs: page counting and raw text extraction (no external deps).
 */

export function countPdfPages(pdfBuffer: Buffer): number {
  const str = pdfBuffer.toString('latin1');
  const matches = str.match(/\/Type\s*\/Page(?![s])/g);
  return matches ? matches.length : 0;
}

function decodePdfString(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '\\' && i + 1 < raw.length) {
      const next = raw[i + 1];
      if (next === 'n') {
        out += '\n';
        i++;
      } else if (next === 'r') {
        out += '\r';
        i++;
      } else if (next === 't') {
        out += '\t';
        i++;
      } else if (next === 'b') {
        out += '\b';
        i++;
      } else if (next === 'f') {
        out += '\f';
        i++;
      } else if (next === '(' || next === ')' || next === '\\') {
        out += next;
        i++;
      } else if (/\d/.test(next)) {
        let oct = next;
        i++;
        for (let k = 0; k < 2 && i + 1 < raw.length && /\d/.test(raw[i + 1]); k++) {
          oct += raw[i + 1];
          i++;
        }
        out += String.fromCharCode(parseInt(oct, 8));
      } else {
        out += next;
        i++;
      }
    } else {
      out += ch;
    }
  }
  return out;
}

function extractTokens(stream: string): string[] {
  const tokens: string[] = [];
  const tokenRe = /(?:\((?:\\.|[^\\()])*\)|<\s*[0-9a-fA-F\s]+\s*>)/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(stream)) !== null) {
    const tok = m[0];
    if (tok.startsWith('(')) {
      tokens.push(decodePdfString(tok.slice(1, -1)));
    } else {
      const hex = tok.slice(1, -1).replace(/\s+/g, '');
      let out = '';
      for (let i = 0; i + 1 < hex.length; i += 2) {
        out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
      }
      tokens.push(out);
    }
  }
  return tokens;
}

function decompressStreams(pdfBuffer: Buffer): string {
  const str = pdfBuffer.toString('latin1');
  const streams: string[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) {
    const raw = m[1];
    const bytes = Buffer.from(raw, 'latin1');
    try {
      streams.push(zlib.inflateSync(bytes).toString('latin1'));
    } catch {
      try {
        streams.push(zlib.inflateRawSync(bytes).toString('latin1'));
      } catch {
        streams.push(raw);
      }
    }
  }
  return streams.join('\n');
}

/**
 * Extracts all text show-operators from the generated PDF. PDFKit writes every
 * text run as a Tj/TJ operator, so reconstructing the strings gives us the real
 * visible content for completeness assertions.
 */
export function extractPdfText(pdfBuffer: Buffer): string {
  const content = decompressStreams(pdfBuffer);
  const parts: string[] = [];
  const re = /\[([\s\S]*?)\]\s*TJ|\((?:\\.|[^\\()])*\)\s*Tj|\((?:\\.|[^\\()])*\)\s*'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const group = m[1] ?? m[0];
    parts.push(...extractTokens(group));
  }
  return parts.join('');
}

/**
 * PDFKit emits kerned TJ arrays that split words at arbitrary points (e.g.
 * "BRIGHT\nON"), so presence checks compare whitespace-insensitively while
 * preserving character order.
 */
export function pdfTextContains(text: string, frag: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, '');
  return norm(text).includes(norm(frag));
}

export function assertPdfContainsText(pdfBuffer: Buffer, expected: string[], label: string) {
  const text = extractPdfText(pdfBuffer);
  const missing: string[] = [];
  for (const frag of expected) {
    if (!pdfTextContains(text, frag)) missing.push(frag);
  }
  if (missing.length > 0) {
    throw new Error(
      `[${label}] PDF is missing expected content: ${missing.join(', ')}`
    );
  }
}
