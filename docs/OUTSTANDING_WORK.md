# EdgeView completion ledger — 2026-10-20

## Continuation directive intake (sections 0–28)

The 096e1b20 and e3289d42 continuation attachments are additive and equivalent
work packages, not proof of a current deployment. Preserve e8a73d5 npm-policy
isolation. New regression covers real offline npm with inherited allow-scripts,
unrelated user/global npmrc, missing config and restart; existing recovery tests
also cover partial installations, stale/corrupt markers and wrong/corrupt package
metadata. No production dependency reinstall is required for these fixtures.

Execution order: finish launcher verification/package; then extend existing
SystemHealthPanel/runtime metrics/doctor through one shared diagnostics authority,
including actual bounded resources and build identity. Sections 5–12 require
source-to-runtime-to-render evidence, safe log export and explicit unsupported
metrics. External monitoring (8–10) requires privacy-reviewed optional adapters,
no default replay or private-data transmission; unconfigured is not successful.
Sections 13–19 remain installation identity, DB restore, failure UX, bundled-runtime
clean-VM distribution, safe updates and measured long-run performance work.
Sections 20–25 add current-HEAD security/CI/license review, real-company truthsets,
normal-UI importer workflow and crash/shutdown recovery. Sections 26–28 preserve
all A–K completion gates below and evidence-backed final reporting.

Supported browser acquisition was genuinely attempted again at user request;
the tool returned a saved-origin permission denial, not an interactive approval
prompt. No alternate browser/port/raw-CDP workaround is permitted. Visual QA is
unperformed pending a supported permission change, not permanently abandoned.

Resource-monitoring increment: Node process/system/filesystem sampler now feeds
the existing health API, doctor and a Settings health panel. Sampling and API
regressions are separate gates; rendered QA and long-run measurements remain
unverified. See docs/RESOURCE_MONITORING.md. The owner closed the backend after
the dependency file-lock blocker; exact locked-toolchain restoration succeeded,
with zero direct-version mismatches. Source checks/build, isolated telemetry API,
release smoke and extracted-package cold install/rebuild passed for ab98219.

Backup increment: failed copies now stay INCOMPLETE until final publication;
existing backend locks and runtime/destination links are refused. Independent
fixtures verify interrupted-copy preservation, manifest hashes, isolated SQLite
integrity/row restore plus JSON/config/evidence retention. The Windows package now
includes the backup command; staged-script regression is a release gate. This is
not a VSS snapshot, concurrent-writer guarantee, production-data restore, portable
credential recovery or completed full crash-recovery audit.

Build-identity increment: source/artifact content digests, version/time/checkout
HEAD and build ID now flow through the build generator, startup-captured backend
health, doctor and Settings' Build identity disclosure. Launcher reuse/rebuild
uses those same digests, including old-timestamp source changes; failed builds
restore previous artifacts. Unit/static-presentation and compiled isolated
restart tests pass. A real deployment restart was rejected by execution policy;
do not relabel the old live process as deployed. Normal owner close/relaunch and
rendered verification remain required. See docs/BUILD_IDENTITY.md.

The extracted build-identity package passed locked installation, API smoke,
production rebuild, rebuilt identity reuse and second smoke on 2026-10-20.
Distribution integrity was checked before the rebuild, not against changed
generated files afterward. Node was preinstalled; clean-machine and visual gates
remain open. Retrying the existing Chrome EdgeView tab again returned saved-origin
denial without an approval dialog; no workaround attempted.

This ledger reconciles the requested work. Source/tests, deployed behavior, and
visual verification are separate gates. Earlier progress reports are not proof.

Database startup increment: corrupt/empty/unreadable operational files are no
longer automatically replaced by an empty database; failed schema initialization
retains original bytes and publishes no intermediate schema image. Legacy fixture
row/backup/integrity/reopen, compiled degraded-health and failed-flush exit tests
pass. Health/doctor distinguish dataset projection from operational readiness.
Source, V1, shutdown, release/history and packaged backup tests passed; this is
not a production migration/restore, full historical upgrade matrix, whole-app
read-only gating or visual failure-UX verification. See docs/SHUTDOWN_RECOVERY.md.

