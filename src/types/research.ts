export type ResearchObjective =
  | 'IDENTITY_VERIFICATION'
  | 'OFFICIAL_WEBSITE_DISCOVERY'
  | 'CONTACT_PAGE_DISCOVERY'
  | 'ADDRESS_DISCOVERY'
  | 'EMAIL_DISCOVERY'
  | 'PHONE_DISCOVERY'
  | 'LEADERSHIP_DISCOVERY'
  | 'PERSON_VERIFICATION'
  | 'PERSON_CONTACT_DISCOVERY'
  | 'SOCIAL_DISCOVERY'
  | 'TRADE_RELATIONSHIP_RESOLUTION'
  | 'SOURCE_VERIFICATION';

export interface ResearchTarget {
  internalId: string;
  companyName: string;
  normalizedCompanyName: string;
  country: string;
  role: 'Importer' | 'Exporter' | 'Both' | 'Other';
  existingWebsite?: string;
  domain?: string;
  tradeRelationships?: any[];
  datasetReferences?: any[];
}

export interface EvidenceNode {
  id: string;
  type: 'url' | 'fact';
  label: string;
  metadata: {
    url?: string;
    provider?: string;
    method?: string;
    timestamp?: string;
    confidence?: number;
    field?: string;
    value?: any;
    snippet?: string;
    accessibilityStatus?: 'success' | 'blocked' | 'failed';
    reason?: string;
  };
}

export interface EvidenceEdge {
  sourceId: string;
  targetId: string;
  relationship: string; // e.g., "extracted_from", "discovered_by"
}

export interface EvidenceGraph {
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
}

export interface CanonicalContactPerson {
  name: string;
  designation: string;
  department: string;
  directEmails: string[];
  directPhones: string[];
  socials: string[];
  sources: string[];
  confidence: number;
}

export interface CanonicalGeneralContact {
  department: string;
  emails: string[];
  phones: string[];
  sources: string[];
}

export interface CanonicalContactProfile {
  company_name: string;
  role: 'Importer' | 'Exporter' | 'Both' | 'Other';
  country: string;
  website: string;
  domain: string;
  addresses: { address: string; type: string; source_url: string }[];
  generalEmails: string[];
  generalPhones: string[];
  fax: string[];
  socials: { platform: string; url: string }[];
  sources: { url: string; title: string; source_type: string }[];
  decisionMakers: CanonicalContactPerson[];
  generalContacts: CanonicalGeneralContact[];
  qualityScore: number;
  qualityStatus: 'COMPLETE' | 'PARTIAL' | 'NOT_FOUND' | 'FAILED';
  evidence: {
    field: string;
    value: string;
    source_url: string;
    source_type?: string;
    confidence?: number;
    evidence_text?: string;
  }[];
}

export interface ProviderCapability {
  provider: string;
  capabilities: string[];
  supportedTaskTypes: ResearchObjective[];
  strengths: string[];
  weaknesses: string[];
  latencyCharacteristics: 'low' | 'medium' | 'high';
  approximateCostClass: 'free' | 'low' | 'medium' | 'high';
  concurrencyLimits: number;
  cacheSuitability: boolean;
  returnsUrls: boolean;
  returnsSnippets: boolean;
  performsDeepExtraction: boolean;
  performsSemanticDiscovery: boolean;
  canExecuteBrowserLikeExtraction: boolean;
  canDiscoverEmails: boolean;
  canVerifyEmails: boolean;
  canDiscoverPeople: boolean;
  canDiscoverSocialProfiles: boolean;
}

export interface ApifyActorCapability {
  actorId: string;
  name: string;
  taskType: 'dynamic_contact_page' | 'dynamic_leadership_page' | 'company_social_page' | 'company_profile' | 'search_result_extraction' | 'javascript_rendered_page';
  description: string;
  approximateCostClass: 'low' | 'medium' | 'high';
  expectedLatencyMs: number;
}
