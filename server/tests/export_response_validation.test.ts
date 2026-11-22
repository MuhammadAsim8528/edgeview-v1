import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PDFDocument from 'pdfkit';
import { processAndValidateExportResponse } from '../../src/utils/exportValidator';

const incompleteMessage = 'Export incomplete: one or more requested formats could not be generated. Retry, or export an individual format.';
for (const failed of ['PDF', 'CSV,DOCX', 'unexpected private server text']) {
  const response = new Response('PK synthetic partial archive', { headers: { 'Content-Type': 'application/zip', 'X-Export-Failed-Formats': failed } });
  response.arrayBuffer = async () => { throw new Error('A reported incomplete artifact must not be read/downloaded'); };
  await assert.rejects(processAndValidateExportResponse(response, 'all'), error => error instanceof Error && error.message === incompleteMessage);
}

async function zipWith(files: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, contents] of Object.entries(files)) zip.file(name, contents);
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
}

async function realPdf(): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on('error', reject);
    doc.text('Synthetic export response');
    doc.end();
  });
}

const bodies: Record<string, Uint8Array> = {
  csv: new TextEncoder().encode('Company\nSynthetic Δ'),
  pdf: await realPdf(),
  docx: await zipWith({ '[Content_Types].xml': '<Types/>', 'word/document.xml': '<document/>' }),
  xlsx: await zipWith({ '[Content_Types].xml': '<Types/>', 'xl/workbook.xml': '<workbook/>' }),
  all: await zipWith({ 'report.csv': 'Company\nSynthetic Δ' }),
};
for (const [format, body] of Object.entries(bodies)) {
  const type = format === 'csv' ? 'text/csv' : format === 'pdf' ? 'application/pdf' : 'application/zip';
  const result = await processAndValidateExportResponse(new Response(body, {
    headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="Synthetic.${format === 'all' ? 'zip' : format}"` },
  }), format);
  assert.equal(result.blob.size, body.byteLength);
}

const markupCsv = '﻿"Company","Literal markup"\r\n"R&D","<!doctype html> <script>alert(1)</script> <html><head><style>body{}</style></head>"';
const csvResult = await processAndValidateExportResponse(new Response(markupCsv, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } }), 'csv');
assert.deepEqual(new Uint8Array(await csvResult.blob.arrayBuffer()), new TextEncoder().encode(markupCsv), 'valid CSV markup must survive byte-for-byte');

for (const format of ['docx', 'xlsx', 'all']) {
  for (const invalid of ['P', 'PK', 'PK synthetic', new Uint8Array([0x50, 0x4b, 0x03, 0x04])]) {
    await assert.rejects(
      processAndValidateExportResponse(new Response(invalid, { headers: { 'Content-Type': 'application/zip' } }), format),
      /archive package/,
      `${format} accepted prefix-only archive input`,
    );
  }
  const valid = bodies[format];
  for (const truncated of [valid.slice(0, 12), valid.slice(0, -1), valid.slice(0, -22)]) {
    await assert.rejects(
      processAndValidateExportResponse(new Response(truncated, { headers: { 'Content-Type': 'application/zip' } }), format),
      /archive package/,
      `${format} accepted a truncated archive`,
    );
  }
}
await assert.rejects(processAndValidateExportResponse(new Response('%PDF-1.7 synthetic', { headers: { 'Content-Type': 'application/pdf' } }), 'pdf'), /valid PDF/);
await assert.rejects(processAndValidateExportResponse(new Response(bodies.pdf.slice(0, -12), { headers: { 'Content-Type': 'application/pdf' } }), 'pdf'), /valid PDF/);

await assert.rejects(processAndValidateExportResponse(new Response('temporarily unavailable', { status: 503 }), 'all'), /HTTP 503/);
await assert.rejects(processAndValidateExportResponse(Response.json({ error: 'SYNTHETIC_PRIVATE_STORAGE_PATH' }, { status: 500 }), 'all'), error => error instanceof Error && error.message === 'Export server error (HTTP 500)');
await assert.rejects(processAndValidateExportResponse(new Response('<html>failure</html>', { headers: { 'Content-Type': 'text/html' } }), 'all'), /HTML page/);
console.log('PASS real five-format responses, structural archive/PDF rejection, CSV markup preservation, incomplete artifact and HTTP/HTML failures');
