export interface SummaryResult {
  total_rows: number;
  exporters_count: number;
  importers_count: number;
  total_cost_usd: number;
  detected_exporter_col?: string;
  detected_importer_col?: string;
  detected_cost_col?: string;
  exporters_list: string[];
  importers_list: string[];
  countries_list?: string[];
}

const EXPORTER_KEYWORDS = ['exporter', 'export', 'seller', 'supplier', 'vendor', 'shipper', 'origin_company', 'sender'];
const IMPORTER_KEYWORDS = ['importer', 'import', 'buyer', 'customer', 'consignee', 'receiver', 'dest_company', 'recipient'];
const COST_KEYWORDS = ['total value', 'total cost', 'total fc', 'tot_fc', 'val_usd', 'total_cost_usd', 'usd', 'amount', 'value', 'total'];

export function computeSummary(
  columns: string[],
  rows: Record<string, any>[]
): SummaryResult {
  let detected_exporter_col: string | undefined;
  let detected_importer_col: string | undefined;
  let detected_cost_col: string | undefined;

  // 1. First, search for exact canonical/total-value column matches
  const exactCostCols = [
    'total value (usd)',
    'total value',
    'total fc (usd)',
    'total fc',
    'tot_fc',
    'total_fc_usd',
    'totalfcusd',
    'totfc',
    'total_cost_usd',
    'total cost (usd)',
    'total cost',
    'val_usd',
    'invoice_value',
    'invoice_val',
    'amount'
  ];

  for (const col of columns) {
    const colLower = col.toLowerCase().trim();
    if (exactCostCols.includes(colLower)) {
      detected_cost_col = col;
      break;
    }
  }

  // Scan columns for keyword matches
  for (const col of columns) {
    const colLower = col.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!detected_exporter_col && EXPORTER_KEYWORDS.some((kw) => colLower.includes(kw))) {
      detected_exporter_col = col;
    }

    if (!detected_importer_col && IMPORTER_KEYWORDS.some((kw) => colLower.includes(kw))) {
      detected_importer_col = col;
    }

    if (!detected_cost_col && COST_KEYWORDS.some((kw) => colLower.includes(kw))) {
      detected_cost_col = col;
    }
  }

  const detected_country_col = columns.find((c) => /(country|origin|cntry)/i.test(c));

  // Collect unique Exporters, Importers, and Countries
  const exportersSet = new Set<string>();
  const importersSet = new Set<string>();
  const countriesSet = new Set<string>();
  let totalCostUSD = 0;

  for (const row of rows) {
    // 1. Exporters
    if (detected_exporter_col && row[detected_exporter_col]) {
      const val = String(row[detected_exporter_col]).trim();
      if (val && val !== 'N/A' && val !== 'undefined') {
        exportersSet.add(val);
      }
    }

    // 2. Importers
    if (detected_importer_col && row[detected_importer_col]) {
      const val = String(row[detected_importer_col]).trim();
      if (val && val !== 'N/A' && val !== 'undefined') {
        importersSet.add(val);
      }
    }

    // 3. Countries
    if (detected_country_col && row[detected_country_col]) {
      const val = String(row[detected_country_col]).trim();
      if (val && val !== 'N/A' && val !== 'undefined' && val.toLowerCase() !== 'unknown') {
        countriesSet.add(val);
      }
    }

    // 4. Cost
    if (detected_cost_col && row[detected_cost_col] !== undefined) {
      const rawVal = String(row[detected_cost_col]);
      // Remove currency symbols, commas, spaces
      const cleanVal = rawVal.replace(/[^0-9.-]/g, '');
      const num = parseFloat(cleanVal);
      if (!isNaN(num)) {
        totalCostUSD += num;
      }
    }
  }

  return {
    total_rows: rows.length,
    exporters_count: exportersSet.size,
    importers_count: importersSet.size,
    total_cost_usd: Math.round(totalCostUSD * 100) / 100,
    detected_exporter_col,
    detected_importer_col,
    detected_cost_col,
    exporters_list: Array.from(exportersSet),
    importers_list: Array.from(importersSet),
    countries_list: Array.from(countriesSet),
  };
}
