// Local support export: explicit fields only. Never serialize health/config/log objects.
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const numeric = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1024 ** 5 ? v : null;
const match = (v: unknown, pattern: RegExp) => typeof v === 'string' && pattern.test(v) ? v : null;
const states = ['DISABLED','NOT_CONFIGURED','CONFIGURED_UNVERIFIED','TRANSPORT_OK','ERROR'];
const choice = (v: unknown, allowed: string[], fallback: string) => typeof v === 'string' && allowed.includes(v) ? v : fallback;
export function supportDiagnostics(input: { build: unknown; installationId: unknown; resources: unknown; database: unknown; monitoring: unknown; node: unknown; platform: unknown }) {
  const build = record(input.build), resources = record(input.resources), database = record(input.database), monitoring = record(input.monitoring);
  const vendor = (key: string) => { const value = record(monitoring[key]); return {
    configured: value.configured === true, enabled: value.enabled === true,
    state: choice(value.state, states, 'UNKNOWN'),
    dashboard_verified: value.dashboard_verified === true,
  }; };
  return {
    format: 'edgeview-support-v1', generated_at: new Date().toISOString(),
    installation_id: match(input.installationId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i),
    build: { available: build.available === true,
      version: match(build.version, /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-(?:rc|beta|canary)\.\d{1,5})?$/),
      build_id: match(build.buildId, /^[a-f0-9]{64}$/), commit: match(build.gitCommit, /^[a-f0-9]{40,64}$/) },
    runtime: { node: match(input.node, /^v\d{1,3}\.\d{1,3}\.\d{1,3}$/), platform: choice(input.platform, ['win32','linux','darwin'], 'unknown') },
    database: { status: choice(database.status, ['unknown','initializing','ok','degraded'], 'unknown'), schema_version: null },
    resources: Object.fromEntries(['cpuPercent','rssBytes','heapUsedBytes','systemTotalBytes','systemFreeBytes','diskAvailableBytes','uptimeSeconds'].map(key => [key,numeric(resources[key])])),
    monitoring: { enabled: monitoring.enabled === true, replay: 'OFF', sentry: vendor('sentry'), posthog: vendor('posthog') },
    excludes: ['credentials','configuration files','datasets','research evidence','raw logs','exception messages','user paths','hardware identifiers'],
    limitations: ['Database schema version is not measured by this export.','Remote dashboard receipt is not inferred from transport status.','This file is downloaded locally; sharing is a separate user action.'],
  };
}
