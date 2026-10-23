import ExcelJS from 'exceljs';
import mammoth from 'mammoth';
import { checkTextColumnCount, TextParseBudget, TextParseLimitError, TEXT_PARSE_LIMITS } from './text_parse_budget';

export interface ParsedResult {
  file_type: 'NVL' | 'DBF' | 'CSV' | 'Excel' | 'DOCX' | 'Unknown';
  columns: string[];
  rows: Record<string, any>[];
  raw_text?: string;
  doc_tables?: Array<{ title?: string; rows: string[][] }>;
  error?: string;
}

/**
 * Custom NVL Parser
 * Format:
 * key1 = "value1"
 * key2 = "value2"
 * <blank line or '---' for new record>
 */
export function parseNVL(content: string): { columns: string[]; rows: Record<string, any>[] } {
  try {
    if (!content || typeof content !== 'string' || !content.trim()) {
      return { columns: ['Date', 'Item', 'Importer', 'Exporter', 'Total Value (USD)', 'Agent'], rows: [] };
    }

    const lines = content.split(/\r?\n/).map((l) => (l || '').trim()).filter((l) => l.length > 0);
    if (lines.length === 0) {
      return { columns: ['Date', 'Item', 'Importer', 'Exporter', 'Total Value (USD)', 'Agent'], rows: [] };
    }

    const DEFAULT_NVL_COLUMNS = [
      'BE_LINK', 'BE_DATE', 'HS_CODE', 'ITEM', 'IMPORTER', 'NTN',
      'EXPORTER', 'AGENT_NAME', 'ADD1', 'COUNTRY', 'QTY', 'GROSS',
      'NET', 'UNT', 'DV_FC', 'FC', 'DV_PAK', 'AV_FC', 'AV_PAK',
      'TOT_FC', 'LC_NO', 'LC_DATE', 'BE_TYPE', 'SIGN', 'PORT',
      'MRK', 'GROUP_LINK', 'DUTY', 'STAX', 'ITAX', 'AGENT_LINK',
      'INDEX_LINK', 'INDEX_DATE', 'IGM_LINK', 'IGM_DATE', 'COMP_LINK',
      'FRET', 'ORIGIN', 'SUPP', 'CITY', 'FOB'
    ];

    const SIX_NVL_COLUMNS = ['BE_DATE', 'ITEM', 'IMPORTER', 'EXPORTER', 'TOT_FC', 'AGENT_NAME'];

    const splitLineIntoCells = (line: string): string[] => {
      try {
        const lineStr = line ? String(line).trim() : '';
        if (!lineStr) return [];
        const delimiter = lineStr.includes('\t') ? '\t' : lineStr.includes(',') ? ',' : /\s{2,}/.test(lineStr) ? /\s{2,}/ : /\s+/;
        const cells = lineStr.split(delimiter, TEXT_PARSE_LIMITS.columns + 1);
        checkTextColumnCount(cells.length);
        return cells.map((c) => c.trim().replace(/^"|"$/g, ''));
      } catch (err) {
        if (err instanceof TextParseLimitError) throw err;
        return [line ? String(line) : ''];
      }
    };

    const columnMapping: Record<string, string> = {
      BE_DATE: 'Date',
      ITEM: 'Item',
      IMPORTER: 'Importer',
      EXPORTER: 'Exporter',
      TOT_FC: 'Total Value (USD)',
      AGENT_NAME: 'Agent',
      be_date: 'Date',
      item: 'Item',
      importer: 'Importer',
      exporter: 'Exporter',
      tot_fc: 'Total Value (USD)',
      agent_name: 'Agent',
    };

    const reverseMapping: Record<string, string> = {
      Date: 'BE_DATE',
      Item: 'ITEM',
      Importer: 'IMPORTER',
      Exporter: 'EXPORTER',
      'Total Value (USD)': 'TOT_FC',
      'Total FC (USD)': 'TOT_FC',
      Agent: 'AGENT_NAME',
    };

    const requiredCols = ['Date', 'Item', 'Importer', 'Exporter', 'Total Value (USD)', 'Agent'];

    const firstLineCells = splitLineIntoCells(lines[0]);
    const hasHeader = firstLineCells.some((cell) =>
      /BE_DATE|BE_LINK|ITEM|IMPORTER|EXPORTER|TOT_FC|AGENT_NAME|HS_CODE|Date|Item|Importer|Exporter|Total FC|Agent/i.test(cell)
    );

    let headers: string[] = [];
    let dataLines: string[] = [];

    if (hasHeader) {
      headers = firstLineCells;
      dataLines = lines.slice(1);
    } else {
      dataLines = lines;
      headers = firstLineCells.length <= 10 ? SIX_NVL_COLUMNS : DEFAULT_NVL_COLUMNS;
    }

    const rows: Record<string, any>[] = [];
    const budget = new TextParseBudget();
    const allColsSet = new Set<string>();

    headers.forEach((h) => {
      allColsSet.add(h);
      if (columnMapping[h]) allColsSet.add(columnMapping[h]);
    });
    requiredCols.forEach((rc) => allColsSet.add(rc));

    for (const line of dataLines) {
      if (line.startsWith('#') || line.startsWith('//')) continue;
      const cells = splitLineIntoCells(line);
      if (cells.length === 0) continue;
      budget.addRow(Math.max(headers.length, cells.length));

      const row: Record<string, any> = {};
      requiredCols.forEach((rc) => {
        row[rc] = '';
      });

      for (let colIdx = 0; colIdx < Math.max(headers.length, cells.length); colIdx++) {
        const colName = headers[colIdx] || `Column_${colIdx + 1}`;
        const val = cells[colIdx] ?? '';
        row[colName] = val;
        allColsSet.add(colName);

        if (columnMapping[colName]) {
          const mappedKey = columnMapping[colName];
          row[mappedKey] = val;
          allColsSet.add(mappedKey);
        }
      }

      // Fill reverse keys if present
      for (const [newK, oldK] of Object.entries(reverseMapping)) {
        if (row[newK] && (!row[oldK] || row[oldK] === '')) {
          row[oldK] = row[newK];
          allColsSet.add(oldK);
        }
      }

      rows.push(row);
    }

    // Key-value fallback if rows empty or single cell key=value lines
    if (rows.length === 0) {
      let currentRecord: Record<string, any> = {};
      for (const rawLine of lines) {
        if (!rawLine || rawLine.startsWith('#') || rawLine.startsWith('//') || rawLine === '---') {
          if (Object.keys(currentRecord).length > 0) {
            rows.push({ ...currentRecord });
            currentRecord = {};
          }
          continue;
        }

        const eqIdx = rawLine.indexOf('=');
        if (eqIdx !== -1) {
          const key = rawLine.substring(0, eqIdx).trim();
          let val = rawLine.substring(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          if (key in currentRecord && currentRecord[key] !== '') {
            rows.push({ ...currentRecord });
            currentRecord = { [key]: val };
          } else {
            currentRecord[key] = val;
          }
          allColsSet.add(key);
          if (columnMapping[key]) allColsSet.add(columnMapping[key]);
        }
      }
      if (Object.keys(currentRecord).length > 0) {
        rows.push({ ...currentRecord });
      }
    }

    // Ensure all rows contain both mapped and raw keys
    const finalRows = rows.map((r) => {
      const newRow = { ...r };
      requiredCols.forEach((rc) => {
        if (newRow[rc] === undefined) newRow[rc] = '';
      });
      for (const [oldK, newK] of Object.entries(columnMapping)) {
        if (newRow[oldK] !== undefined && (newRow[newK] === undefined || newRow[newK] === '')) {
          newRow[newK] = newRow[oldK];
        }
      }
      return newRow;
    });

    return {
      columns: Array.from(allColsSet),
      rows: finalRows,
    };
  } catch (err) {
    if (err instanceof TextParseLimitError) throw err;
    console.warn('parseNVL failed gracefully:', err);
    return { columns: [], rows: [] };
  }
}

/**
 * DBF Direct Binary Parser
 */
export function parseDBFBuffer(buffer: Buffer): { columns: string[]; rows: Record<string, any>[] } {
  try {
    if (!buffer || buffer.length === 0) return { columns: [], rows: [] };

    // Parse the DBF binary directly. This avoids routing untrusted DBF input
    // through a spreadsheet parser and keeps bounds checks explicit.
    if (buffer.length < 32) return { columns: [], rows: [] };

    const rawNumRecords = buffer.readUInt32LE(4);
    const headerLen = buffer.readUInt16LE(8);
    const recordLen = buffer.readUInt16LE(10);

    if (headerLen <= 0 || recordLen <= 0 || headerLen >= buffer.length) {
      return { columns: [], rows: [] };
    }

    const fields: Array<{ name: string; type: string; len: number }> = [];
    let offset = 32;

    while (offset < headerLen - 1 && buffer[offset] !== 0x0d) {
      if (offset + 32 > buffer.length) break;
      const name = buffer
        .subarray(offset, offset + 11)
        .toString('ascii')
        .replace(/\0/g, '')
        .trim();
      const type = String.fromCharCode(buffer[offset + 11]);
      const len = buffer[offset + 16];
      if (name) {
        fields.push({ name, type, len });
      }
      offset += 32;
    }

    if (fields.length === 0) return { columns: [], rows: [] };

    const columns = fields.map((f) => f.name);
    const rows: Record<string, any>[] = [];
    let recOffset = headerLen;

    const calculatedMax = Math.floor((buffer.length - headerLen) / recordLen);
    const numRecords = rawNumRecords > 0 && rawNumRecords < 1000000 ? Math.min(rawNumRecords, calculatedMax) : calculatedMax;

    for (let i = 0; i < numRecords; i++) {
      if (recOffset + recordLen > buffer.length) break;
      const recordBytes = buffer.subarray(recOffset, recOffset + recordLen);
      recOffset += recordLen;

      // Check deletion flag (0x2A is '*')
      if (recordBytes[0] === 0x2a) continue;

      const row: Record<string, any> = {};
      let colOffset = 1;

      for (const f of fields) {
        if (colOffset + f.len > recordBytes.length) break;
        let valStr = recordBytes
          .subarray(colOffset, colOffset + f.len)
          .toString('latin1')
          .replace(/[\0\r\n]/g, '')
          .trim();
        colOffset += f.len;

        if (f.type === 'N') {
          const num = Number(valStr);
          row[f.name] = isNaN(num) ? valStr : num;
        } else {
          row[f.name] = valStr;
        }
      }

      rows.push(row);
    }

    return { columns, rows };
  } catch (err) {
    console.warn('parseDBFBuffer failed gracefully:', err);
    return { columns: [], rows: [] };
  }
}

/**
 * Fallback Customs NVL Record Pattern Extractor
 */
function parseCustomsNVLRawText(text: string): { columns: string[]; rows: Record<string, any>[] } {
  try {
    if (!text || typeof text !== 'string') return { columns: [], rows: [] };

    const defaultCols = [
      'BE_LINK', 'BE_DATE', 'HS_CODE', 'ITEM', 'IMPORTER', 'NTN',
      'EXPORTER', 'AGENT_NAME', 'ADD1', 'COUNTRY', 'QTY', 'GROSS',
      'NET', 'UNT', 'DV_FC', 'FC', 'DV_PAK', 'AV_FC', 'AV_PAK',
      'TOT_FC', 'LC_NO', 'LC_DATE', 'BE_TYPE', 'SIGN', 'PORT',
      'MRK', 'GROUP_LINK', 'DUTY', 'STAX', 'ITAX', 'AGENT_LINK',
      'INDEX_LINK', 'INDEX_DATE', 'IGM_LINK', 'IGM_DATE', 'COMP_LINK',
      'FRET', 'ORIGIN', 'SUPP', 'CITY', 'FOB'
    ];

    // Regex pattern matching records like "IPAE-1112      202307133004.9099 ..."
    const matches = Array.from(text.matchAll(/([A-Z]{3,4}-\d+)\s+(\d{8})(\d{4}\.\d{4})?\s+(.*?)(?=\b[A-Z]{3,4}-\d+|\b[A-Z0-9]{6,8}\b|$)/gs));
    const rows: Record<string, any>[] = [];

    for (const m of matches) {
      const beLink = m[1] || '';
      const dateStr = m[2] || '';
      const hsCode = m[3] || '';
      const rest = m[4] || '';

      // Extract numbers from rest for QTY, AV_FC, AV_PAK, TOT_FC
      const numMatches = rest.match(/\d+\.\d{2,6}/g) || [];
      const textParts = rest.replace(/\d+\.\d{2,6}/g, ' ').split(/\s{2,}/).map(s => s.trim()).filter(Boolean);

      rows.push({
        BE_LINK: beLink,
        BE_DATE: dateStr,
        HS_CODE: hsCode,
        ITEM: textParts[0] || rest.substring(0, 80).trim(),
        IMPORTER: textParts[1] || '',
        EXPORTER: textParts[2] || textParts[3] || '',
        COUNTRY: textParts.find(p => /Sri Lanka|Somalia|Kenya|Uganda|Ghana|Nigeria|Thailand|Mauritius|United Kingdom|Barbados/i.test(p)) || '',
        TOT_FC: numMatches[numMatches.length - 1] || numMatches[0] || '',
        AGENT_NAME: textParts.find(p => /KHALID|AGENT|MUG/i.test(p)) || '',
      });
    }

    return { columns: defaultCols, rows };
  } catch (err) {
    console.warn('parseCustomsNVLRawText failed gracefully:', err);
    return { columns: [], rows: [] };
  }
}

export function standardizeDate(input: any): string {
  try {
    if (input === null || input === undefined) return '';
    const s = String(input).trim();
    if (!s) return '';

    // 1. YYYYMMDD
    if (/^\d{8}$/.test(s) && (s.startsWith('19') || s.startsWith('20'))) {
      return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
    }

    // 2. Excel serial number
    if (!isNaN(Number(s))) {
      const num = Number(s);
      if (num >= 1000 && num <= 90000) {
        const excelBase = new Date(Date.UTC(1899, 11, 30));
        const targetDate = new Date(excelBase.getTime() + Math.floor(num) * 86400000);
        if (!isNaN(targetDate.getTime())) {
          return targetDate.toISOString().split('T')[0];
        }
      }
    }

    // 3. Delimited Date: DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD, DD-MM-YYYY
    const parts = s.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      const p3 = parseInt(parts[2], 10);

      // YYYY/MM/DD
      if (parts[0].length === 4 && !isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
        const year = p1;
        const month = String(Math.min(12, Math.max(1, p2))).padStart(2, '0');
        const day = String(Math.min(31, Math.max(1, p3))).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }

      // DD/MM/YYYY or MM/DD/YYYY
      if (parts[2].length === 4 && !isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
        const year = p3;
        let day = p1;
        let month = p2;

        if (p1 > 12) {
          day = p1;
          month = p2;
        } else if (p2 > 12) {
          day = p2;
          month = p1;
        }

        const monthStr = String(Math.min(12, Math.max(1, month))).padStart(2, '0');
        const dayStr = String(Math.min(31, Math.max(1, day))).padStart(2, '0');
        return `${year}-${monthStr}-${dayStr}`;
      }
    }

    // 4. Native JS Date attempt
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }

    return s;
  } catch {
    return String(input || '');
  }
}

