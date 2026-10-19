import { parseFile } from '../parsers';
import { groupShipmentRows, normalizeRow } from '../grouping';

async function runRegressionTests() {
  console.log('=== STARTING SHIPMENT / INVOICE DEDUPLICATION REGRESSION TESTS ===');

  // Architecture note: parseFile intentionally PRESERVES all raw rows (see .agent/DISCUSSION.md).
  // Shipment/invoice deduplication is performed at DISPLAY time via groupShipmentRows
  // (server.ts /api/files/:id/data?group_shipments=true). These tests assert that contract:
  //   (a) parse never drops or multiplies raw rows,
  //   (b) groupShipmentRows merges by shipment/invoice/composite key without multiplying
  //       total value, aggregates items, and sums quantity.

  // Test Case 1: Shipment ID grouping (display-time)
  console.log('\nTest Case 1: Grouping by Shipment ID (display-time)...');
  const csvHeaders = 'Shipment ID,Item,HS Code,Qty,Total Value (USD),Importer,Exporter\n';
  const csvRow1 = 'SHP-999,Aspirin 100mg,3004.90,100,500,ImpoCorp,ExpoLtd\n';
  const csvRow2 = 'SHP-999,Aspirin 500mg,3004.90,250,500,ImpoCorp,ExpoLtd\n';
  const csvBuffer = Buffer.from(csvHeaders + csvRow1 + csvRow2, 'utf-8');

  const parsed = await parseFile('test_shipments.csv', csvBuffer);

  // (a) Raw rows are preserved by the parser
  if (parsed.rows.length !== 2) {
    throw new Error(`Test 1a Failed: parseFile must preserve raw rows, expected 2, got ${parsed.rows.length}`);
  }
  console.log('   ✅ parseFile preserves both raw line rows (no data loss).');

  // (b) Display-time grouping merges the two lines into one shipment
  const grouped = groupShipmentRows(parsed.rows);
  if (grouped.length !== 1) {
    throw new Error(`Test 1b Failed: Expected 1 grouped shipment row, got ${grouped.length}`);
  }
  const merged = grouped[0];
  if (merged['Total Value (USD)'] !== 500) {
    throw new Error(`Test 1c Failed: Total Value (USD) must NOT be multiplied when grouping: ${merged['Total Value (USD)']}`);
  }
  if (merged['Qty'] !== 350) {
    throw new Error(`Test 1d Failed: Grouped Qty must be summed (100+250): expected 350, got ${merged['Qty']}`);
  }
  if (!merged['Item'].includes('Aspirin 100mg') || !merged['Item'].includes('Aspirin 500mg')) {
    throw new Error(`Test 1e Failed: Items were not aggregated: ${merged['Item']}`);
  }
  console.log('   ✅ groupShipmentRows merges SHP-999 -> total value kept, Qty summed to 350, items joined.');

  // Test Case 2: Invoice Number grouping (display-time)
  console.log('\nTest Case 2: Grouping by Invoice Number (display-time)...');
  const csvInvoice = 'Invoice No,Item,HS Code,Qty,Total Value (USD),Importer,Exporter\n' +
                     'INV-12345,Item A,1111,10,1000,Impo,Expo\n' +
                     'INV-12345,Item B,2222,20,1000,Impo,Expo\n';
  const parsedInvoice = await parseFile('test_invoice.csv', Buffer.from(csvInvoice, 'utf-8'));

  if (parsedInvoice.rows.length !== 2) {
    throw new Error(`Test 2a Failed: parseFile must preserve raw invoice rows, expected 2, got ${parsedInvoice.rows.length}`);
  }
  const groupedInvoice = groupShipmentRows(parsedInvoice.rows);
  if (groupedInvoice.length !== 1) {
    throw new Error(`Test 2b Failed: Expected 1 grouped invoice row, got ${groupedInvoice.length}`);
  }
  if (groupedInvoice[0]['Total Value (USD)'] !== 1000) {
    throw new Error(`Test 2c Failed: Invoice Total Value was multiplied: ${groupedInvoice[0]['Total Value (USD)']}`);
  }
  if (groupedInvoice[0]['Qty'] !== 30) {
    throw new Error(`Test 2d Failed: Invoice grouped Qty was not summed (10+20): ${groupedInvoice[0]['Qty']}`);
  }
  console.log('   ✅ groupShipmentRows merges INV-12345 -> total kept, Qty summed to 30.');

  // Test Case 3: Fallback composite-key grouping (display-time)
  console.log('\nTest Case 3: Fallback Composite Key Grouping...');
  const csvComposite = 'Date,Item,Total Value (USD),Importer,Exporter,Qty\n' +
                       '2026-08-11,Paracetamol,150,ClientA,VendorB,50\n' +
                       '2026-08-11,Paracetamol,150,ClientA,VendorB,100\n';
  const parsedComposite = await parseFile('test_composite.csv', Buffer.from(csvComposite, 'utf-8'));

  if (parsedComposite.rows.length !== 2) {
    throw new Error(`Test 3a Failed: parseFile must preserve composite raw rows, expected 2, got ${parsedComposite.rows.length}`);
  }
  const groupedComposite = groupShipmentRows(parsedComposite.rows);
  if (groupedComposite.length !== 1) {
    throw new Error(`Test 3b Failed: Composite keys did not group: got ${groupedComposite.length}`);
  }
  if (groupedComposite[0]['Total Value (USD)'] !== 150) {
    throw new Error(`Test 3c Failed: Composite Total Value was changed or multiplied: ${groupedComposite[0]['Total Value (USD)']}`);
  }
  if (groupedComposite[0]['Qty'] !== 150) {
    throw new Error(`Test 3d Failed: Composite grouped Qty was not summed (50+100): ${groupedComposite[0]['Qty']}`);
  }
  console.log('   ✅ groupShipmentRows merges composite key -> total kept, Qty summed to 150.');

  // Test Case 4: normalizeRow contract (shared with server.ts)
  console.log('\nTest Case 4: normalizeRow column alias mapping...');
  const mapped = normalizeRow({ TOT_FC: 777, be_date: '2026-08-11', IMPORTER: 'Acme', EXPORTER: 'Globex' });
  if (mapped['Total Value (USD)'] !== 777) throw new Error('Test 4 Failed: TOT_FC alias not mapped');
  if (mapped['Date'] !== '2026-08-11') throw new Error('Test 4 Failed: be_date alias not mapped');
  if (mapped['Importer'] !== 'Acme') throw new Error('Test 4 Failed: IMPORTER alias not mapped');
  if (mapped['Exporter'] !== 'Globex') throw new Error('Test 4 Failed: EXPORTER alias not mapped');
  console.log('   ✅ normalizeRow aliases mapped correctly.');

  console.log('\n=============================================');
  console.log('  SUCCESS: All deduplication/grouping regression tests passed! ');
  console.log('=============================================\n');
}

runRegressionTests().catch((err) => {
  console.error('Regression tests failed:', err);
  process.exit(1);
});