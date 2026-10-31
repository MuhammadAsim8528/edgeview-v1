import { Router, Request, Response } from 'express';
import { db } from './db';
import { getHistoryFilesFromDb, deleteFileFromHistory } from './sqlite_persistence';
import { getSafeContentDisposition } from './utils/header_encoder';
import { hasUnattributedHistory, HISTORY_RECONCILIATION_REQUIRED } from './history_ownership';

export const statsRouter = Router();

function safeDecode(str: any): string {
  if (!str) return '';
  const s = Array.isArray(str) ? String(str[0]) : String(str);
  try {
    return decodeURIComponent(s).trim();
  } catch {
    return s.trim();
  }
}

function parseQueryString(val: any): string {
  if (Array.isArray(val)) val = val[0];
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

function sanitizeCSVValue(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return str;
}

function normalizeCountry(val: any): string {
  if (!val) return 'Unknown';
  let s = String(val).trim();
  if (!s || s.toLowerCase() === 'nan' || s === '3004' || s.toLowerCase() === 'null') return 'Unknown';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function normalizeName(val: any, fallback = 'Unknown'): string {
  if (!val) return fallback;
  const s = String(val).trim();
  return s || fallback;
}

export function extractRowData(row: Record<string, any>) {
  const country = row.Country || row.COUNTRY || row.DESTINATION_COUNTRY || row.cntry || row.ORIGIN || 'Unknown';
  const importer = row.Importer || row.IMPORTER || row.BUYER || row.BUYER_NAME || row.Consignee || 'Unknown Importer';
  const exporter = row.Exporter || row.EXPORTER || row.SELLER || row.SUPPLIER || row.SUPPLIER_NAME || 'Unknown Exporter';
  const product = row.Item || row.ITEM || row.PRODUCT || row.product_name || row.DESCRIPTION || 'Unknown Product';
  const dateVal = row.Date || row.BE_DATE || row.be_date || row.shipment_date || row.BE_DATE_1 || '';
  const invoiceNo = row.LC_NO || row.BE_LINK || row.BE_NO || row.Invoice || row.INVOICE || row.INVOICE_NO || row.be_no || row.be_link || row.lc_no || row.Bill_No || 'N/A';
  const hsCode = row.HS_CODE || row.hs_code || row.HSCode || row.hscode || '';

  const fcVal = row['Total Value (USD)'] || row['Total FC (USD)'] || row.TOT_FC || row.VAL_USD || row.total_cost_usd || row.AMOUNT || 0;
  const total_value = typeof fcVal === 'number' ? fcVal : (parseFloat(String(fcVal)) || 0);

  const qtyVal = row.QTY || row.qty || row.Qty || row.QUANTITY || row.GROSS || row.NET || 0;
  const quantity = typeof qtyVal === 'number' ? qtyVal : (parseFloat(String(qtyVal)) || 0);

  const unit = row.UNT || row.unit || row.UNIT || row.UOM || row.qty_unit || 'KG';

  let dStr = String(dateVal).trim();
  if (dStr.length === 8 && /^\d+$/.test(dStr)) {
    dStr = `${dStr.slice(0, 4)}-${dStr.slice(4, 6)}-${dStr.slice(6)}`;
  }

  return {
    country: normalizeCountry(country),
    importer: normalizeName(importer, 'Unknown Importer'),
    exporter: normalizeName(exporter, 'Unknown Exporter'),
    product: normalizeName(product, 'Unknown Product'),
    date: dStr,
    invoice_no: String(invoiceNo).trim() || 'N/A',
    hs_code: String(hsCode).trim(),
    total_value,
    quantity,
    unit: String(unit).trim().toUpperCase() || 'KG',
    raw_row: row,
  };
}

function getAllDatasetRows(fileId?: string) {
  let rawRows: Record<string, any>[] = [];
  if (fileId) {
    rawRows = db.files.get(fileId)?.rows || [];
  } else {
    for (const f of db.files.values()) {
      rawRows.push(...(f.rows || []));
    }
  }
  return rawRows.map(extractRowData);
}

function filterByDate(rows: ReturnType<typeof extractRowData>[], start?: string, end?: string) {
  if (!start && !end) return rows;
  return rows.filter((r) => {
    if (!r.date) return true;
    if (start && r.date < start) return false;
    if (end && r.date > end) return false;
    return true;
  });
}

// 1. GET /api/stats/summary -> Global top level stats
statsRouter.get('/summary', (req: Request, res: Response) => {
  const fileId = req.query.file_id as string;
  const rows = getAllDatasetRows(fileId);

  const countries = new Set<string>();
  const companies = new Set<string>();
  let totalValue = 0;

  for (const r of rows) {
    if (r.country && r.country !== 'Unknown') countries.add(r.country);
    if (r.importer && r.importer !== 'Unknown Importer') companies.add(r.importer);
    totalValue += r.total_value;
  }

  res.json({
    total_records: rows.length,
    total_value: Math.round(totalValue * 100) / 100,
    total_countries: countries.size,
    total_companies: companies.size,
  });
});

// 2. GET /api/stats/countries -> List of countries with importer counts
statsRouter.get('/countries', (req: Request, res: Response) => {
  const fileId = req.query.file_id as string;
  const rows = getAllDatasetRows(fileId);

  const cMap = new Map<string, { importers: Set<string>; total_value: number; records: number }>();

  for (const r of rows) {
    if (!cMap.has(r.country)) {
      cMap.set(r.country, { importers: new Set(), total_value: 0, records: 0 });
    }
    const item = cMap.get(r.country)!;
    if (r.importer && r.importer !== 'Unknown Importer') item.importers.add(r.importer);
    item.total_value += r.total_value;
    item.records += 1;
  }

  const sortedCountries = Array.from(cMap.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  const result = sortedCountries.map((c) => {
    const item = cMap.get(c)!;
    return {
      country: c,
      importers_count: item.importers.size,
      total_value: Math.round(item.total_value * 100) / 100,
      records_count: item.records,
    };
  });

  res.json(result);
});

// 3. GET /api/stats/countries/:country/importers -> Importers for a country (or all importers if ALL)
statsRouter.get('/countries/:country/importers', (req: Request, res: Response) => {
  const rawCountry = safeDecode(req.params.country);
  const countryParam = rawCountry.toLowerCase();
  const fileId = req.query.file_id as string;
  const rows = getAllDatasetRows(fileId);

  const isAll = !rawCountry || countryParam === 'all' || countryParam === 'all countries' || countryParam === '*';
  const matched = isAll
    ? rows
    : rows.filter(
        (r) => r.country.toLowerCase() === countryParam
      );

  const impMap = new Map<string, { importer: string; exporters: Set<string>; total_value: number; shipments: number }>();

  for (const r of matched) {
    if (!r.importer || r.importer === 'Unknown Importer') continue;
    if (!impMap.has(r.importer)) {
      impMap.set(r.importer, { importer: r.importer, exporters: new Set(), total_value: 0, shipments: 0 });
    }
    const item = impMap.get(r.importer)!;
    if (r.exporter && r.exporter !== 'Unknown Exporter') item.exporters.add(r.exporter);
    item.total_value += r.total_value;
    item.shipments += 1;
  }

  const result = Array.from(impMap.values())
    .map((item) => ({
      importer: item.importer,
      exporters_count: item.exporters.size,
      total_value: Math.round(item.total_value * 100) / 100,
      shipments_count: item.shipments,
    }))
    .sort((a, b) => a.importer.localeCompare(b.importer, undefined, { sensitivity: 'base' }));

  res.json(result);
});

// 4. GET /api/stats/importers/:importer/summary -> Summary stats for selected importer
statsRouter.get('/importers/:importer/summary', (req: Request, res: Response) => {
  const importerParam = safeDecode(req.params.importer).toLowerCase();
  const countryParam = parseQueryString(req.query.country).toLowerCase();
  const startDate = req.query.start as string;
  const endDate = req.query.end as string;
  const fileId = req.query.file_id as string;

  let rows = getAllDatasetRows(fileId);

  if (countryParam && countryParam !== 'all') {
    rows = rows.filter((r) => r.country.toLowerCase() === countryParam);
  }

  let matched = rows.filter((r) => r.importer.toLowerCase() === importerParam);
  matched = filterByDate(matched, startDate, endDate);

  const exporters = new Set<string>();
  let totalVal = 0;

  for (const r of matched) {
    if (r.exporter && r.exporter !== 'Unknown Exporter') exporters.add(r.exporter);
    totalVal += r.total_value;
  }

  const matchedCountries = new Set(matched.map(row => row.country));
  const displayCountry = matchedCountries.size > 1 ? 'All Countries'
    : matched.length > 0 ? matched[0].country : (req.query.country as string || 'All Countries');
  const displayImporter = matched.length > 0 ? matched[0].importer : safeDecode(req.params.importer);

  res.json({
    country: displayCountry,
    importer: displayImporter,
    total_export_value: Math.round(totalVal * 100) / 100,
    total_exporters: exporters.size,
    total_shipments: matched.length,
  });
});

// 5. GET /api/stats/importers/:importer/products -> Product breakdown with repetition tracking
statsRouter.get('/importers/:importer/products', (req: Request, res: Response) => {
  const importerParam = safeDecode(req.params.importer).toLowerCase();
  const countryParam = parseQueryString(req.query.country).toLowerCase();
  const startDate = req.query.start as string;
  const endDate = req.query.end as string;
  const fileId = req.query.file_id as string;

  let rows = getAllDatasetRows(fileId);

  if (countryParam && countryParam !== 'all') {
    rows = rows.filter((r) => r.country.toLowerCase() === countryParam);
  }

  let matched = rows.filter((r) => r.importer.toLowerCase() === importerParam);
  matched = filterByDate(matched, startDate, endDate);

  const totalValAll = matched.reduce((acc, r) => acc + r.total_value, 0);

  const prodMap = new Map<string, { product: string; quantity: number; unit: string; shipments: number; total_value: number }>();

  for (const r of matched) {
    if (!prodMap.has(r.product)) {
      prodMap.set(r.product, {
        product: r.product,
        quantity: 0,
        unit: r.unit,
        shipments: 0,
        total_value: 0,
      });
    }
    const item = prodMap.get(r.product)!;
    item.quantity += r.quantity;
    item.shipments += 1;
    item.total_value += r.total_value;
  }

  const result = Array.from(prodMap.values())
    .map((item) => ({
      product: item.product,
      quantity: Math.round(item.quantity * 100) / 100,
      unit: item.unit,
      shipments: item.shipments,
      total_value: Math.round(item.total_value * 100) / 100,
      percentage: totalValAll > 0 ? Math.round((item.total_value / totalValAll) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total_value - a.total_value);

  res.json(result);
});

// 6. GET /api/stats/importers/:importer/exporters -> Exporters breakdown
statsRouter.get('/importers/:importer/exporters', (req: Request, res: Response) => {
  try {
    const importerParam = safeDecode(req.params.importer).toLowerCase();
    const countryParam = parseQueryString(req.query.country).toLowerCase();
    const startDate = parseQueryString(req.query.start);
    const endDate = parseQueryString(req.query.end);
    const fileId = parseQueryString(req.query.file_id);

    let rows = getAllDatasetRows(fileId);

    if (countryParam && countryParam !== 'all') {
      rows = rows.filter((r) => r.country.toLowerCase() === countryParam);
    }

    let matched = rows.filter((r) => r.importer.toLowerCase() === importerParam);
    matched = filterByDate(matched, startDate, endDate);

    const totalValAll = matched.reduce((acc, r) => acc + r.total_value, 0);

    const expMap = new Map<string, { exporter: string; products: Set<string>; shipments: number; total_value: number }>();

    for (const r of matched) {
      if (!expMap.has(r.exporter)) {
        expMap.set(r.exporter, {
          exporter: r.exporter,
          products: new Set(),
          shipments: 0,
          total_value: 0,
        });
      }
      const item = expMap.get(r.exporter)!;
      item.products.add(r.product);
      item.shipments += 1;
      item.total_value += r.total_value;
    }

    const result = Array.from(expMap.values())
      .map((item) => ({
        exporter: item.exporter,
        products_count: item.products.size,
        shipments: item.shipments,
        total_value: Math.round(item.total_value * 100) / 100,
        percentage: totalValAll > 0 ? Math.round((item.total_value / totalValAll) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total_value - a.total_value);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch importer exporters' });
  }
});

// 7. GET /api/stats/importers/:importer/shipments -> Individual shipment records
statsRouter.get('/importers/:importer/shipments', (req: Request, res: Response) => {
  try {
    const importerParam = safeDecode(req.params.importer).toLowerCase();
    const countryParam = parseQueryString(req.query.country).toLowerCase();
    const exporterParam = parseQueryString(req.query.exporter).toLowerCase();
    const productParam = parseQueryString(req.query.product).toLowerCase();
    const startDate = parseQueryString(req.query.start);
    const endDate = parseQueryString(req.query.end);
    const fileId = parseQueryString(req.query.file_id);

    let rows = getAllDatasetRows(fileId);

    if (countryParam && countryParam !== 'all') {
      rows = rows.filter((r) => r.country.toLowerCase() === countryParam);
    }

    let matched = rows.filter((r) => r.importer.toLowerCase() === importerParam);
    
    if (exporterParam) {
      matched = matched.filter((r) => r.exporter.toLowerCase() === exporterParam || r.exporter.toLowerCase().includes(exporterParam));
    }
    if (productParam) {
      matched = matched.filter((r) => r.product.toLowerCase() === productParam || r.product.toLowerCase().includes(productParam));
    }

    matched = filterByDate(matched, startDate, endDate);

    // Sort by date DESC by default
    matched.sort((a, b) => {
      if (a.date && b.date) return b.date.localeCompare(a.date);
      return b.total_value - a.total_value;
    });

    res.json(matched);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch importer shipments' });
  }
});

// 8. GET /api/stats/importers/:importer/export -> Filtered CSV report export
statsRouter.get('/importers/:importer/export', (req: Request, res: Response) => {
  try {
    const importerParam = safeDecode(req.params.importer);
    const countryParam = parseQueryString(req.query.country).toLowerCase();
    const startDate = parseQueryString(req.query.start);
    const endDate = parseQueryString(req.query.end);
    const fileId = parseQueryString(req.query.file_id);

    let rows = getAllDatasetRows(fileId);

    if (countryParam && countryParam !== 'all') {
      rows = rows.filter((r) => r.country.toLowerCase() === countryParam);
    }

    let matched = rows.filter((r) => r.importer.toLowerCase() === importerParam.toLowerCase());
    matched = filterByDate(matched, startDate, endDate);

    const totalVal = matched.reduce((acc, r) => acc + r.total_value, 0);

    const csvLines: string[] = [];
    csvLines.push(`=== PHARMA AI IMPORTER STATS REPORT: ${sanitizeCSVValue(importerParam.toUpperCase())} ===`);
    if (req.query.country) csvLines.push(`Country Filter: ${sanitizeCSVValue(parseQueryString(req.query.country))}`);
    if (startDate || endDate) csvLines.push(`Date Range: ${startDate || 'Beginning'} to ${endDate || 'Present'}`);
    csvLines.push('');

    const exportersSet = new Set(matched.map((r) => r.exporter).filter((e) => e && e !== 'Unknown Exporter'));
    csvLines.push('--- IMPORTER SUMMARY ---');
    csvLines.push('Importer Name,Total Export Value (USD),Total Exporters,Total Shipments');
    csvLines.push(`"${sanitizeCSVValue(importerParam)}","$${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}",${exportersSet.size},${matched.length}`);
    csvLines.push('');

    // Products Breakdown
    csvLines.push('--- PRODUCTS EXPORTED (WITH REPETITION TRACKING) ---');
    csvLines.push('Product Name,Quantity,Unit,Shipments (Repetitions),Total Value (USD),% Share');

    const prodMap = new Map<string, { qty: number; unit: string; shipments: number; val: number }>();
    for (const r of matched) {
      if (!prodMap.has(r.product)) {
        prodMap.set(r.product, { qty: 0, unit: r.unit, shipments: 0, val: 0 });
      }
      const item = prodMap.get(r.product)!;
      item.qty += r.quantity;
      item.shipments += 1;
      item.val += r.total_value;
    }

    const sortedProds = Array.from(prodMap.entries()).sort((a, b) => b[1].val - a[1].val);
    for (const [pName, data] of sortedProds) {
      const share = totalVal > 0 ? (data.val / totalVal) * 100 : 0;
      csvLines.push(
        `"${sanitizeCSVValue(pName)}",${data.qty.toLocaleString()},"${sanitizeCSVValue(data.unit)}",${data.shipments},"$${data.val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}",${share.toFixed(1)}%`
      );
    }

    csvLines.push('');

    // Exporters Breakdown
    csvLines.push('--- EXPORTERS BREAKDOWN ---');
    csvLines.push('Exporter Name,Distinct Products,Shipments Count,Total Value (USD),% Share');

    const expMap = new Map<string, { prods: Set<string>; shipments: number; val: number }>();
    for (const r of matched) {
      if (!expMap.has(r.exporter)) {
        expMap.set(r.exporter, { prods: new Set(), shipments: 0, val: 0 });
      }
      const item = expMap.get(r.exporter)!;
      item.prods.add(r.product);
      item.shipments += 1;
      item.val += r.total_value;
    }

    const sortedExps = Array.from(expMap.entries()).sort((a, b) => b[1].val - a[1].val);
    for (const [eName, data] of sortedExps) {
      const share = totalVal > 0 ? (data.val / totalVal) * 100 : 0;
      csvLines.push(
        `"${sanitizeCSVValue(eName)}",${data.prods.size},${data.shipments},"$${data.val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}",${share.toFixed(1)}%`
      );
    }

    const csvOutput = '\uFEFF' + csvLines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', getSafeContentDisposition(`EdgeView_Stats_${importerParam}.csv`));
    res.send(csvOutput);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to export CSV report' });
  }
});

// 9. GET /api/stats/history-files -> List all real uploaded files saved in History DB
statsRouter.get('/history-files', async (req: Request, res: Response) => {
  try {
    const historyFiles = await getHistoryFilesFromDb();
    const formatted = historyFiles.map((f) => ({
      id: f.id,
      file_name: f.file_name,
      uploaded_at: f.uploaded_at,
      row_count: f.row_count,
      total_value: f.total_value,
      unique_countries: f.unique_countries,
      unique_importers: f.unique_importers,
      source: f.source,
      file_type: f.file_type,
      size: f.size,
    }));

    res.json({
      success: true,
      data: formatted,
    });
  } catch (err: any) {
    console.error('Failed to fetch history files:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to fetch history files',
    });
  }
});

// 10. DELETE /api/stats/history-files/:id -> Delete a file and its records permanently from History DB
statsRouter.delete('/history-files/:id', async (req: Request, res: Response) => {
  try {
    const fileId = req.params.id;
    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required',
      });
    }

    const fileInMem = db.files.get(fileId);
    if (!fileInMem) return res.status(404).json({ success: false, code: 'FILE_NOT_FOUND', message: 'File not found.' });
    const fileName = fileInMem ? fileInMem.name : 'Uploaded file';
    if (await hasUnattributedHistory(fileName)) return res.status(409).json(HISTORY_RECONCILIATION_REQUIRED);
    const deletedFromDisk = await deleteFileFromHistory(fileId);
    let historyCleanupError: string | null = null;

    // Purge the file's shipment rows and flush the derived index before making
    // a full-cleanup claim. The primary JSON deletion above is already durable.
    try {
      const { getDb } = await import('./sqlite');
      const sqliteDb = await getDb();
      if (fileName && fileName !== 'Uploaded file') {
        await sqliteDb.run('DELETE FROM history_data WHERE file_id = ?', [fileId]);
        await sqliteDb.flush();
      }
    } catch (sqlErr: any) {
      historyCleanupError = String(sqlErr?.message || sqlErr);
      console.warn('Failed to durably purge history_data rows during delete:', sqlErr);
    }

    db.files.delete(fileId);

    // Re-sync company contacts and prune contacts that no longer have a
    // source file so stale companies do not persist until restart.
    db.syncCompaniesFromFiles();
    db.pruneOrphanedContacts();

    if (historyCleanupError) {
      return res.status(207).json({
        success: true,
        partial: true,
        message: `File "${fileName}" was deleted durably, but derived history cleanup needs retry.`,
        deleted_id: fileId,
        persisted: deletedFromDisk,
        warning: historyCleanupError,
      });
    }
    return res.json({
      success: true,
      message: `File "${fileName}" and all associated history records were permanently deleted.`,
      deleted_id: fileId,
      persisted: deletedFromDisk,
    });
  } catch (err: any) {
    console.error('Failed to delete history file:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to delete file from history',
    });
  }
});

