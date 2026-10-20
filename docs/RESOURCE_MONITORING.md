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
