import * as Sentry from '@sentry/node';
import { PostHog } from 'posthog-node';
import { projectMonitoringEvent, type SafeMonitoringEvent } from '../shared/monitoring_privacy';

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
  };
}

export function initMonitoring(nextIdentity: MonitoringIdentity): void {
  identity = nextIdentity;
  if (!monitoringEnabled) return;
  if (sentryDsn) {
    if (!safeUrl(sentryDsn)) markFailure('sentry', 'INVALID_DSN');
    else {
      try {
        Sentry.init({
          dsn: sentryDsn,
          release: `edgeview@${nextIdentity.version}`,
          environment: nextIdentity.channel,
          sendDefaultPii: false,
          integrations: [],
          tracesSampleRate: 0,
          beforeSend(event) {
            return {
              event_id: event.event_id,
              timestamp: event.timestamp,
              platform: 'node',
              level: event.level,
              message: event.message,
              release: event.release,
              environment: event.environment,
              tags: event.tags,
              extra: event.extra,
            };
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
          privacyMode: true,
          enableExceptionAutocapture: false,
          featureFlagsPollingInterval: null,
          enableLocalEvaluation: false,
        });
      } catch { markFailure('posthog', 'INIT_FAILED'); }
    }
  }
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
  const projected = projectMonitoringEvent(name, properties, identity);
  if (!projected) return { projected: false, sentry: false, posthog: false };
  let sentrySent = false;
  let posthogSent = false;

  if (monitoringEnabled && sentryInitialized) {
    markAttempt('sentry');
    try {
      Sentry.captureEvent(sentryEvent(projected));
      if (flush) {
        const ok = await Sentry.flush(5000);
        if (!ok) throw new Error('flush timeout');
        markSuccess('sentry');
      }
      sentrySent = true;
    } catch { markFailure('sentry', 'TRANSPORT_FAILED'); }
  }

  if (monitoringEnabled && posthog) {
    markAttempt('posthog');
    try {
      posthog.capture({
        distinctId: String(projected.installation_id),
        event: String(projected.event),
        properties: { ...projected },
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
