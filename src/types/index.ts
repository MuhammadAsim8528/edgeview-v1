export interface FileSummary {
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

export interface ParsedFile {
  id: string;
  name: string;
  file_type: 'NVL' | 'DBF' | 'CSV' | 'Excel' | 'DOCX' | 'Unknown';
  size: number;
  upload_time: string;
  columns: string[];
  rows: Record<string, any>[];
  summary: FileSummary;
  raw_text?: string;
  doc_tables?: Array<{ title?: string; rows: string[][] }>;
}

export interface SocialAccount {
  platform: string; // 'linkedin' | 'twitter' | 'x' | 'facebook' | 'instagram' | 'youtube' | 'tiktok' | 'telegram' | 'threads' | string
  url: string;
  handle?: string;
  display_name?: string;
  verified?: boolean;
  source_url?: string;
}

export interface WhatsAppContact {
  value: string;
  status: 'verified' | 'not_verified' | 'unknown';
  source_url?: string;
}

export interface PersonContact {
  value: string;
  type?: string;
  verified?: boolean;
  source_url?: string;
}

export interface DecisionMaker {
  id?: string;
  name: string;
  designation?: string;
  department?: string;
  emails?: PersonContact[];
  phones?: PersonContact[];
  whatsapp?: WhatsAppContact;
  socials?: SocialAccount[];
  address?: { full: string; type?: string; source_url?: string };
  sources?: ContactSource[];
}

export interface GeneralCompanyContact {
  email?: string;
  phone?: string;
  type?: string;
  source_url?: string;
}

export interface ContactPerson {
  name: string;
  designation?: string;
  email?: string;
  phone?: string;
  department?: string;
  country?: string;
  branch?: string;
  linkedin_url?: string;
  source_url?: string;
}

export interface CompanyAddress {
  address: string;
  type?: string;
  source_url?: string;
}

export interface ContactSource {
  url: string;
  title?: string;
  source_type?: string;
}

export type CompanyQualityStatus = 'COMPLETE' | 'PARTIAL' | 'NOT_FOUND' | 'FAILED' | 'PENDING' | 'ENRICHING';

export interface SourceEvidence {
  field: string;
  value: string;
  source_url: string;
  source_type?: string;
  confidence?: number;
  evidence_text?: string;
}

export interface IntelligenceClaim {
  id: string;
  entity_key: string;
  subject_type: 'company' | 'person';
  predicate: string;
  value: string;
  evidence_refs: string[];
  source_refs: string[];
  source_authority: 'official' | 'third-party';
  retrieved_at: string;
  status: 'supported' | 'disputed' | 'rejected' | 'superseded';
  contradicts: string[];
}

export interface IntelligenceContradiction {
  id: string;
  predicate: string;
  claim_ids: string[];
  status: 'unresolved' | 'resolved' | 'superseded';
}

export interface ResearchAssessment {
  coverage: 'LOW' | 'MEDIUM' | 'HIGH';
  evidence_strength: 'WEAK' | 'MODERATE' | 'STRONG';
  provenance: 'PARTIAL' | 'TRACEABLE' | 'COMPLETE';
  unresolved_contradictions: number;
  basis: string;
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
  website?: string;
  address?: string;
  industry?: string;
  country?: string;
  fax_numbers?: string[];
  emails_list?: string[];
  phones_list?: string[];
  linkedin_urls?: string[];
  addresses?: CompanyAddress[];
  contact_persons?: ContactPerson[];
  decision_makers?: DecisionMaker[];
  socials?: SocialAccount[];
  whatsapp_details?: WhatsAppContact;
  company_contacts?: GeneralCompanyContact[];
  sources?: ContactSource[];
  traded_with?: string[];
  top_products?: string[];
  isPartial?: boolean;
  quality_status?: CompanyQualityStatus;
  edgeview_v1_run_id?: string;
  evidence?: SourceEvidence[];
  research_trace?: any[];
  objectives?: Record<string, any>;
  claims?: IntelligenceClaim[];
  contradictions?: IntelligenceContradiction[];
  research_assessment?: ResearchAssessment;
  enrichment_metadata?: {
    provider?: string;
    model?: string;
    queries?: string[];
    pages_found?: number;
    pages_scraped?: number;
    completed_at?: string;
  };
  sync_status?: 'synced' | 'saving' | 'unsaved' | 'failed';
  last_sync_time?: string;
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  subsystem: 'STARTUP' | 'DATABASE' | 'CONFIG' | 'API' | 'EXPORT' | 'SECURITY';
  message: string;
  details?: string;
}

export interface EnrichmentLogEntry {
  id: string;
  timestamp: string;
  company_name: string;
  step: 'QUERY_GEN' | 'SERPER_SEARCH' | 'AI_RANKING' | 'SCRAPE' | 'AI_EXTRACT' | 'CACHE_WRITE';
  status: 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO';
  message: string;
  details?: string;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  event_type: 'FILE_IMPORT' | 'DB_WRITE' | 'CACHE_HIT' | 'CACHE_MISS' | 'UI_SYNC';
  record_count?: number;
  target: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  message: string;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  company_name?: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'error';
}

export interface SystemProviderHealth {
  configured: boolean;
  reachable: boolean;
  status: 'healthy' | 'not_configured' | 'auth_failed' | 'rate_limited' | 'unreachable' | 'error';
  message?: string;
}

export interface SystemHealthResponse {
  nvidia_nim: SystemProviderHealth;
  groq: SystemProviderHealth;
  search: SystemProviderHealth;
  firecrawl: SystemProviderHealth;
  last_tested?: string;
}

export interface UsageStats {
  search_requests: number;
  scraper_requests: number;
  nvidia_calls: number;
  groq_calls: number;
  pages_analyzed: number;
  duration_ms: number;
  cache_hits?: number;
  cache_misses?: number;
}

export interface HermesReport {
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

export type ActiveTab = 'files' | 'summary' | 'country' | 'stats' | 'contacts' | 'research' | 'reports' | 'settings';

export interface GlobalStatsSummary {
  total_records: number;
  total_value: number;
  total_countries: number;
  total_companies: number;
}

export interface StatsCountryItem {
  country: string;
  importers_count: number;
  total_value: number;
  records_count: number;
}

export interface StatsImporterItem {
  importer: string;
  exporters_count: number;
  total_value: number;
  shipments_count: number;
}

export interface ImporterStatsSummary {
  country: string;
  importer: string;
  total_export_value: number;
  total_exporters: number;
  total_shipments: number;
}

export interface ProductRepetitionItem {
  product: string;
  quantity: number;
  unit: string;
  shipments: number;
  total_value: number;
  percentage: number;
}

export interface ExporterDistributionItem {
  exporter: string;
  products_count: number;
  shipments: number;
  total_value: number;
  percentage: number;
}

export interface ShipmentDetailItem {
  date: string;
  invoice_no: string;
  product: string;
  quantity: number;
  unit: string;
  total_value: number;
  exporter: string;
  importer: string;
  country: string;
  hs_code?: string;
  raw_row?: Record<string, any>;
}

export interface HistoryFileItem {
  id: string;
  file_name: string;
  uploaded_at: string;
  row_count: number;
  total_value: number;
  unique_countries: number;
  unique_importers: number;
  source: 'real' | 'test';
  file_type?: string;
  size?: number;
}
