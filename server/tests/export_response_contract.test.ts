import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { processAndValidateExportResponse } from '../../src/utils/exportValidator';

test('ordinary CSV data can contain literal markup without becoming an HTML document', async () => {
  const csv = 'Date,Item\n2026-01-01,"literal <script>not executable</script> & <header> text"\n';
  const result = await processAndValidateExportResponse(new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } }), 'csv');
  assert.equal(await result.blob.text(), csv, 'Export must preserve literal cell contents');
});

test('HTML fallback documents remain rejected even when mislabeled as CSV', async () => {
  for (const body of ['<!DOCTYPE html><html><body>Unavailable</body></html>', '  <HTML><HEAD></HEAD><BODY>Unavailable</BODY></HTML>',
    '\uFEFF <!-- server notice --> \n<html><body>Unavailable</body></html>', '<?xml version="1.0"?>\n<html>Unavailable</html>']) {
    await assert.rejects(processAndValidateExportResponse(new Response(body, { headers: { 'Content-Type': 'text/csv' } }), 'csv'), /HTML/i);
  }
});

test('truncated ZIP signatures do not qualify as XLSX, DOCX or ZIP exports', async () => {
  for (const format of ['xlsx', 'docx', 'all']) {
    for (const body of [new Uint8Array([0x50]), new Uint8Array([0x50, 0x4b]), new Uint8Array([0x50, 0x4b, 0x03, 0x04])]) {
      await assert.rejects(processAndValidateExportResponse(new Response(body, { headers: { 'Content-Type': 'application/zip' } }), format), /valid .*archive/i);
    }
  }
});

test('an actual small XLSX remains downloadable', async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Control').addRow(['ordinary value']);
  const bytes = await workbook.xlsx.writeBuffer();
  const result = await processAndValidateExportResponse(new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } }), 'xlsx');
  assert.equal(result.blob.size, bytes.byteLength);
});
