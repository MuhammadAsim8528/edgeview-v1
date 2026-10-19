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
- A raw-trade interface, disk-backed SQLite candidate, bounded streaming query/
  ingestion path and measured 100k/1M synthetic runs now exist; see
  `STORAGE_FOUNDATION.md`. Final engine comparison, worker/UI integration,
  analytical aggregation/partition paths and migration remain open.
- Operational disk-backed database abstraction/migration evaluation remains open.
- Full requirement-by-requirement review of inherited hardening commits remains open,
  including historical-preservation coverage, capability UI recovery, archive proof,
  run quarantine inventory, current dependency audit and real storage savings.
- New blob tests measure a synthetic repetitive fixture; they do not demonstrate
  measured savings for the existing historical evidence corpus.

## Additional verification and fixes

- The archived ZIP and all 148 file hashes were verified; generated esbuild input
  graphs show 36 backend and 29 frontend local inputs, zero retired inputs.
  `scripts/verify-release-graph.mjs` repeats this gate and records the graph.
- A requirement-driven history test first failed after 25 weak refreshes. Removed
  the latest-20 cutoff and project historical runs one at a time. The test now
  preserves six trusted field classes and country isolation.
- Added saved-credential origin binding, model-request timeout/redirect policy,
  bounded SHA-256 keyed model cache, GET discovery limits, and all-route mutation
  limits. Mocked credential tests, SSRF and transport tests passed. See
  `SECURITY_FINDING_FOLLOWUP.md` for report redaction and remaining security scope.
- Full and production-only `npm audit --json` ran successfully as audits (exit 1
  due to findings), each reporting five moderate, zero high/critical findings.
- Rebuilt production and reran the isolated release smoke after these changes:
  PASS. Live restart and rendered browser QA remain blocked as described above.

## Credential and provider cleanup continuation

- Removed save/reset synchronization into `process.env`. Both settings readers
  now honor explicit empty credential values. Tests prove immediate reload,
  startup-environment fallback for absent keys, no saved-key child inheritance,
  and no reset resurrection.
- Redaction now covers runtime files, console sinks and log API, including Groq
  underscore prefixes, Bearer/Basic authorization and cookies. Synthetic-marker
  regression passes; no live credentials were used by these tests.
- Archived source context and the unused Apify adapter in the separate local
  `.archive/edgeview-retired-provider-source-2026-10-19.zip`; hashes and reasons are
  recorded in `RETIRED_PROVIDER_SOURCE.json`. Removed the unpacked adapter and five
  unused provider-test functions. Settings credential fields remain recoverable.
- Dependency verification now checks this supplemental archive, forbids those
  retired exports, and rejects retired-provider transport hosts in both bundles.
  Current closure is 35 backend inputs and 29 frontend inputs.
- Expanded the deferred licensing design with issuer rotation, offline revocation
  limits, clock recovery, minimal device inputs and pre-activation acceptance tests.
- Test-mode settings no longer load a local `.env`; an isolated subprocess fixture
  verifies this boundary without reading the production dotenv file.
- A bounded Git history pattern gate scanned 10 available commits and 303 historical
  paths with zero prohibited state paths and zero known credential/private-key
  pattern file matches. It does not cover unavailable pre-baseline history or
  replace an entropy-based scanner. CI fetches full history before running it.
- Expanded immutable persistence tests with partial-write ENOSPC and promotion
  failure injection. They prove no incomplete final file/index entry is published.
  Duplicate run IDs now raise a conflict without moving the prior immutable file.
- Added read-only evidence maintenance and explicit offline quarantine/index
  rebuild. Tests simulate successful and interrupted quarantine and prove each
  artifact remains recoverable and valid bytes remain unchanged.
- The actual read-only maintenance pass examined all 5,810 final run JSON files,
  totaling 2,402,248,597 bytes, with zero invalid syntax/identity records. It moved
  nothing and did not rebuild the index. Peak audit-process RSS was 407.922 MiB.
  This pass does not verify every blob hash; do not interpret it as full evidence
  or contact correctness verification.
- Current public `/api/settings/test` checks on 2026-10-19: Serper success
  (2,347 ms), NVIDIA success (363 ms), Groq success (718 ms). Hunter was configured
  but disabled and was not called. Timings are local API round trips, not isolated
  upstream timings. NVIDIA/Groq checks validate model-list/auth access, not a fresh
  inference/enrichment run. The live process is still the existing installation;
  these checks do not prove the newly built backend has been deployed.

No claim of release completion or broad production readiness is made.