Normal shutdown increment: HTTP intake/job scheduling stop, bounded task drain,
initialized-DB flush, Vite close and lock release at exit now replace immediate
signal exit. Pending-write reopen and compiled production signal-handler/history
tests pass. Windows console delivery, forced termination, active provider drain
and full crash/upgrade lifecycle remain separate unverified gates; see
docs/SHUTDOWN_RECOVERY.md. No live-process control workaround used.

One live diagnostic round verified NVIDIA/Groq model-list connectivity and Serper
search-envelope connectivity; disabled Hunter was skipped. Actual HTTP status
propagation was missing on successes and is now tested in source/API fixtures.
See docs/PROVIDER_VERIFICATION.md; this does not close live deployment, visual
display, generation entitlement, company accuracy or full importer workflow gates.

| Requirement | Current evidence and remaining gate |
|---|---|
| Preserve V1 and remove competing old engine | Active dependency/archive graph checked; retired source archived, not restored. |
| Raw responses/failures and immutable evidence | Requirement, body-bound, schema/failure, blob/integrity tests pass. Real-provider coverage and full UI evidence inspection still required. |
| Correct company/country identity and multiple contacts | Existing deterministic identity/ownership tests. New bounded link discovery follows real contact/management CMS links rather than only guessed routes. Global Pharmaceuticals Pakistan, Thorne Berry, Emerchemie and Slim Pharma need fresh source-to-live-UI comparisons; never inject expected answers. |
| Whole importer dataset and weak/no-contact reruns | Historical jobs report completed, but this is not proof of accuracy or current full scope. Reconcile current real dataset identities/counts, exclude Pakistan exporters, exercise normal UI batch workflow, monitor resource use and review remaining gaps. No promise of retrieving the entire Internet or nonexistent contacts. |
| UI state, no forced Research navigation | Source changes previously made; refresh/restart/tab/selection/scroll behavior needs rendered end-to-end verification. |
| Compact uploader and table space | UploadArea uses compact layout when files exist; rendered layout remains unverified. |
| Every button / ordinary-user QA | Control inventory is in EDGEVIEW_CONTROL_AUDIT.md. Isolated API/export tests do not count as visual clicks. Local-origin browser policy still denies observation; do not evade with another port/browser. |
| Telemetry/logs/provider settings | Runtime/regression checks recorded in control audit. Repeat visible settings/diagnostics checks after latest deployment; do not restore retired scoring controls. |
| Security report findings | Origin-bound stored keys, redirect/timeout guards, whole-key cache digest, rate limits, bounded JSON, log redaction and headers already implemented/tested. Windows credential encryption implemented and isolated restart tested. Live startup migration now verified: config protected, zero nonempty plaintext key fields; .env and historical copies are separate limitations. |
| Exposed credentials | Owner must rotate exposed provider keys and replace them locally. Encryption/redaction is not revocation; do not print keys or revoke working credentials without a safe replacement plan. |
| Dependency advisories | Five moderate rollups previously remain; no claim every dependency is patched. UUID affected-buffer API not reached by application ExcelJS call sites; published sprintf-js fix unavailable at last check. Recheck when dependencies change. |
| Windows launcher/logo/shortcut/package | Existing launcher/package retained. Package checks pass. Verify user's actual desktop shortcut/icon/launch target visually; do not create a second installation authority. |
| GitHub and CI/CD | Private MuhammadAsim8528/edgeview-v1; hosted run 39466064224 for ab98219 passed Windows + Docker QA with artifact uploaded. Tag-gated publishing skipped/not exercised. Backup changes need their own hosted green run; no production-readiness claim. |
| Docker | Non-root isolated QA image built; offline release smoke passes. Not a supported Linux production replacement for Windows DPAPI. |
| Local live deployment | Last read-only check: production backend PID 36216 still owns port 3901 and reports no build identity. New content-identity build is NOT deployed. Owner close attempt did not stop it; process-control restart was policy-denied. Do not infer deployment from source/build/package success. |
| Performance | Prior bounded load checks are documented; repeated large-dataset/browser memory and full enrichment measurements remain. No modest-hardware or million-row readiness claim. |
| Documentation and final handoff | Architecture/control/security/operations/delivery docs exist. Final report must name exact exercised behaviors, provider coverage, limitations and launch steps. |
| HWID/no-cloud concept | Licensing design reconciled to random installation UUID/keypair as primary, optional hardware signal secondary; reuse one protected-storage owner. Design only, no enforced activation or implemented installation keypair. No cloud deployment or multi-user readiness claim. |

