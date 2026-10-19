import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { selectExportRecords, validateExportRequest } from './export_validation';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  PageOrientation,
} from 'docx';
import { cleanMarkdown, type ReportCompanyContact } from './docx_report';
import { generateDocxReportStream, generateGenericDocxReportStream, generateInternationalImporterDirectoryDocx } from './docx_stream';
import { generatePdfReport, generateInternationalImporterDirectoryPdf } from './pdf_report';
import { TradeRelationshipResolver } from './trade_relationship_resolver';
import { buildContactReport, getReportColumnLabels, type ContactReport } from './contact_report_model';
import {
  getInternationalImporterDirectory,
  flattenInternationalImporterRows,
  INTERNATIONAL_IMPORTER_COLUMNS,
  type InternationalImporterDirectory,
} from './international_importer_directory';

function logMem(label: string) {
  const m = process.memoryUsage();
  console.log(`[MEM] ${label}: RSS=${Math.round(m.rss/1024/1024)}MB heapUsed=${Math.round(m.heapUsed/1024/1024)}MB heapTotal=${Math.round(m.heapTotal/1024/1024)}MB ext=${Math.round(m.external/1024/1024)}MB arr=${Math.round((m.arrayBuffers||0)/1024/1024)}MB`);
}



export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ColumnDef {
  key: string;
  header: string;
}

export interface NormalizedExportPayload {
  dataset: string; // 'contacts' | 'files' | 'country' | 'outreach' | 'reports' | 'stats' | 'summary'
  title: string;
  records: any[];
  columns?: ColumnDef[];
  selectedRows?: any[];
  filters?: Record<string, any>;
  filenamePrefix?: string;
  format: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'all';
  report_type?: 'importer' | 'exporter' | 'both' | 'international_importer';
}

export const FULL_DATASET_COLUMNS: ColumnDef[] = [
  { key: 'Date', header: 'Date' },
  { key: 'Importer', header: 'Importer' },
  { key: 'Country', header: 'Country' },
  { key: 'Exporter', header: 'Exporter' },
  { key: 'Item', header: 'Item' },
  { key: 'Total FC (USD)', header: 'Total FC (USD)' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function formatDatasetDate(val: any, rawRow?: Record<string, any>): string {
  if (val === null || val === undefined) return 'N/A';
  let s = String(val).trim();
  if (!s) return 'N/A';

  // If value starts with "####" (Excel column width display artifact)
  if (s.startsWith('####')) {
    if (rawRow) {
      const altVal = rawRow['BE_DATE'] || rawRow['BE_DATE_1'] || rawRow['LC_DATE'] || rawRow['BE_DT'] || rawRow['shipment_date'] || rawRow['Date'] || rawRow['date'];
      if (altVal && String(altVal).trim() && !String(altVal).startsWith('####')) {
        return formatDatasetDate(altVal);
      }
    }
    return 'N/A';
  }

  const formatParts = (d: number, m: number, y: number) => {
    const dayStr = String(d).padStart(2, '0');
    const monthStr = String(m).padStart(2, '0');
    const yearStr = String(y);
    return `${dayStr}-${monthStr}-${yearStr}`;
  };

  // 1. Check Excel serial number (numeric, e.g. 45084)
  const num = Number(s);
  if (!isNaN(num) && num >= 1000 && num <= 90000) {
    const excelBase = new Date(Date.UTC(1899, 11, 30));
    const targetDate = new Date(excelBase.getTime() + Math.floor(num) * 86400000);
    if (!isNaN(targetDate.getTime())) {
      return formatParts(
        targetDate.getUTCDate(),
        targetDate.getUTCMonth() + 1,
        targetDate.getUTCFullYear()
      );
    }
  }

  // 2. YYYYMMDD (e.g. 20230607)
  if (/^\d{8}$/.test(s) && (s.startsWith('19') || s.startsWith('20'))) {
    const year = parseInt(s.substring(0, 4), 10);
    const month = parseInt(s.substring(4, 6), 10);
    const day = parseInt(s.substring(6, 8), 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return formatParts(day, month, year);
    }
  }

  // 3. Delimited Date (e.g., 7/6/2023, 07-June-2023, 2023-06-07)
  const parts = s.split(/[\/\-\.\s]+/);
  if (parts.length >= 3) {
    // Check if month name is in the second part
    const monthNamesLower = [
      'jan', 'feb', 'mar', 'apr', 'may', 'jun',
      'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ];
    const secondPartLower = parts[1]?.toLowerCase();
    const textMonthIdx = monthNamesLower.findIndex((m) => secondPartLower?.startsWith(m));
    if (textMonthIdx !== -1) {
      const day = parseInt(parts[0], 10);
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(year)) {
        return formatParts(day, textMonthIdx + 1, year);
      }
    }

    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const p3 = parseInt(parts[2], 10);

    // YYYY-MM-DD
    if (parts[0].length === 4 && !isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      return formatParts(p3, p2, p1);
    }

    // DD/MM/YYYY or D/M/YYYY
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
      return formatParts(day, month, year);
    }
  }

  // 4. Try JS Date parser as last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return formatParts(
      d.getUTCDate(),
      d.getUTCMonth() + 1,
      d.getUTCFullYear()
    );
  }

  return 'N/A';
}

