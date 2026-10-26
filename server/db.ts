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
    // Empty customer storage is authoritative. Demonstration data is an explicit
    // developer opt-in, never a side effect of a new installation.
    if (process.env.EDGEVIEW_ENABLE_SAMPLE_DATA === '1') this.seedInitialData();
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
    // Explicit demo-only examples: no real trade rows, company names, contacts,
    // financial/compliance claims or developer/customer operational records.
    const columns = ['Date', 'Importer', 'Country', 'Exporter', 'Item', 'TOT_FC'];
    const formats: Array<{ suffix: string; type: FileRecord['file_type']; extension: string }> = [
      { suffix: 'nvl', type: 'NVL', extension: 'nvl' },
      { suffix: 'dbf', type: 'DBF', extension: 'dbf' },
      { suffix: 'xlsx', type: 'Excel', extension: 'xlsx' },
      { suffix: 'csv', type: 'CSV', extension: 'csv' },
      { suffix: 'docx', type: 'DOCX', extension: 'docx' },
    ];
    for (const format of formats) {
      const rows = [{ Date: '2026-01-01', Importer: 'Synthetic Demo Buyer', Country: 'Kenya',
        Exporter: 'Synthetic Demo Supplier', Item: 'Synthetic demonstration product', TOT_FC: 10 }];
      const raw = [columns.join(','), ...rows.map(row => columns.map(column => String(row[column as keyof typeof row])).join(','))].join('\n');
      const file: FileRecord = {
        id: 'file-sample-' + format.suffix + '-1',
        name: 'synthetic-demo.' + format.extension,
        file_type: format.type,
        size: Buffer.byteLength(raw, 'utf8'),
        upload_time: '2026-01-01T00:00:00.000Z',
        columns: [...columns], rows, summary: computeSummary(columns, rows), raw_text: raw,
        ...(format.type === 'DOCX' ? { doc_tables: [{ title: 'Synthetic demonstration table',
          rows: [[...columns], ...rows.map(row => columns.map(column => String(row[column as keyof typeof row])))] }] } : {}),
      };
      this.files.set(file.id, file);
    }
    this.syncCompaniesFromFiles();
    this.rebuildIndexes();
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