All unresolved rows remain release gates where applicable. Do not mark V1 complete
merely because builds, a job counter, or one provider diagnostic passes.

## Master directive intake (39 sections, added 2026-10-20)

This is additive. `EXISTING` means source exists, not that every acceptance test
passed. `PLANNED` is not implemented. Conditional items require the actual feature
or runtime, not an invented Python/WebView/cloud stack. One active source writer.

| Directive sections | Status / bounded task and acceptance gate |
|---|---|
| 1, 2: reuse and OSS acceptance | EXISTING principle; PLANNED dependency/license inventory, adoption record template, production SBOM using established tooling. Evaluate maintenance, advisories, Windows compatibility and distribution license before installation. Flag copyleft before adoption. |
| 3, 35: preserve architecture | EXISTING V1 contract and archive graph; every milestone must retain identity, evidence, canonical state, test isolation and user data. No platform-driven research/storage rewrite. |
| 4: AI/research boundaries | EXISTING constrained NVIDIA/Groq transports, extraction and deterministic admission. PLANNED gap audit of contradiction/provenance coverage. Model planning/information-gain expansion is not permission to restore retired autonomous systems; resolve against frozen V1 before any such feature. |
| 5: frontend | EXISTING React/TypeScript/Tailwind/components; evaluate accessibility/form/table/virtualization needs before new libraries. PLANNED component/accessibility tests where gaps exist. |
| 6: Python backend | CONDITIONAL: no tracked Python implementation/manifest found in active repository. Apply infrastructure/boundary principles to actual Node/Express backend; do not add a duplicate Python owner. |
| 7, 26: desktop/WebView2 | AUDITED: browser + loopback server + Windows launcher; no confirmed native WebView host. WebView2 bootstrap/CDP distribution conditional on future justified host adoption. No Electron/Tauri rewrite. |
| 8: doctor command | PLANNED npm command orchestrating existing checks, PASS/WARN/FAIL/SKIPPED plus JSON, bounded execution and nonzero blocking failures. Identify irrelevant Python checks explicitly. Never mutate production or claim browser QA from API smoke. |
| 9, 10: test pyramid / isolation | EXISTING static/unit/contract/integration/release fixtures and disposable roots. PLANNED coverage map, cancellation/schema drift tests and supported real-interface E2E when browser access permits. Keep live-provider tests opt-in and credit-bounded. |
| 11, 12: observability / diagnostics | EXISTING bounded redacted Node logging/metrics. PLANNED privacy-reviewed diagnostics export and correlation coverage. No duplicate logging framework or arbitrary file read endpoint. |
| 13: crash reporting | PLANNED Sentry evaluation for actual React/Node stack, consent/configuration boundary, release IDs, deduplication, offline-safe operation and scrubbing tests. Secure source-map upload only if adopted/configured; no public private maps. No cloud payloads sent during evaluation. |
| 14: analytics | PLANNED PostHog evaluation and central minimal event schemas, privacy/opt-in design; replay OFF. No trade data, credentials, document content or automatic external analytics activation. |
| 15, 23: traces / performance | EXISTING timing/metrics and limited load checks. PLANNED repeatable cold/warm start, CPU/RSS, UI responsiveness, large-directory and research benchmarks; evaluate OTel only for measured gaps, set evidence-based thresholds. |
| 16, 18: device/cloud identity | CONDITIONAL: no remote identity requirement established. PLANNED pseudonymous random ID/keypair/OS storage/recovery design if licensing/cloud needs it. No raw/HWID hash authentication, embedded secret salt, automatic cloud DB or service-role client keys. |
| 17: local database | EXISTING integrity checks, schema version, migration backup and idempotent migrations. PLANNED transaction/foreign-key/index/recovery audit and restoration tests. Preserve sql.js/JSON authorities until a justified tested migration; evaluate encryption only for a concrete requirement. |
| 19, 20: security/research inputs | EXISTING secret-pattern scan, local-origin guards, bounded requests/uploads, URL safeguards, redaction and evidence tests. PLANNED mature scanner/SBOM/dependency audit integration, names-only environment template, additional injection/parser contracts. Do not mark moderate dependencies patched merely because call sites are currently unaffected. |
| 21, 22: crash/hang recovery | EXISTING ErrorBoundary/provider deadlines; PLANNED top-level boot failure, stalled-worker/cancellation/UI recovery audit, diagnostics/report actions and rendered regression checks. No indefinitely spinning states. |
| 24, 29: release / CI | EXISTING Windows and Docker QA, cold-package checks, checksums and tag-gated delivery. Hosted run 39431744015 passed Windows credential, build, release and cold-package tests; artifact upload rejected a parent-relative glob. Absolute-path step-output correction queued for verification; no release tag until acceptance passes. PLANNED SBOM/audit attachments, signing evaluation, clean-shutdown proof and supported E2E gate. |
| 25: version information | PARTIAL package/API/runtime versions. PLANNED build ID, commit/date/schema diagnostics and report correlation without exposing secrets or machine identity. |
| 27: dev/production separation | EXISTING explicit Vite dev opt-in, static default, CSP and release-HMR tests. PLANNED source-map/debug-port/exposed-bridge audit across actual package. |
| 28: full-app tests | BLOCKED current localhost browser permission. Do not bypass using another browser/port/CDP. PLANNED supported production-runtime UI smoke with isolated storage/mock providers, failure screenshots/traces/console/build correlation when authority exists. |
| 30, 31: issue / research ledgers | EXISTING hardening chronology, control audit and this backlog. PLANNED structured records with symptom/repro/environment/cause/fix/test/commit/date, plus separate entity/source/missed-contact/contradiction quality cases and evidence-derived truthsets. |
| 32, 38: verification / definition of done | REQUIRED all milestones: exact files/checks/results/runtime evidence, warnings and NOT VERIFIED labels. Startup or counters alone do not establish completion. |
| 33, 34: work ownership / milestones | REQUIRED one writer; bounded read-only review when authorized. Finish tests for each logical milestone before new implementation. New requests append here; do not replace unfinished work. |
| 36, 37: read-only audit / roadmap | IN PROGRESS reconciliation in EDGEVIEW_ENGINEERING_AUDIT.md. Existing source/test evidence reused with dates; comprehensive new security/duplication audits are not claimed. Complete applicable audit gaps before broad platform changes. |
| 39: product focus | REQUIRED: infrastructure reuse; custom code concentrated on trade identity, evidence, provenance and product-specific behavior. No new R&D architecture by implication. |

