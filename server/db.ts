import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { computeSummary, SummaryResult } from './summary';
import { canonicalCompanyIdentityKey, canonicalCountryIdentityKey, canonicalEntityIdentityKey } from './company_identity';
import { normalizeCountryName } from '../src/utils/countryNormalizer';
import { inferExporterCountryFromDataset } from './dataset_provenance';
import type { V1CompanyAddress, V1ContactPerson, V1SocialAccount } from '../shared/v1_contact_contract';

function stableCompanyId(entityKey: string): string {
  return `comp-${crypto.createHash('sha256').update(entityKey).digest('hex').slice(0, 16)}`;
}

export interface FileRecord {
  id: string;
  name: string;
  file_type: 'NVL' | 'DBF' | 'CSV' | 'Excel' | 'DOCX' | 'Unknown';
  size: number;
  upload_time: string;
  columns: string[];
  rows: Record<string, any>[];
  summary: SummaryResult;
  raw_text?: string;
  doc_tables?: Array<{ title?: string; rows: string[][] }>;
}

export interface CompanyContact {
  id: string;
  company_name: string;
  entity_key?: string;
  normalized_company?: string;
  normalized_country?: string;
  type: 'Exporter' | 'Importer' | 'Both' | 'Other';
  ceo: string;
  email: string;
  phone: string;
  whatsapp: string;
  linkedin: string;
  message_sent: boolean;
  last_updated: string;
  source_file?: string;
  source_file_ids?: string[];
  country?: string;
  industry?: string;
  website?: string;
  address?: string;
  emails_list?: string[];
  phones_list?: string[];
  linkedin_urls?: string[];
  socials?: V1SocialAccount[];
  addresses?: V1CompanyAddress[];
  contact_persons?: V1ContactPerson[];
  evidence?: unknown[];
  edgeview_v1_run_id?: string;
  sources?: Array<{ url: string; title?: string; source_type?: string }>;
  quality_status?: string;
  traded_with?: string[];
  top_products?: string[];
  trade_feature_recurrence?: Record<string, number>;
}

export interface EdgeViewReport {
  id: string;
  title: string;
  created_by: string;
  created_at: string;
  report_type: 'table' | 'docx' | 'text';
  content_text?: string;
  columns?: string[];
  rows?: Record<string, any>[];
  source_file?: string;
}

// In-Memory & File-Backed Storage Engine with Database Indexes for O(1) Lookups
class PharmaDatabase {
  public files: Map<string, FileRecord> = new Map();
  public contacts: Map<string, CompanyContact> = new Map();
  public reports: Map<string, EdgeViewReport> = new Map();

  // Performance Indexes for instant query lookups
  public companyNameIndex: Map<string, CompanyContact> = new Map();
  public contactIdIndex: Map<string, CompanyContact> = new Map();
  public fileIdIndex: Map<string, FileRecord> = new Map();
  public lastUpdatedIndex: Map<string, string> = new Map(); // id -> timestamp

  constructor() {
    this.seedInitialData();
    this.rebuildIndexes();
  }

  // Rebuild all database indexes for instant lookups
  public rebuildIndexes() {
    this.companyNameIndex.clear();
    this.contactIdIndex.clear();
    this.fileIdIndex.clear();
    this.lastUpdatedIndex.clear();

    // Index Files
    for (const [id, file] of this.files.entries()) {
      this.fileIdIndex.set(id, file);
      if (file.upload_time) {
        this.lastUpdatedIndex.set(id, file.upload_time);
      }
    }

    // Index Contacts
    for (const contact of this.contacts.values()) {
      const entityKey = contact.entity_key || canonicalEntityIdentityKey(contact.company_name, contact.country);
      this.companyNameIndex.set(entityKey, contact);
      this.contactIdIndex.set(contact.id.toLowerCase().trim(), contact);
      this.lastUpdatedIndex.set(contact.id, contact.last_updated);

    }
  }

  public getContactById(id: string): CompanyContact | undefined {
    if (!id) return undefined;
    return this.contactIdIndex.get(id.toLowerCase().trim());
  }

