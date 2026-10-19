import { getAppSettings } from './settings';
import { ResourceGovernor } from './resource_governor';

export interface ApifyResult {
  url: string;
  markdown?: string;
  text?: string;
  html?: string;
  emails?: string[];
  phones?: string[];
  title?: string;
}

export class ApifyProvider {
  /**
   * Tests the connection to Apify API by fetching information about the user.
   */
  public static async testConnection(token: string): Promise<{ success: boolean; message: string }> {
    if (!token || !token.trim()) {
      return { success: false, message: 'Apify API token is empty' };
    }

    try {
      const res = await fetch(`https://api.apify.com/v2/users/me?token=${token.trim()}`);
      if (res.status === 200) {
        const data = await res.json();
        const username = data.data?.username || 'unknown';
        return { success: true, message: `Apify key connection verified! Connected as: ${username}` };
      } else if (res.status === 401) {
        return { success: false, message: 'Invalid Apify API token (Unauthorized)' };
      } else {
        return { success: false, message: `Apify returned status ${res.status}` };
      }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to connect to Apify API' };
    }
  }

  /**
   * Executes a deep extraction using Apify website crawler or contact scraper actor.
   */
  public static async scrapeUrl(url: string, token: string): Promise<ApifyResult> {
    if (!token || !token.trim()) {
      throw new Error('Apify API token is not configured.');
    }

    // We'll use the 'apify/website-content-crawler' Actor, which is highly suited
    // for extracting deep content, rendering JS, and supporting Playwright browser execution.
    const actorId = 'apify~website-content-crawler';
    const cleanToken = token.trim();

    const input = {
      startUrls: [{ url }],
      maxCrawlPages: 1,
      maxCrawlDepth: 1,
      maxResults: 1,
      crawlerType: 'playwright:firefox', // Requiring browser execution
      saveMarkdown: true,
      saveHtml: false,
    };

    try {
      // 1. Try running the actor synchronously (up to 60s wait) to get dataset items directly.
      const syncUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${cleanToken}&timeout=60`;
      
      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (response.ok) {
        const items = await response.json();
        if (Array.isArray(items) && items.length > 0) {
          const item = items[0];
          return {
            url,
            markdown: item.markdown || '',
            text: item.text || item.description || '',
            emails: item.metadata?.emails || item.contactInfo?.emails || item.emails || [],
            phones: item.metadata?.phones || item.contactInfo?.phones || item.phones || [],
            title: item.metadata?.title || item.title || '',
          };
        }
      }

      // 2. Fallback to asynchronous run if synchronous run times out or fails with status 429/etc.
      const runUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${cleanToken}`;
      const runRes = await fetch(runUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!runRes.ok) {
        throw new Error(`Apify Actor initiation failed with status ${runRes.status}`);
      }

      const runData = await runRes.json();
      const runId = runData.data?.id;
      const datasetId = runData.data?.defaultDatasetId;

      if (!runId || !datasetId) {
        throw new Error('Could not retrieve Apify runId or datasetId.');
      }

      // Poll for completion (up to 45 seconds, checking every 3 seconds)
      let completed = false;
      const startTime = Date.now();
      const timeoutMs = 45000;

      while (Date.now() - startTime < timeoutMs) {
        const checkUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${cleanToken}`;
        const checkRes = await fetch(checkUrl);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          const status = checkData.data?.status;
          if (status === 'SUCCEEDED') {
            completed = true;
            break;
          } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
            throw new Error(`Apify Actor run finished with status: ${status}`);
          }
        }
        await new Promise((r) => setTimeout(r, 3000));
      }

      if (!completed) {
        throw new Error('Apify Actor run polling timed out.');
      }

      // Retrieve dataset items
      const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${cleanToken}`;
      const datasetRes = await fetch(datasetUrl);
      if (datasetRes.ok) {
        const items = await datasetRes.json();
        if (Array.isArray(items) && items.length > 0) {
          const item = items[0];
          return {
            url,
            markdown: item.markdown || '',
            text: item.text || item.description || '',
            emails: item.metadata?.emails || item.contactInfo?.emails || item.emails || [],
            phones: item.metadata?.phones || item.contactInfo?.phones || item.phones || [],
            title: item.metadata?.title || item.title || '',
          };
        }
      }

      throw new Error('No items found in Apify dataset.');
    } catch (err: any) {
      console.error(`Apify Scrape Error: ${err.message}`);
      throw err;
    }
  }
}
