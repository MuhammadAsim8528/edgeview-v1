import * as Sentry from '@sentry/node';
import { PostHog } from 'posthog-node';
import { isProductMonitoringEvent, projectMonitoringEvent, type SafeMonitoringEvent } from '../shared/monitoring_privacy';

export type MonitoringIdentity = {
  version: string;
  build_id: string;
  channel: 'stable' | 'beta' | 'canary';
  installation_id: string;
};

type DeliveryState = 'DISABLED' | 'NOT_CONFIGURED' | 'CONFIGURED_UNVERIFIED' | 'TRANSPORT_OK' | 'ERROR';
type VendorStatus = {
  configured: boolean;
  enabled: boolean;
  state: DeliveryState;
  last_attempt_at: string | null;
  last_transport_success_at: string | null;
  dashboard_verified: false;
  error_code: string | null;
};

const monitoringEnabled = process.env.EDGEVIEW_MONITORING_ENABLED === '1';
const sentryDsn = String(process.env.EDGEVIEW_SENTRY_DSN || '').trim();
const posthogKey = String(process.env.EDGEVIEW_POSTHOG_KEY || '').trim();
const posthogHost = String(process.env.EDGEVIEW_POSTHOG_HOST || 'https://us.i.posthog.com').trim();
const allowInsecureLocal = process.env.EDGEVIEW_MONITORING_ALLOW_INSECURE_LOCAL === '1';

let identity: MonitoringIdentity | null = null;
let posthog: PostHog | null = null;
let sentryInitialized = false;
const RESOURCE_FIELDS = ['rss_bytes', 'heap_used_bytes', 'disk_free_bytes', 'uptime_seconds', 'cpu_percent'] as const;
let latestResources: Record<string, number> = {};
let resourceSampleAt: number | null = null;
const isSentryEvent = (event: unknown) => event === 'runtime_error' || event === 'doctor_run';

const state: { sentry: VendorStatus; posthog: VendorStatus } = {
  sentry: vendorInitial(Boolean(sentryDsn)),
  posthog: vendorInitial(Boolean(posthogKey)),
};

function vendorInitial(configured: boolean): VendorStatus {
  return {
    configured,
    enabled: monitoringEnabled && configured,
    state: !monitoringEnabled ? 'DISABLED' : configured ? 'CONFIGURED_UNVERIFIED' : 'NOT_CONFIGURED',
    last_attempt_at: null,
    last_transport_success_at: null,
    dashboard_verified: false,
    error_code: null,
  };
}

function safeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return allowInsecureLocal && url.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  } catch { return false; }
}

function markAttempt(vendor: 'sentry' | 'posthog') {
  state[vendor].last_attempt_at = new Date().toISOString();
}
function markSuccess(vendor: 'sentry' | 'posthog') {
  state[vendor].state = 'TRANSPORT_OK';
  state[vendor].last_transport_success_at = new Date().toISOString();
  state[vendor].error_code = null;
}
function markFailure(vendor: 'sentry' | 'posthog', code: string) {
  state[vendor].state = 'ERROR';
  state[vendor].error_code = code;
}

function sentryEvent(projected: SafeMonitoringEvent) {
  const tags: Record<string, string> = {};
  const extra: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(projected)) {
    if (key === 'message') continue;
    if (typeof value === 'string' && ['event', 'provider', 'stage', 'outcome', 'error_code', 'version', 'build_id', 'channel', 'installation_id'].includes(key)) tags[key] = value;
    else if (typeof value === 'number') extra[key] = value;
  }
  return {
    message: typeof projected.message === 'string' ? projected.message : String(projected.event),
    level: projected.event === 'runtime_error' ? 'error' as const : 'info' as const,
    tags,
    extra,
    release: `edgeview@${projected.version}+${projected.build_id}`,
    environment: String(projected.channel),
  };
}