function deduplicateAndAggregateRows(rows: Record<string, any>[]): Record<string, any>[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const groups: Record<string, Record<string, any>[]> = {};

  const getCleanVal = (row: Record<string, any>, ...keys: string[]): string => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null) {
        const str = String(row[k]).trim();
        if (str && str !== 'undefined' && str !== 'null' && str !== '—') {
          return str;
        }
      }
    }
    return '';
  };

  for (const row of rows) {
    // 1. shipment ID
    let identity = getCleanVal(row, 'shipment_id', 'SHIPMENT_ID', 'Shipment ID', 'shipment_no', 'SHIPMENT_NO', 'Shipment No');
    let idType = 'shipment_id';

    // 2. invoice number
    if (!identity) {
      identity = getCleanVal(row, 'invoice_no', 'INVOICE_NO', 'Invoice No', 'invoice_num', 'INVOICE_NUM', 'Invoice Number', 'INV_NO', 'inv_no');
      idType = 'invoice_no';
    }

    // 3. BE number
    if (!identity) {
      identity = getCleanVal(row, 'be_no', 'BE_NO', 'Be_No', 'BE Number', 'be_number', 'Be_Number');
      idType = 'be_no';
    }

    // 4. BE link
    if (!identity) {
      identity = getCleanVal(row, 'be_link', 'BE_LINK', 'Be_Link', 'BE_LINK_1', 'BE Link');
      idType = 'be_link';
    }

    // 5. LC number
    if (!identity) {
      identity = getCleanVal(row, 'lc_no', 'LC_NO', 'Lc_No', 'LC Number', 'lc_num', 'LC_NUM');
      idType = 'lc_no';
    }

    // 6. deterministic composite fallback
    if (!identity) {
      const beDate = getCleanVal(row, 'BE_DATE', 'Date', 'be_date');
      const importer = getCleanVal(row, 'IMPORTER', 'Importer', 'importer').toLowerCase().replace(/[^a-z0-9]/g, '');
      const exporter = getCleanVal(row, 'EXPORTER', 'Exporter', 'exporter').toLowerCase().replace(/[^a-z0-9]/g, '');
      const totFc = getCleanVal(row, 'TOT_FC', 'Total Value (USD)', 'Total FC (USD)');
      const item = getCleanVal(row, 'ITEM', 'Item', 'item').toLowerCase().replace(/[^a-z0-9]/g, '');
      identity = `${beDate}_${importer}_${exporter}_${totFc}_${item}`;
      idType = 'composite';
    }

    const groupKey = `${idType}:${identity}`;
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(row);
  }

  const result: Record<string, any>[] = [];

  for (const groupKey of Object.keys(groups)) {
    const groupRows = groups[groupKey];
    if (groupRows.length === 1) {
      result.push(groupRows[0]);
      continue;
    }

    // Merge multiple rows
    const baseRow = { ...groupRows[0] };

    // Aggregate items
    const uniqueItems = Array.from(
      new Set(
        groupRows
          .map(r => getCleanVal(r, 'ITEM', 'Item', 'item'))
          .filter(Boolean)
      )
    );
    const mergedItem = uniqueItems.join('; ');
    if (mergedItem) {
      baseRow['ITEM'] = mergedItem;
      baseRow['Item'] = mergedItem;
    }

    // Aggregate HS Codes
    const uniqueHs = Array.from(
      new Set(
        groupRows
          .map(r => getCleanVal(r, 'HS_CODE', 'hs_code', 'HS Code'))
          .filter(Boolean)
      )
    );
    const mergedHs = uniqueHs.join(', ');
    if (mergedHs) {
      baseRow['HS_CODE'] = mergedHs;
      baseRow['HS Code'] = mergedHs;
    }

    // Aggregate Quantities
    let totalQty = 0;
    let hasQty = false;
    for (const r of groupRows) {
      const qVal = r.Qty !== undefined ? r.Qty : (r.QTY !== undefined ? r.QTY : r.qty);
      if (qVal !== undefined && qVal !== null) {
        const num = Number(String(qVal).replace(/[^0-9.-]/g, ''));
        if (!isNaN(num)) {
          totalQty += num;
          hasQty = true;
        }
      }
    }
    if (hasQty) {
      baseRow['Qty'] = totalQty;
      baseRow['QTY'] = totalQty;
      baseRow['qty'] = totalQty;
    }

    // Total FC (USD) / Value: count once, do not multiply!
    // Since baseRow already has the first row's value, we keep it as is, which prevents multiplying/summing.

    // Merge remaining fields by choosing the first non-empty value
    const fieldsToFill = ['agent_name', 'AGENT_NAME', 'Agent Name', 'Agent', 'COUNTRY', 'Country', 'country', 'unit', 'Unit', 'UNIT', 'be_link', 'BE_LINK', 'be_date', 'BE_DATE', 'Date'];
    for (const f of fieldsToFill) {
      if (!baseRow[f]) {
        for (const r of groupRows) {
          const val = r[f];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            baseRow[f] = val;
            break;
          }
        }
      }
    }

    result.push(baseRow);
  }

  return result;
}