### Execution order

- [ ] M0: Finish current hosted CI credential-transport investigation; retain local
  working app and test gates. Complete new directive's audit/gap report.
- [ ] M1: Doctor command, version/build diagnostics and OSS/SBOM records.
  Baseline doctor implemented and tested: `npm run doctor`, JSON and developer
  `--full` orchestration. Read-only live check and full check/build/release mode
  passed; provider reachability, visual QA, build freshness, independent secret
  probing, resources/Git-state and device identity explicitly remain WARN/SKIPPED.
  Full developer mode is not available in an end-user ZIP lacking test/dev tools.
  See docs/DOCTOR.md; M1 remains open for these gaps and SBOM/version work.
  Standard npm CycloneDX production-lock inventory now generated locally (437
  components), with canonical identity/preservation regression tests and CI/release
  attachment wiring. See docs/OSS_INVENTORY.md. Six missing license metadata records
  and existing MPL-2.0 Lightning CSS family need review; attribution, binary/OS
  inventory and new hosted CI verification remain open.
- [ ] M2: Close security/database/contract/recovery gaps with regression tests.
- [ ] M3: Independent company truthsets and normal-user rendered enrichment QA;
  reconcile all importer scope, weak records and resource measurements.
- [ ] M4: Privacy-safe diagnostic export; evaluate crash/trace/analytics tooling,
  activate nothing externally without a concrete configuration/privacy boundary.