export function initMonitoring(nextIdentity: MonitoringIdentity): void {
  identity = nextIdentity;
  latestResources = {}; resourceSampleAt = null;
  if (!monitoringEnabled) return;
  const safeIdentity = projectMonitoringEvent('doctor_run', {}, nextIdentity);
  if (!safeIdentity) {
    identity = null;
    markFailure('sentry', 'INVALID_IDENTITY'); markFailure('posthog', 'INVALID_IDENTITY');
    return;
  }
  if (sentryDsn) {
    if (!safeUrl(sentryDsn)) markFailure('sentry', 'INVALID_DSN');
    else {
      try {
        Sentry.init({
          dsn: sentryDsn,
          release: `edgeview@${safeIdentity.version}+${safeIdentity.build_id}`,
          environment: String(safeIdentity.channel),
          defaultIntegrations: false,
          integrations: [],
          // SDK v11 removed sendDefaultPii and broadened defaults. Restrict
          // collection explicitly; the final allowlist projection remains.
          dataCollection: {
            userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
            genAI: { inputs: false, outputs: false }, mcp: { inputs: false, outputs: false },
            graphQL: { document: false, variables: false }, databaseQueryData: false,
            queues: false, stackFrameVariables: false, frameContextLines: 0,
          },
          tracesSampleRate: 0,
          transport(options) {
            const transport = Sentry.makeNodeTransport(options);
            return {
              flush: timeout => transport.flush(timeout),
              async send(envelope) {
                try {
                  const response = await transport.send(envelope);
                  if (typeof response.statusCode === 'number' && response.statusCode >= 200 && response.statusCode < 300) markSuccess('sentry');
                  else markFailure('sentry', 'TRANSPORT_REJECTED');
                  return response;
                } catch (error) { markFailure('sentry', 'TRANSPORT_FAILED'); throw error; }
              },
            };
          },
          beforeSend(event) {
            const safe = projectMonitoringEvent(String(event.tags?.event ?? ''), { ...event.tags, ...event.extra }, nextIdentity);
            if (!safe || !isSentryEvent(safe.event)) return null;
            const rebuilt = sentryEvent(safe);
            event.message = rebuilt.message;
            event.tags = rebuilt.tags;
            event.extra = rebuilt.extra;
            event.level = rebuilt.level;
            event.release = rebuilt.release;
            event.environment = rebuilt.environment;
            // Preserve the SDK's concrete ErrorEvent shape for compatibility, but
            // remove every field outside EdgeView's strict projected envelope.
            // captureMonitoringEvent only supplies message/tags/numeric extra, yet
            // this second boundary prevents SDK-added request/user/context data
            // from escaping if defaults change in a future SDK release.
            for (const key of Object.keys(event)) {
              if (!['event_id','timestamp','message','level','tags','extra','platform','release','environment'].includes(key)) {
                delete (event as unknown as Record<string, unknown>)[key];
              }
            }
            event.platform = 'node';
            return event;
          },
        });
        sentryInitialized = true;
      } catch { markFailure('sentry', 'INIT_FAILED'); }
    }
  }
  if (posthogKey) {
    if (!safeUrl(posthogHost)) markFailure('posthog', 'INVALID_HOST');
    else {
      try {
        posthog = new PostHog(posthogKey, {
          host: posthogHost,
          flushAt: 10,
          flushInterval: 5000,
          maxQueueSize: 100,
          requestTimeout: 3000,
          fetchRetryCount: 0,
          privacyMode: true,
          enableExceptionAutocapture: false,
          featureFlagsPollingInterval: null,
          enableLocalEvaluation: false,
        });
      } catch { markFailure('posthog', 'INIT_FAILED'); }
    }
  }
}

export function classifyMonitoringError(error: unknown): string {
  const message = String((error as any)?.message ?? error ?? '').toLowerCase();
  const code = String((error as any)?.code ?? '').toLowerCase();
  if (code === 'enospc' || /no space left|disk.{0,12}full|storage.{0,12}full/.test(message)) return 'DISK_FULL';
  if (/\b(?:401|403)\b|unauthor|forbidden|credential|api[ _-]?key|auth(?:entication)?/.test(message)) return 'PROVIDER_AUTH_FAILED';
  if (/\b429\b|rate[ _-]?limit|quota/.test(message)) return 'PROVIDER_RATE_LIMITED';
  if (/timeout|timed out|aborted?/.test(message)) return 'PROVIDER_TIMEOUT';
  if (/schema|invalid.{0,20}response|malformed|json.{0,12}(?:parse|invalid)/.test(message)) return 'PROVIDER_SCHEMA_INVALID';
  if (/sqlite|database/.test(message)) return 'DATABASE_UNAVAILABLE';
  if (/persist|write.{0,12}fail/.test(message)) return 'PERSISTENCE_WRITE_FAILED';
  if (/fetch failed|econn|enotfound|socket|network|dns|unavailable/.test(message)) return 'PROVIDER_UNAVAILABLE';
  return 'UNEXPECTED_ERROR';
}

export function getMonitoringStatus() {
  return {
    enabled: monitoringEnabled,
    sentry: { ...state.sentry },
    posthog: { ...state.posthog },
    privacy_boundary: 'strict_allowlist_projection',
    replay: 'OFF',
  };
}

export async function captureMonitoringEvent(name: string, properties: unknown = {}, flush = false) {
  if (!identity) return { projected: false, sentry: false, posthog: false };
  let projected = projectMonitoringEvent(name, properties, identity);
  if (!projected) return { projected: false, sentry: false, posthog: false };
  if (projected.event === 'resource_sample') {
    latestResources = {};
    for (const field of RESOURCE_FIELDS) if (typeof projected[field] === 'number') latestResources[field] = projected[field];
    resourceSampleAt = performance.now();
  }
  if (projected.event === 'runtime_error' && resourceSampleAt !== null) {
    const age = Math.max(0, performance.now() - resourceSampleAt);
    if (age <= 360_000) projected = Object.freeze({ ...latestResources, ...projected, resource_sample_age_ms: age });
  }
  let sentrySent = false;
  let posthogSent = false;

  if (monitoringEnabled && sentryInitialized && isSentryEvent(projected.event)) {
    markAttempt('sentry');
    state.sentry.state = 'CONFIGURED_UNVERIFIED';
    try {
      Sentry.captureEvent(sentryEvent(projected));
      if (flush) {
        const ok = await Sentry.flush(5000);
        if (!ok || getMonitoringStatus().sentry.state !== 'TRANSPORT_OK') throw new Error('delivery not confirmed');
      }
      sentrySent = true;
    } catch { markFailure('sentry', 'TRANSPORT_FAILED'); }
  }

  if (monitoringEnabled && posthog && isProductMonitoringEvent(projected.event)) {
    markAttempt('posthog');
    try {
      posthog.capture({
        distinctId: String(projected.installation_id),
        event: String(projected.event),
        properties: { ...projected, $geoip_disable: true },
      });
      if (flush) {
        await posthog.flush();
        markSuccess('posthog');
      }
      posthogSent = true;
    } catch { markFailure('posthog', 'TRANSPORT_FAILED'); }
  }

  return { projected: true, sentry: sentrySent, posthog: posthogSent };
}

export async function shutdownMonitoring(): Promise<void> {
  try { if (sentryInitialized) await Sentry.flush(2000); } catch {}
  try { if (posthog) await posthog.flush(); } catch {}
}
