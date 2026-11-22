export interface DisplayColumn {
  key: string;
  label: string;
  actualCol: string | null;
  sourceValue?: boolean;
}

// Config for the 8 required columns in exact order with detection keywords
const TARGET_COLUMNS_CONFIG = [
  {
    key: 'date',
    label: 'Date',
    keywords: [
      'be_date',
      'lc_date',
      'invoice date',
      'be_dt',
      'date',
      'dt',
      'invoice_date',
      'transaction_date',
      'tx_date',
      'be_d',
    ],
  },
  {
    key: 'importer',
    label: 'Importer',
    keywords: [
      'importer',
      'buyer',
      'customer',
      'consignee',
      'importer_name',
      'buyer_name',
      'consignee_name',
    ],
  },
  {
    key: 'country',
    label: 'Country',
    keywords: [
      'country',
      'cntry',
      'origin',
      'destination_country',
      'country_name',
      'c_name',
      'country_of_origin',
    ],
  },
  {
    key: 'exporter',
    label: 'Exporter',
    keywords: [
      'exporter',
      'seller',
      'supplier',
      'shipper',
      'exporter_name',
      'seller_name',
      'supplier_name',
    ],
  },
  {
    key: 'item',
    label: 'Item',
    keywords: [
      'item',
      'description',
      'product',
      'commodity',
      'product_name',
      'item_desc',
      'prod_desc',
      'goods_description',
      'desc',
    ],
  },
  {
    key: 'total_fc_usd',
    label: 'Total Value (USD)',
    keywords: [
      'total value (usd)',
      'total value',
      'total fc (usd)',
      'total fc usd',
      'totalfcusd',
      'tot_fc',
      'av_fc',
      'dv_fc',
      'val_usd',
      'invoice_val',
      'total cost',
      'total_cost',
      'amount',
      'value',
      'usd',
      'cost',
      'tot_cost',
      'total_usd',
    ],
  },
];

function tradePartyColumnMatches(column: string, keyword: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  const columnName = normalize(column), alias = normalize(keyword);
  if (!alias) return false;
  if (columnName === alias) return true;
  // Descriptive name/company suffixes remain useful. Country, date, notes and
  // other attributes of a trade party are not themselves the party column.
  const suffixes = new Set(['name', 'company', 'company name', 'legal name', 'entity', 'entity name']);
  return columnName.startsWith(`${alias} `) && suffixes.has(columnName.slice(alias.length + 1));
}

/**
 * Column Detection Logic:
 * Scans file.columns for matching keywords and assigns actual column names to target headers.
 * If a required column is not found in the file, it is marked as missing.
 */
export const detectColumns = (fileColumns: string[]) => {
  const normalizedFileCols = fileColumns.map((col) => ({
    original: col,
    clean: col.toLowerCase().replace(/[^a-z0-9_]/g, ''),
  }));

  const usedOriginalCols = new Set<string>();

  const displayColumns: DisplayColumn[] = TARGET_COLUMNS_CONFIG.map((target) => {
    let bestMatch: string | null = null;
    const allKeywords = [target.label.toLowerCase(), target.key, ...target.keywords];

    // 1. Try exact keyword match
    for (const kw of allKeywords) {
      const cleanKw = kw.replace(/[^a-z0-9_]/g, '');
      const match = normalizedFileCols.find(
        (c) => !usedOriginalCols.has(c.original) && c.clean === cleanKw
      );
      if (match) {
        bestMatch = match.original;
        break;
      }
    }

    // 2. Trade-party columns permit only explicit name/company qualifiers.
    if (!bestMatch && (target.key === 'importer' || target.key === 'exporter')) {
      const match = normalizedFileCols.find(c => !usedOriginalCols.has(c.original)
        && allKeywords.some(keyword => tradePartyColumnMatches(c.original, keyword)));
      if (match) bestMatch = match.original;
    }

    // 3. Other fields retain their historical substring fallback.
    if (!bestMatch && target.key !== 'importer' && target.key !== 'exporter') {
      for (const kw of allKeywords) {
        const cleanKw = kw.replace(/[^a-z0-9_]/g, '');
        if (cleanKw.length < 2) continue;
        const match = normalizedFileCols.find(
          (c) => !usedOriginalCols.has(c.original) && c.clean.includes(cleanKw)
        );
        if (match) {
          bestMatch = match.original;
          break;
        }
      }
    }

    if (bestMatch) {
      usedOriginalCols.add(bestMatch);
    }

    return {
      key: target.key,
      label: target.label,
      actualCol: bestMatch,
    };
  });

  const allowedKeys = ['date', 'importer', 'country', 'exporter', 'item', 'total_fc_usd'];
  const missingColumns = displayColumns
    .filter((col) => !col.actualCol && allowedKeys.includes(col.key))
    .map((col) => col.label);

  return { displayColumns, missingColumns };
};

export function hasTradeParties(columns: string[]): boolean {
  return detectColumns(columns).displayColumns.some(col =>
    (col.key === 'importer' || col.key === 'exporter') && col.actualCol !== null);
}
