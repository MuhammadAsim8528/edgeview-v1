import assert from 'node:assert/strict';
import { processAndValidateExportResponse } from '../../src/utils/exportValidator';

const incompleteMessage = 'Export incomplete: one or more requested formats could not be generated. Retry, or export an individual format.';
for (const failed of ['PDF', 'CSV,DOCX', 'unexpected private server text']) {
  const response = new Response('PK synthetic partial archive', { headers: { 'Content-Type': 'application/zip', 'X-Export-Failed-Formats': failed } });
  response.arrayBuffer = async () => { throw new Error('A reported incomplete artifact must not be read/downloaded'); };
  await assert.rejects(processAndValidateExportResponse(response, 'all'), error => error instanceof Error && error.message === incompleteMessage);
}
for (const [format, body, type] of [['csv', 'Company\nSynthetic Δ', 'text/csv'], ['pdf', '%PDF-1.7 synthetic', 'application/pdf'], ['docx', 'PK synthetic', 'application/zip'], ['xlsx', 'PK synthetic', 'application/zip'], ['all', 'PK synthetic', 'application/zip']]) {
  const result = await processAndValidateExportResponse(new Response(body, { headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="Synthetic.${format === 'all' ? 'zip' : format}"` } }), format);
  assert.ok(result.blob.size > 0);
}
await assert.rejects(processAndValidateExportResponse(new Response('temporarily unavailable', { status: 503 }), 'all'), /HTTP 503/);
await assert.rejects(processAndValidateExportResponse(new Response('<html>failure</html>', { headers: { 'Content-Type': 'text/html' } }), 'all'), /HTML page/);
console.log('PASS incomplete artifacts refused before body read, safe fixed error, normal five-format responses and HTTP/HTML failures');