/**
 * Universal Parser based on File Extension / Content
 */
export async function parseFile(
  filename: string,
  buffer: Buffer
): Promise<ParsedResult> {
  try {
    if (!buffer || buffer.length === 0) {
      return { file_type: 'Unknown', columns: [], rows: [], raw_text: 'Empty file buffer received.', error: 'Empty file buffer received.' };
    }

    const ext = filename.split('.').pop()?.toLowerCase() || '';

    // Helper to ensure rows have normalized aliases and safe defaults without destructive overwrites
    const normalizeRowsList = (rowsList: Record<string, any>[]): Record<string, any>[] => {
      if (!Array.isArray(rowsList)) return [];
      const mapped = rowsList.map((r) => {
        if (!r || typeof r !== 'object') return {};
        const norm: Record<string, any> = { ...r };

        const getVal = (...keys: string[]) => {
          for (const k of keys) {
            if (r[k] !== undefined && r[k] !== null) {
              const strVal = String(r[k]).trim();
              if (strVal !== '' && strVal !== 'undefined' && strVal !== 'null') {
                return r[k];
              }
            }
          }
          return '';
        };

        const beDate = getVal('BE_DATE', 'be_date', 'BE_DATE_1', 'BE_DT', 'shipment_date', 'SHIP_DATE', 'Date', 'date');
        const importer = getVal('IMPORTER', 'importer', 'importer_name', 'BUYER_NAME', 'Customer_Name', 'BUYER', 'CONSIGNEE', 'Importer');
        const country = getVal('COUNTRY', 'country', 'ORIGIN', 'origin', 'country_name', 'Country');
        const exporter = getVal('EXPORTER', 'exporter', 'exporter_name', 'SUPPLIER_NAME', 'Supplier_Name', 'SELLER', 'SUPPLIER', 'Exporter');
        const item = getVal('ITEM', 'item', 'product_name', 'Drug_Class', 'CAT_NUMBER', 'goods_description', 'Item');
        const totFc = getVal('TOT_FC', 'tot_fc', 'total_cost_usd', 'VAL_USD', 'Invoice_Value', 'Total Value (USD)', 'Total FC (USD)');
        const ntn = getVal('NTN', 'ntn', 'Ntn', 'NTN_NO');
        const hsCode = getVal('HS_CODE', 'hs_code', 'Hs_Code', 'HS Code');

        if (beDate) {
          norm['BE_DATE'] = beDate;
          norm['Date'] = standardizeDate(beDate);
        }
        if (importer) {
          norm['IMPORTER'] = importer;
          norm['Importer'] = importer;
        }
        if (country) {
          norm['COUNTRY'] = country;
          norm['Country'] = country;
        }
        if (exporter) {
          norm['EXPORTER'] = exporter;
          norm['Exporter'] = exporter;
        }
        if (item) {
          norm['ITEM'] = item;
          norm['Item'] = item;
        }
        if (totFc !== '') {
          norm['TOT_FC'] = totFc;
          const num = Number(String(totFc).replace(/[^0-9.-]/g, ''));
          norm['Total Value (USD)'] = isNaN(num) ? totFc : num;
          norm['Total FC (USD)'] = isNaN(num) ? totFc : num;
        }
        if (ntn) {
          norm['NTN'] = ntn;
        }
        if (hsCode) {
          norm['HS_CODE'] = hsCode;
          norm['HS Code'] = hsCode;
        }

        return norm;
      });

      return mapped;
    };

  // 1. NVL Files
  if (ext === 'nvl') {
    // A) Try DBF Binary parsing first because customs .nvl files are DBF binary tables
    let dbfRes = { columns: [] as string[], rows: [] as Record<string, any>[] };
    try {
      dbfRes = parseDBFBuffer(buffer);
    } catch (e) {
      console.warn('DBF buffer parse error for NVL file:', e);
    }

    if (dbfRes.rows && dbfRes.rows.length > 0) {
      const normRows = normalizeRowsList(dbfRes.rows);
      const colsSet = new Set<string>([...dbfRes.columns, 'Date', 'Country', 'Importer', 'Exporter', 'Total Value (USD)', 'Total FC (USD)', 'Item']);
      return {
        file_type: 'NVL',
        columns: Array.from(colsSet),
        rows: normRows,
      };
    }

    // B) Text NVL parsing fallback
    let latin1Text = '';
    try {
      latin1Text = buffer ? buffer.toString('latin1') : '';
    } catch (e) {
      latin1Text = '';
    }

    let nvlCols: string[] = [];
    let nvlRows: Record<string, any>[] = [];
    try {
      const res = parseNVL(latin1Text);
      nvlCols = res.columns || [];
      nvlRows = res.rows || [];
    } catch (e) {
      if (e instanceof TextParseLimitError) throw e;
      console.warn('Text NVL parse error:', e);
    }

    if (nvlRows && nvlRows.length > 0) {
      const normRows = normalizeRowsList(nvlRows);
      const colsSet = new Set<string>([...nvlCols, 'Date', 'Country', 'Importer', 'Exporter', 'Total Value (USD)', 'Total FC (USD)', 'Item']);
      return {
        file_type: 'NVL',
        columns: Array.from(colsSet),
        rows: normRows,
        raw_text: latin1Text,
      };
    }

    // C) Customs NVL raw text regex extractor fallback
    let rawCustomsRes = { columns: [] as string[], rows: [] as Record<string, any>[] };
    try {
      rawCustomsRes = parseCustomsNVLRawText(latin1Text);
    } catch (e) {
      console.warn('Customs NVL raw text parse error:', e);
    }

    const normRows = normalizeRowsList(rawCustomsRes.rows || []);
    const colsSet = new Set<string>([
      ...(rawCustomsRes.columns || []),
      'Date', 'Country', 'Importer', 'Exporter', 'Total Value (USD)', 'Total FC (USD)', 'Item'
    ]);

    return {
      file_type: 'NVL',
      columns: Array.from(colsSet),
      rows: normRows,
      raw_text: latin1Text,
    };
  }

  // 2. DBF Files
  if (ext === 'dbf') {
    const { columns, rows } = parseDBFBuffer(buffer);
    const normRows = normalizeRowsList(rows);
    const colsSet = new Set<string>([...columns, 'Date', 'Country', 'Importer', 'Exporter', 'Total Value (USD)', 'Total FC (USD)', 'Item']);
    return {
      file_type: 'DBF',
      columns: Array.from(colsSet),
      rows: normRows,
    };
  }

  // 3. Excel Files (.xlsx, .xls)
  if (ext === 'xlsx' || ext === 'xls') {
    try {
      if (ext === 'xls') {
        return { file_type: 'Excel', columns: [], rows: [], error: 'Legacy .xls files are not accepted. Save the workbook as .xlsx and upload it again.' };
      }
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const sheet = workbook.worksheets[0];
      if (!sheet) return { file_type: 'Excel', columns: [], rows: [], error: 'Workbook contains no worksheets.' };
      const headerRow = sheet.getRow(1);
      const columns: string[] = [];
      const width = Math.max(headerRow.cellCount, sheet.columnCount);
      for (let index = 1; index <= width; index += 1) {
        columns.push(headerRow.getCell(index).text.trim() || `Column_${index}`);
      }
      const rows: Record<string, any>[] = [];
      for (let rowIndex = 2; rowIndex <= sheet.actualRowCount; rowIndex += 1) {
        const source = sheet.getRow(rowIndex);
        const record: Record<string, any> = {};
        let populated = false;
        columns.forEach((column, offset) => {
          const cell = source.getCell(offset + 1);
          const raw: any = cell.value;
          const value = raw && typeof raw === 'object' && 'result' in raw ? raw.result : raw instanceof Date ? raw.toISOString() : raw ?? '';
          record[column] = value;
          if (value !== '') populated = true;
        });
        if (populated) rows.push(record);
      }
      return {
        file_type: 'Excel',
        columns,
        rows: normalizeRowsList(rows),
      };
    } catch (err: any) {
      console.error('Excel parsing error:', err);
      return { file_type: 'Excel', columns: [], rows: [], error: err?.message || 'Invalid Excel workbook.' };
    }
  }

  // 4. CSV Files
  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length === 0) return { file_type: 'CSV', columns: [], rows: [] };

    // Direct fast line parser for high row counts (>100 rows) or fallback
    const delimiter = text.includes('\t') ? '\t' : text.includes(';') ? ';' : ',';
    const splitCSVLine = (lineStr: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let cIdx = 0; cIdx < lineStr.length; cIdx++) {
        const char = lineStr[cIdx];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(cur.trim().replace(/^"|"$/g, ''));
          checkTextColumnCount(result.length + 1);
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim().replace(/^"|"$/g, ''));
      checkTextColumnCount(result.length);
      return result;
    };

    const headers = splitCSVLine(lines[0]);
    const rows: Record<string, any>[] = [];
    const budget = new TextParseBudget();

    for (let i = 1; i < lines.length; i++) {
      const cells = splitCSVLine(lines[i]);
      if (cells.length === 0 || (cells.length === 1 && !cells[0])) continue;
      budget.addRow(headers.length);
      const row: Record<string, any> = {};
      headers.forEach((h, colIdx) => {
        row[h || `Column_${colIdx + 1}`] = cells[colIdx] ?? '';
      });
      rows.push(row);
    }

    return {
      file_type: 'CSV',
      columns: headers,
      rows: normalizeRowsList(rows),
      raw_text: text,
    };
  }

  // 5. DOCX Files
  if (ext === 'docx') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const htmlResult = await mammoth.convertToHtml({ buffer });

      const rawText = result.value || '';
      
      const docTables: Array<{ title?: string; rows: string[][] }> = [];
      const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
      let match;
      let tblIdx = 1;

      while ((match = tableRegex.exec(htmlResult.value)) !== null) {
        const tableHtml = match[1];
        const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let trMatch;
        const tableRows: string[][] = [];

        while ((trMatch = trRegex.exec(tableHtml)) !== null) {
          const rowHtml = trMatch[1];
          const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
          let tdMatch;
          const rowCells: string[] = [];

          while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
            const cellText = tdMatch[1].replace(/<[^>]+>/g, '').trim();
            rowCells.push(cellText);
          }
          if (rowCells.length > 0) {
            tableRows.push(rowCells);
          }
        }

        if (tableRows.length > 0) {
          docTables.push({
            title: `Extracted Table ${tblIdx++}`,
            rows: tableRows,
          });
        }
      }

      let columns: string[] = [];
      let rows: Record<string, any>[] = [];

      if (docTables.length > 0 && docTables[0].rows.length > 1) {
        const headerRow = docTables[0].rows[0];
        columns = headerRow;
        for (let r = 1; r < docTables[0].rows.length; r++) {
          const rowData = docTables[0].rows[r];
          const rowObj: Record<string, any> = {};
          headerRow.forEach((col, idx) => {
            rowObj[col || `Col_${idx + 1}`] = rowData[idx] ?? '';
          });
          rows.push(rowObj);
        }
      }

      return {
        file_type: 'DOCX',
        columns,
        rows: normalizeRowsList(rows),
        raw_text: rawText,
        doc_tables: docTables,
      };
    } catch (err) {
      console.error('DOCX parse error:', err);
      return {
        file_type: 'DOCX',
        columns: [],
        rows: [],
        raw_text: 'Error parsing DOCX file format.',
        error: err instanceof Error ? err.message : 'Invalid DOCX document.',
      };
    }
  }

  // Fallback / Unknown format
  const text = buffer.toString('utf-8');
  return {
    file_type: 'Unknown',
    columns: [],
    rows: [],
    raw_text: text,
  };
  } catch (globalErr: any) {
    console.error('Fatal file parsing error caught:', globalErr);
    return {
      file_type: 'Unknown',
      columns: [],
      rows: [],
      raw_text: `File contents could not be parsed: ${globalErr?.message || 'Unknown error'}`,
      error: globalErr?.message || 'Unknown parsing error',
    };
  }
}

