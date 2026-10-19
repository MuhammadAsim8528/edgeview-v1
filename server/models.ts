export interface PlannedQuery {
  query: string;
  target_type: string;
  reason: string;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
}

export interface EvidenceSource {
  url: string;
  title: string;
  content: string;
}

export interface ResearchTarget {
  id: string;
  name: string;
  country: string;
  website: string;
  tradeRole: 'Importer' | 'Exporter' | 'Both' | 'Other';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stage: string;
  initialized: boolean;
  plannedQueries: PlannedQuery[];
  evidenceCorpus: EvidenceSource[];
  seenUrls: string[];
  hasEmail: boolean;
  hasPhone: boolean;
  hasLeadership: boolean;
  extractedDetails?: any;
}

export interface ContactProfile {
  id: string;
  company_name: string;
  website: string;
  address: string;
  phone: string;
  email: string;
  linkedin: string;
  industry: string;
  country?: string;
  fax_numbers?: string[];
  emails_list?: string[];
  phones_list?: string[];
  addresses?: Array<{ address: string; type: string; source_url?: string }>;
  decision_makers?: Array<{
    id: string;
    name: string;
    designation: string;
    emails?: Array<{ value: string; verified?: boolean }>;
    phones?: Array<{ value: string; verified?: boolean }>;
    whatsapp?: { value: string; status: string };
  }>;
  quality_status: 'COMPLETE' | 'PARTIAL' | 'NOT_FOUND' | 'PENDING';
  isPartial: boolean;
  last_updated: string;
  source: string;
}