  public getFileById(id: string | number): FileRecord | undefined {
    if (!id) return undefined;
    const strId = String(id).trim();
    const lowerId = strId.toLowerCase();

    // 1. Direct Map lookup
    if (this.files.has(strId)) {
      return this.files.get(strId);
    }

    const filesList = Array.from(this.files.values());

    // 2. Case-insensitive ID or name lookup
    for (const file of filesList) {
      if (file.id.toLowerCase() === lowerId || file.name.toLowerCase() === lowerId) {
        return file;
      }
    }

    // No match — return undefined so callers can return a proper 404.
    // NOTE: Ambiguous substring/prefix matching, numeric-index lookup, and the
    // "first available file" fallback were removed because they silently served
    // the WRONG file (HTTP 200) for unknown/typo'd ids and could resurrect
    // deleted sample files by re-seeding.
    return undefined;
  }

  public seedInitialData() {
    // 1. Initial Sample NVL File
    const sampleNVLRows = [
      {
        BE_LINK: 'IPAE-1112',
        BE_DATE: '20230713',
        HS_CODE: '3004.9099',
        ITEM: 'Icon 100mg Cap Nico Tab 10mg Rifaxa 200mg & 550mg Tab Sitagen 25mg Tab Clarion125mg Susp',
        IMPORTER: 'Emerchemie NB Ceylon Limited',
        EXPORTER: 'FEROZSONS LABORATRIES LIMITED',
        TOT_FC: 184120.86,
        AGENT_NAME: 'KHALID-MUG',
        COUNTRY: 'Sri Lanka',
        QTY: 2541.0,
        UNT: 'KG',
        Date: '2023-07-13',
        Item: 'Icon 100mg Cap Nico Tab 10mg Rifaxa 200mg & 550mg Tab Sitagen 25mg Tab Clarion125mg Susp',
        Country: 'Sri Lanka',
        Importer: 'Emerchemie NB Ceylon Limited',
        Exporter: 'FEROZSONS LABORATRIES LIMITED',
        'Total Value (USD)': 184120.86,
        Agent: 'KHALID-MUG',
      },
      {
        BE_LINK: 'IPAE-1176',
        BE_DATE: '20230714',
        HS_CODE: '3004.9099',
        ITEM: '50-CARTONS MEDICINES ( Calcibet ointment KETOVAL ACNE CREAM AS PER INVOICE )',
        IMPORTER: 'SLIM PHARMACEUTICALS PVT LTD',
        EXPORTER: 'M/S VALOR PHARMACEUTICALS',
        TOT_FC: 17850.0,
        AGENT_NAME: 'KHALID-MUG',
        COUNTRY: 'Sri Lanka',
        QTY: 10500.0,
        UNT: 'KG',
        Date: '2023-07-14',
        Item: '50-CARTONS MEDICINES ( Calcibet ointment KETOVAL ACNE CREAM AS PER INVOICE )',
        Country: 'Sri Lanka',
        Importer: 'SLIM PHARMACEUTICALS PVT LTD',
        Exporter: 'M/S VALOR PHARMACEUTICALS',
        'Total Value (USD)': 17850.0,
        Agent: 'KHALID-MUG',
      },
      {
        BE_LINK: 'IPAE-1237',
        BE_DATE: '20230714',
        HS_CODE: '3004.9099',
        ITEM: 'Icon Caps,Flosure 0.4mg cap,Rifaxa 550mg Tab,Novapressin(BF) other detail as per invoice.',
        IMPORTER: 'SURGILINKS LIMITED',
        EXPORTER: 'FEROZSONS LABORATRIES LIMITED',
        TOT_FC: 46628.4,
        AGENT_NAME: 'KHALID-MUG',
        COUNTRY: 'Kenya',
        QTY: 488.0,
        UNT: 'KG',
        Date: '2023-07-14',
        Item: 'Icon Caps,Flosure 0.4mg cap,Rifaxa 550mg Tab,Novapressin(BF) other detail as per invoice.',
        Country: 'Kenya',
        Importer: 'SURGILINKS LIMITED',
        Exporter: 'FEROZSONS LABORATRIES LIMITED',
        'Total Value (USD)': 46628.4,
        Agent: 'KHALID-MUG',
      },
      {
        BE_LINK: 'IPAE-2153',
        BE_DATE: '20230720',
        HS_CODE: '3004.9099',
        ITEM: 'Aspralin 25mg tab Baclin 10mg & 20mg tab Derotine XR 12.5mg 25mg tab Rivroxa 10mg Tab.',
        IMPORTER: 'HYPERPHARM LTD',
        EXPORTER: 'GENOME PHARMACEUTICALS (PVT.) LIMITED',
        TOT_FC: 21784.68,
        AGENT_NAME: 'KHALID-MUG',
        COUNTRY: 'Mauritius',
        QTY: 138.0,
        UNT: 'KG',
        Date: '2023-07-20',
        Item: 'Aspralin 25mg tab Baclin 10mg & 20mg tab Derotine XR 12.5mg 25mg tab Rivroxa 10mg Tab.',
        Country: 'Mauritius',
        Importer: 'HYPERPHARM LTD',
        Exporter: 'GENOME PHARMACEUTICALS (PVT.) LIMITED',
        'Total Value (USD)': 21784.68,
        Agent: 'KHALID-MUG',
      },
      {
        BE_LINK: 'IPAE-2960',
        BE_DATE: '20230725',
        HS_CODE: '3003.1000',
        ITEM: '6000 DAPAXIGA 10 MG TABLETS MFG 05.07.23 EXP 04.07.26 BATCH NO M6048',
        IMPORTER: 'ZILLION INTERNATIONAL TRADING PTE LTD',
        EXPORTER: 'M/S WELMARK PHARMACEUTIALS',
        TOT_FC: 12000.0,
        AGENT_NAME: 'KHALID-MUG',
        COUNTRY: 'Thailand',
        QTY: 6000.0,
        UNT: 'KG',
        Date: '2023-07-25',
        Item: '6000 DAPAXIGA 10 MG TABLETS MFG 05.07.23 EXP 04.07.26 BATCH NO M6048',
        Country: 'Thailand',
        Importer: 'ZILLION INTERNATIONAL TRADING PTE LTD',
        Exporter: 'M/S WELMARK PHARMACEUTIALS',
        'Total Value (USD)': 12000.0,
        Agent: 'KHALID-MUG',
      },
    ];

    const nvlCols = Object.keys(sampleNVLRows[0]);
    const nvlSummary = computeSummary(nvlCols, sampleNVLRows);

    const nvlFile: FileRecord = {
      id: 'file-sample-nvl-1',
      name: 'pharma_imports_2026.nvl',
      file_type: 'NVL',
      size: 4210,
      upload_time: new Date('2026-07-28T02:15:00Z').toISOString(),
      columns: nvlCols,
      rows: sampleNVLRows,
      summary: nvlSummary,
      raw_text: sampleNVLRows
        .map((r) => Object.entries(r).map(([k, v]) => `${k} = "${v}"`).join('\n'))
        .join('\n\n---\n\n'),
    };
    this.files.set(nvlFile.id, nvlFile);

    // 2. Initial Sample DBF File
    const sampleDBFRows = [
      {
        REC_ID: '1001',
        SUPPLIER_NAME: 'Bayer AG Leverkusen',
        BUYER_NAME: 'CVS Caremark Wholesale',
        CAT_NUMBER: 'BAY-9081',
        VAL_USD: 512000.0,
        SHIP_DATE: '2026-05-10',
        STATUS: 'CLEARED',
      },
      {
        REC_ID: '1002',
        SUPPLIER_NAME: 'AstraZeneca UK',
        BUYER_NAME: 'Walgreens Boots Alliance',
        CAT_NUMBER: 'AZ-3342',
        VAL_USD: 780000.0,
        SHIP_DATE: '2026-05-14',
        STATUS: 'IN_TRANSIT',
      },
      {
        REC_ID: '1003',
        SUPPLIER_NAME: 'Novartis Pharma AG',
        BUYER_NAME: 'CVS Caremark Wholesale',
        CAT_NUMBER: 'NOV-1120',
        VAL_USD: 340000.0,
        SHIP_DATE: '2026-05-20',
        STATUS: 'CLEARED',
      },
      {
        REC_ID: '1004',
        SUPPLIER_NAME: 'Roche Diagnostics',
        BUYER_NAME: 'AmerisourceBergen',
        CAT_NUMBER: 'ROC-7781',
        VAL_USD: 915000.0,
        SHIP_DATE: '2026-05-28',
        STATUS: 'IN_TRANSIT',
      },
    ];
    const dbfCols = Object.keys(sampleDBFRows[0]);
    const dbfFile: FileRecord = {
      id: 'file-sample-dbf-1',
      name: 'shipments_q2.dbf',
      file_type: 'DBF',
      size: 8912,
      upload_time: new Date('2026-07-28T02:30:00Z').toISOString(),
      columns: dbfCols,
      rows: sampleDBFRows,
      summary: computeSummary(dbfCols, sampleDBFRows),
    };
    this.files.set(dbfFile.id, dbfFile);

    // 3. Initial Sample Excel File
    const sampleXlsxRows = [
      {
        Supplier_Name: 'AstraZeneca UK',
        Customer_Name: 'Cardinal Health Inc',
        Drug_Class: 'Oncology Biologicals',
        Batch_Number: 'BN-882190',
        Invoice_Value: 1250000.0,
        Country_Origin: 'United Kingdom',
        Target_Market: 'United States',
      },
      {
        Supplier_Name: 'Merck Sharp & Dohme',
        Customer_Name: 'McKesson Corporation',
        Drug_Class: 'Immuno-Oncology Pembrolizumab',
        Batch_Number: 'MSD-44109',
        Invoice_Value: 1890000.0,
        Country_Origin: 'Germany',
        Target_Market: 'United States',
      },
      {
        Supplier_Name: 'Eli Lilly & Company',
        Customer_Name: 'Cardinal Health Inc',
        Drug_Class: 'Glucagon-like Peptide 1 (Tirzepatide)',
        Batch_Number: 'LLY-99211',
        Invoice_Value: 2450000.0,
        Country_Origin: 'United States',
        Target_Market: 'European Union',
      },
    ];
    const xlsxCols = Object.keys(sampleXlsxRows[0]);
    const xlsxFile: FileRecord = {
      id: 'file-sample-xlsx-1',
      name: 'suppliers_master.xlsx',
      file_type: 'Excel',
      size: 15420,
      upload_time: new Date('2026-07-28T02:45:00Z').toISOString(),
      columns: xlsxCols,
      rows: sampleXlsxRows,
      summary: computeSummary(xlsxCols, sampleXlsxRows),
    };
    this.files.set(xlsxFile.id, xlsxFile);

    // 4. Initial Sample CSV File
    const sampleCsvRows = [
      {
        Shipper: 'Dr. Reddy Labs',
        Consignee: 'PrimeRx Supply Chain',
        HS_Code: '3004.90',
        Total_Amount_USD: 185000.0,
        Port_Origin: 'Chennai, India',
        Port_Destination: 'Newark, USA',
      },
      {
        Shipper: 'Cipla Quality Chemical',
        Consignee: 'PrimeRx Supply Chain',
        HS_Code: '3004.20',
        Total_Amount_USD: 310000.0,
        Port_Origin: 'Kampala, Uganda',
        Port_Destination: 'London, UK',
      },
    ];
    const csvCols = Object.keys(sampleCsvRows[0]);
    const csvFile: FileRecord = {
      id: 'file-sample-csv-1',
      name: 'trade_manifest.csv',
      file_type: 'CSV',
      size: 2048,
      upload_time: new Date('2026-07-28T03:00:00Z').toISOString(),
      columns: csvCols,
      rows: sampleCsvRows,
      summary: computeSummary(csvCols, sampleCsvRows),
      raw_text: `Shipper,Consignee,HS_Code,Total_Amount_USD,Port_Origin,Port_Destination\nDr. Reddy Labs,PrimeRx Supply Chain,3004.90,185000.0,Chennai, India,Newark, USA\nCipla Quality Chemical,PrimeRx Supply Chain,3004.20,310000.0,Kampala, Uganda,London, UK`,
    };
    this.files.set(csvFile.id, csvFile);

    // 5. Initial Sample DOCX File
    const docxFile: FileRecord = {
      id: 'file-sample-docx-1',
      name: 'compliance_audit_report.docx',
      file_type: 'DOCX',
      size: 24500,
      upload_time: new Date('2026-07-28T03:10:00Z').toISOString(),
      columns: ['Vendor Name', 'Audit Score', 'GMP Certified', 'Risk Rating', 'Annual Cost USD'],
      rows: [
        { 'Vendor Name': 'Novartis Pharma AG', 'Audit Score': '98/100', 'GMP Certified': 'YES', 'Risk Rating': 'LOW', 'Annual Cost USD': 384750 },
        { 'Vendor Name': 'Pfizer Global Supply', 'Audit Score': '95/100', 'GMP Certified': 'YES', 'Risk Rating': 'LOW', 'Annual Cost USD': 392000 },
        { 'Vendor Name': 'Sun Pharma Advanced Research', 'Audit Score': '88/100', 'GMP Certified': 'PENDING', 'Risk Rating': 'MEDIUM', 'Annual Cost USD': 646000 },
      ],
      summary: computeSummary(['Vendor Name', 'Audit Score', 'GMP Certified', 'Risk Rating', 'Annual Cost USD'], [
        { 'Vendor Name': 'Novartis Pharma AG', 'Annual Cost USD': 384750 },
        { 'Vendor Name': 'Pfizer Global Supply', 'Annual Cost USD': 392000 },
        { 'Vendor Name': 'Sun Pharma Advanced Research', 'Annual Cost USD': 646000 },
      ]),
      raw_text: `PHARMA AI COMPLIANCE & AUDIT REPORT 2026\n\nExecutive Summary:\nThis report details the global pharmaceutical manufacturing audit conducted across top tier active pharmaceutical ingredient (API) exporters and importers. All inspected facilities comply with standard EU/FDA Good Manufacturing Practice (GMP) guidelines.\n\nKey Findings:\n- Total verified vendors: 12\n- Average compliance score: 94.2%\n- Critical non-conformances identified: 0\n- High risk supply bottlenecks mitigated: 3`,
      doc_tables: [
        {
          title: 'Table 1: Verified Exporter Compliance Matrix',
          rows: [
            ['Vendor Name', 'Audit Score', 'GMP Certified', 'Risk Rating', 'Annual Cost USD'],
            ['Novartis Pharma AG', '98/100', 'YES', 'LOW', '$384,750'],
            ['Pfizer Global Supply', '95/100', 'YES', 'LOW', '$392,000'],
            ['Sun Pharma Advanced Research', '88/100', 'PENDING', 'MEDIUM', '$646,000'],
          ],
        },
      ],
    };
    this.files.set(docxFile.id, docxFile);

    // Sync all companies into Contacts list
    this.syncCompaniesFromFiles();

  }

