/** Vendor-independent outbound boundary. No SDK initialization or network I/O.
 * Consumers must still verify final SDK envelopes: this is not an SDK scrubber.
 * Caller precondition (NOT proved by this pure module): identity comes from
 * verified local build metadata and a protected random installation UUID,
 * never request/company/job/dataset fields. Validation here proves syntax only.
 * Installation provenance must be verified when the real adapter is wired.
 * Numeric measurements likewise require trusted runtime collectors; a number
 * cannot be semantically identified as RAM vs a phone number by its shape.
 * Never populate allowed fields by relabeling provider/business payloads.
 */
const PRODUCT_EVENTS = new Set([
  'app_started', 'app_closed', 'dataset_import_started', 'dataset_import_completed',
  'dataset_import_failed', 'research_started', 'research_completed', 'research_failed',
  'research_cancelled', 'export_started', 'export_completed', 'export_failed',
  'diagnostics_opened', 'doctor_run', 'update_check', 'update_available',
  'update_started', 'update_success', 'update_failed', 'rollback_started', 'rollback_success',
]);
const ERROR_MESSAGES = {
  UNEXPECTED_ERROR: 'Unexpected EdgeView error',
  REACT_RENDER_FAILED: 'EdgeView interface rendering failed',
  PROVIDER_AUTH_FAILED: 'Provider authentication failed',
  PROVIDER_RATE_LIMITED: 'Provider request rate limited',
  PROVIDER_TIMEOUT: 'Provider request timed out',
  PROVIDER_UNAVAILABLE: 'Provider unavailable',
  PROVIDER_SCHEMA_INVALID: 'Provider response invalid',
  DATABASE_UNAVAILABLE: 'Operational database unavailable',
  PERSISTENCE_WRITE_FAILED: 'Local persistence failed',
  DISK_FULL: 'Local storage is full',
  CONFIGURATION_INVALID: 'Configuration invalid',
  UPDATE_FAILED: 'Update failed',
  ROLLBACK_FAILED: 'Recovery failed',
} as const;
const ENUMS: Record<string, readonly string[]> = {
  provider: ['nvidia', 'groq', 'serper', 'hunter', 'direct_http'],
  stage: ['startup', 'shutdown', 'render', 'import', 'run', 'query_generation', 'search', 'resolution', 'scrape', 'storage', 'export', 'diagnostics', 'update', 'rollback'],
  outcome: ['started', 'success', 'failed', 'cancelled', 'skipped'],
};
const NUMBERS: Record<string, number> = {
  duration_ms: 3_600_000, http_status: 599, rss_bytes: 1024 ** 4,
  heap_used_bytes: 1024 ** 4, disk_free_bytes: 1024 ** 5,
  uptime_seconds: 315_576_000, cpu_percent: 25_600,
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION = /^(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})(?:-(?:rc|beta|canary)\.[1-9]\d{0,4})?$/;
type Primitive = string | number;
export type SafeMonitoringEvent = Readonly<Record<string, Primitive>>;

// Read only own data descriptors: getters, prototypes and toJSON must not run.
function own(input: unknown, key: string): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}
function identityFields(identity: unknown): Record<string, Primitive> | null {
  const version = own(identity, 'version');
  const build = own(identity, 'build_id');
  const channel = own(identity, 'channel');
  const installation = own(identity, 'installation_id');
  if (typeof version !== 'string' || !VERSION.test(version)
    || version !== version.trim()
    || typeof build !== 'string' || build.length !== 64 || !/^[a-f0-9]{64}$/.test(build)
    || typeof channel !== 'string' || !['stable', 'beta', 'canary'].includes(channel)
    || typeof installation !== 'string' || installation.length !== 36 || !UUID.test(installation)) return null;
  return { version, build_id: build, channel, installation_id: installation.toLowerCase() };
}

/** Strict projection, not redaction. Never forwards free-form strings, error
 * objects/stacks, URLs, headers, paths, prompts, business rows or unknown keys.
 * Fixed field count, no recursion. Arbitrary code inside Proxy traps cannot
 * be bounded here; this is not a sandbox for malicious JavaScript execution.
 */
export function projectMonitoringEvent(name: unknown, properties: unknown, identity: unknown): SafeMonitoringEvent | null {
  try {
    if (typeof name !== 'string' || (!PRODUCT_EVENTS.has(name) && !['runtime_error', 'operation_timing', 'resource_sample'].includes(name))) return null;
    const metadata = identityFields(identity);
    if (!metadata) return null;
    const output: Record<string, Primitive> = Object.assign(Object.create(null), metadata, { event: name });
    for (const [key, allowed] of Object.entries(ENUMS)) {
      const value = own(properties, key);
      if (typeof value === 'string' && allowed.includes(value)) output[key] = value;
    }
    for (const [key, maximum] of Object.entries(NUMBERS)) {
      const value = own(properties, key);
      if (typeof value === 'number' && Number.isFinite(value) && value >= (key === 'http_status' ? 100 : 0) && value <= maximum
        && (key !== 'http_status' || Number.isInteger(value))) output[key] = value;
    }
    if (name === 'runtime_error') {
      const requested = own(properties, 'error_code');
      const code = typeof requested === 'string' && Object.hasOwn(ERROR_MESSAGES, requested)
        ? requested as keyof typeof ERROR_MESSAGES : 'UNEXPECTED_ERROR';
      output.error_code = code;
      output.message = ERROR_MESSAGES[code];
    }
    return Object.freeze(output);
  } catch {
    // Thrown descriptor/configuration errors fail closed rather than escape.
    return null;
  }
}
