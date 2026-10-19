# Additional hardening work package — 2026-10-19

## Baseline and inherited changes

Source baseline: `fa7fcda`. Inherited latest commit at review start: `99fd233`.
The subsequent inherited commits archive the legacy stack, normalize contacts,
make run writes atomic, bound credential backup retention, add capabilities,
introduce ESLint, propagate storage failures, order worker failures, and add blobs.
Their existence does not by itself prove every attached requirement complete.

## Checks exercised in this review

- `npm run check`: PASS (typecheck, ESLint, all nine listed V1 regression suites).
- `npm run typecheck`, `npm run lint`, `npm run build`: PASS after fatal-handler change.
- `node --import tsx server/tests/fatal_errors.test.ts`: PASS; isolated children exit
  with status 1 after either unknown exception or rejection, before later work.
- `node scripts/build-recovery.test.mjs`: PASS for failed and successful rebuilds.
- `npm run test:release`: PASS against isolated test state.
- `npm run package:windows` and `npm run verify:package`: PASS, 93 manifest files.
- `git diff --check`: PASS; Git reports Windows line-ending conversion notices.
- Live `/api/health`: healthy; active-job endpoint reported no active job.

## Follow-up corrections in this review

- Package shared contracts and docs; exclude the archived Python source tree.
- Watch shared contracts and dependency lockfile when deciding to rebuild.
- Install terminating production fatal handlers after the redacting log setup.
  Unknown failures exit without attempting to export possibly corrupted RAM state.
  Ordinary caught provider failures retain their existing handling.
- Add fatal-handler, rebuild-recovery, and package-integrity checks to CI.
- Make the run-audit utility hydrate versioned blobs through the storage adapter,
  retain compact audit summaries instead of full run payloads, and count unreadable runs.

## Open requirements — goal remains active

- Browser control still denies localhost and explicitly forbids alternate-browser
  circumvention. Full rendered button audit remains unperformed.
- Live restart was rejected by automatic command policy. Newly built fatal-handler
  behavior is tested in isolated children, not deployed/verified in the live process.
- Raw trade warehouse abstraction, streaming query path, candidate evaluation and
  measured 100k/1M synthetic benchmarks remain to be implemented.
- Operational disk-backed database abstraction/migration evaluation remains open.
- Full requirement-by-requirement review of inherited hardening commits remains open,
  including historical-preservation coverage, capability UI recovery, archive proof,
  run quarantine inventory, current dependency audit and real storage savings.
- New blob tests measure a synthetic repetitive fixture; they do not demonstrate
  measured savings for the existing historical evidence corpus.

No claim of release completion or broad production readiness is made.
