export interface ResearchCampaignTask {
  id: string;
  objective: string;
  capability: string;
  query_text?: string;
  origin_agent: string;
  reviewer_agent?: string;
  review_status: string;
  status: string;
  preferred_providers: string[];
  reason: string;
}

export interface ResearchCampaignEvent {
  id: number;
  version: number;
  event_type: string;
  actor: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ResearchCampaign {
  id: string;
  entity_key: string;
  company: string;
  country: string;
  force_fetch: boolean;
  status: string;
  version: number;
  objective: string;
  budget: Record<string, number>;
  tasks: ResearchCampaignTask[];
  sources: Array<Record<string, any>>;
  claims: Array<Record<string, any>>;
  events: ResearchCampaignEvent[];
  error_message?: string;
  created_at: string;
  updated_at: string;
}
