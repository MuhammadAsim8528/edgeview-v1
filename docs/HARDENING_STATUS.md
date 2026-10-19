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
  At that checkpoint the closure was 35 backend inputs and 29 frontend inputs;
  `ACTIVE_DEPENDENCY_GRAPH.json` records the latest generated closure.
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

## Telemetry/control recovery continuation

- Separated diagnostic latency from completed-call averages; zero sample counts
  now display Unknown instead of invented 0% success or 100% cache efficiency.
- The health panel exposes request/test errors, bounds its extra polling, avoids
  overlapping reads and aborts requests on cleanup. Rendered interaction remains
  unverified while browser authority is denied.
- Shared runtime refresh now validates required nested state, coalesces callers,
  aborts a stalled request after 15 seconds and marks capabilities unavailable on
  failure without clearing loaded data. A later valid response restores them.
  Isolated client tests cover coalescing, offline/malformed data, timeout and recovery.
- Provider snapshots follow request completion time; newer successes clear old
  errors while older finishing jobs cannot overwrite the latest outcome. HTTP 408
  is counted as a timeout. Counters still include all completed calls.
- Mocked API tests prove failed-key suppression, replacement-key recovery without
  restart, disabled precedence, separate timing/average denominators, and newer
  HTTP 503 overriding an older successful check. Diagnostics expire after two
  minutes for status classification.
- Isolated server tests now select an unused port and verify the health PID
  before mutations; a deliberate unrelated-port collision receives zero writes.
- Packaging now refuses added/edited output files and creates the new artifact
  before replacing existing output. Tests prove private fixture data, edits and
  prior ZIP/folder survive refusal or source-copy failure.
- Fixed omitted package build inputs (`server.ts` and the active lint/dev setup)
  and preserved source/directory mtimes. Both the staged folder and the actual
  ZIP extracted into a fresh temporary folder pass the no-change launch check
  without modifying manifest-verified artifacts. This does not claim a full
  first-run dependency install or a browser-driven `.bat` cold start.
- The live backend's runtime payload was read through the new client validator:
  it was accepted and research remained available. This is a data-contract check,
  not rendered browser interaction or deployment of the changed backend.
- Settings requests now reject unsupported fields/retired provider weights and
  non-object payloads, with a regression proving rejected updates do not partially
  save supported values.

Validation for this continuation: typecheck, ESLint, the nine V1 suites,
telemetry presentation/order tests, runtime capability/offline/timeout recovery,
mocked telemetry API and key-recovery flow, unrelated-port refusal, release smoke,
package preservation, package manifest verification, ZIP-extraction launch check,
and dependency/archive verification passed. Browser click coverage and the live
backend restart remain unverified/blocked; the packaged artifact is not proof of
the running process version.

No claim of release completion or broad production readiness is made.

### 2026-10-19: provider-body capture and cold-install verification

- The four active JSON-provider paths now consume bodies through
  `server/provider_response.ts`: 8 MiB maximum and a 20-second body deadline,
  independently of the existing headers timeout. Malformed JSON text is retained
  with a schema failure rather than silently replaced by `{}`. Invalid UTF-8 is
  retained as base64. Oversize/stalled streams produce structured failures;
  their complete bodies are not claimed captured. Unknown valid JSON fields remain.
- Targeted stream tests and an enrichment/storage-round-trip regression cover
  malformed HTTP-200 responses without real external calls. Existing successful
  results and historical raw payloads are not rewritten.
- Removed the unused Google SDK dependency. Windows first-run install omits
  development-only dependencies; local build tools remain runtime dependencies so
  source updates can rebuild locally. No lifecycle scripts were enabled.
- Added an extracted-ZIP cold-install/start/rebuild check to CI. The local attempt
  failed during dependency installation after roughly seven minutes with registry
  ECONNRESET and Windows EPERM. Startup/rebuild stages were NOT reached. The
  extracted test directory was cleaned; the live installation was not modified.