- [ ] M5: Packaged runtime E2E, clean restart/update/restore proof, passing hosted
  CI and factual release handoff. Conditional cloud/device/WebView tasks stay
  explicitly conditional rather than being silently omitted or falsely completed.

## OSS composition directive intake (40 sections + phases A–K)

Added 2026-10-20; additive to every preceding requirement. Engineering strategy is
**compose proven OSS/platform capabilities with custom EdgeView domain logic**,
not "dependencies only as a last resort" and not "a package for everything".
Reuse good existing implementation first; evaluate maintained libraries/repos,
public APIs and legally adaptable implementations before substantial generic
infrastructure. Do not automatically install the named examples.

For EACH subsystem review below, record these eight fields before selection:
existing implementation; available OSS/platform options; selected approach; why;
license/attribution; integration plan; security consequences; test plan. Record
upstream version/commit and EdgeView modifications for adopted source. Prior master
directive acceptance rules, SBOM and copyleft review remain in force.

| New sections | Added or clarified task / acceptance gate |
|---|---|
| 1: resource monitoring | PLANNED unified bounded resource service using actual Node/Windows capabilities or a justified maintained adapter. Cover process/system CPU/RAM, uptime/status/children/threads/handles where supported, disk and useful I/O, job/queue/worker/provider/extraction/database timings, failures and cache hits. Unsupported values remain unknown. GPU only if local GPU work exists; no required NVIDIA hardware. Detailed diagnostics rather than a Task Manager clone. |
| 2: installation/device identity | PLANNED local random installation UUID plus mature crypto keypair and OS-protected private storage, update persistence and recovery/reset tests. Raw/HWID hashes are not authentication; hardware signals secondary and never sent raw to analytics. Cloud registration/signed credentials remain conditional on an actual cloud service. This explicitly adds local identity work; it is no longer entirely deferred merely because cloud registration is optional. |
| 3: one secret-store abstraction | PARTIAL existing Windows provider-credential codec; PLANNED assess reuse/extension for device keys and local tokens through one owner, no competing plaintext stores. Distributed client must not contain shared cloud service-role secrets. Preserve current configuration and recovery semantics. |
| 4, 5, 6: crash, analytics, replay | Carry forward Sentry/PostHog evaluations for actual React/Node stack, vendor adapters, correlation/breadcrumb/release IDs, central minimal event schemas and offline-safe delivery. Replay OFF unless separate masking/privacy verification succeeds. No direct vendor calls scattered through product code, no sensitive research payloads exported. |
| 7, 8: logging / tracing | Reuse existing bounded redacted logs and metrics; evaluate mature backing libraries and simplest adequate tracing (Sentry spans/OTel where justified). Add version/operation/job/provider/stage correlation and privacy-reviewed diagnostics export. Python-specific SDK examples do not require a Python backend. |
| 9: SQLite | Carry forward measured index/constraint/transaction/migration/corruption/backup/locking/concurrency/schema audit. WAL only where supported/appropriate to actual sql.js persistence; do not claim native SQLite features are automatically active. |
| 10: optional control plane | CONDITIONAL licensing/registration/update metadata/flags/shared configuration, separated from local research storage. No automatic private-data synchronization or unnecessary PostgreSQL/Supabase migration. |
| 11, 12: runtime / real automation | Current runtime is browser + loopback Node app. WebView2 detection/bootstrap/CDP tests conditional on a real host; do not add Chromium/Python merely to fit examples. Real interface testing must cover production integration, not a standalone dev page. Existing local-origin denial remains a hard visual-test blocker, not permission for raw-CDP/alternate-port workarounds. |
| 13, 14, 15: tests / schemas | Evaluate existing TS test stack plus Vitest/RTL/Playwright/MSW where useful; no homemade test engine. Python/pytest/Pydantic conditional on actual Python code. Validate privileged API contracts, payloads, responses, errors, versioning, cancellation and timeouts using existing or justified mature schema tooling. |
| 16, 17: networking / retries | Retain mature HTTP client/platform fetch and SSRF wrapper. Audit shared TLS, pooling, cancellation, size bounds, telemetry, safe retry classification, attempt cap/backoff/jitter and total deadline. Never indefinite retries or unsafe replay of paid/non-idempotent operations. |
| 18: background work | Audit actual concurrency across parsing, database-heavy work, exports and research; keep UI responsive with appropriate supported workers/task primitives. No distributed queue added without need. |
| 19: safe updates | PLANNED evaluate mature Windows update/distribution compatible with current launcher/package. Require HTTPS, verified metadata/hashes/signatures where possible, versions, atomic replacement, rollback and clear UX. Never execute arbitrary server-returned binaries; preserve active jobs and user state. Existing build-on-launch is not a verified automatic update system. |
| 20, 21, 22, 23: packaging / native / UI / reuse | Inspect actual packaging first, evaluate installer/bundled runtime rather than choose by popularity. Reuse OS capabilities and accessible UI primitives without replacing visual identity. Legally reuse maintained repositories with attribution and acceptance records. No unrelated UI/theme rewrite. |
| 24: security toolchain | Mandatory release dependency audit plus appropriate mature static/secret scanners and update tooling evaluation. Names-only env template, honest severity/reachability triage and unresolved findings; do not disable legitimate failing checks. |
| 25: leak/stress tests | PLANNED long repeated representative cycles with bounded fixtures and trend measurements: memory, CPU, child/process count, threads, handles, connections, listeners, DB state and crashes. Include worker/renderer leaks only where actual runtime uses them. Single idle/RSS snapshot is not a leak test. |
| 26, 27, 28: startup / unified health / doctor | Reuse one canonical health-check set for startup, UI, diagnostics bundles, doctor and tests. Cover runtime, storage/config/permissions/disk, DB/migrations, secrets, providers, jobs/resources/logs/build and identity. Explicitly SKIP nonexistent bridge/WebView/Python features. Human PASS/WARN/FAIL/SKIPPED + machine JSON; nonzero release-blocking failures. Cloud telemetry never required for startup. |
| 29: advanced diagnostics | Extend existing diagnostics with real version/build/schema/runtime/resources/process/provider/cache/worker/error/health information and Copy/Export/Run Health Check. Clear Safe Cache only for explicitly identified recreatable cache, never evidence/DB/secrets; normal destructive-action rules apply. No fabricated registered/healthy state. |
| 30: performance budgets | Measure startup/idle/company/detail/directory/research/database/UI baseline first; then set practical regression thresholds and warn/fail as appropriate. No arbitrary hardware promises or invented budgets. |
| 31, 32: offline / provider resilience | Explicitly distinguish offline, provider outage, auth, quota/rate limit, timeout, server and local failure. Stored intelligence remains browsable where possible. Maintain provider adapters, real timing/success/error/quota/usage states, NVIDIA/Groq routing preferences and no fabricated fallback results. |
| 33, 34: privacy / telemetry boundary | PLANNED data-egress inventory and SAFE TELEMETRY/PSEUDONYMOUS/SENSITIVE/NEVER TRANSMIT classifications, vendor-independent narrow services. Never transmit credentials, private documents/DB rows/full research/prompts/auth material by default. Centralization must not become a giant duplicate telemetry platform. |
| 35: flags | CONDITIONAL mature remote rollout/kill-switch system only if justified. Client-controlled flags must never disable mandatory security protections. |
| 36, 37, 38: backup / crash / shutdown | PLANNED schema-aware backups, integrity/restore validation, interrupted-write/job recovery and stale-lock handling without erasing evidence or marking interrupted work complete. Coordinated bounded shutdown flushes durable state/logs, cancels workers and closes owned children/resources; telemetry cannot stall it forever. |
| 39: lifecycle gate | PLANNED isolated first-start → DB/local identity → representative real workflow → normal close/restart/persistence → controlled crash/recovery → app/schema upgrade/data-preservation test. Use real supported runtime plus controlled providers, never destructive production fixtures. |
| 40: full completion | REQUIRED dedicated phases A–K below AFTER feature milestones, then re-run blocking regression gates following all fixes. "Works", one passing test run, healthy counters or an attractive UI are not completion. |

