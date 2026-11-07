import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { FatalKind } from './fatal_errors';
import type { MonitoringIdentity } from './monitoring';
import { projectMonitoringEvent } from '../shared/monitoring_privacy';

/** Fixed reporter path and stdin projection. No shell, customer configuration,
 * PostHog key, exception, log, request, dataset or database is handed to it.
 * Synchronous wait prevents application callbacks resuming after a fatal error.
 */
export function reportFatalIsolated(root: string, identity: MonitoringIdentity, kind: FatalKind): boolean {
  const safe = projectMonitoringEvent('runtime_error', {}, identity);
  if (!safe || !['uncaught exception', 'unhandled rejection'].includes(kind)) return false;
  const reporter = path.join(root, 'dist', 'fatal-reporter.cjs');
  try {
    const stat = fs.lstatSync(reporter);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
    env.EDGEVIEW_MONITORING_ENABLED = '1';
    env.EDGEVIEW_SENTRY_DSN = String(process.env.EDGEVIEW_SENTRY_DSN || '');
    const result = spawnSync(process.execPath, [reporter], {
      cwd: root, env, input: JSON.stringify({ identity: {
        version: safe.version, build_id: safe.build_id, channel: safe.channel, installation_id: safe.installation_id,
      }, kind }), stdio: ['pipe', 'ignore', 'ignore'],
      timeout: 6000, windowsHide: true,
    });
    return !result.error && result.status === 0;
  } catch { return false; }
}
