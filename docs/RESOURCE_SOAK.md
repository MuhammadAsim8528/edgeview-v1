# Isolated resource observations

Run from a development checkout with the existing browser dependencies installed:

```
npm run build
npm run typecheck:e2e
npm run test:soak
```

This opt-in Playwright configuration does not run in the normal fast browser
suite. Default workload duration is five minutes, with a 30-second idle baseline
and a 30-second settling period. `EDGEVIEW_SOAK_SECONDS` can select an integer
duration from 300 to 1800 seconds. There is one browser worker, no automatic
retry and a bounded sample array. Workloads are paced at roughly 20 seconds per
cycle, not a request flood.

The existing test fixture starts a private compiled backend with empty temporary
storage, strips provider credentials and blocks outgoing provider requests. The
test uploads 60 synthetic rows through the normal UI, then repeatedly exercises
file pagination, country view, contact search, Settings and logs. It never
attaches to port 3901 or reads current operational data. Only the owned child
process and temporary storage are cleaned up.

The attached `resource-observations.json` records build identity, observed
duration, per-cycle latency, backend RSS/heap/CPU, DOM node count and Chromium's
optional JavaScript heap estimate. Unavailable measurements remain null. The
browser estimate is **not** browser process RSS or total system/browser memory.
No private dataset/contact/evidence bodies are included in this numeric report.
Failure screenshots/traces can contain synthetic test data.

Output is under `.test-cache/soak-artifacts/`. These engineering observations do
not establish a leak-free verdict or hardware support claim. No arbitrary memory
growth threshold converts them into a green release gate. An action failure,
backend identity change, browser exception or console error does fail the tested
workflow; a partial observation report is still attached after such a failure.

Remaining coverage includes larger/real datasets, active provider research,
exports, multi-hour workloads, GC-aware analysis, OS handles/processes, disk I/O,
crash recovery and clean-customer-runtime measurement. No such coverage is
implied by a successful synthetic navigation run.

## Observed run — 2026-10-25 (Asia/Karachi)

[Recorded numeric samples](evidence/resource-soak-20261025.json): 15 workload
cycles, 18 samples, 361.5 seconds including baseline/settling, zero browser page
or console errors. Backend RSS: 104.05 MiB after idle, 107.19 MiB first workload,
105.07 MiB last workload, 104.57 MiB settled. Backend heap used: 36.73 MiB first
workload, 36.81 MiB last, 36.97 MiB settled. Median cycle: 1,745ms; maximum: 3,271ms.
These are whole navigation-cycle times, not individual provider/API latency.

Chromium returned the same coarse 10,000,000-byte heap estimate throughout;
that does not establish browser heap stability. Workload DOM counts were 521
initially and then 510; the blank settling page had three nodes. No memory-leak
absence or customer hardware claim follows from these measurements.

Candidate build ID: 2cd84e2fc477963b59ee0f191e140a3c4908d8156c5078134df073e099af557a.
It was built while the pagination fix was uncommitted; metadata therefore records
parent dd636727dfce2c34d86656be8d0f4bf50faa1791, not the subsequent fix commit
783d360. This is pre-release candidate evidence, not an exact frozen-release
certification. Shared workstation load and browser test instrumentation were
not controlled. Exact-commit build/package checks are separate.

Earlier attempts are not counted as successful soaks: the first used the default
Researched contact filter for unresearched synthetic companies; later attempts
exposed grouping reset and a mount-time search debounce undoing pagination.
Those product defects were fixed in dd63672 and 783d360 with focused regressions.
