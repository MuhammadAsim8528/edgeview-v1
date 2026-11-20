import fs from 'node:fs';

export function provisionPilotMonitoring(bootstrap, env) {
  if (env.EDGEVIEW_PACKAGE_MONITORING === undefined || env.EDGEVIEW_PACKAGE_MONITORING === '0') return false;
  const dsn = env.EDGEVIEW_SENTRY_DSN || '';
  const key = env.EDGEVIEW_POSTHOG_KEY || '';
  if (env.EDGEVIEW_PACKAGE_MONITORING !== '1'
      || !/^https:\/\/[a-f0-9]{32}@o[0-9]+\.ingest(?:\.(?:us|de))?\.sentry\.io\/4512304043065344$/i.test(dsn)
      || !/^phc_[a-zA-Z0-9]{16,128}$/.test(key)
      || (env.EDGEVIEW_POSTHOG_HOST && env.EDGEVIEW_POSTHOG_HOST !== 'https://us.i.posthog.com')
      || /\s/.test(dsn + key)) throw new Error('MSIX_PUBLIC_MONITORING_CONFIGURATION_INVALID');
  const defaults = { EDGEVIEW_MONITORING_ENABLED: '1', EDGEVIEW_SENTRY_DSN: dsn, EDGEVIEW_POSTHOG_KEY: key, EDGEVIEW_POSTHOG_HOST: 'https://us.i.posthog.com' };
  const existing = fs.readFileSync(bootstrap, 'utf8');
  const prefix = Object.entries(defaults).map(([name, value]) => 'process.env.' + name + ' ??= ' + JSON.stringify(value) + ';').join('\n');
  fs.writeFileSync(bootstrap, "'use strict';\n" + prefix + '\n' + existing);
  return true;
}
