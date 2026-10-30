# Isolated repeated-workflow baseline — 2026-10-30

Scope: functional PASS for the recorded baseline. NOT leak-free, current-release,
clean-Windows, browser or large-dataset acceptance.

## Exact execution

- Application source: `9407aae76d5d94913e03b2ccebfb19b68e79116d` (SQLite schema 1).
- Build: `83de27be9b408391b900cf3aceacce21df1885d19df64d8c57f2bb73c1b1e0cb`.
- Runner: `fe7448eba8536859eff4476e1fd4899f69126f3b`.
- Node: `v24.19.0`, existing Windows development laptop.
- Command: `node scripts/separate-data-runtime.test.mjs --soak-cycles 60`.
- Sample period: 2026-10-30 12:24:06.894Z–12:54:25.679Z, 1,818.785 seconds.
- Tool session `92715` terminated with exit 0; all 60 samples present.

The child ran copied compiled artifacts with separate temporary writable state,
an empty provider configuration and monitoring disabled. It used development
dependencies through `NODE_PATH`; it was not a self-contained customer package.
Live port 3901 and customer data were not touched. Other engineering processes
ran on the host during collection; this is not an idle-device measurement.

Each cycle imported 100 synthetic trade rows, read companies, generated an HTML
contact export, listed files and deleted that cycle's file. Total processed:
6,000 rows across 60 small imports, not one large-file test. A 30-second pause
followed each cycle. Responses, deadlines and stored sample counts were bounded.
Health memory was sampled before the active workflow; no forced GC was used.

## Observations

Percentiles use sorted samples at index `floor(N*p)` with N=60.

| Measurement | First | Last | Minimum | Maximum | p50 | p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RSS MiB | 152.1 | 132.8 | 125.6 | 152.1 | 133.3 | 135.7 |
| Heap used MiB | 47.1 | 45.2 | 42.9 | 52.3 | 49.0 | 51.7 |
| Complete active workflow ms | 452.85 | 304.11 | 127.77 | 921.41 | 272.11 | 730.95 |

Workflow timings include the whole request sequence and exclude the pause. They
are not per-request latency or provider timing. These samples do not show
unbounded growth during this interval; they do not prove absence of a leak.
No new pass/fail resource threshold was manufactured from this one run.

After the cycles, actual normal shutdown, UUID/dataset restart persistence,
absence of writable app-root state and the offline backup checks passed. The
conclusion uses terminal exit and those checks, not the report's `COMPLETED`
field alone (that field is written before the post-cycle checks).

## Evidence and limits

Private local outputs, intentionally not committed:

- `.test-cache/soak-60-cycles-20261030.log`.
- `.test-cache/isolated-soak-23d1050d-d2b9-40cc-b731-0d44ed419cf9.json`.
- JSON SHA256: `77a163fa3861998dabb055bd84b5706d8ac589e2e0f47a56a2b3469f3b873c54`.

This baseline predates shipment-history schema 2 and its ownership fix. It uses
unique filenames, so it does not cover the reproduced same-name collision.
Current-build repetition remains required after legacy repair is accepted.
CPU, disk growth, handles, listeners, forced termination, large data, research,
external providers, installed MSIX and visual/accessibility behavior were not
measured by this run. Longer and representative target-device testing remains
open under PERF01/PILOT01 in the authoritative completion ledger.