export function formatTotalValueUsd(val: any): string {
  if (val === null || val === undefined || val === '') return 'N/A';
  const str = String(val).trim();
  if (!str || str === 'N/A') return 'N/A';

  const cleanNumStr = str.replace(/[^0-9.-]/g, '');
  if (!cleanNumStr) return 'N/A';

  const num = Number(cleanNumStr);
  if (isNaN(num)) return 'N/A';

  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatTotalFc(val: any): string {
  if (val === null || val === undefined || val === '') return 'N/A';
  const str = String(val).trim();
  if (!str || str === 'N/A') return 'N/A';

  const cleanNumStr = str.replace(/[^0-9.-]/g, '');
  if (!cleanNumStr) return 'N/A';

  const num = Number(cleanNumStr);
  if (isNaN(num)) return 'N/A';

  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USD`;
}

export const formatTotalCostUsd = formatTotalValueUsd;

export function formatNtn(val: any): string {
  if (val === null || val === undefined || val === '') return 'N/A';
  let str = String(val).trim();
  if (!str || str === 'N/A') return 'N/A';
  if (str.endsWith('.0')) str = str.slice(0, -2);
  return str || 'N/A';
}

export function formatHsCode(val: any): string {
  if (val === null || val === undefined || val === '') return 'N/A';
  const str = String(val).trim();
  if (!str || str === 'N/A') return 'N/A';
  return str;
}

export function transformFullDatasetRecords(records: any[]): Record<string, string>[] {
  if (!Array.isArray(records)) return [];

  return records.map((r) => {
    if (!r || typeof r !== 'object') {
      return {
        'Date': 'N/A',
        'Importer': 'N/A',
        'Country': 'N/A',
        'Exporter': 'N/A',
        'Item': 'N/A',
        'Total Value (USD)': 'N/A',
      };
    }

    const getVal = (...keys: string[]) => {
      for (const k of keys) {
        if (r[k] !== undefined && r[k] !== null) {
          const vStr = String(r[k]).trim();
          if (vStr !== '' && vStr !== 'undefined' && vStr !== 'null') {
            return r[k];
          }
        }
      }
      return null;
    };

    const rawDate = getVal('BE_DATE', 'BE_DATE_1', 'be_date', 'BE_DT', 'shipment_date', 'SHIP_DATE', 'Date', 'date');
    const rawImporter = getVal('IMPORTER', 'importer', 'importer_name', 'BUYER_NAME', 'Customer_Name', 'BUYER', 'CONSIGNEE', 'Importer');
    const rawCountry = getVal('COUNTRY', 'country', 'ORIGIN', 'origin', 'country_name', 'Country');
    const rawExporter = getVal('EXPORTER', 'exporter', 'exporter_name', 'SUPPLIER_NAME', 'Supplier_Name', 'SELLER', 'SUPPLIER', 'Exporter');
    const rawItem = getVal('ITEM', 'item', 'product_name', 'Drug_Class', 'CAT_NUMBER', 'goods_description', 'Item');
    const rawTotFc = getVal('TOT_FC', 'tot_fc', 'total_cost_usd', 'VAL_USD', 'Invoice_Value', 'Total Value (USD)', 'Total FC (USD)', 'total_fc_usd');

    return {
      'Date': formatDatasetDate(rawDate, r),
      'Importer': rawImporter ? String(rawImporter).trim() : 'N/A',
      'Country': rawCountry ? String(rawCountry).trim() : 'N/A',
      'Exporter': rawExporter ? String(rawExporter).trim() : 'N/A',
      'Item': rawItem ? String(rawItem).trim() : 'N/A',
      'Total FC (USD)': formatTotalValueUsd(rawTotFc),
    };
  });
}

function sanitizeCell(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

function sanitizeCSVCell(val: any): string {
  let str = sanitizeCell(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

// 1. CSV Generator
export function generateCsvData(columns: ColumnDef[], records: any[]): string {
  const headers = columns.map((col) => sanitizeCSVCell(col.header)).join(',');
  const rows = records.map((rec) =>
    columns.map((col) => sanitizeCSVCell(rec[col.key] ?? rec[col.header] ?? '')).join(',')
  );
  return '\uFEFF' + [headers, ...rows].join('\r\n');
}

// 2. XLSX Workbook Generator
export async function generateXlsxWorkbook(title: string, columns: ColumnDef[], records: any[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EdgeView';
  workbook.created = new Date();
  const sheetName = title.replace(/[\\/*?:\[\]]/g, '').substring(0, 31) || 'Data Sheet';
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns.map((col) => {
    let maxLen = col.header.length;
    records.slice(0, 50).forEach((rec) => {
      const v = sanitizeCell(rec[col.key] ?? rec[col.header] ?? '');
      if (v.length > maxLen) maxLen = v.length;
    });
    return { header: col.header, key: col.key, width: Math.min(Math.max(maxLen + 4, 12), 50) };
  });
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  for (const record of records) {
    const row: Record<string, any> = {};
    for (const col of columns) {
      let value = record[col.key] ?? record[col.header] ?? '';
      if (value !== null && typeof value === 'object') value = JSON.stringify(value);
      row[col.key] = typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    }
    sheet.addRow(row);
  }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: Math.max(1, columns.length) } };
  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output as ArrayBuffer);
}

// 3. Generic DOCX Generator for Tabular Datasets
export async function generateGenericDocxReport(
  title: string,
  columns: ColumnDef[],
  records: any[]
): Promise<Buffer> {
  const thinBorder = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: '000000',
  };

  const borders = {
    top: thinBorder,
    bottom: thinBorder,
    left: thinBorder,
    right: thinBorder,
  };

  const TOTAL_DXA = 14400; // Landscape 10 inches @ 1440 DXA/in

  // Map proportional column widths for 8 columns or fallback evenly
  const colWidthMap: Record<string, number> = {
    'Date': 1200,
    'Importer': 2200,
    'Country': 1200,
    'Exporter': 2200,
    'Item': 3800,
    'Total FC': 1500,
    'NTN': 1150,
    'HS Code': 1150,
  };

  const getColDxa = (colHeader: string) => {
    if (colWidthMap[colHeader]) return colWidthMap[colHeader];
    return Math.floor(TOTAL_DXA / Math.max(columns.length, 1));
  };

  // Header Banner
  const titleBanner = new Table({
    width: { size: TOTAL_DXA, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: TOTAL_DXA, type: WidthType.DXA },
            shading: { fill: '0284C7' },
            borders,
            margins: { top: 180, bottom: 180, left: 180, right: 180 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `EdgeView — ${title}`,
                    font: 'Arial',
                    size: 26,
                    bold: true,
                    color: 'FFFFFF',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Table Header Row
  const headerRow = new TableRow({
    tableHeader: true,
    children: columns.map(
      (col) =>
        new TableCell({
          width: { size: getColDxa(col.header), type: WidthType.DXA },
          shading: { fill: 'E5E7EB' },
          borders,
          margins: { top: 120, bottom: 120, left: 100, right: 100 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [
                new TextRun({
                  text: col.header,
                  font: 'Arial',
                  size: 16,
                  bold: true,
                  color: '111827',
                }),
              ],
            }),
          ],
        })
    ),
  });

  // Table Data Rows
  const dataRows = records.map((rec) => {
    return new TableRow({
      children: columns.map((col) => {
        const val = sanitizeCell(rec[col.key] ?? rec[col.header] ?? '');
        return new TableCell({
          width: { size: getColDxa(col.header), type: WidthType.DXA },
          borders,
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [
                new TextRun({
                  text: val || '—',
                  font: 'Arial',
                  size: 14,
                  color: '374151',
                }),
              ],
            }),
          ],
        });
      }),
    });
  });

  const dataTable = new Table({
    width: { size: TOTAL_DXA, type: WidthType.DXA },
    rows: [headerRow, ...dataRows],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: 720,
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        children: [
          titleBanner,
          new Paragraph({ text: '', spacing: { after: 200 } }),
          dataTable,
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// 4. Generic PDF Generator for Tabular Datasets (Landscape 8-Column)
export async function generateGenericPdfReport(
  title: string,
  columns: ColumnDef[],
  records: any[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        layout: 'landscape',
        size: 'LETTER',
        margin: 36,
        autoFirstPage: true,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const MARGIN = 36;
      const PAGE_WIDTH = doc.page.width; // 792
      const PAGE_HEIGHT = doc.page.height; // 612
      const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 720

      // Title Banner
      const titleBannerHeight = 32;
      const startY = doc.y;

      doc.rect(MARGIN, startY, CONTENT_WIDTH, titleBannerHeight).fillAndStroke('#0284C7', '#000000');

      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(`EdgeView — ${title}`, MARGIN, startY + 9, {
          width: CONTENT_WIDTH,
          align: 'center',
        });

      doc.y = startY + titleBannerHeight + 12;

      // Proportional widths for 8 columns on 720pt page width
      const colWidthsMap: Record<string, number> = {
        'Date': 60,
        'Importer': 110,
        'Country': 65,
        'Exporter': 110,
        'Item': 185,
        'Total FC': 80,
        'NTN': 55,
        'HS Code': 55,
      };

      const displayCols = columns;
      const getColWidth = (colHeader: string) => {
        if (colWidthsMap[colHeader]) return colWidthsMap[colHeader];
        return CONTENT_WIDTH / Math.max(displayCols.length, 1);
      };

      const drawTableHeader = (yPos: number) => {
        doc.rect(MARGIN, yPos, CONTENT_WIDTH, 20).fillAndStroke('#E5E7EB', '#000000');
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8);

        let curX = MARGIN;
        displayCols.forEach((col) => {
          const w = getColWidth(col.header);
          doc.text(col.header, curX + 3, yPos + 5, {
            width: w - 6,
            align: 'left',
          });
          curX += w;
        });

        return yPos + 20;
      };

      let currentY = drawTableHeader(doc.y);

      records.forEach((rec) => {
        // Estimate row height based on cell text lengths
        let maxLines = 1;
        displayCols.forEach((col) => {
          const val = sanitizeCell(rec[col.key] ?? rec[col.header] ?? '');
          const w = getColWidth(col.header);
          const lines = Math.ceil(val.length / Math.max(Math.floor((w - 6) / 5), 4));
          if (lines > maxLines) maxLines = lines;
        });

        const rowHeight = Math.min(Math.max(maxLines * 11 + 6, 18), 90);

        if (currentY + rowHeight > PAGE_HEIGHT - MARGIN - 20) {
          doc.addPage();
          currentY = drawTableHeader(MARGIN);
        }

        const rowStartY = currentY;

        doc.rect(MARGIN, rowStartY, CONTENT_WIDTH, rowHeight).stroke('#E5E7EB');

        let curX = MARGIN;
        displayCols.forEach((col) => {
          const val = sanitizeCell(rec[col.key] ?? rec[col.header] ?? '') || '—';
          const w = getColWidth(col.header);

          doc
            .fillColor('#374151')
            .font('Helvetica')
            .fontSize(7.5)
            .text(val, curX + 3, rowStartY + 4, {
              width: w - 6,
              height: rowHeight - 6,
              align: 'left',
            });
          curX += w;
        });

        currentY += rowHeight;
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Resolves the first non-empty value from a list of column aliases. Used for
 * dynamic schema resolution across the many column naming conventions found in
 * real trade datasets (importer/exporter/country/date/value aliases).
 */
export function resolveColumnAlias(record: any, aliases: string[], fallback?: any): any {
  if (!record || typeof record !== 'object') return fallback;
  for (const alias of aliases) {
    const v = record[alias];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return v;
    }
  }
  return fallback;
}

// Helper to extract contacts array from records
export function extractContactsList(records: any[]): ReportCompanyContact[] {
  return records.map((r, i) => {
    if (!r || typeof r !== 'object') {
      return {
        id: `c-${i}`,
        company_name: 'Unknown Company',
        country: 'Not Specified'
      };
    }

    const companyName = resolveColumnAlias(
      r,
      ['company_name', 'company', 'Name', 'name', 'Importer', 'Exporter', 'IMPORTER', 'EXPORTER',
       'Buyer', 'Buyer Name', 'Buyer_Name', 'BUYER', 'BUYER_NAME', 'Supplier', 'Supplier Name',
       'Supplier_Name', 'SUPPLIER', 'SUPPLIER_NAME', 'Consignee', 'Customer', 'Vendor', 'Seller'],
      'Company Record'
    );
    const country = resolveColumnAlias(
      r,
      ['country', 'Country', 'COUNTRY', 'country_name', 'DESTINATION', 'DEST', 'ORIGIN', 'ORIG', 'Origin', 'Destination'],
      'Not Specified'
    );
    const email = resolveColumnAlias(r, ['email', 'Email', 'EMAIL', 'contact_email', 'CONTACT_EMAIL'], undefined);
    const phone = resolveColumnAlias(r, ['phone', 'Phone', 'PHONE', 'contact_phone', 'tel', 'mobile', 'MOBILE'], undefined);
    const website = resolveColumnAlias(r, ['website', 'Website', 'WEBSITE', 'web'], undefined);
    const address = resolveColumnAlias(r, ['address', 'Address', 'ADDRESS', 'street'], undefined);
    const industry = resolveColumnAlias(r, ['industry', 'Industry', 'SECTOR', 'sector'], undefined);

    return {
      id: r.id || r._id || `c-${i}`,
      company_name: String(companyName).trim(),
      type: r.type || 'Company',
      ceo: r.ceo || r.CEO || r.executive || r.key_contact,
      email: email ? String(email).trim() : undefined,
      phone: phone ? String(phone).trim() : undefined,
      whatsapp: r.whatsapp,
      whatsapp_details: r.whatsapp_details,
      linkedin: r.linkedin,
      website: website ? String(website).trim() : undefined,
      address: address ? String(address).trim() : undefined,
      industry: industry ? String(industry).trim() : undefined,
      country: String(country).trim(),
      emails_list: r.emails_list || (email ? [email] : []),
      phones_list: r.phones_list || (phone ? [phone] : []),
      fax_numbers: r.fax_numbers || [],
      linkedin_urls: r.linkedin_urls || (r.linkedin ? [r.linkedin] : []),
      contact_persons: r.contact_persons || r.contacts || [],
      addresses: r.addresses || [],
      decision_makers: r.decision_makers || [],
      socials: r.socials || [],
      sources: r.sources || [],
      evidence: r.evidence || [],
      company_contacts: r.company_contacts || [],
    };
  });
}

// Helper to flatten a normalized contact report into the 5-column directory grid
// shared by CSV/XLSX exports. Runs fully synchronously from the pre-built model.
export function flattenContactReportRows(
  report: ContactReport,
  columns: ColumnDef[]
): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  const [sNoKey, nameKey, historyKey, leadershipKey, contactKey] = columns.map((c) => c.key);

  for (const section of report.countrySections) {
    for (const imp of section.importers) {
      const historyLines =
        imp.tradeHistory.length === 0
          ? ['Not found']
          : imp.tradeHistory.map((r) => {
              const line = `• ${cleanMarkdown(r.partnerName)} (${cleanMarkdown(r.country || 'Unknown')}) [${r.shipmentCount || 0} shp]`;
              return r.itemDescription ? `${line}\n   ${cleanMarkdown(r.itemDescription)}` : line;
            });

      const leadershipLines =
        imp.leadership.length === 0
          ? ['Not found']
          : imp.leadership.map((p) => {
              let title = cleanMarkdown(p.name);
              if (p.designation) title += ` (${cleanMarkdown(p.designation)})`;
              if (p.department) title += ` [${cleanMarkdown(p.department)}]`;
              const parts = [title];
              if (p.emails.length > 0) parts.push(`Email: ${p.emails.join(', ')}`);
              if (p.phones.length > 0) parts.push(`Tel: ${p.phones.join(', ')}`);
              if (p.sources.length > 0) parts.push(`Source: ${p.sources.join('; ')}`);
              return parts.join('\n');
            });

      const ci = imp.contactInfo;
      const contactLines: string[] = [];
      if (ci.addresses.length === 0) {
        contactLines.push('Addr: Not found');
      } else {
        ci.addresses.forEach((a) =>
          contactLines.push(`Addr: ${cleanMarkdown(a.address)}${a.type ? ` (${a.type})` : ''}`)
        );
      }
      if (ci.website) contactLines.push(`Website: ${cleanMarkdown(ci.website)}`);
      if (ci.emails.length > 0) contactLines.push(`Email: ${ci.emails.join(', ')}`);
      if (ci.phones.length > 0) contactLines.push(`Tel: ${ci.phones.join(', ')}`);
      if (ci.fax_numbers.length > 0) contactLines.push(`Fax: ${ci.fax_numbers.join(', ')}`);
      if (ci.whatsapp) contactLines.push(`WhatsApp: ${cleanMarkdown(ci.whatsapp)}`);
      if (ci.linkedin_urls.length > 0) contactLines.push(`LinkedIn: ${ci.linkedin_urls.map(cleanMarkdown).join(', ')}`);
      const socials = (ci.socials || [])
        .filter((s) => s && s.url)
        .map((s) => `${s.platform}: ${cleanMarkdown(s.url)}`);
      if (socials.length > 0) contactLines.push(`Socials: ${socials.join(' | ')}`);
      if (ci.sources.length > 0) {
        contactLines.push(`Sources: ${ci.sources.map((s) => cleanMarkdown(s.url)).join('; ')}`);
      }

      rows.push({
        [sNoKey]: imp.sNo,
        [nameKey]: `${cleanMarkdown(imp.companyName)} [${imp.role}]`,
        [historyKey]: historyLines.join('\n'),
        [leadershipKey]: leadershipLines.join('\n'),
        [contactKey]: contactLines.join('\n'),
      });
    }
  }

  return rows;
}

export function contactReportColumns(reportType: 'importer' | 'exporter'): ColumnDef[] {
  const labels = getReportColumnLabels(reportType);
  return [
    { key: 'S.No', header: 'S.No' },
    { key: 'Company', header: labels.nameHeader },
    { key: 'History', header: labels.historyHeader },
    { key: 'Leadership', header: 'CEO / Leadership / Decision Makers' },
    { key: 'Contact', header: 'Contact Information & Address' },
  ];
}

// 5. Contact Export Processor (Strictly Isolated Pipeline)
export async function processContactExport(payload: NormalizedExportPayload): Promise<{
  buffer: Buffer | string;
  contentType: string;
  filename: string;
  failedFormats?: string[];
}> {
  logMem('processContactExport START');
  const { title, format, filenamePrefix = 'EdgeView_Contacts_Export' } = payload;
  const reportType: 'importer' | 'exporter' | 'both' | 'international_importer' =
    payload.report_type && ['importer', 'exporter', 'both', 'international_importer'].includes(payload.report_type)
      ? (payload.report_type as 'importer' | 'exporter' | 'both' | 'international_importer')
      : 'importer';

  const rawRecords = selectExportRecords(payload);

  if (rawRecords.length === 0) {
    throw new Error('No valid contact records found to export.');
  }

  const contactsList = extractContactsList(rawRecords);

  // Build the trade index ONCE for the entire export (O(1) lookups per company).
  const tradeIndex = await TradeRelationshipResolver.buildTradeIndex();
  logMem('after buildTradeIndex');

  const currentDate = new Date().toISOString().split('T')[0];
  const safeTitle = (title || 'Contacts').replace(/[^a-zA-Z0-9_-]/g, '_');

  const generateSingle = async (
    rt: 'importer' | 'exporter',
    fmt: string
  ): Promise<{ buffer: Buffer | string; contentType: string; filename: string; failedFormats?: string[] }> => {
    const report = await buildContactReport(contactsList, rt, tradeIndex);
    const columns = contactReportColumns(rt);
    const rows = flattenContactReportRows(report, columns);
    const roleTag = rt === 'importer' ? 'Importers' : 'Exporters';
    const baseFilename = `${filenamePrefix}_${roleTag}_${currentDate}`;

    if (fmt === 'csv') {
      logMem('generateSingle csv START');
      return {
        buffer: generateCsvData(columns, rows),
        contentType: 'text/csv; charset=utf-8',
        filename: `${baseFilename}.csv`,
      };
    }

    if (fmt === 'xlsx') {
      logMem('generateSingle xlsx START');
      return {
        buffer: await generateXlsxWorkbook(title || 'Contacts', columns, rows),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `${baseFilename}.xlsx`,
      };
    }

    if (fmt === 'docx') {
      logMem('generateSingle docx START');
      const buf = await generateDocxReportStream(contactsList, rt, tradeIndex, report);
      return {
        buffer: buf,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        filename: `${baseFilename}.docx`,
      };
    }

    if (fmt === 'pdf') {
      logMem('generateSingle pdf START');
      const buf = await generatePdfReport(contactsList, rt, tradeIndex, report);
      return {
        buffer: buf,
        contentType: 'application/pdf',
        filename: `${baseFilename}.pdf`,
      };
    }

    if (fmt === 'all') {
      logMem('generateSingle all START');
      const failedFormats: string[] = [];
      const tempBase = path.join(os.tmpdir(), 'edgeview_exports');
      fs.mkdirSync(tempBase, { recursive: true });
      const tempPaths: string[] = [];

      const writeTemp = async (name: string, data: Buffer | string): Promise<void> => {
        const filePath = path.join(tempBase, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${name}`);
        await fs.promises.writeFile(filePath, data);
        tempPaths.push(filePath);
      };

      const cleanupTemp = () => {
        for (const p of tempPaths) {
          try {
            fs.unlinkSync(p);
          } catch {
            /* ignore */
          }
        }
      };

      try {
        // CSV string written to disk and released before XLSX is built.
        const csvStr = generateCsvData(columns, rows);
        await writeTemp(`${baseFilename}_Contacts.csv`, csvStr);
      } catch (err: any) {
        console.error('CSV export failed in ZIP:', err);
        failedFormats.push('CSV');
      }
      try {
        // XLSX buffer written to disk and released before DOCX is built.
        const xlsxBuf = await generateXlsxWorkbook(title || 'Contacts', columns, rows);
        await writeTemp(`${baseFilename}_Contacts.xlsx`, xlsxBuf);
      } catch (err: any) {
        console.error('XLSX export failed in ZIP:', err);
        failedFormats.push('XLSX');
      }
      try {
        // DOCX buffer written to disk and released before PDF is built.
        const docxBuf = await generateDocxReportStream(contactsList, rt, tradeIndex, report);
        await writeTemp(`${baseFilename}_Report.docx`, docxBuf);
      } catch (err: any) {
        console.error('DOCX export failed in ZIP:', err);
        failedFormats.push('DOCX');
      }
      try {
        const pdfBuf = await generatePdfReport(contactsList, rt, tradeIndex, report);
        await writeTemp(`${baseFilename}_Report.pdf`, pdfBuf);
      } catch (err: any) {
        console.error('PDF export failed in ZIP:', err);
        failedFormats.push('PDF');
      }

      logMem('all formats written to temp files');
      // Only one sub-format is read into memory at a time when assembling the ZIP.
      const zip = new JSZip();
      for (const p of tempPaths) {
        const name = path.basename(p).replace(/^[0-9]+_[a-z0-9]+_/, '');
        const data = await fs.promises.readFile(p);
        zip.file(name, data);
        try {
          fs.unlinkSync(p);
        } catch {
          /* ignore */
        }
      }
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      logMem('zip generated');
      return {
        buffer: zipBuffer,
        contentType: 'application/zip',
        filename: `${baseFilename}.zip`,
        failedFormats: failedFormats.length > 0 ? failedFormats : undefined,
      };
    }

    throw new Error(`Unsupported export format: ${fmt}`);
  };

  // report_type 'both' always packages importer + exporter reports together.
  if (reportType === 'both') {
    if (format === 'all') {
      const failedFormats: string[] = [];
      const tempBase = path.join(os.tmpdir(), 'edgeview_exports');
      fs.mkdirSync(tempBase, { recursive: true });
      const tempPaths: string[] = [];

      const writeTemp = async (name: string, data: Buffer | string): Promise<void> => {
        const filePath = path.join(tempBase, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${name}`);
        await fs.promises.writeFile(filePath, data);
        tempPaths.push(filePath);
      };

      for (const rt of ['importer', 'exporter'] as const) {
        const report = await buildContactReport(contactsList, rt, tradeIndex);
        logMem(`buildContactReport ${rt}`);
        const columns = contactReportColumns(rt);
        const rows = flattenContactReportRows(report, columns);
        const roleTag = rt === 'importer' ? 'Importers' : 'Exporters';
        const baseFilename = `${filenamePrefix}_${roleTag}_${currentDate}`;
        try {
          await writeTemp(`${baseFilename}.csv`, generateCsvData(columns, rows));
        } catch (err: any) {
          console.error('CSV export failed in ZIP:', err);
          failedFormats.push('CSV');
        }
        try {
          await writeTemp(`${baseFilename}.xlsx`, await generateXlsxWorkbook(title || 'Contacts', columns, rows));
        } catch (err: any) {
          console.error('XLSX export failed in ZIP:', err);
          failedFormats.push('XLSX');
        }
        try {
          await writeTemp(`${baseFilename}.docx`, await generateDocxReportStream(contactsList, rt, tradeIndex, report));
        } catch (err: any) {
          console.error('DOCX export failed in ZIP:', err);
          failedFormats.push('DOCX');
        }
        try {
          await writeTemp(`${baseFilename}.pdf`, await generatePdfReport(contactsList, rt, tradeIndex, report));
        } catch (err: any) {
          console.error('PDF export failed in ZIP:', err);
          failedFormats.push('PDF');
        }
      }
      logMem('both/all formats written to temp files');
      const zip = new JSZip();
      for (const p of tempPaths) {
        const name = path.basename(p).replace(/^[0-9]+_[a-z0-9]+_/, '');
        const data = await fs.promises.readFile(p);
        zip.file(name, data);
        try {
          fs.unlinkSync(p);
        } catch {
          /* ignore */
        }
      }
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      logMem('both/all zip generated');
      return {
        buffer: zipBuffer,
        contentType: 'application/zip',
        filename: `${filenamePrefix}_Importers_Exporters_All_${currentDate}.zip`,
        failedFormats: failedFormats.length > 0 ? failedFormats : undefined,
      };
    }

    const imp = await generateSingle('importer', format);
    const exp = await generateSingle('exporter', format);
    const zip = new JSZip();
    zip.file(imp.filename, imp.buffer);
    zip.file(exp.filename, exp.buffer);
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    return {
      buffer: zipBuffer,
      contentType: 'application/zip',
      filename: `${filenamePrefix}_Importers_Exporters_${currentDate}.zip`,
    };
  }

  // International Importer Directory — canonical projection shared by every
  // format below (PDF/DOCX/XLSX/CSV/ZIP) so ordering, Pakistan exclusion, and
  // trade aggregation are identical.
  if (reportType === 'international_importer') {
    const directory = await getInternationalImporterDirectory(contactsList, tradeIndex);
    logMem('after international directory');
    const columns = INTERNATIONAL_IMPORTER_COLUMNS as ColumnDef[];
    const rows = flattenInternationalImporterRows(directory, columns as any);
    const baseFilename = `${filenamePrefix}_International_Importers_${currentDate}`;

    if (format === 'csv') {
      return {
        buffer: generateCsvData(columns, rows),
        contentType: 'text/csv; charset=utf-8',
        filename: `${baseFilename}.csv`,
      };
    }

    if (format === 'xlsx') {
      return {
        buffer: await generateXlsxWorkbook(title || 'International Importers', columns, rows),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `${baseFilename}.xlsx`,
      };
    }

    if (format === 'docx') {
      const buf = await generateInternationalImporterDirectoryDocx(contactsList, tradeIndex, directory);
      return {
        buffer: buf,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        filename: `${baseFilename}.docx`,
      };
    }

    if (format === 'pdf') {
      const buf = await generateInternationalImporterDirectoryPdf(contactsList, tradeIndex, directory);
      return {
        buffer: buf,
        contentType: 'application/pdf',
        filename: `${baseFilename}.pdf`,
      };
    }

    if (format === 'all') {
      const failedFormats: string[] = [];
      const tempBase = path.join(os.tmpdir(), 'edgeview_exports');
      fs.mkdirSync(tempBase, { recursive: true });
      const tempPaths: string[] = [];

      const writeTemp = async (name: string, data: Buffer | string): Promise<void> => {
        const filePath = path.join(tempBase, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${name}`);
        await fs.promises.writeFile(filePath, data);
        tempPaths.push(filePath);
      };

      try {
        await writeTemp(`${baseFilename}.csv`, generateCsvData(columns, rows));
      } catch (err: any) {
        console.error('CSV export failed in ZIP:', err);
        failedFormats.push('CSV');
      }
      try {
        await writeTemp(`${baseFilename}.xlsx`, await generateXlsxWorkbook(title || 'International Importers', columns, rows));
      } catch (err: any) {
        console.error('XLSX export failed in ZIP:', err);
        failedFormats.push('XLSX');
      }
      try {
        await writeTemp(`${baseFilename}.docx`, await generateInternationalImporterDirectoryDocx(contactsList, tradeIndex, directory));
      } catch (err: any) {
        console.error('DOCX export failed in ZIP:', err);
        failedFormats.push('DOCX');
      }
      try {
        await writeTemp(`${baseFilename}.pdf`, await generateInternationalImporterDirectoryPdf(contactsList, tradeIndex, directory));
      } catch (err: any) {
        console.error('PDF export failed in ZIP:', err);
        failedFormats.push('PDF');
      }

      const zipBuf = new JSZip();
      for (const p of tempPaths) {
        const name = path.basename(p).replace(/^[0-9]+_[a-z0-9]+_/, '');
        const data = await fs.promises.readFile(p);
        zipBuf.file(name, data);
        try {
          fs.unlinkSync(p);
        } catch {
          /* ignore */
        }
      }
      const buffer = await zipBuf.generateAsync({ type: 'nodebuffer' });
      return {
        buffer,
        contentType: 'application/zip',
        filename: `${baseFilename}.zip`,
        failedFormats: failedFormats.length > 0 ? failedFormats : undefined,
      };
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  return generateSingle(reportType as 'importer' | 'exporter', format);
}

// 6. Full Dataset Export Processor (Strictly Isolated Pipeline)
export async function processFullDatasetExport(payload: NormalizedExportPayload): Promise<{
  buffer: Buffer | string;
  contentType: string;
  filename: string;
  failedFormats?: string[];
}> {
  const { title, format, filenamePrefix = 'EdgeView_Dataset_Export' } = payload;
  const rawRecords = selectExportRecords(payload);

  if (rawRecords.length === 0) {
    throw new Error('No valid records found in dataset to export.');
  }

  const targetRecords = transformFullDatasetRecords(rawRecords);
  const columns = FULL_DATASET_COLUMNS;

  const currentDate = new Date().toISOString().split('T')[0];
  const safeTitle = (title || 'Dataset').replace(/[^a-zA-Z0-9_-]/g, '_');
  const baseFilename = `${filenamePrefix}_${safeTitle}_${currentDate}`;

  if (format === 'csv') {
    const csvContent = generateCsvData(columns, targetRecords);
    return {
      buffer: csvContent,
      contentType: 'text/csv; charset=utf-8',
      filename: `${baseFilename}.csv`,
    };
  }

  if (format === 'xlsx') {
    const xlsxBuf = await generateXlsxWorkbook(title || 'Dataset', columns, targetRecords);
    return {
      buffer: xlsxBuf,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${baseFilename}.xlsx`,
    };
  }

  if (format === 'docx') {
    const docxBuf = await generateGenericDocxReportStream(title || 'Report', columns, targetRecords);
    return {
      buffer: docxBuf,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      filename: `${baseFilename}.docx`,
    };
  }

  if (format === 'pdf') {
    const pdfBuf = await generateGenericPdfReport(title || 'Report', columns, targetRecords);
    return {
      buffer: pdfBuf,
      contentType: 'application/pdf',
      filename: `${baseFilename}.pdf`,
    };
  }

  if (format === 'all') {
    const zip = new JSZip();
    const failedFormats: string[] = [];

    try {
      const csvStr = generateCsvData(columns, targetRecords);
      zip.file(`${baseFilename}_Data.csv`, csvStr);
    } catch (err: any) {
      console.error('CSV export failed in ZIP:', err);
      failedFormats.push('CSV');
    }

    try {
      const xlsxBuf = await generateXlsxWorkbook(title || 'Dataset', columns, targetRecords);
      zip.file(`${baseFilename}_Data.xlsx`, xlsxBuf);
    } catch (err: any) {
      console.error('XLSX export failed in ZIP:', err);
      failedFormats.push('XLSX');
    }

    try {
      const docxBuf = await generateGenericDocxReportStream(title || 'Report', columns, targetRecords);
      zip.file(`${baseFilename}_Report.docx`, docxBuf);
    } catch (err: any) {
      console.error('DOCX export failed in ZIP:', err);
      failedFormats.push('DOCX');
    }

    try {
      const pdfBuf = await generateGenericPdfReport(title || 'Report', columns, targetRecords);
      zip.file(`${baseFilename}_Report.pdf`, pdfBuf);
    } catch (err: any) {
      console.error('PDF export failed in ZIP:', err);
      failedFormats.push('PDF');
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    return {
      buffer: zipBuffer,
      contentType: 'application/zip',
      filename: `${baseFilename}.zip`,
      failedFormats: failedFormats.length > 0 ? failedFormats : undefined,
    };
  }

  throw new Error(`Unsupported export format: ${format}`);
}

// Master Export Processor (Router)
export async function processExportRequest(payload: NormalizedExportPayload): Promise<{
  buffer: Buffer | string;
  contentType: string;
  filename: string;
  failedFormats?: string[];
}> {
  validateExportRequest(payload);
  const isContactDataset = payload.dataset === 'contacts' || payload.dataset === 'outreach';
  if (isContactDataset) {
    return processContactExport(payload);
  } else {
    return processFullDatasetExport(payload);
  }
}
