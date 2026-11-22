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

function decodeUtf16Hex(hex: string): string {
  const bytes = Buffer.from(hex, 'hex');
  if (bytes.length % 2 !== 0) return bytes.toString('latin1');
  return Buffer.from(bytes).swap16().toString('utf16le');
}

type UnicodeGlyphMap = Map<number, string>;

function parseUnicodeGlyphMap(cmap: string): UnicodeGlyphMap {
  const glyphs: UnicodeGlyphMap = new Map();
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      glyphs.set(parseInt(pair[1], 16), decodeUtf16Hex(pair[2]));
    }
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const range of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([\s\S]*?)\]/g)) {
      const start = parseInt(range[1], 16);
      for (const [index, destination] of Array.from(range[3].matchAll(/<([0-9a-fA-F]+)>/g)).entries()) {
        glyphs.set(start + index, decodeUtf16Hex(destination[1]));
      }
    }
    const withoutArrays = block[1].replace(/<[^>]+>\s*<[^>]+>\s*\[[\s\S]*?\]/g, '');
    for (const range of withoutArrays.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const start = parseInt(range[1], 16), end = parseInt(range[2], 16), destination = parseInt(range[3], 16);
      for (let code = start; code <= end; code++) glyphs.set(code, String.fromCodePoint(destination + code - start));
    }
  }
  return glyphs;
}

function streamText(body: string): string | null {
  const match = body.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
  if (!match) return null;
  const raw = Buffer.from(match[1], 'latin1');
  try { return zlib.inflateSync(raw).toString('latin1'); } catch {
    try { return zlib.inflateRawSync(raw).toString('latin1'); } catch { return raw.toString('latin1'); }
  }
}

function unicodeGlyphMapsByFont(pdfBuffer: Buffer): Map<string, UnicodeGlyphMap> {
  const source = pdfBuffer.toString('latin1');
  const objects = new Map<string, string>();
  for (const match of source.matchAll(/(\d+)\s+0\s+obj\s*([\s\S]*?)endobj/g)) objects.set(match[1], match[2]);
  const maps = new Map<string, UnicodeGlyphMap>();
  for (const resource of source.matchAll(/\/(F[^\s/]+)\s+(\d+)\s+0\s+R/g)) {
    const fontObject = objects.get(resource[2]);
    const cmapReference = fontObject?.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
    const cmapBody = cmapReference ? objects.get(cmapReference[1]) : undefined;
    const cmap = cmapBody ? streamText(cmapBody) : null;
    if (cmap) maps.set(resource[1], parseUnicodeGlyphMap(cmap));
  }
  return maps;
}

function decodeHexToken(hex: string, glyphs?: UnicodeGlyphMap): string {
  if (glyphs) {
    let out = '';
    for (let i = 0; i + 3 < hex.length; i += 4) out += glyphs.get(parseInt(hex.slice(i, i + 4), 16)) ?? '�';
    return out;
  }
  let out = '';
  for (let i = 0; i + 1 < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

function extractTokens(stream: string, glyphs?: UnicodeGlyphMap): string[] {
  const tokens: string[] = [];
  const tokenRe = /(?:\((?:\\.|[^\\()])*\)|<\s*[0-9a-fA-F\s]+\s*>)/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(stream)) !== null) {
    const tok = m[0];
    if (tok.startsWith('(')) tokens.push(decodePdfString(tok.slice(1, -1)));
    else tokens.push(decodeHexToken(tok.slice(1, -1).replace(/\s+/g, ''), glyphs));
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
  const fontMaps = unicodeGlyphMapsByFont(pdfBuffer);
  const parts: string[] = [];
  let currentFont = '';
  const re = /\/([^\s]+)\s+[\d.]+\s+Tf|\[([\s\S]*?)\]\s*TJ|<\s*([0-9a-fA-F\s]+)\s*>\s*Tj|\((?:\\.|[^\\()])*\)\s*Tj|\((?:\\.|[^\\()])*\)\s*'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m[1]) {
      currentFont = m[1];
      continue;
    }
    const glyphs = fontMaps.get(currentFont);
    if (m[3]) parts.push(decodeHexToken(m[3].replace(/\s+/g, ''), glyphs));
    else parts.push(...extractTokens(m[2] ?? m[0], glyphs));
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