- Browser access was retried after the user's permission update. The origin gate
  still explicitly denied observation and alternate-surface workarounds. No
  browser clicks, visual QA, or full dataset enrichment are claimed for this run.
- A fresh npm vulnerability audit also failed with registry ECONNRESET; previous
  audit results must not be presented as a fresh scan.
- Post-change checks passed: TypeScript, ESLint, all nine V1 suites, the targeted
  provider-body suite (including invalid UTF-8), the added malformed-response
  enrichment regression, production build and isolated release smoke, dependency
  closure/archive validation (37 backend / 30 frontend inputs), 106-file Windows
  manifest verification, and staged/ZIP-extracted unchanged-build launch checks.
  Live `/api/health` remained `ok`; the live backend was not restarted.

### Follow-up: installation recovery and canonical settings ownership

- Launcher now checks an installation completion fingerprint rather than merely
  checking for `node_modules`. npm must succeed and direct dependency versions
  must match the lockfile before a marker is written. The marker includes
  package/lock content and runtime platform/architecture/Node major. Tests cover
  partial failure, failed update, normal reuse, missing package and wrong version.
  This is not a comprehensive post-install tamper/integrity scanner.
- Settings now reuse the existing executable-first validated application root
  used by databases and health. Removed arbitrary-cwd and missing-override fallback
  reads. A fresh production-mode subprocess with a synthetic unrelated cwd config
  and `.env` proves those credentials are ignored and saves go to the correct root.
  Existing config persistence/reset and test dotenv isolation suites also pass.
- Response-body collection now uses one bounded buffer and one timeout race, not
  an unbounded number of tiny buffers/deadline callbacks. Tests include 10,000
  one-byte chunks and invalid configured limits. No live-app memory improvement
  is inferred from this structural bound alone.
- A fresh production dependency audit succeeded after registry connectivity
  recovered: five moderate findings, zero high/critical (mammoth/argparse/sprintf-js
  and exceljs/uuid). Source inspection finds argparse in mammoth's CLI and ExcelJS
  using UUID v4; that narrows known paths but does not erase the advisories or prove
  absence of all exploitability. Suggested older major versions were not installed.
- The retry of the full extracted-ZIP cold test succeeded on Windows / Node
  v24.19.0: install 185,717 ms, isolated release smoke 7,112 ms, production-only
  rebuild 45,410 ms, rebuilt smoke 8,008 ms. The tested ZIP SHA-256 was
  `f7b4be64a1787a3a15318840a9dfa09a9bbe2ea69ff432e0b84912ba2191461c`.
  That snapshot preceded the canonical-settings-root change; the updated source
  was independently rebuilt and passed release smoke and telemetry API tests.
  Subsequent package verification is not a second cold install. Temp install
  cleanup completed and free disk returned to approximately 3.3 GB.
- Read-only load smoke against the existing live port 3901 process: 100 requests,
  concurrency 12, zero failures, p50 392 ms, p95 2,363 ms, max 5,190 ms, RSS
  107.5 -> 125.8 MB. This is not a load test of a restarted/new backend version,
  not a long-duration leak test and not browser-rendering memory measurement.
- Further successful regression checks: configuration root ownership, persistence
  and dotenv isolation; provider settings runtime synchronization; log redaction;
  credential origin binding; completed-call metric ordering; runtime offline and
  recovery; dependency/archive closure and known-pattern history audit (13 commits,
  325 historical paths, zero matches; still not an entropy scan).

### Provider semantic-success and partial-normalization audit

- Required envelopes are now validated after raw capture for Serper, Hunter and
  both AI operation paths. HTTP-200 error objects and unusable response shapes
  retain their complete payload but are not counted as successful empty research.
  Valid empty search/email arrays remain valid negative evidence; unknown fields
  are not stripped. Existing legacy captures are not retroactively relabeled.
- Operation parsing failures now attach to the corresponding captured raw record,
  so timeline failures no longer coexist with an incorrectly successful provider
  metric. An extraction answer must contain a claims array; explicit `[]` remains
  allowed. Unsupported claims remain rejected with evidence retained.