  public syncCompaniesFromFiles() {
    const tradeContext = new Map<string, { partners: Map<string, { value: string; count: number }>; products: Map<string, { value: string; count: number }>; fileIds: Set<string> }>();
    const addTradeContext = (company: unknown, country: unknown, partner: unknown, product: unknown, fileId: string) => {
      const companyName = String(company || '').trim();
      if (!companyName) return;
      const key = canonicalEntityIdentityKey(companyName, country);
      if (!tradeContext.has(key)) tradeContext.set(key, { partners: new Map(), products: new Map(), fileIds: new Set() });
      const ctx = tradeContext.get(key)!;
      ctx.fileIds.add(fileId);
      const addCounted = (map: Map<string, { value: string; count: number }>, raw: unknown) => {
        const value = String(raw || '').trim();
        if (!value || value === 'N/A') return;
        const normalized = value.toLowerCase();
        const existing = map.get(normalized);
        if (existing) existing.count++;
        else map.set(normalized, { value, count: 1 });
      };
      addCounted(ctx.partners, partner);
      addCounted(ctx.products, product);
    };

    for (const file of this.files.values()) {
      const summary = file.summary;
      const exporterCountry = inferExporterCountryFromDataset(file);

      // Importer country is trusted row context and is part of entity identity.
      const importerEntities = new Map<string, { name: string; country: string }>();
      const importerNamesWithRowIdentity = new Set<string>();
      for (const row of file.rows || []) {
        const countryRaw = row.Country || row.COUNTRY || row.DESTINATION_COUNTRY || row.cntry || row.ORIGIN || '';
        const country = String(countryRaw || '').trim();
        if (!country || country.toLowerCase() === 'nan' || country.toLowerCase() === 'null' || country === 'N/A') continue;
        const importer = row.Importer || row.IMPORTER || row.BUYER || row.BUYER_NAME || row.Consignee || '';
        const exporter = row.Exporter || row.EXPORTER || row.SELLER || row.SUPPLIER || row.SUPPLIER_NAME || '';
        const product = row.Item || row.ITEM || row.Product || row.PRODUCT || row.Description || row.DESCRIPTION || '';
        const normalizedCountry = country ? normalizeCountryName(country) : '';
        addTradeContext(importer, normalizedCountry, exporter, product, file.id);
        // Destination/importer country is never copied onto the exporter. A
        // country is supplied only when the dataset schema itself proves its
        // origin (for example the Pakistan customs export schema).
        addTradeContext(exporter, exporterCountry, importer, product, file.id);
        if (importer) {
          const k = canonicalEntityIdentityKey(importer, normalizedCountry);
          if (k && !importerEntities.has(k)) importerEntities.set(k, { name: String(importer).trim(), country: normalizedCountry });
          importerNamesWithRowIdentity.add(canonicalCompanyIdentityKey(importer));
        }
      }

      // Add Exporters
      for (const exporterName of summary.exporters_list) {
        if (!exporterName || exporterName === 'N/A') continue;
        const key = canonicalEntityIdentityKey(exporterName, exporterCountry);
        if (!this.contacts.has(key)) {
          this.contacts.set(key, {
            id: stableCompanyId(key),
            company_name: exporterName,
            type: 'Exporter',
            ceo: '',
            email: '',
            phone: '',
            whatsapp: '',
            linkedin: '',
            country: exporterCountry,
            entity_key: key,
            normalized_company: canonicalCompanyIdentityKey(exporterName),
            normalized_country: canonicalCountryIdentityKey(exporterCountry),
            message_sent: false,
            last_updated: new Date().toISOString(),
            source_file: file.name,
          });
        }
      }

      // Rows preserve every same-name/different-country importer entity. Files
      // without row detail retain a conservative name-only summary fallback.
      for (const importerName of summary.importers_list || []) {
        if (!importerName || importerName === 'N/A') continue;
        const hasRowEntity = importerNamesWithRowIdentity.has(canonicalCompanyIdentityKey(importerName));
        if (!hasRowEntity) {
          const key = canonicalCompanyIdentityKey(importerName);
          importerEntities.set(key, { name: importerName, country: '' });
        }
      }
      for (const [key, entity] of importerEntities) {
        const importerName = entity.name;
        if (this.contacts.has(key)) {
          const existing = this.contacts.get(key)!;
          if (existing.type === 'Exporter') {
            existing.type = 'Both';
          }
          if (!existing.country) {
            existing.country = entity.country;
          }
          existing.entity_key = key;
          existing.normalized_company = canonicalCompanyIdentityKey(importerName);
          existing.normalized_country = canonicalCountryIdentityKey(existing.country);
        } else {
          this.contacts.set(key, {
            id: stableCompanyId(key),
            company_name: importerName,
            type: 'Importer',
            ceo: '',
            email: '',
            phone: '',
            whatsapp: '',
            linkedin: '',
            country: entity.country,
            entity_key: key,
            normalized_company: canonicalCompanyIdentityKey(importerName),
            normalized_country: canonicalCountryIdentityKey(entity.country),
            message_sent: false,
            last_updated: new Date().toISOString(),
            source_file: file.name,
          });
        }
      }
    }

    for (const [key, contact] of this.contacts.entries()) {
      const context = tradeContext.get(key);
      if (!context) continue;
      const ranked = (map: Map<string, { value: string; count: number }>) => Array.from(map.values())
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
        .slice(0, 10)
        .map((item) => item.value);
      contact.traded_with = ranked(context.partners);
      contact.top_products = ranked(context.products);
      contact.trade_feature_recurrence = Object.fromEntries(
        [...context.partners.entries(), ...context.products.entries()].map(([normalized, item]) => [normalized, item.count])
      );
      contact.source_file_ids = Array.from(context.fileIds);
    }
    this.rebuildIndexes();
  }