### Dedicated full-product completion phase (not started / not passed)

- [ ] A — Whole-repository audit: major subsystems, duplicates/dead code, unused
  dependencies, temporary code, TODO/FIXME/debug bypasses, defaults and errors.
- [ ] B — Complete applicable static/unit/component/integration/contract/E2E/
  packaged/migration/recovery/provider/offline/stress/leak/security test execution;
  legitimate failures fixed, not disabled. Explicitly identify irrelevant runtimes.
- [ ] C — Security pass across dependencies, static/secret checks, API/bridge,
  URLs/network, filesystem, device/secret storage, runtime and database; classify
  severity with evidence and resolve release blockers.
- [ ] D — Measured startup/idle/navigation/large-data/research/export/shutdown
  CPU, memory, disk/network, provider and DB profile; regressions/leaks addressed.
- [ ] E — Failure UX: internet loss, DB failure, outage/quota, malformed data,
  renderer/runtime failure, permission denial, disk full, bad configuration and
  unexpected shutdown, all tested safely in isolation.
- [ ] F — Actual distributable install/run: first launch, dependencies, storage,
  identity, resources, optional telemetry, research, exports, updates and applicable
  uninstall behavior. Development checkout success is insufficient.
- [ ] G — Clean Windows/VM gate WITHOUT developer-installed Node/npm/Python,
  developer environment variables, repository, IDE or dev server. **Current ZIP
  requires Node/npm and does NOT satisfy this new gate.** Evaluate bundled runtime/
  installer with licenses/integrity/update/recovery tests; Docker QA and prior
  cold-package tests are different evidence, not clean-machine substitutes.