- Query generation now requires at least two actual identity-anchored proposals.
  Valid AI proposals precede deterministic coverage queries. Invalid AI answers
  produce observable failures and the existing deterministic fallback rather than
  falsely claiming successful AI generation.
- Mixed malformed/valid Serper organic or Hunter email arrays now keep usable
  siblings. Malformed entries remain in raw evidence with an explicit schema
  failure and timeline warning, not a silent filter or whole-response loss.
- New active JSON-provider captures retain actual `http_status` separately from
  semantic success/failure. Metrics expose recorded successful statuses; legacy
  missing statuses remain unknown rather than an invented HTTP 200. The existing
  raw-record UI serializes the complete record, including this additive field.
- Synthetic regression coverage includes HTTP-200 error envelopes, invalid AI
  proposals, actual proposal priority, mixed organic/email records, unknown
  metadata retention, malformed evidence persistence and recorded HTTP status.
  The first Hunter fixture failed because its domain did not satisfy existing
  ownership rules; the fixture was corrected to an exact synthetic company/domain
  identity. Production identity validation was not weakened to pass the test.
  No real-provider or full-dataset enrichment is claimed from these fixtures.
- Explicit Serper/Hunter diagnostic checks now validate bounded successful bodies
  instead of declaring health from status 200 alone. NVIDIA/Groq model discovery
  shares bounded model-envelope validation, preserving support for both array and
  `{data: [...]}` catalogs. Invalid/error catalogs are not healthy empty lists.
  New tests cover malformed HTML, error objects, empty keys, unauthorized replies,
  valid empty search/email records and both supported model-list envelopes.

### File/history/export control-path audit

- Stale selected export IDs previously fell back to the whole input dataset.
  Both contact and full-dataset processors now share selection validation; missing
  or mixed IDs are rejected and cannot widen the export. The unified endpoint
  validates datasets, formats, record shape, titles, columns and report type and
  returns 400 for these request errors rather than a server-error download.
- Country and statistics drilldowns now use exact case-insensitive country and
  importer identities, not substrings (Niger/Nigeria; Alpha/Alpha Trading).
  Explicit missing file IDs yield no rows instead of silently selecting all files.
- File data pages reject malformed/negative/zero/oversized limits and negative or
  unsafe offsets; page size is 1–1000. Six existing million-row export fetch calls
  were replaced by a shared sequential page collector. It fails on missing pages,
  changed totals or totals beyond the prior million-row ceiling rather than
  silently returning a partial dataset. It still collects export rows in browser
  memory; this is not a streaming export or a million-row capacity claim. Backend
  filtering/normalization still operates on existing in-memory file rows.
- React best-practices review kept fetching in event paths with no new hooks,
  timers, libraries or concurrent page burst. Dependent pages remain sequential;
  the shared helper removes duplicated fetch logic without a UI redesign.
- Expanded isolated release workflow exercises paging/filtering, exact country
  and importer drilldowns, history save plus durable row count, five unified export
  formats and stale/malformed export rejection. CSV/XLSX/DOCX content excludes an
  unselected synthetic company. PDF header/size and all-format ZIP membership are
  checked; rendered PDF layout and browser download gestures are not verified.
  Synthetic test-mode history remains hidden from the real-history listing by
  design; no real production record was changed to force a passing history check.
- Checks passed after these changes: TypeScript, ESLint, nine V1 suites, bounded
  paging and selection-validation regressions, contact-directory export suite,
  expanded isolated release smoke, telemetry runtime, dependency/archive graph,
  package preservation, 108-file package verification and extracted-ZIP launch.
- Remaining provenance finding: a read-only probe confirmed
  `isTestRecord('file-customer-001', 'latest.xlsx') === true` because it uses broad
  substring matching. That can hide a legitimate filename from history. This
  classification path still needs a narrow forward fix and preservation-focused
  regression; existing records must not be mass-reclassified without evidence.
