import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { unusedTestPort } from '../../scripts/test-server-port.mjs';

type Runtime = { baseURL: string; restart: () => Promise<void>; identity: () => Promise<any> };
export const test = base.extend<{}, { runtime: Runtime }>({
  runtime: [async ({}, use) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-browser-e2e-'));
    const port = await unusedTestPort();
    const baseURL = `http://127.0.0.1:${port}`;
    const json = path.join(root, 'rows.json');
    fs.writeFileSync(json, '[]'); // Existing empty authority suppresses demo reseeding.
    fs.writeFileSync(path.join(root, 'config.json'), '{}');
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
      child = spawn(process.execPath, ['--require', path.resolve('tests/e2e/no-egress.cjs'), path.resolve('dist/server.cjs')], {
        cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'], env: { ...inherited, NODE_ENV: 'test', PORT: String(port),
          EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root, EDGEVIEW_JSON_DB: json,
          EDGEVIEW_SQLITE_DB: path.join(root, 'operational.db'), EDGEVIEW_CONFIG: path.join(root, 'config.json'), EDGEVIEW_V1_DATA_DIR: path.join(root, 'runs') },
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
    try { await start(); await use({ baseURL, identity, restart: async () => { await stop(); await start(); } }); }
    finally { await stop(); fs.rmSync(root, { recursive: true, force: true }); }
  }, { scope: 'worker', timeout: 120_000 }],
  baseURL: async ({ runtime }, use) => { await use(runtime.baseURL); },
});
export { expect };