- [ ] H — Release observability: real logs/resources/diagnostics/build IDs and
  configured privacy-approved crash/analytics services; controlled test error
  reaches intended destination. Offline/unconfigured vendors clearly distinguished.
- [ ] I — Final regression: rerun every release-blocking test AFTER security,
  performance, recovery, packaging and UX fixes.
- [ ] J — Documentation: architecture/setup, dependency decisions/attribution,
  tests/diagnostics/release, identity/privacy, recovery and known limitations.
- [ ] K — Produce `EDGEVIEW_PRODUCTION_READINESS_REPORT.md` with architecture,
  OSS/custom decisions, exact tests/scans/results, measured performance, monitoring,
  actual identity design, exact packaged build, clean-machine result, limitations
  and evidence-backed READY / READY WITH WARNINGS / NOT READY recommendation.
  Do not issue a favorable report prematurely.

M0–M5 execution order remains; these requirements expand the appropriate milestones
and add final completion gates. Earlier real-company accuracy, full importer scope,
UI state/visibility, provider evidence and key-rotation requirements remain open.

### 2026-10-21 independent source audit and retrieval fix

Standard offline scan `fd56c873-d8dd-4055-b090-9b89a81e19ac` reviewed 221/226
tracked source/context paths at `a58f3fe`. Three branding binaries were excluded;
two lockfiles received metadata/pattern review, not dependency implementation
review. Seven validated findings: four medium, three low. The sealed report is
in the local Codex Security workbench; source review is not visual acceptance.

