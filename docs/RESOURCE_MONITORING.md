# Runtime resources

The existing `/api/health` response is the single source for the resource sampler,
Settings → Provider health → Runtime resources, and doctor. No separate metrics
database, provider probes, telemetry vendor or subprocess is introduced.

Decision: reuse Node's process.cpuUsage/process.memoryUsage/process.uptime,
os.totalmem/os.freemem, fs.statfsSync and monotonic performance.now. They already
ship with the supported Node runtime. A broad native system-information adapter
is not needed for these measurements. No new third-party package or license is
introduced; native process-tree/handle/thread/I/O adapters remain unevaluated and
their metrics explicitly unsupported. This is not a Task Manager replacement.

Sampling is on demand, cached for one second, retaining only one snapshot and one
CPU baseline. There is no timer/history/queue in the sampler. CPU is elapsed process
user+system time divided by elapsed monotonic time: 100% means one logical core,
so a multicore process can exceed 100%. First sample, reset counters and failed
reads remain unknown. Memory/disk fields are bytes; UI converts to MiB. Disk is
available space on the installation filesystem, not a recursive dataset-size scan.
No browser-memory or GPU claim is made. WARN includes incomplete measurements;
it does not mean the whole application is broken.

The panel loads once and refreshes only on user action. It permits one in-flight
request, aborts on unmount, has an eight-second deadline, validates numerical
fields, and labels retained measurements stale on failure. Error text is fixed;
platform exceptions and environment variables are not serialized. No credentials,
dataset rows, company names, file contents or provider evidence are sampler inputs.

Tests cover initial/delta/multicore/reset CPU, one-second cache reuse, failures,
invalid values, safe JSON and the real current process. The isolated telemetry
runtime test checks the API response and a second CPU sample. Visual rendering
requires separate authorized browser verification; source/build tests do not
establish that result. Native counters, long-run leak tests, build identity,
diagnostics export and external monitoring remain separate completion gates.

## Runtime summary polling (2026-10-21 local continuation)

The separate runtime-state endpoint formerly opened ten complete immutable runs
on each uncached poll, then traversed provider payloads just for counts/logs.
It now uses the existing persisted completed-call aggregates for the four active
providers and the existing redacted runtime log reader (50 entries, bounded 1MiB
tail read). No new counter store, timer or provider request is introduced.
usageScope identifies persisted_completed_provider_calls; this is local recorded
history, not remaining provider credits, an account-wide meter or the last ten
runs. The UI names that scope, or explicitly says scope unavailable for older
backends. Unknown direct-page/cache metrics stay null; unloaded usage is Unknown.

Runtime-state logsSource is bounded_runtime_log_tail, not research timeline.
Per-run timeline and complete evidence remain available through the selected-run
API/workspace; those on-demand paths were not replaced. The poll still performs
existing job/contact projections and can scale with dataset size; it is not a
constant-time whole-application guarantee or proof of long-run leak freedom.

The compiled regression creates a discoverable 4MiB run and a test-only read
marker. Runtime polling must return aggregate counts, bounded logs and explicit
unknowns without reading that run in full. Client recovery and static React
markup tests cover unknown fields/labels; they are not interactive visual QA.
No before/after production memory or browser-lag improvement is claimed without
measurements on the deployed build and representative user workflow.
