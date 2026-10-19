import { useEffect, useState } from 'react';
import type { ResearchCampaign } from '../types/campaign';

export function useResearchCampaign() {
  const [campaign, setCampaign] = useState<ResearchCampaign | null>(null);
  const [campaigns, setCampaigns] = useState<ResearchCampaign[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let disposed = false;
    let source: EventSource | null = null;
    const attach = (id: string) => {
      if (disposed) return;
      source?.close();
      source = new EventSource(`/api/research/campaigns/${encodeURIComponent(id)}/events`);
      source.addEventListener('workspace', (event) => {
        const next = JSON.parse((event as MessageEvent).data) as ResearchCampaign;
        setCampaign(next);
        sessionStorage.setItem('edgeview_campaign_id', next.id);
      });
      source.onopen = () => setConnected(true);
      source.onerror = () => setConnected(false);
    };
    const hydrate = async () => {
      const remembered = sessionStorage.getItem('edgeview_campaign_id');
      const listResponse = await fetch('/api/research/campaigns');
      const listPayload = await listResponse.json();
      if (!disposed) setCampaigns(listPayload.campaigns || []);
      let id = remembered;
      if (!id) {
        const activeResponse = await fetch('/api/research/campaigns/active');
        const activePayload = await activeResponse.json();
        id = activePayload.campaign?.id || listPayload.campaigns?.[0]?.id || null;
      }
      if (id) attach(id);
    };
    void hydrate();
    return () => {
      disposed = true;
      source?.close();
    };
  }, []);

  const selectCampaign = (id: string) => {
    sessionStorage.setItem('edgeview_campaign_id', id);
    window.location.reload();
  };

  return { campaign, campaigns, connected, selectCampaign };
}
