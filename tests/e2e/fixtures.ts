import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { unusedTestPort } from '../../scripts/test-server-port.mjs';

// Artifact delivery is distinct from the 15s control/expectation budget.
// Hosted traces returned valid exports at17–19s. Keep a finite shared wait;
// content/status checks and product timeouts remain independent.
export const EXPORT_ARTIFACT_TIMEOUT_MS = 45_000;

type Runtime = { baseURL: string; restart: () => Promise<void>; identity: () => Promise<any>; outboundAttempts: () => number; historyReadFailure: (enabled: boolean) => void };
export const test = base.extend<{ runtime: Runtime; savedHistoryCount: number; historyFaultInjection: boolean }>({
  savedHistoryCount: [0, { option: true }],
  historyFaultInjection: [false, { option: true }],
  runtime: [async ({ savedHistoryCount, historyFaultInjection }, use) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-browser-e2e-'));
    const port = await unusedTestPort();
    const baseURL = `http://127.0.0.1:${port}`;
    const json = path.join(root, 'rows.json');
    const outboundAudit = path.join(root, 'outbound-attempts.txt');
    const historyFault = path.join(root, 'history-read-failure.flag');
    fs.writeFileSync(json, '[]'); // Existing empty authority suppresses demo reseeding.
    fs.writeFileSync(path.join(root, 'config.json'), '{}');
    if (!Number.isInteger(savedHistoryCount) || savedHistoryCount < 0 || savedHistoryCount > 1100) throw new Error('Synthetic history count out of bounds');
    if (savedHistoryCount) {
      fs.mkdirSync(path.join(root, 'runs'));
      for (let i = 0; i < savedHistoryCount; i++) {
        const id = `run-history-${String(i).padStart(4, '0')}`;
        fs.writeFileSync(path.join(root, 'runs', `${id}.json`), JSON.stringify({
          id, company_name: `Synthetic History Buyer ${i}`, country: i % 2 ? 'Sudan' : 'South Sudan',
          status: 'COMPLETED', started_at: '2026-10-01T00:00:00.000Z', completed_at: '2026-10-01T00:00:01.000Z',
          ...(i === 1004 ? { research_context: { format: 1, pipeline_version: 1, result_schema: 30, objective: 'company-contact-research', profile: 'bulk', provider_fingerprint: '0'.repeat(64) } } : {}),
          queries: [], results: [], raw_records: i === 1004 ? ['serper', 'hunter', 'serper'].map((provider, index) => ({
            id: `${id}-raw-${index}`, run_id: id, kind: 'search', provider, request: {}, response: {},
            requested_at: '2026-10-01T00:00:00.000Z', completed_at: '2026-10-01T00:00:01.000Z', latency_ms: 1,
            sha256: createHash('sha256').update('{}').digest('hex'),
          })) : [], timeline: [], limits: { max_queries: 4, max_results_per_query: 8, max_scrapes: 8, timeout_ms: 120000 },
        }));
      }
    }
    const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
    let child: ChildProcess | undefined;
    let stderr = '';
    const identity = async () => {
      const response = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (!response.ok) throw new Error('Owned E2E health unavailable');
      const data = await response.json();
      expect(data.app.pid).toBe(child?.pid); // Never mutate an unrelated listener after a bind race.
      return data;
    };
    const start = async () => {
      stderr = '';
      child = spawn(process.execPath, ['--require', path.resolve('scripts/test-no-egress.cjs'), path.resolve('dist/server.cjs')], {
        cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'], env: { ...inherited, NODE_ENV: 'test', PORT: String(port),
          EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root, EDGEVIEW_JSON_DB: json,
          EDGEVIEW_SQLITE_DB: path.join(root, 'operational.db'), EDGEVIEW_CONFIG: path.join(root, 'config.json'), EDGEVIEW_V1_DATA_DIR: path.join(root, 'runs'), EDGEVIEW_E2E_EGRESS_AUDIT: outboundAudit, ...(historyFaultInjection ? { EDGEVIEW_E2E_HISTORY_FAULT_FILE: historyFault } : {}) },
      });
      child.stderr?.on('data', bytes => { stderr = (stderr + String(bytes)).slice(-4000); });
      for (const deadline = Date.now() + 45_000; Date.now() < deadline;) {
        if (child.exitCode !== null) throw new Error(`Owned E2E server exited: ${stderr}`);
        try { await identity(); return; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
      }
      throw new Error(`Owned E2E server failed readiness: ${stderr}`);
    };
    const stop = async () => {
      if (child && child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit', { signal: AbortSignal.timeout(15_000) });
        child.kill(); await exited;
      }
    };
    try { await start(); await use({ baseURL, identity, historyReadFailure: enabled => { if (!historyFaultInjection) throw new Error('History fault injection was not enabled for this isolated test'); if (enabled) fs.writeFileSync(historyFault, 'synthetic'); else fs.rmSync(historyFault, { force: true }); }, outboundAttempts: () => fs.existsSync(outboundAudit) ? fs.readFileSync(outboundAudit, 'utf8').trim().split('\n').filter(Boolean).length : 0, restart: async () => { await stop(); await start(); } }); }
    finally { await stop(); fs.rmSync(root, { recursive: true, force: true }); }
  }, { timeout: 120_000 }],
  baseURL: async ({ runtime }, use) => { await use(runtime.baseURL); },
});
export { expect };