  // Remove contacts that are no longer derived from any current file.
  // syncCompaniesFromFiles() is additive-only, so deleting a file would
  // otherwise leave its companies in the contacts map until restart, making
  // runtime state diverge from post-restart state across /api/companies,
  // /api/summary, /api/runtime/state and exports.
  public pruneOrphanedContacts(): number {
    const validKeys = new Set<string>();
    for (const file of this.files.values()) {
      const summary = file.summary;
      for (const name of summary?.exporters_list || []) {
        if (name && name !== 'N/A') validKeys.add(canonicalEntityIdentityKey(name, inferExporterCountryFromDataset(file)));
      }
      const rowImporterNames = new Set<string>();
      for (const row of file.rows || []) {
        const importer = row.Importer || row.IMPORTER || row.BUYER || row.BUYER_NAME || row.Consignee || '';
        if (!importer || importer === 'N/A') continue;
        const country = row.Country || row.COUNTRY || row.DESTINATION_COUNTRY || row.cntry || row.ORIGIN || '';
        validKeys.add(canonicalEntityIdentityKey(importer, country));
        rowImporterNames.add(canonicalCompanyIdentityKey(importer));
      }
      for (const name of summary?.importers_list || []) {
        if (name && name !== 'N/A' && !rowImporterNames.has(canonicalCompanyIdentityKey(name))) {
          validKeys.add(canonicalCompanyIdentityKey(name));
        }
      }
    }

    let removed = 0;
    for (const key of Array.from(this.contacts.keys())) {
      if (!validKeys.has(key)) {
        this.contacts.delete(key);
        removed++;
      }
    }
    if (removed > 0) this.rebuildIndexes();
    return removed;
  }

}

export const db = new PharmaDatabase();