- [x] Source fix: pin each retrieval connection to the single validated DNS
  answer set; reject mixed private/public answers. Share this GET transport with
  NVIDIA model discovery, preserving credential-origin checks and no redirects.
- [x] Source fix: one absolute deadline covers DNS, redirects and body capture;
  late DNS cannot start a connection. Preserve exact response bytes for strict
  provider decoding. Synthetic transport tests and actual NVIDIA catalog passed.
  This does not implement immediate batch-stop cancellation or a global run SLA.
- [ ] Fix parser header-by-row cell amplification and bound document resources.
- [ ] Fix/retire unsafe legacy HTML block export and stats CSV quote handling.
- [ ] Prevent nonloopback HOST exposure and export filename path traversal.
- [ ] Resolve backup effective-path overrides and previous-config completeness.
- [x] Batch dashboard: adapt summary/full job before rendering company_states;
  remove Firecrawl/obsolete-model labels and unknown-limit arithmetic.
- [ ] Enable metadata-only paginated dataset export controls without requiring
  empty local row arrays to be populated.
- [x] Preserve usageScope when the runtime hook publishes validated state.
- [ ] Diagnose occasional saved-config DPAPI open failure. One standalone read
  failed; synthetic DPAPI roundtrip and subsequent actual config read succeeded.
  Configuration was not replaced; do not fall back to plaintext or reset keys.

Verified for retrieval patch: typecheck, lint, test:v1, synthetic outbound suite,
model-origin and diagnostic payload contracts, production build/release smoke,
Windows package verification (130 files) and staged/ZIP unchanged-launch checks.
Actual NVIDIA model catalog: HTTP 200, 83 models, selected model available,
257 ms. Catalog access does not prove generation or real-company accuracy.

Live port 3901 still belongs to old PID 36216. No policy-denied restart bypass
was attempted. Supported browser documentation retry failed before navigation:
`failed to write kernel assets: The system cannot find the path specified.
(os error 3)`. No permission dialog or visual QA occurred. Full UI/research,
clean-machine, current hosted CI and remaining A–K gates are still open.

### 2026-10-23 batch dashboard/runtime contract follow-up

Batch summary restoration now provides safe empty collections until the bounded
progress poll arrives. Polling starts immediately, coalesces overlapping polls,
aborts on close/reselection, and cannot restart from an obsolete restoration.
Closing the dashboard does not stop the persisted backend job. Retired-provider
labels, fixed model names, invented account limits and guessed ETAs were removed.
Backend job-list/summary/progress/usage responses share a four-provider projection;
historical stored counters are not deleted. Per-company progress now carries its
actual resource counts; absent values remain unknown. The runtime hook retains
the backend's usageScope.

Passed after these changes: npm run check; batch_snapshot (including static React
markup, not visual QA); runtime_capability_recovery; production build;
telemetry-runtime against an isolated compiled backend (including job creation,
summary/progress/stop and no guessed quota); production release smoke.
The first extended runtime test correctly failed on leaked legacy counters, which
were fixed at the shared API projection rather than hidden in the test.

Verification setup initially lacked development dependencies. Clean npm ci hit a
Windows-locked Rollup native file; in-place npm install restored the locked tree
with scripts disabled and no package-lock change. It reported a leftover locked
cleanup directory; no forced deletion or unrelated process termination was used.

Port 3901 now belongs to PID 30112, not the previously observed PID. Its loaded
build and new UI behavior are not certified by these isolated checks. Supported
browser retry on this date still failed with the kernel-assets os error 3 before
navigation. Visual QA and the remaining security/product gates stay open.
