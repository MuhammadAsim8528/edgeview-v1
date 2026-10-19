import { db as appDb } from './db';
import { applyEnrichmentDetailsToContact, selectContactEntity } from './contact_projection';
import { enrichCompanyDetails } from './enrichment';
import { executeParallelDiscoverySearch } from './orchestrator';
import { getAppSettings } from './settings';
import { DualAgentCoordinator } from './dual_agent_coordinator';
import { ResearchWorkspace } from './research_workspace';

const runningCampaigns = new Set<string>();

function terminal(status: string): boolean {
  return status === 'COMPLETED' || status === 'FAILED';
}

export async function runCampaign(campaignId: string): Promise<void> {
  if (runningCampaigns.has(campaignId)) return;
  runningCampaigns.add(campaignId);
  try {
    const workspace = await ResearchWorkspace.get(campaignId);
    if (!workspace || terminal(workspace.status)) return;
    await ResearchWorkspace.setStatus(campaignId, 'RUNNING');
    const settings = getAppSettings();
    const coordination = await DualAgentCoordinator.initializeCampaign(campaignId, settings);
    if (coordination.degraded) await ResearchWorkspace.setStatus(campaignId, 'AI_DEGRADED');

    const refreshed = await ResearchWorkspace.get(campaignId);
    const approvedSearchTasks = (refreshed?.tasks || []).filter((task: any) => task.capability === 'WEB_SEARCH' && task.review_status !== 'REJECTED').slice(0, 2);
    for (const task of approvedSearchTasks) {
      try {
        await ResearchWorkspace.appendEvent(campaignId, 'PROVIDER_STARTED', 'provider', { task_id: task.id, capability: task.capability });
        const search = await executeParallelDiscoverySearch(
          task.query_text,
          task.objective || 'company',
          settings,
          () => {},
          refreshed!.company,
          { providers: task.preferred_providers?.length ? task.preferred_providers : ['serper', 'exa', 'tavily'], maxProviders: Number(task.priority || 0) >= 70 ? 3 : 2 }
        );
        for (const result of search.results) {
          for (const provider of result.discoveredBy) {
            await ResearchWorkspace.addSource(campaignId, { url: result.link, title: result.title, provider });
          }
        }
        await ResearchWorkspace.appendEvent(campaignId, 'PROVIDER_COMPLETED', 'provider', { task_id: task.id, providers: [...new Set(search.attempts.map((attempt) => attempt.provider))], sources_discovered: search.results.length, attempts: search.attempts });
      } catch (error: any) {
        await ResearchWorkspace.appendEvent(campaignId, 'PROVIDER_FAILED', 'provider', { task_id: task.id, error: String(error?.message || error).slice(0, 300) });
      }
    }

    await ResearchWorkspace.appendEvent(campaignId, 'CANONICAL_RESEARCH_STARTED', 'deterministic', {});
    const details = await enrichCompanyDetails(refreshed!.company, refreshed!.force_fetch, refreshed!.context || {});
    for (const source of details.sources || []) {
      if (source?.url) await ResearchWorkspace.addSource(campaignId, { url: source.url, title: source.title, source_type: source.source_type, authority: source.source_type === 'official_website' ? 'official' : 'unknown' });
    }
    for (const claim of details.claims || []) {
      if (claim?.status === 'supported') {
        await ResearchWorkspace.admitCanonicalClaim(campaignId, {
          id: claim.id,
          predicate: claim.predicate,
          value: claim.value,
          source_ids: claim.source_refs || [],
          proposed_by: 'deterministic',
        });
      }
    }
    const contact = selectContactEntity(Array.from(appDb.contacts.values()), {
      company_name: refreshed!.company,
      country: refreshed!.country,
      entity_key: refreshed!.entity_key,
    });
    if (contact) {
      applyEnrichmentDetailsToContact(contact, details);
      contact.last_updated = new Date().toISOString();
    }
    await ResearchWorkspace.setStatus(campaignId, 'COMPLETED', undefined, details);
  } catch (error: any) {
    await ResearchWorkspace.setStatus(campaignId, 'FAILED', String(error?.message || error).slice(0, 500));
  } finally {
    runningCampaigns.delete(campaignId);
  }
}

export function startCampaign(campaignId: string): void {
  void runCampaign(campaignId);
}

export async function recoverCampaigns(): Promise<void> {
  await ResearchWorkspace.recoverInterrupted();
}
