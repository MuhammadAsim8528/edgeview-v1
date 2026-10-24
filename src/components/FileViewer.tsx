import React, { useState, useMemo, useEffect } from 'react';
import { safeFetchJson, fetchAllFileRows } from '../utils/safeFetch';
import {
  Download,
  Search,
  ArrowUpDown,
  FileText,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle,
  DollarSign,
  Filter,
  X,
  Layers,
  Calendar,
  Package,
  Globe,
  Building2,
  RotateCcw,
  Bookmark,
  CheckCircle2,
  Database,
} from 'lucide-react';
import { ParsedFile } from '../types';
import { GlobalExportPayload } from './GlobalExportModal';

interface FileViewerProps {
  file: ParsedFile | null;
  onExportCSV: () => void;
  onSaveToHistory?: (fileId: string) => Promise<any>;
  onOpenExport?: (payload: GlobalExportPayload) => void;
}

export interface DisplayColumn {
  key: string;
  label: string;
  actualCol: string | null;
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

/**
 * Column Detection Logic:
 * Scans file.columns for matching keywords and assigns actual column names to target headers.
 * If a required column is not found in the file, it is marked as missing.
 */
const detectColumns = (fileColumns: string[]) => {
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

    // 2. Try substring match if exact match not found
    if (!bestMatch) {
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

// Helper to extract cell value across actualCol, label, key, or raw aliases
const getCellValue = (row: Record<string, any> | any[], col: DisplayColumn, fileCols: string[] = []): any => {
  if (row === undefined || row === null) return '';

  let actualRow: any = row;
  if (typeof row === 'object' && !Array.isArray(row)) {
    if (row.data && typeof row.data === 'object') actualRow = row.data;
    else if (row.row && typeof row.row === 'object') actualRow = row.row;
    else if (row.values && typeof row.values === 'object') actualRow = row.values;
  }

  const targetAliases: Record<string, string[]> = {
    date: [
      'Date', 'date', 'BE_DATE', 'be_date', 'BE_DATE_1', 'DATE', 'be_dt', 'lc_date',
      'shipment_date', 'SHIP_DATE', 'Shipment_Date', 'Ship_Date'
    ],
    importer: [
      'Importer', 'importer', 'IMPORTER', 'importer_name', 'Importer_Name', 'BUYER', 'Buyer',
      'BUYER_NAME', 'buyer_name', 'CONSIGNEE', 'Consignee', 'Customer_Name', 'customer_name'
    ],
    country: [
      'Country', 'country', 'COUNTRY', 'cntry', 'CNTRY', 'origin', 'ORIGIN',
      'country_name', 'Country_Name', 'COUNTRY_NAME'
    ],
    exporter: [
      'Exporter', 'exporter', 'EXPORTER', 'exporter_name', 'Exporter_Name', 'SELLER', 'Seller',
      'SUPPLIER', 'Supplier', 'SUPPLIER_NAME', 'Supplier_Name', 'SHIPPER', 'shipper'
    ],
    item: [
      'Item', 'item', 'ITEM', 'PRODUCT', 'Product', 'product_name', 'Product_Name',
      'description', 'DESCRIPTION', 'Drug_Class', 'drug_class', 'CAT_NUMBER', 'cat_number', 'commodity'
    ],
    total_fc_usd: [
      'Total Value (USD)', 'Total Cost (USD)', 'Total FC (USD)', 'total_fc_usd', 'TOT_FC', 'tot_fc', 'TOT_FC_USD', 'total_cost_usd',
      'Total_Cost_USD', 'AV_FC', 'DV_FC', 'TOTAL_FC_USD', 'Total FC', 'TOTAL FC',
      'val_usd', 'VAL_USD', 'total_cost', 'Invoice_Value', 'invoice_value', 'amount', 'value', 'usd'
    ],
    ntn: [
      'NTN', 'ntn', 'Ntn', 'NTN_NO', 'ntn_no', 'ntn_num', 'tax_number'
    ],
    hs_code: [
      'HS Code', 'HS_CODE', 'hs_code', 'Hs_Code', 'HSCODE', 'hscode', 'hs', 'hs_cd'
    ],
  };

  // Array Row handling
  if (Array.isArray(actualRow)) {
    if (col.actualCol && fileCols.length > 0) {
      const idx = fileCols.indexOf(col.actualCol);
      if (idx !== -1 && actualRow[idx] !== undefined && actualRow[idx] !== null && actualRow[idx] !== '') {
        return actualRow[idx];
      }
    }
    const posMap: Record<string, number> = { date: 0, importer: 1, country: 2, exporter: 3, item: 4, total_fc_usd: 5, ntn: 6, hs_code: 7 };
    const pos = posMap[col.key];
    if (pos !== undefined && actualRow[pos] !== undefined && actualRow[pos] !== null && actualRow[pos] !== '') {
      return actualRow[pos];
    }
    return '';
  }

  // Check direct col.actualCol if set
  if (col.actualCol && actualRow[col.actualCol] !== undefined && actualRow[col.actualCol] !== null && actualRow[col.actualCol] !== '') {
    return actualRow[col.actualCol];
  }

  // Try exact col.label
  if (actualRow[col.label] !== undefined && actualRow[col.label] !== null && actualRow[col.label] !== '') {
    return actualRow[col.label];
  }

  // Try exact col.key
  if (actualRow[col.key] !== undefined && actualRow[col.key] !== null && actualRow[col.key] !== '') {
    return actualRow[col.key];
  }

  // Try all aliases
  const aliases = targetAliases[col.key] || [];
  for (const alias of aliases) {
    if (actualRow[alias] !== undefined && actualRow[alias] !== null && actualRow[alias] !== '') {
      return actualRow[alias];
    }
  }

  // Fuzzy match
  const cleanLabel = col.label.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanKey = col.key.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const [k, v] of Object.entries(actualRow)) {
    if (v === undefined || v === null || v === '') continue;
    const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanK === cleanLabel || cleanK === cleanKey) {
      return v;
    }
    for (const alias of aliases) {
      if (cleanK === alias.toLowerCase().replace(/[^a-z0-9]/g, '')) {
        return v;
      }
    }
  }

  return '';
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Helper to convert dates to DD-Month-YYYY
const formatExcelDate = (val: any): string => {
  if (val === undefined || val === null || val === '') return 'N/A';
  const sStr = String(val).trim();
  if (!sStr || sStr === 'N/A' || sStr.startsWith('####')) return 'N/A';

  // Check numeric Excel serial number
  const num = Number(sStr);
  if (!isNaN(num) && num >= 1000 && num <= 90000) {
    const excelBase = new Date(Date.UTC(1899, 11, 30));
    const targetDate = new Date(excelBase.getTime() + Math.floor(num) * 86400000);
    if (!isNaN(targetDate.getTime())) {
      const day = String(targetDate.getUTCDate()).padStart(2, '0');
      const monthStr = MONTH_NAMES[targetDate.getUTCMonth()];
      const year = targetDate.getUTCFullYear();
      return `${day}-${monthStr}-${year}`;
    }
  }

  // YYYYMMDD
  if (/^\d{8}$/.test(sStr) && (sStr.startsWith('19') || sStr.startsWith('20'))) {
    const year = sStr.substring(0, 4);
    const mIdx = parseInt(sStr.substring(4, 6), 10) - 1;
    const day = sStr.substring(6, 8);
    if (mIdx >= 0 && mIdx < 12) {
      return `${day}-${MONTH_NAMES[mIdx]}-${year}`;
    }
  }

  // Delimited
  const parts = sStr.split(/[\/\-\.\s]+/);
  if (parts.length >= 3) {
    const textMonthIdx = MONTH_NAMES.findIndex((m) => m.toLowerCase().startsWith(parts[1]?.toLowerCase() || 'xyz'));
    if (textMonthIdx !== -1) {
      const day = String(parseInt(parts[0], 10)).padStart(2, '0');
      const year = parts[2];
      return `${day}-${MONTH_NAMES[textMonthIdx]}-${year}`;
    }

    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const p3 = parseInt(parts[2], 10);

    if (parts[0].length === 4 && !isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      const year = p1;
      const mIdx = Math.min(12, Math.max(1, p2)) - 1;
      const day = String(Math.min(31, Math.max(1, p3))).padStart(2, '0');
      return `${day}-${MONTH_NAMES[mIdx]}-${year}`;
    }

    if (parts[2].length === 4 && !isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      const year = p3;
      let day = p1;
      let month = p2;

      if (p1 > 12 && p2 <= 12) {
        day = p1;
        month = p2;
      } else if (p2 > 12 && p1 <= 12) {
        day = p2;
        month = p1;
      }

      const dayStr = String(Math.min(31, Math.max(1, day))).padStart(2, '0');
      const mIdx = Math.min(12, Math.max(1, month)) - 1;
      return `${dayStr}-${MONTH_NAMES[mIdx]}-${year}`;
    }
  }

  const d = new Date(sStr);
  if (!isNaN(d.getTime())) {
    const day = String(d.getUTCDate()).padStart(2, '0');
    const monthStr = MONTH_NAMES[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    return `${day}-${monthStr}-${year}`;
  }

  return sStr;
};

// Table Row Component
interface TableRowProps {
  row: Record<string, any>;
  displayColumns: DisplayColumn[];
  rowNum: number;
  fileColumns: string[];
}

const TableRow = React.memo<TableRowProps>(({ row, displayColumns, rowNum, fileColumns }) => {
  const isGroupedRow = Boolean(row._isGroupedRow);
  const groupCount = row._groupCount || 1;

  return (
    <tr className="hover:bg-[#262626] transition-colors border-b border-[#262626]">
      <td className="px-3 py-2 font-mono text-[11px] text-center text-[#9ca3af] border-r border-[#262626] bg-[#1a1a1a]">
        {rowNum}
      </td>
      {displayColumns.map((col) => {
        const val = getCellValue(row, col, fileColumns);
        const isDateCol = col.key === 'date';
        const isUsdCol = col.key === 'total_fc_usd';
        const isItemCol = col.key === 'item';
        let displayVal = val !== undefined && val !== null && val !== '' ? String(val) : '';

        if (isDateCol && displayVal !== '') {
          displayVal = formatExcelDate(displayVal);
        } else if (isUsdCol && displayVal !== '') {
          if (typeof val === 'number') {
            displayVal = `$${val.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`;
          } else if (!isNaN(Number(val))) {
            const num = Number(val);
            displayVal = `$${num.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`;
          }
        }

        const isNumeric = isUsdCol || typeof val === 'number';

        return (
          <td
            key={col.key}
            className={`px-3.5 py-2.5 border-r border-[#262626] ${
              isItemCol ? 'max-w-md' : 'max-w-xs truncate'
            } ${
              isUsdCol
                ? 'font-mono text-[#10b981] font-semibold bg-[#10b981]/10'
                : isNumeric
                ? 'font-mono text-[#ffffff]'
                : 'text-[#e5e7eb]'
            }`}
            title={displayVal}
          >
            {isItemCol ? (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[#ffffff] leading-snug break-words">
                  {displayVal || <span className="text-[#9ca3af] font-mono">—</span>}
                </span>
                {isGroupedRow && groupCount > 1 && (
                  <span className="inline-flex items-center gap-1 w-fit px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40">
                    <Layers className="w-2.5 h-2.5" />
                    {groupCount} items grouped
                  </span>
                )}
              </div>
            ) : (
              <span>{displayVal || <span className="text-[#9ca3af] font-mono">—</span>}</span>
            )}
          </td>
        );
      })}
    </tr>
  );
});
TableRow.displayName = 'TableRow';

// Column mapping from raw names to display names
const columnMapping: Record<string, string> = {
  BE_DATE: 'Date',
  ITEM: 'Item',
  COUNTRY: 'Country',
  IMPORTER: 'Importer',
  EXPORTER: 'Exporter',
  TOT_FC: 'Total Value (USD)',
  be_date: 'Date',
  item: 'Item',
  country: 'Country',
  importer: 'Importer',
  exporter: 'Exporter',
  tot_fc: 'Total Value (USD)',
};

export const FileViewer: React.FC<FileViewerProps> = ({ file, onExportCSV, onSaveToHistory, onOpenExport }) => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [viewMode, setViewMode] = useState<'table' | 'text'>('table');

  // Shipment Grouping and Granular Filters State
  const [isGrouped, setIsGrouped] = useState<boolean>(true);
  const [productFilter, setProductFilter] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [importerFilter, setImporterFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Server-Side Paginated State for Fast Large Dataset Transfer
  const [serverRows, setServerRows] = useState<any[]>([]);
  const [serverTotalCount, setServerTotalCount] = useState<number>(0);
  const [serverFilterOptions, setServerFilterOptions] = useState<{ countries: string[]; importers: string[] }>({ countries: [], importers: [] });
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);

  // Server-side paginated mode enforced for any file without rows or with > 50 rows
  const isServerSide = !file?.rows || file.rows.length === 0 || file.rows.length > 50;

  useEffect(() => {
    if (!file?.id || !isServerSide) return;
    let isMounted = true;
    const fetchPaginatedData = async () => {
      setIsDataLoading(true);
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String((currentPage - 1) * pageSize),
        group_shipments: isGrouped ? 'true' : 'false',
        search: debouncedSearch,
        product: productFilter,
        country: countryFilter,
        importer: importerFilter,
        start_date: startDate,
        end_date: endDate,
      });
      if (sortColumn) {
        params.set('sort_by', sortColumn);
        params.set('sort_dir', sortDirection);
      }

      const { ok, data } = await safeFetchJson<any>(`/api/files/${encodeURIComponent(file.id)}/data?${params.toString()}`);
      if (isMounted && ok && data) {
        setServerRows(data.rows || data.data || []);
        setServerTotalCount(data.total_count ?? data.total_rows ?? 0);
        if (data.filter_options && (data.filter_options.countries?.length > 0 || data.filter_options.importers?.length > 0)) {
          setServerFilterOptions({
            countries: data.filter_options.countries || [],
            importers: data.filter_options.importers || [],
          });
        }
      }
      if (isMounted) setIsDataLoading(false);
    };

    fetchPaginatedData();
    return () => { isMounted = false; };
  }, [
    file?.id,
    isServerSide,
    currentPage,
    pageSize,
    isGrouped,
    debouncedSearch,
    productFilter,
    countryFilter,
    importerFilter,
    startDate,
    endDate,
    sortColumn,
    sortDirection,
  ]);

  const rawRows = file?.rows || [];

  // Map raw data keys to standardized display names
  const mappedData = useMemo(() => {
    return rawRows.map((row: any) => {
      const newRow: any = { ...row };
      Object.keys(row || {}).forEach((key) => {
        const displayKey = columnMapping[key] || columnMapping[key.toUpperCase()] || key;
        newRow[displayKey] = row[key];
      });
      return newRow;
    });
  }, [rawRows]);

  const fileColumns = useMemo(() => {
    if (file?.columns && file.columns.length > 0) return file.columns;
    if (mappedData.length > 0) {
      const keysSet = new Set<string>();
      mappedData.forEach((r) => Object.keys(r || {}).forEach((k) => keysSet.add(k)));
      return Array.from(keysSet);
    }
    return [];
  }, [file, mappedData]);

  // Extract unique filter dropdown values from mappedData
  const filterOptions = useMemo(() => {
    const countries = new Set<string>();
    const importers = new Set<string>();

    mappedData.forEach((row) => {
      const c = getCellValue(row, { key: 'country', label: 'Country', actualCol: null }, fileColumns) || row['Country'] || '';
      if (c && String(c).trim()) countries.add(String(c).trim());

      const imp = getCellValue(row, { key: 'importer', label: 'Importer', actualCol: null }, fileColumns) || row['Importer'] || '';
      if (imp && String(imp).trim()) importers.add(String(imp).trim());
    });

    return {
      countries: Array.from(countries).sort(),
      importers: Array.from(importers).sort(),
    };
  }, [mappedData, fileColumns]);

  // Run column detection for target 6 columns
  const { displayColumns, missingColumns } = useMemo(() => {
    return detectColumns(fileColumns);
  }, [fileColumns]);

  const visibleDisplayColumns = useMemo(() => {
    const allowedKeys = ['date', 'importer', 'country', 'exporter', 'item', 'total_fc_usd'];
    return displayColumns.filter((col) => allowedKeys.includes(col.key));
  }, [displayColumns]);

  // 1. Grouping Logic: Combine items & sum FC when isGrouped is true
  const processedData = useMemo(() => {
    if (!isGrouped) return mappedData;

    const groupsMap = new Map<string, {
      key: string;
      rows: any[];
      items: string[];
      date: string;
      country: string;
      importer: string;
      exporter: string;
      tot_fc_values: number[];
      sampleRow: any;
    }>();

    mappedData.forEach((row) => {
      // Find grouping identifier (BE_LINK, LC_NO, BE_NO, INVOICE_NO, etc.)
      let groupKey = '';
      const possibleLinkKeys = [
        'BE_LINK', 'be_link', 'LC_NO', 'lc_no', 'BE_NO', 'be_no',
        'INVOICE_NO', 'invoice_no', 'BILL_NO', 'bill_no', 'IGM_NO', 'igm_no',
        'SHIPMENT_ID', 'shipment_id', 'group_link', 'GROUP_LINK'
      ];

      for (const k of possibleLinkKeys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          groupKey = String(row[k]).trim();
          break;
        }
      }

      const dateVal = formatExcelDate(getCellValue(row, displayColumns[0], fileColumns) || row['Date'] || '');
      const countryVal = String(getCellValue(row, displayColumns[1], fileColumns) || row['Country'] || '').trim();
      const importerVal = String(getCellValue(row, displayColumns[2], fileColumns) || row['Importer'] || '').trim();
      const exporterVal = String(getCellValue(row, displayColumns[3], fileColumns) || row['Exporter'] || '').trim();

      // Fallback composite key if no link ID is present
      if (!groupKey) {
        groupKey = `${dateVal}_${countryVal}_${importerVal}_${exporterVal}`.toLowerCase().trim();
      }

      if (!groupKey || groupKey === '___') {
        groupKey = `row_${Math.random()}`;
      }

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          key: groupKey,
          rows: [],
          items: [],
          date: dateVal,
          country: countryVal,
          importer: importerVal,
          exporter: exporterVal,
          tot_fc_values: [],
          sampleRow: row,
        });
      }

      const group = groupsMap.get(groupKey)!;
      group.rows.push(row);

      // Collect Item
      const itemVal = getCellValue(row, { key: 'item', label: 'Item', actualCol: null }, fileColumns) || row['Item'] || '';
      if (itemVal && String(itemVal).trim()) {
        group.items.push(String(itemVal).trim());
      }

      // Collect Total FC
      const fcVal = getCellValue(row, { key: 'total_fc_usd', label: 'Total Value (USD)', actualCol: null }, fileColumns) || row['Total Value (USD)'] || getCellValue(row, { key: 'total_fc_usd', label: 'Total FC (USD)', actualCol: null }, fileColumns) || row['Total FC (USD)'];
      const numFc = Number(fcVal);
      if (!isNaN(numFc) && numFc > 0) {
        group.tot_fc_values.push(numFc);
      }
    });

    // Map groups back to single shipment rows
    return Array.from(groupsMap.values()).map((group) => {
      const uniqueItems = Array.from(new Set(group.items.filter(Boolean)));
      const combinedItem = uniqueItems.join(', ');

      let totalFc = 0;
      if (group.tot_fc_values.length > 0) {
        const allSame = group.tot_fc_values.every((v) => Math.abs(v - group.tot_fc_values[0]) < 0.001);
        if (allSame) {
          totalFc = group.tot_fc_values[0];
        } else {
          totalFc = group.tot_fc_values.reduce((sum, val) => sum + val, 0);
        }
      }

      return {
        ...group.sampleRow,
        Date: group.date,
        Country: group.country,
        Importer: group.importer,
        Exporter: group.exporter,
        'Total Value (USD)': totalFc,
        'Total FC (USD)': totalFc,
        Item: combinedItem,
        date: group.date,
        country: group.country,
        importer: group.importer,
        exporter: group.exporter,
        total_fc_usd: totalFc,
        item: combinedItem,
        _groupCount: group.rows.length,
        _isGroupedRow: true,
      };
    });
  }, [mappedData, isGrouped, displayColumns, fileColumns]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 2. Filter Processed Data using Product, Country, Importer, Date Range, and Search
  const filteredRows = useMemo(() => {
    return processedData.filter((row) => {
      // Product Filter
      if (productFilter.trim()) {
        const itemVal = String(getCellValue(row, { key: 'item', label: 'Item', actualCol: null }, fileColumns) || row['Item'] || '').toLowerCase();
        if (!itemVal.includes(productFilter.toLowerCase().trim())) {
          return false;
        }
      }

      // Country Filter
      if (countryFilter) {
        const countryVal = String(getCellValue(row, { key: 'country', label: 'Country', actualCol: null }, fileColumns) || row['Country'] || '').toLowerCase();
        if (countryVal !== countryFilter.toLowerCase()) {
          return false;
        }
      }

      // Importer Filter
      if (importerFilter) {
        const importerVal = String(getCellValue(row, { key: 'importer', label: 'Importer', actualCol: null }, fileColumns) || row['Importer'] || '').toLowerCase();
        if (importerVal !== importerFilter.toLowerCase()) {
          return false;
        }
      }

      // Date Range Filter
      if (startDate || endDate) {
        const rowDate = formatExcelDate(getCellValue(row, { key: 'date', label: 'Date', actualCol: null }, fileColumns) || row['Date'] || '');
        if (rowDate) {
          if (startDate && rowDate < startDate) return false;
          if (endDate && rowDate > endDate) return false;
        }
      }

      // Global Search
      if (debouncedSearch.trim()) {
        const term = debouncedSearch.toLowerCase();
        const matches = displayColumns.some((col) => {
          const val = getCellValue(row, col, fileColumns);
          return val !== undefined && val !== null && String(val).toLowerCase().includes(term);
        });
        if (!matches) return false;
      }

      return true;
    });
  }, [processedData, productFilter, countryFilter, importerFilter, startDate, endDate, debouncedSearch, displayColumns, fileColumns]);

  // 3. Sorting
  const sortedRows = useMemo(() => {
    if (!sortColumn) return filteredRows;
    const targetCol = displayColumns.find((c) => c.key === sortColumn);
    if (!targetCol) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const valA = getCellValue(a, targetCol, fileColumns);
      const valB = getCellValue(b, targetCol, fileColumns);

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA ?? '').toLowerCase();
      const strB = String(valB ?? '').toLowerCase();
      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortColumn, sortDirection, displayColumns, fileColumns]);

  // Effective Pagination & Display Variables (Hybrid Client/Server Side)
  const effectiveTotalCount = isServerSide ? serverTotalCount : sortedRows.length;
  const totalPages = Math.ceil(effectiveTotalCount / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const displayRows = isServerSide ? serverRows : paginatedRows;

  const effectiveFilterOptions = useMemo(() => {
    if (isServerSide && (serverFilterOptions.countries.length > 0 || serverFilterOptions.importers.length > 0)) {
      return serverFilterOptions;
    }
    if (file?.summary?.countries_list || file?.summary?.importers_list) {
      return {
        countries: file.summary.countries_list || [],
        importers: file.summary.importers_list || [],
      };
    }
    return filterOptions;
  }, [isServerSide, serverFilterOptions, file?.summary, filterOptions]);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push('...');
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      pages.push(totalPages);
    }
    return pages;
  };

  // Count active filters
  const activeFilterCount = [
    Boolean(productFilter.trim()),
    Boolean(countryFilter),
    Boolean(importerFilter),
    Boolean(startDate),
    Boolean(endDate),
    Boolean(debouncedSearch.trim()),
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setProductFilter('');
    setCountryFilter('');
    setImporterFilter('');
    setStartDate('');
    setEndDate('');
    setSearchInput('');
    setDebouncedSearch('');
    setCurrentPage(1);
  };

  // Export Filtered View via Global Export Manager
  const [isExportingFiltered, setIsExportingFiltered] = useState(false);
  const handleExportFilteredCSV = async () => {
    if (isExportingFiltered || effectiveTotalCount === 0) return;
    let exportRows = sortedRows;
    if (isServerSide && file) {
      setIsExportingFiltered(true);
      try {
        const result = await fetchAllFileRows(file.id, undefined, {
          group_shipments: String(isGrouped), search: debouncedSearch,
          product: productFilter, country: countryFilter, importer: importerFilter,
          start_date: startDate, end_date: endDate,
          ...(sortColumn ? { sort_by: sortColumn, sort_dir: sortDirection } : {}),
        });
        if (!result.ok || !result.data) {
          window.alert(result.error || 'Could not load the complete filtered export. Try again.');
          return;
        }
        exportRows = result.data.rows;
      } finally {
        setIsExportingFiltered(false);
      }
    }
    if (exportRows.length === 0) return;

    if (onOpenExport) {
      const baseName = file?.name?.replace(/\.[^/.]+$/, '') || 'shipment_data';
      onOpenExport({
        dataset: 'files',
        title: `${file?.name || 'File Data'} (Filtered)`,
        records: exportRows,
        columns: displayColumns.map((col) => ({ key: col.key, header: col.label })),
        filenamePrefix: `EdgeView_${baseName}_Filtered`,
      });
      return;
    }

    const headers = displayColumns.map((col) => col.label);
    const csvRows = [headers.join(',')];

    exportRows.forEach((row) => {
      const values = displayColumns.map((col) => {
        let val = getCellValue(row, col, fileColumns);
        if (col.key === 'date') {
          val = formatExcelDate(val);
        }
        const strVal = val !== undefined && val !== null ? String(val) : '';
        return `"${strVal.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const baseName = file?.name?.replace(/\.[^/.]+$/, '') || 'pharma_shipments';
    const groupSuffix = isGrouped ? '_grouped' : '';
    const filterSuffix = activeFilterCount > 0 ? '_filtered' : '';

    link.setAttribute('href', url);
    link.setAttribute('download', `${baseName}${groupSuffix}${filterSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveToHistory = async () => {
    if (!file) return;
    try {
      setIsSaving(true);
      if (onSaveToHistory) {
        await onSaveToHistory(file.id);
      } else {
        const { ok, data, error } = await safeFetchJson<any>(`/api/files/${file.id}/save-to-history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!ok || !data || data.success === false) {
          throw new Error(data?.error || error || 'Failed to save to history');
        }
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      alert(`Save to History Error: ${err.message || 'Failed to save file'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!file) {
    return (
      <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] p-12 text-center text-[#9ca3af] shadow-xs">
        <Database className="w-12 h-12 text-[#9ca3af] mx-auto mb-3" />
        <h3 className="text-base font-semibold text-[#ffffff]">No File Loaded in File Viewer</h3>
        <p className="text-xs text-[#9ca3af] mt-2 max-w-md mx-auto leading-relaxed">
          The File Viewer holds temporary session data and clears on page refresh. Any uploaded records are stored permanently in the <strong>History</strong> tab. Upload a file above or load a dataset from <strong>History</strong> to begin analysis.
        </p>
      </div>
    );
  }

  if (file && (!file.rows || file.rows.length === 0) && file.summary?.total_rows === 0 && serverTotalCount === 0 && !isDataLoading) {
    return (
      <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] p-12 text-center text-[#9ca3af] shadow-xs">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-[#ffffff]">Empty Data Records</h3>
        <p className="text-xs text-[#9ca3af] mt-2 max-w-md mx-auto leading-relaxed">
          The file <strong className="text-amber-300 font-mono">{file.name}</strong> was loaded successfully but contains 0 data rows or readable trade records. Try uploading a valid NVL, DBF, CSV, Excel, or DOCX trade file or load sample data.
        </p>
      </div>
    );
  }

  const handleSort = (colKey: string) => {
    if (sortColumn === colKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(colKey);
      setSortDirection('asc');
    }
  };

  const isDocxWithText = file.file_type === 'DOCX' || Boolean(file.raw_text);

  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] shadow-xs overflow-hidden">
      {/* Missing Columns Warning Banner */}
      {missingColumns && missingColumns.length > 0 && (
        <div className="px-4 py-2.5 bg-amber-950/60 border-b border-amber-800/50 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Column Notice:</strong> Standard column(s) <span className="font-mono font-bold text-amber-300">[{missingColumns.join(', ')}]</span> were not detected. Displaying available file fields.
            </span>
          </div>
          <span className="text-[10px] text-amber-400/80 font-mono">
            {fileColumns.length} fields found
          </span>
        </div>
      )}

      {/* Viewer Header Toolbar */}
      <div className="p-4 bg-[#262626] border-b border-[#333333] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 text-xs font-bold font-mono rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40">
              {file.file_type}
            </span>
            <h2 className="text-base font-bold text-[#ffffff] truncate max-w-xs md:max-w-md">
              {file.name}
            </h2>
          </div>

          <span className="text-xs text-[#9ca3af] font-medium">
            ({rawRows.length || file.summary?.total_rows || effectiveTotalCount || 0} total product lines)
          </span>

          {/* Grouping Toggle Switch */}
          <button
            onClick={() => {
              setIsGrouped((prev) => !prev);
              setCurrentPage(1);
            }}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isGrouped
                ? 'bg-[#10b981] text-white border-[#10b981] shadow-xs'
                : 'bg-[#1a1a1a] text-[#e5e7eb] border-[#333333] hover:bg-[#262626]'
            }`}
            title="Group multiple product rows into 1 row per shipment"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Group Shipments {isGrouped ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {/* View Mode Toggle for DOCX or Text Files */}
          {isDocxWithText && (
            <div className="flex items-center bg-[#1a1a1a] border border-[#333333] p-0.5 rounded-lg text-xs font-medium">
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 ${
                  viewMode === 'table'
                    ? 'bg-[#333333] text-white font-semibold'
                    : 'text-[#9ca3af] hover:text-white'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                onClick={() => setViewMode('text')}
                className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 ${
                  viewMode === 'text'
                    ? 'bg-[#333333] text-white font-semibold'
                    : 'text-[#9ca3af] hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Document</span>
              </button>
            </div>
          )}

          {/* Save to History Button */}
          <button
            onClick={handleSaveToHistory}
            id="save-to-history-btn"
            disabled={isSaving}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg font-semibold text-xs transition-colors shadow-xs ${
              saveSuccess
                ? 'bg-[#10b981] text-white border border-[#10b981]'
                : 'bg-[#0284c7] hover:bg-[#0369a1] text-white'
            }`}
            title="Save this dataset to the permanent History tab"
          >
            {isSaving ? (
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Bookmark className="w-3.5 h-3.5" />
            )}
            <span>{saveSuccess ? 'Saved to History ✓' : 'Save to History'}</span>
          </button>

          {/* Export Filtered View Button */}
          <button
            onClick={handleExportFilteredCSV}
            id="export-filtered-btn"
            disabled={isExportingFiltered || isDataLoading || effectiveTotalCount === 0}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-[#10b981] hover:bg-[#10b981]/80 disabled:opacity-50 text-white font-semibold text-xs shadow-xs transition-colors"
            title="Export currently filtered and grouped view to UTF-8 CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingFiltered ? 'Preparing export…' : 'Export Filtered'}</span>
          </button>

          {/* Export all stored rows through the server-owned report pipeline. */}
          <button
            onClick={() => {
              if (file && onOpenExport) {
                const baseName = file.name.replace(/\.[^/.]+$/, '');
                onOpenExport({
                  dataset: 'files',
                  title: `${file.name} (Full Dataset)`,
                  records: [],
                  sourceFileId: file.id,
                  recordCount: file.summary?.total_rows ?? file.rows?.length ?? 0,
                  filenamePrefix: `EdgeView_${baseName}_Full`,
                });
              } else {
                onExportCSV();
              }
            }}
            id="export-csv-btn"
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#333333] hover:bg-[#262626] text-[#e5e7eb] font-medium text-xs shadow-xs transition-colors cursor-pointer"
            title="Export all stored rows in the selected report format"
          >
            <Download className="w-3.5 h-3.5 text-[#9ca3af]" />
            <span>Export Full</span>
          </button>
        </div>
      </div>

      {/* Warnings for Missing Columns */}
      {missingColumns.length > 0 && (
        <div className="bg-amber-950/40 border-b border-amber-800/50 divide-y divide-amber-800/30">
          {missingColumns.map((colName) => (
            <div
              key={colName}
              className="p-2.5 px-4 flex items-center space-x-2 text-xs text-amber-300 font-medium"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Column not found: <strong>{colName}</strong>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* View Mode 1: Document View */}
      {viewMode === 'text' && file.raw_text ? (
        <div className="p-6 bg-[#1a1a1a] space-y-6">
          <div className="p-4 bg-[#262626] border border-[#333333] rounded-lg max-h-[500px] overflow-y-auto whitespace-pre-wrap font-mono text-xs text-[#e5e7eb] leading-relaxed">
            {file.raw_text}
          </div>

          {file.doc_tables && file.doc_tables.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#ffffff] flex items-center space-x-2">
                <TableIcon className="w-4 h-4 text-[#10b981]" />
                <span>Extracted Document Tables</span>
              </h3>
              {file.doc_tables.map((table, tIdx) => (
                <div key={tIdx} className="border border-[#333333] rounded-lg overflow-hidden">
                  <div className="bg-[#262626] px-3 py-2 text-xs font-semibold text-[#e5e7eb]">
                    {table.title || `Table ${tIdx + 1}`}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-[#e5e7eb]">
                      <tbody>
                        {table.rows.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className={
                              rIdx === 0
                                ? 'bg-[#333333] font-bold border-b border-[#333333]'
                                : 'border-b border-[#262626]'
                            }
                          >
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="px-3 py-2 border-r border-[#262626] last:border-0">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* View Mode 2: Table View with Granular Filter Controls & 6 Target Columns */
        <div>
          {/* Filter Controls Bar Above Table */}
          <div className="p-4 bg-[#262626] border-b border-[#333333] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-[#ffffff] uppercase tracking-wider">
                <Filter className="w-4 h-4 text-[#10b981]" />
                <span>Filters & Search</span>
                {activeFilterCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#10b981]/20 text-[#10b981] font-mono text-[10px] border border-[#10b981]/40">
                    {activeFilterCount} active
                  </span>
                )}
              </div>

              {activeFilterCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center space-x-1 text-xs text-[#10b981] hover:text-[#10b981]/80 font-semibold transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            {/* Granular Filter Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* 1. Product Filter */}
              <div className="relative">
                <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Package className="w-3 h-3 text-[#9ca3af]" />
                  Product / Item
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filter product name..."
                    value={productFilter}
                    onChange={(e) => {
                      setProductFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-[#1a1a1a] border border-[#333333] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981]"
                  />
                  {productFilter && (
                    <button
                      onClick={() => setProductFilter('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Country Filter */}
              <div>
                <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-[#9ca3af]" />
                  Country
                </label>
                <select
                  value={countryFilter}
                  onChange={(e) => {
                    setCountryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-[#1a1a1a] border border-[#333333] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981]"
                >
                  <option value="">All Countries ({effectiveFilterOptions.countries.length})</option>
                  {effectiveFilterOptions.countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Importer Filter */}
              <div>
                <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-[#9ca3af]" />
                  Importer
                </label>
                <select
                  value={importerFilter}
                  onChange={(e) => {
                    setImporterFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-[#1a1a1a] border border-[#333333] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981]"
                >
                  <option value="">All Importers ({effectiveFilterOptions.importers.length})</option>
                  {effectiveFilterOptions.importers.map((imp) => (
                    <option key={imp} value={imp}>
                      {imp}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Start Date */}
              <div>
                <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#9ca3af]" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#1a1a1a] border border-[#333333] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981]"
                />
              </div>

              {/* 5. End Date */}
              <div>
                <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#9ca3af]" />
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#1a1a1a] border border-[#333333] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981]"
                />
              </div>
            </div>

            {/* Quick Keyword Search + Table Meta */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#9ca3af] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Global keyword search across Date, Item, Importer, Cost..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981]"
                />
                {searchInput && (
                  <button
                    onClick={() => setSearchInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-3 text-xs text-[#e5e7eb]">
                <div className="flex items-center space-x-1.5">
                  <span>Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-[#333333] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#10b981] bg-[#1a1a1a] text-white"
                  >
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                </div>

                <span className="font-mono text-[#9ca3af] font-medium">
                  Showing {effectiveTotalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
                  {Math.min(currentPage * pageSize, effectiveTotalCount)} of {effectiveTotalCount}{' '}
                  {isGrouped ? 'shipments' : 'rows'}
                </span>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto max-h-[520px] custom-scrollbar">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#262626] text-[#e5e7eb] font-bold sticky top-0 z-10 border-b border-[#333333] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center border-r border-[#333333] bg-[#1a1a1a] text-[#9ca3af]">
                    #
                  </th>
                  {visibleDisplayColumns.map((col) => {
                    const isSorted = sortColumn === col.key;
                    const isUsdCol = col.key === 'total_fc_usd';

                    return (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`px-3.5 py-2.5 border-r border-[#333333] cursor-pointer hover:bg-[#333333] transition-colors select-none whitespace-nowrap ${
                          isUsdCol ? 'bg-[#10b981]/10 text-[#10b981] font-extrabold' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between space-x-1">
                          <span className="truncate flex items-center gap-1">
                            {isUsdCol && (
                              <DollarSign className="w-3.5 h-3.5 text-[#10b981] inline shrink-0" />
                            )}
                            {col.label}
                          </span>
                          <ArrowUpDown
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isSorted ? 'text-[#10b981] font-bold' : 'text-[#9ca3af]'
                            }`}
                          />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262626] text-[#e5e7eb]">
                {displayRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={displayColumns.length + 1}
                      className="px-4 py-12 text-center text-[#9ca3af] bg-[#1a1a1a]"
                    >
                      <div className="max-w-xs mx-auto space-y-2">
                        <p className="font-semibold text-[#e5e7eb]">No matching shipment records found</p>
                        <p className="text-xs text-[#9ca3af]">
                          Try adjusting or resetting your active search filters.
                        </p>
                        {activeFilterCount > 0 && (
                          <button
                            onClick={handleResetFilters}
                            className="mt-2 inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40 text-xs font-semibold hover:bg-[#10b981]/30 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Clear All Filters</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayRows.map((row, rIdx) => {
                    const rowNum = (currentPage - 1) * pageSize + rIdx + 1;
                    return (
                      <TableRow
                        key={rIdx}
                        row={row}
                        displayColumns={visibleDisplayColumns}
                        rowNum={rowNum}
                        fileColumns={fileColumns}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Pagination Controls */}
          <div className="p-3 bg-[#262626] border-t border-[#333333] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3 text-xs text-[#9ca3af] font-mono">
              <span>
                Page {currentPage} of {totalPages} ({sortedRows.length.toLocaleString()} items)
              </span>

              {/* Rows Per Page Selector */}
              <div className="flex items-center space-x-1.5 border-l border-[#333333] pl-3">
                <span className="text-[11px] text-gray-400">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-[#1a1a1a] border border-[#333333] text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-[#10b981]"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                </select>
              </div>

              {/* Jump to Page */}
              {totalPages > 1 && (
                <div className="hidden sm:flex items-center space-x-1 border-l border-[#333333] pl-3">
                  <span className="text-[11px] text-gray-400">Jump:</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1 && val <= totalPages) {
                        setCurrentPage(val);
                      }
                    }}
                    className="w-14 bg-[#1a1a1a] border border-[#333333] text-white rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-[#10b981]"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center space-x-1 flex-wrap gap-y-1">
              {/* First Page Button */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1 || totalPages <= 1}
                className="px-2.5 py-1.5 rounded border border-[#333333] text-xs text-[#e5e7eb] hover:bg-[#333333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center space-x-1 bg-[#1a1a1a]"
                title="Go to First Page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
                <span>First</span>
              </button>

              {/* Previous Page Button */}
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1 || totalPages <= 1}
                className="px-2.5 py-1.5 rounded border border-[#333333] text-xs text-[#e5e7eb] hover:bg-[#333333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center space-x-1 bg-[#1a1a1a]"
                title="Go to Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              {/* Page Number Buttons */}
              {getPageNumbers().map((page, idx) => {
                if (typeof page === 'string') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs text-[#9ca3af] font-mono">
                      ...
                    </span>
                  );
                }

                const isActive = page === currentPage;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-2.5 py-1.5 rounded text-xs font-mono transition-colors ${
                      isActive
                        ? 'bg-[#10b981] text-white font-bold border border-[#10b981] shadow-xs'
                        : 'bg-[#1a1a1a] text-[#e5e7eb] border border-[#333333] hover:bg-[#333333]'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

              {/* Next Page Button */}
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages <= 1}
                className="px-2.5 py-1.5 rounded border border-[#333333] text-xs text-[#e5e7eb] hover:bg-[#333333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center space-x-1 bg-[#1a1a1a]"
                title="Go to Next Page"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Last Page Button */}
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || totalPages <= 1}
                className="px-2.5 py-1.5 rounded border border-[#333333] text-xs text-[#e5e7eb] hover:bg-[#333333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center space-x-1 bg-[#1a1a1a]"
                title="Go to Last Page"
              >
                <span>Last</span>
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
