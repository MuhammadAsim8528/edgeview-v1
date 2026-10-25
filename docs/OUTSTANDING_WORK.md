# EdgeView completion ledger — 2026-10-20

## Authoritative implementation ledger — reconciled 2026-10-25

### Latest owner acceptance constraint and reviewed durability regression — 2026-10-25

Clean release export is AFTER implementation acceptance and reconciliation into
original development location. Preserve that project's data/configuration; export
with an explicit allowlist into a new immutable candidate, independently verify
empty storage/new identity and packaged behavior, then STOP for owner review
before Store submission, public publication or public installer/feed uploads.
Existing release blockers are unchanged; no final source copy was created.

Original main is clean at b6db239 on readback. Reviewed only its persistence
failure assertion: failed flush must return DISK_FULL or PERSISTENCE_WRITE_FAILED,
not an arbitrary exception. Adopted server/tests/persistence_failure_propagation.test.ts
and independently ran it: PASS including controlled write failure and repair.
Expected injected ENOENT diagnostics are not an unexpected production failure.
Qoder's reported mutation score was not independently rerun. No whole-tree merge,
live restart, customer-data change or release approval is implied.

### Current coordination / organisation / shipping constraint

### Hosted SDK compatibility/privacy finding — 2026-10-25

### Reviewed Qoder test reconciliation — SSRF precision

Read final test changes at main 83c5dd2 and 9f0c4fa, compared the affected file
against common ancestor 860b6e4 and confirmed integration had no divergent hunks
there. Adopted only server/tests/ssrf_security_guard.test.ts, not the main tree
or its mixed historical ledger. Actual standalone execution passes exact guard
message assertions under isolated empty settings, unsaved synthetic keys,
loopback aliases/0.0.0.0/fd00 controls and an allowed documentation-address literal.
Corrected the output label: literal controls without a DNS lookup are not proof
of DNS resolution/binding coverage. Qoder's reported mutation score is prior
evidence, not an independently repeated mutation run here. Remaining main
commits are still pending individual review; original tree remains untouched.

Inspected actual GitHub runs at 30c7f9246c078de96a1f44636ae9ce52cb87ec0e:
40200261970 (research read) failed typecheck; 40200261939 (release) failed Windows
verify typecheck and Docker build. Browser-e2e succeeded; publish skipped.
Inventory 40200261965 succeeded. These are scoped results, not overall PASS.
Annotations identify server/monitoring.ts:100: sendDefaultPii is not a NodeOptions
property in locked @sentry/node/core 11.9.0. Local package metadata says 11.9.0
but declared build/types/index.d.ts is missing: local typecheck silently treated
the SDK as untyped, so previous local passes did not prove SDK compatibility.
Do not suppress/cast away the CI error or weaken the typecheck gate.

Official v11 migration guide replaces sendDefaultPii with dataCollection and
warns of more permissive defaults:
https://github.com/getsentry/sentry-javascript/blob/develop/MIGRATION.md
Candidate explicitly disables user/cookie/header/body/query, AI/MCP/GraphQL,
database/queue payload, stack variable and source-context collection. Default
integrations remain off and final safe-event projection remains in place.
Actual SDK-options regression failed before the change (undefined), then passes;
captured Sentry/PostHog transport test emitted six requests without private
synthetic markers; rejection/offline/recovery test passes. Clean exact-lock
temporary install completed and restored declared SDK types. The isolated tsc
reported no SDK option error, but failed because the validation-copy allowlist
omitted scripts/test-server-port.mjs imported by three endpoint tests. That setup
failure is NOT a full clean-typecheck PASS. Hosted complete-checkout acceptance
and local dependency-tree repair remain pending. No real-account
event was sent by these tests and no claim of prior private-data leakage is made.

Owner explicitly requested a stop before shipping in the latest instruction.
That supersedes earlier automatic-publication authorization: prepare and verify,
then return a pre-shipping checkpoint before submission/public distribution.
Qoder is still working in the original Pharma-AI directory; keep it read-only
from this session until a clean handoff. A pause message was NOT sent: native
control observed Qoder running, then could not access its minimized window.
Do not represent draft text or a failed UI action as delivered coordination.
Reviewed integration remains the temporary active line at 0f3f4d6; main was clean
at 79b1784 on the latest read. Reconcile main's divergent launcher/packaging/docs/
test tools individually after Qoder finishes; no blanket agreement or merge.

Windows resolved Desktop to C:\Users\asimh\OneDrive\Desktop. Created EdgeView/
README.md and empty Versions, Installers and Documentation audience subfolders
(User-Guide, Installation-and-Updates, Privacy-and-Licenses, Support-and-Recovery,
Engineering, Verification-Reports). Read back existence and README status.
No populated source version, installer, customer data or operational snapshot was
copied. No existing version was overwritten. Permanent development directory
restoration, allowlisted scanned snapshots and documentation inventory/index
remain open. This scaffold does not satisfy release/snapshot acceptance.

### CC03 startup-overlay policy — implementation in progress

Startup guard committed as 3a9672ee1e1d21f979ff3b84f274091f9c40789b and pushed.
Exact isolated package checks passed at build
ff32dc33f8017f1a4d1a5e5b90f6366de28693733c3f092d9c5c1b70061315a3;
136 manifest files, unchanged launch/private-file checks PASS, disposable ZIP
SHA256 9497fb6efd5fac1f0064dc3ca467a566e8811995781aacb62697dcf648bec53a.
This developer package has 105 development files and needs Node/npm; not an installer.

### CC03 ordinary-batch retained-evidence revalidation — follow-up

Actual createJob/runJobLoop regression initially completed a job without restoring
withheld cached fields: normal reuse skipped the new policy entirely. Ordinary
non-forced reuse now first verifies exact saved-run company+country identity;
stale contact output is reprojected from retained history, durably persisted and
then assigned/marked current. No new provider call is needed for this path.
Force Fetch remains the explicit new-retrieval path. Current valid caches still
reuse normally; a foreign saved-run ID cannot authorize another entity's cache.

Executed actual isolated job-loop test passes completion, durable entity-key
binding and zero http/https/fetch calls. Injected overlay-write ENOSPC yields a
FAILED job, retains the previous in-memory contact and needs_revalidation flag,
and still makes zero network calls. Its logged synthetic fatal-loop error is
intentional test evidence, not a production crash. npm run check, build and
test:release pass for the runtime candidate; startup cache guard also passes.
The new job-loop regression is wired in CI. No live/customer batch executed.

Still open: large per-company history can make offline reprojection expensive;
bounded/background revalidation performance, interruption/resume, actual API/UI
and export flow, broad entity relationships and real-company acceptance remain
release gates. This does not automatically revalidate every stale cache at startup.

Reproduced on the active hydrateV1ContactEnrichment SQLite path: an old v18 cache
loaded a foreign email at startup. New shared overlay policy v21 binds persisted
output to canonical company+country entity_key. Startup withholds older/unknown
policy or mismatched-entity overlays, marks needs_revalidation and retains their
stored rows and original run IDs. Current matching-entity overlays still hydrate.
Interactive/batch research clears the warning and persists the entity binding.
Missing contact-ID remapping uses identity headers rather than getV1Run full-body
hydration; no competing persistence authority or synchronous full-history replay.

Focused executed checks: cached_overlay_scope_policy initially failed before fix,
then passed old/wrong-entity withholding, unchanged stored recovery row, current
cache reopen and zero raw-body reads for matched contacts. Initial test cleanup
left a pending save timer after deleting its temporary directory; corrected by
flushing before reset/cleanup, rerun without that error. Static stale-profile
notice/escaping and historical-evidence preservation tests pass. npm run check,
npm run build and npm run test:release also pass on the final candidate; existing
bundle warning remains. Packaged runtime, actual API/UI/export and large-history/
startup performance acceptance remain pending. Original dataset-seeded fields
are not deleted. Latest read-only main observation: ae031d3, with Qoder modifying
server/tests/ssrf_security_guard.test.ts. Do not reconcile/switch its branch yet.
This withholds stale output; it does not yet implement automatic bounded cache
revalidation or prove every cached fact correct merely from a version/key match.

This section is the single current goal/phase authority. Earlier dated entries
below are retained evidence, not competing priorities. RECONCILIATION_2026-10-10_23,
REAL_WORLD_APP_READINESS_RESEARCH, UNCLE_INSTALL_UPDATE_SUPPORT_PLAN and security,
recovery, monitoring and distribution documents support these IDs. Their historical
claims do not automatically close current acceptance. New requests extend these IDs.

Writer: this session only. Authority: integration/edgeview-v1-20261024, initially
clean at 75e8cac. Research/review session owns no implementation. No review approval
is inferred. The older edgeview-chatgpt worktree has an unfinished, independently
reviewed package-content scanning candidate; preserve it without automatic merge.
No live 3901 restart, operational-data mutation or publication is authorized merely
by this plan. Synthetic isolated fixtures first.

State vocabulary: planned / implementing / verified / blocked. Capability vocabulary:
implemented / partially implemented / absent / unverified. Verified applies only to
the cited acceptance scope, never automatically to the whole product.

| ID / priority | Requirement; current state / capability | Code / commits / executed evidence | Remaining acceptance and dependencies |
| --- | --- | --- | --- |
| CC01 P0 | Company+country identity from upload to history; implementing / partial | company_identity.ts, db.ts, v1_identity.ts, job_manager.ts, contact_projection.ts; 75e8cac foreign-domain fix; prior reported four-case regression | Mixed global-domain fields, every admission/overlay/UI/export path; isolated reproduction then real-company rendered comparison |
| CC02 P0 | Field-level local/parent/subsidiary/distributor attribution; implementing / partial | job_manager.ts projectDeterministicContactFields; v1_engine.ts accepted_claims include source_result_id/url/quote; source inspection finds domain-only contact admission | Kenya/Pakistan, Sudan/South Sudan, multi-office and distributor fixtures; country scoped claims and provenance, safe abstention; no blanket parent-domain rejection |
| CC03 P0 | Country-aware history/cache and no foreign repair of missing facts; planned / partial | canonicalEntityIdentityKey; contact_projection_country_isolation.test.ts; historical_evidence_preservation.test.ts | Reproject old mixed runs under current policy; same-name/country aliases, missing/ambiguous scope and persistence/export checks |
| CORE01 P0 | Bounded V1/provider capture, evidence and prior-good preservation; planned / implemented, runtime unverified here | v1_engine.ts, job_manager.ts; prior V1/atomic/blob tests in historical ledger | Enabled NVIDIA/Groq/Serper/Hunter real failure/recovery and complete source→UI truthsets; preserve raw failures and evidence; no retired autonomous stack |
| DATA01 P0 | CSV/XLSX/NVL, importer scope, pagination/export/state; planned / partial | routes/upload.ts, db.ts, Contacts.tsx, FileViewer.tsx, appStore.ts; previous branch fixes not assumed all integrated | Reconcile actual importers/exporters/duplicates, UI controls, refresh/navigation races and accurate counts; no customer dataset writes during fixtures |
| JOB01 P0 | Progress/cancel/retry, bounded waits and crash recovery; planned / partial | job_manager.ts, ResearchWorkspace.tsx, SHUTDOWN_RECOVERY.md, RESEARCH_READ_RECOVERY.md | Trace cancellation to transport/job persistence; kill/restart/retry and no spinner/lost state; fresh runtime/visible proof |
| SEC01 P0 | Local Host/Origin, SSRF/DNS/redirect/credential origin and resource limits; planned / partial | server.ts, ai_providers.ts, url_safety.ts, routes/upload.ts, security tests | Reconcile exact current tests and deployed build; alias/raw requests and malformed/error cases; preserve safe loopback boundary |
| SEC02 P0 | DPAPI secret authority/history/package scans; planned / partial | settings.ts, scan-history-gitleaks.mjs, CI; older branch package scan candidate uncommitted | Review/install current secret boundary; staged-content gate and old main alerts; never publish credentials or claim missing private GitHub features passed |
| MON01 P0 | Privacy-safe Sentry/PostHog plus disabled/offline controls; planned / partial | monitoring.ts, shared/monitoring_privacy.ts; b5fe935, 365021c; prior transport/rejection tests | Visible user settings, frontend crash and startup/unhandled coverage; fresh intended-build delivery and privacy; optional/offline never blocks startup |
| MON02 P0 | Account IP/location privacy; planned / partially verified externally | Backend/frontend IP prevention and extra location fields saved; PostHog discard-IP saved; older branch 8b7308d records fresh 365021c backend event c8c23746830143719cbf23c394688d2e with geography Filtered | Import evidence by review, not code merge. Backend event only; fresh frontend effect and exact current integration/live build remain unverified |
| DIAG01 P1 | Honest diagnostics preview/export/retention/support; planned / partial | support_diagnostics.ts, SystemHealthPanel.tsx; 365021c; support_diagnostics.test.ts | Review actual overview/provider/resource/error states, visible preview/download, offline and redaction; no raw logs/content leakage; support contact requires genuine publisher details |
| PRIV01 P0 | Accessible privacy notice and AI/search disclosures; planned / partial | monitoring allowlist exists; SettingsTabV1.tsx inspection pending | Explain provider company/country/query/content egress separately from monitoring, consent/disable behavior, replay OFF; no invented publisher/legal promises |
| ID01 P1 | Installation identity distinct from licensing/HWID; planned / partial | install_identity.ts random UUID; prior identity/doctor tests | UUID is not cryptographic licensing. Inspect DPAPI/private-key authority and corruption/recovery. Raw HWID authentication deferred; no hardware analytics |
| REL01 P0 | One integration line, narrow commits and version/build/schema/channel; implementing / partial | build_identity, build metadata, sql.js schema, Git/CI; integration at 75e8cac | Reconcile older branch fixes and Qoder launcher commits individually; exact package identity, pilot/stable promotion and changelog; no rebuilding different code on promotion |
| CI01 P0 | CI, dependency/license/SBOM/secret/release evidence; planned / partial | .github/workflows, release-license-inventory, collect-license-texts, verify-release-evidence | Actual current commit jobs/artifacts, dependency advisories and license texts; native private-repo CodeQL/push protection availability not assumed |
| STORE01 P0 | sql.js/JSON/evidence authority and integrity; planned / implemented, broader recovery unverified | sqlite.ts, sqlite_persistence.ts, v1_engine.ts; existing atomic/integrity tests | Old-version upgrades, failed writes, locking and interrupted runtime tests with exact schema evidence; no new persistence authority |
| MIG01 P0 | Stable writable root and explicit legacy migration; planned / partial | shared/runtime_paths.mjs and c8019b7 opt-in EDGEVIEW_DATA_DIR, doctor/backup tests | No legacy migration claimed. Destination/link/junction checks, preflight/backup/journal, interrupted promotion/stale policy and ambiguity refusal; needed before installer |
| REC01 P0 | Backup/transactional restore/schema-compatible rollback; planned / partial | backup-runtime.mjs, migration_backup_retention.ts, prior isolated tests | Rejected restore stays excluded. Executable matched app/data recovery, midway failures, integrity/restart and schema compatibility; package downgrade is not DB rollback |
| DIST01 P0 | Bundled runtime and immutable customer payload; planned / absent customer distribution | package-windows/EdgeView.bat developer ZIP; Windows SDK located; c8019b7 data-root precursor | No customer Node/npm/Git/IDE; runtime-only licenses, stable launcher/data location and complete lifecycle; depends MIG01/REC01/REL01 |
| MS01 P1 | Microsoft Store vs signed MSIX/feed decision; planned / unverified account | WINDOWS_DISTRIBUTION_DECISION.md is evaluation only | Current official eligibility/fees/publisher/account/signing/policy review and visible official account handoff if needed; user handles identity/payment/agreement/attestations. Choose one update authority |
| UPD01 P0 | Trusted update acceptance and compatible recovery; planned / absent accepted updater | UNCLE_INSTALL_UPDATE_SUPPORT_PLAN.md, build recovery only | Package trust, channel/schema compatibility, preserved state, restart health/build/DB acceptance, last-known-good recovery; depends selected distribution route and migration |
| UX01 P1 | Accessibility/About/notices/support; planned / partial | React UI, prior focused browser/a11y tests, license inventory | Keyboard/focus/dialog/forms/error/empty workflows, actual About/version/notices, genuine support details; no broad redesign |
| PERF01 P1 | Offline/failure UX and target-device long performance; planned / partial | resource monitoring, prior smoke/soak JSON and bounded queues/logs | Fresh target idle/start/import/export/research/shutdown measurements; long repeated leak tests and disk/DB/permission/network failures; no scale claims from short smoke |
| QA01 P0 | Rendered controls and real company truthsets; blocked / unverified for live instance | Playwright infrastructure exists; last supported Chrome local-origin access denied despite Always allow UI | No bypass/alternate port. External dashboards accessible; real Global Pharma/Thorne Berry/Emerchemie/Slim and Getz local-scope source→UI checks pending supported access |
| PILOT01 P0 | Clean Windows install/update/recovery/uninstall pilot; planned / absent acceptance | Existing developer ZIP/Docker are not evidence | Exact frozen self-contained package on clean Windows; synthetic import/research/export/offline/restart/update/failure/retention; then authorized real-data step |
| FINAL01 P0 | Freeze/three artifacts/report/uncle Stable deployment; planned / absent release acceptance | Existing release contract and preserved source/data architecture | Close dependent gates; exact source archive, private operational snapshot without casual credentials, runtime distribution/checksums/SBOM/notices/release notes; final READY/READY WITH WARNINGS/NOT READY from evidence |

### Ordered implementation phases and review packets

1. CC01–CC03 now: trace/adversarial mixed-country fixtures, narrow admission fixes,
   field provenance and history checks. Commit each coherent concern. Full real-world
   closure requires later rendered/source comparison, not passing fixtures alone.
2. CORE01/DATA01/JOB01/SEC01/SEC02: reconcile prior working fixes and current
   security/recovery paths. No blind branch/dirty-tree merge or revived legacy engine.
3. MON01/MON02/DIAG01/PRIV01/ID01/UX01: existing adapters first, visible privacy and
   honest support states; actual delivery and crash coverage, not installed SDK claims.
4. REL01/CI01/STORE01/MIG01/REC01: current release identity/evidence and transactional
   migration/recovery. Inspect main launcher commits 05d4e1f,5ab65a6,b8e0266,0ebb6f5,
   8ad12f4 before accepting any; older release branch fixes remain pending reconciliation.
5. DIST01/MS01/UPD01: verify official Store route/account and choose one distribution
   authority, then runtime bundling/install/update trust and post-update acceptance.
6. QA01/PERF01/PILOT01/FINAL01: actual rendered and target/clean-Windows acceptance,
   retained exact artifacts and freeze/deploy only after gates genuinely close.

Each phase checkpoint records goal IDs, exact commits/files, before/after behavior,
executed commands/results, unresolved failures/limitations and next phase here.
This matrix is a conservative reconciliation from source/history; historical test
claims are identified as prior evidence and are not fresh execution in this handoff.

### Checkpoint — handoff reconciliation and Phase 1 reproduction

### Phase 1 first implementation packet — explicit source/field scope

### Phase 1 follow-up packet — unknown evidence abstention

Implementation commit: 3ee7731369e4528c417f0f91016079f6fe7c8f80. Exact built
artifact 02b5e00dc160c3ed39c35dd0119c93aa29ca12cd408c73f987de3a43aa54f768
passed isolated developer-package checks (136 manifest files; unchanged launch
and private-file check). Disposable ZIP SHA256:
eb3a9dc2682449f88a63f7b9abef35cc4416e6fe18b4f356265bc321f8c02b97.
Removed afterward; 105 development files and required Node/npm mean
customerRuntimeReady=false. No installed/live/browser or clean-Windows acceptance.

CC01/CC02 remain implementing; CC03 startup/cache acceptance remains open.
The first follow-up regression failed on 22a7879 because an unlabelled same-domain
mailbox entered the Kenyan profile. Overlay v20 now withholds unknown-country
facts for country-specified runs and retains them as bounded unscoped_facts with
source/result/quote, target country and COUNTRY_SCOPE_UNPROVEN. Historical
projection, batch persistence and canonical JSON normalization carry that field.
No second store or rewritten raw capture. Existing no-country legacy test callers
remain compatible; real enrichment requires the exact country at its input boundary.

Explicit matching international phone prefixes provide number-country evidence
only when source scope was unknown; they do not override foreign/distributor
scope. This establishes the number's calling-code scope, not legal incorporation,
subsidiary status, or a person's workplace. Unknown mappings/local numbers provide
no such positive proof. SourceEvidenceModal has a collapsed, text-escaped notice
showing up to 50 retained unscoped facts; canonical retention is bounded to 200,
with full raw evidence still available in captured results. This is distinct from
verified local contact fields and does not add these facts to local-contact exports.

Positive public-profile/LinkedIn/free-mail fixtures previously omitted country
context. They now explicitly supply local-country evidence; a paired negative
preserves the original unscoped free-mail case and asserts withholding/retention.
This is an intentional stricter policy, not unchanged compatibility. Original
phone recall/history expectations passed unchanged. Unit check proves canonical
JSON round-trip does not promote retained unknown mailboxes to trusted email.
Static rendered markup test proves notice, escaped hostile text and no mailto
promotion, but browser expand/keyboard/API/UI behavior remains NOT VERIFIED.

Executed candidate checks: npm run check, build and test:release pass; separate
unscoped_contact_presentation, search_snippet_email_admission, official_phone_recall,
historical_evidence_preservation and contact contract checks pass. Earlier failures
are retained above, not relabelled as passing baselines. Existing bundle warning
remains. No port 3901 restart, actual-company calls or customer data changes.

Still open: previously persisted overlays are hydrated directly at startup without
v20 reprojection; a schema bump alone does not fix them. Safe bounded revalidation
and visible stale-validation policy are the next CC03 unit. Unknown facts need
deduplication/retention validation across repeated historical runs, broader country
aliases/languages and relationship extraction, actual persisted API/export and
rendered behavior, and performance measurement. No whole Phase 1 completion claim.

Goal IDs CC01/CC02/CC03: implementing, NOT wholly verified. This slice adds
server/contact_country_scope.ts, updates job_manager.ts projection/overlay v19,
adds explicit country-name matching in src/utils/countryNormalizer.ts and wires
company_country_field_scope.test.ts into package.json test:v1. No other session
has reviewed/approved this change. The initial four actual projection assertions
failed before implementation; seven scenario assertions plus HTML/JSON carrier,
address/leader/local-number, raw-preservation and provenance controls now pass.

Behavior: explicit foreign/ambiguous/distributor source context can no longer be
overridden merely by official-domain ownership. Local office sections remain
eligible on a shared global page and on a foreign parent domain. Longest proper
country names distinguish Sudan/South Sudan; natural-language US/IN-like words,
URL and email identifiers do not become country proof. Projection adds per-fact
result/URL/quote/scope references and reprojects historical raw runs through the
same guard. Original provider captures and accepted/rejected extraction evidence
are not rewritten. Existing valid social URL slash variants and older quoted
claim-only leader normalization were initially broken by the candidate; corrected
and their original expectations passed unchanged.

Observed commands: npm run check (typecheck, lint, V1 suite including new cases),
npm run build and npm run test:release all exit 0 on the final candidate; separate
search_snippet_email_admission, official_phone_recall and
historical_evidence_preservation checks pass. The expected injected ENOENT errors
in persistence tests are controlled failure checks, not production DB errors.
Frontend chunk-size warning remains. No live restart or operational-data writes.

Remaining acceptance is substantial: unknown/unlabelled evidence still follows
marked legacy admission (scope unknown, never labelled local); this does NOT
complete required abstention policy. Proper-name matcher does not yet establish
all aliases/languages/structured country codes. Distributor blocks conservatively
stay related_entity for the rest of their source, possibly withholding later valid
facts. Parent/global role versus subsidiary role, complex/flattened office layouts,
matching facts repeated across representations, Hunter country scope, ingestion
acceptance/chunk extraction and cached persisted overlays require further work.
No real-company/provider, actual API/UI/export, restart-cache invalidation,
packaged runtime or source-scoping performance acceptance is established here.
Next slice: strict unknown-evidence admission and relationship/provenance contract,
then isolated persisted API/export and rendered comparison. Keep CC01–CC03 open.

Commit 2a4f352 reconciles this authoritative matrix/phase order; it completes the
ledger-reconciliation subtask, not product release acceptance or all REL01 work.
The integration worktree was clean at initial inspection, HEAD 75e8cac, and no
other session is credited with implementing or approving this checkpoint.

New in-progress fixture server/tests/company_country_field_scope.test.ts exercises
the actual projectDeterministicContactFields function using isolated synthetic
results on one shared domain. Executed:
`node --import tsx server/tests/company_country_field_scope.test.ts` → exit 1,
all four assertions fail: Kenya inherits Pakistan parent email; Sudan inherits
South Sudan email; a global office page combines local/foreign email; a distributor
reference supplies the entity mailbox. This is red reproduction evidence, not a
passing regression or complete Phase 1 fix. No provider call, dataset write, live
restart, telemetry transmission or manual contact injection occurred. The fixture
remains in-progress and is not yet wired into the green V1 suite. Next patch must
preserve legitimate Kenyan content on parent domains and field/source provenance,
and must handle mixed-page and relationship scope rather than merely filter URLs.

MS01 official-source check (2026-10-25): Microsoft currently states both Individual
and Company registrations have no registration fee **in its new onboarding flow**,
entered through https://storedeveloper.microsoft.com/. Individual/business account
selection and required verification differ. This does not establish this owner's
account, eligibility, business verification or publication approval. Official guide:
https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account?tabs=individual
Microsoft recommends MSIX and describes Store-hosted signing/hosting/update
facilities: https://learn.microsoft.com/en-us/windows/apps/publish/get-started
Provisional preference is Store-managed MSIX, subject to actual account/product
acceptance; signed owned-feed MSIX remains an alternative, not a second updater
to implement in parallel. No signup, agreement, submission or publisher attestation
was performed. Sensitive account participation is deferred to the explicit browser
handoff once packaging and account verification are the active dependency.

## Anonymous installation identity for diagnostics — 2026-10-24

This path existed on no branch: `main` after the merge has no install identity and none of the
other agents' worktrees contain one, so it is landed here. Telemetry stayed out of this slice
entirely — it belongs to the other agents and three of their telemetry files already run in CI.

`server/install_identity.ts` mints a random UUID v4 per installation and stores it in
`data/installation.json`. The write is `tmp` + `wx` + `rename`, so a crash cannot leave a
half-written identity, and a file that is unparseable or holds a value that is not a UUID v4 is
replaced rather than propagated. `getInstallationIdentityPath()` follows the same test isolation
as the other writable runtime files (`EDGEVIEW_TEST_DB_DIR` / `EDGEVIEW_JSON_DB` directory), so a
test process can never mint an identity inside the real installation. `/api/health` now reports
`health.app.installation_id`; it is random, not hardware-derived or account-linked.
`scripts/doctor.mjs` replaced `device_identity: SKIPPED ("not yet implemented")` with a real
check: PASS on a well-formed UUID v4, FAIL when the file exists but does not hold one (the
operator cannot trust correlation), WARN when absent because the backend has not started yet.

Evidence:

- `node --import tsx server/tests/install_identity.test.ts` —
  `PASS installation identity: creation, restart, corruption, reset and test isolation behave`.
- `node scripts/doctor.test.mjs` —
  `PASS doctor states, locked dependencies, offline failure, safe output and full-check orchestration`,
  now covering all three identity states including `exitCode 1` on the corrupt file. The doctor
  fixture id is a deliberately synthetic UUID (`00000000-0000-4000-8000-000000000001`) so it can
  never be confused with the developer machine's real value.
- Live probe against the rebuilt `dist/server.cjs` with an isolated environment:
  `HEALTH IDENTITY PROBE: PASS id=ca7a475a-1716-47d4-829a-335225edcc4e` — the id appears in
  `health.app.installation_id`, is persisted in the isolated directory, and is stable across two
  calls.
- Mutation matrix, with both baselines restored before each mutant so nothing compounds:
  `shape_check_off` and `isolation_off` each fail only the identity test; `doctor_skipped` fails
  only the doctor test. After restoring, both tests pass and both files are byte-identical to
  baseline.
- The developer installation was not modified. `data/installation.json` already exists in the
  real project root (created `2026-10-23T06:40:06Z`, before this slice); the identity test reads
  it before and after resolving the isolated path and asserts byte-for-byte equality, so the run
  proves the isolated accessor never writes there.
- `npx tsc --noEmit` and `npx eslint` clean on the touched files.

Not claimed here: the identifier is anonymous and local-only, and nothing in this slice sends it
anywhere — there is no diagnostic upload path wired to it. It has not been verified against a
running browser session, only against the HTTP health endpoint.


## Activity endpoints no longer hydrate evidence bodies — 2026-10-24

Both /api/logs/enrichment and /api/enrich/activity-log now use a shared
activity-only reader of persisted timeline metadata, not map(getV1Run) retaining
twenty fully hydrated runs. Response tail defaults to 500, clamps to 1–1,000,
selects newest events within the existing latest-20-run activity scope, and
advertises that scope in X-EdgeView-Log-Scope. Historical identity discovery and
full getV1Run/evidence integrity behavior are unchanged. Corrupt/missing timeline
files yield explicit current read-failure diagnostics with RUN_TIMELINE_READ_FAILED;
these do not modify immutable runs or invent historical provider calls.

PASS: activity_log_no_hydration with 25 persisted runs and multi-megabyte raw
payload, blocked blob reads plus a positive full-reader control, legacy inline
fixture, repeated bounded reads, newest ordering, unchanged immutable checksum,
all 25 historical identities and explicit malformed-timeline failure. First
positive-control assertion expected an unwrapped probe error; corrected to
verify the real V1_BLOB_INTEGRITY_ERROR and exact probe cause, then rerun.
PASS actual HTTP on both aliases: corrupt raw blob leaves timeline available,
full evidence endpoint still fails closed, tail/scope/order are correct, corrupt
timeline is observable and backend stays healthy. Full checks, typecheck/lint,
production build/release smoke and four rendered E2E cases also passed (29.8s).

Limits: each persisted metadata JSON is still parsed; legacy runs with inline
raw bodies can therefore still require large reads. Other full-run consumers,
global summary/header-cache scaling, long memory/leak workloads, populated live
log UI, monitoring delivery, Settings persistence QA and live deployment remain
open. This removes a demonstrated hydration/retention path, not all memory risk.

## Activity-log failure truth and V1 schema mapping — 2026-10-24

Trace: existing /api/logs/system returns runtime log records; existing
/api/logs/enrichment returns immutable V1 timeline events with at/stage/status.
The old viewer expected timestamp/step/uppercase status, and swallowed failed
fetches into an apparent empty result. A new real-browser regression failed on
the old compiled code because no failure message was rendered after HTTP 500.

Viewer now shows loading and retryable failure separately from valid empty and
search-no-match results. It does not expose raw server errors or invent a zero
entry count when unavailable. Previously loaded entries can remain visibly stale.
Requests have a 30s deadline and abort/identity cleanup on refresh, tab change and
unmount. V1 at/stage and failed status map to timestamp/stage/ERROR; legacy
timestamp/step remains supported. Unknown values stay explicit. Projected buffer
is bounded at 1,000, final/rendered rows at 500 newest returned events, with bounded
field lengths. Source events and raw research evidence are not modified.

PASS: activity_log_projection uses actual V1TimelineEvent shape plus legacy,
malformed/empty/unknown/10,000-event ordering/bounds and input preservation;
runtime_log_security checks existing file/console/API redaction; full checks,
production build/release smoke and four rendered E2E cases (28.4s total).
The new browser case exercises 500 and malformed-200 errors, unknown count,
real empty refresh recovery, tab switch and search feedback. E2E test mode does
not install the runtime logger, so populated live/system log display is NOT
verified. Actual V1 timeline presentation is projection-tested, not a live-company
run or remote-support delivery test. React guidance informed bounded memoized
search and cleanup; no new logging framework or backend authority was added.

Open: enrichment log API still hydrates complete runs to extract timelines;
this frontend bound does not fix that backend memory path. Provider-toggle
save/restart QA, populated log/race/timeout UI cases, diagnostics architecture,
remote monitoring delivery and all remaining release gates remain open.

## Rendered failure recovery and contact export verification — 2026-10-24

Expanded isolated Playwright coverage to three cases, each with its own backend
process and private storage (one worker, no automatic retries). The earlier
worker-scoped fixture could inherit another test's files; test-scoped ownership
now prevents that contamination. Provider credentials/egress remain disabled.

PASS in actual Chromium UI: file HTTP 500 produces a visible retry state with
no stale buyer rows, fake empty result or injected private server message; an
incomplete HTTP 200 is rejected; restoring the real route and retrying shows
actual page-two Buyer 25. Country HTTP 503 and malformed importer detail both
show errors, then recover from actual backend responses. Failure screenshot
inspected. Only failed/malformed responses were injected, never successful data.
Console HTTP resource errors are retained and narrowly allowed in this failure
case; happy-path cases still require no page/console errors.

PASS rendered Contacts: exporter filter defaults report type to exporter,
explicit importer override works, reopen resets to current exporter scope,
selection/filter survive refresh, selected export defaults correctly and its
downloaded CSV contains Scope Supplier. PASS rendered Country overview cards:
60 importer-country entities, one exporter, $600 for the selected 60-row fixture.
This upgrades earlier source/API-only evidence for these exact scenarios, not
the real dataset or all controls. E2E typecheck and three-case suite passed
(25.8s total on the latest precommit run). Full checks/release smoke also passed.

Read-only live /api/health still reports PID 30112, commit
f96a6da068d44a8ed8d0d51aae4b017f96db3038, build
2143be7901f9d1806144f63311d99255e1be624d7fc61e2d272ca274b2e5a973.
It is NOT this branch's newly tested build. No Qoder-owned live server was
restarted or replaced. The prior GitHub status connector query returned 404;
hosted CI remains unverified. Historical exporter count discrepancies, real
enrichment, offline-while-open, races, settings/diagnostics and remaining release
gates are still open.

## First actual isolated rendered workflow — 2026-10-24

Added pinned development-only @playwright/test 1.64.1 (Apache-2.0, Node >=20;
CI Node 24). No application framework replacement or frontend dependency added.
One worker, no automatic retries, strict CSP retained, failure screenshot/trace
and console/page-error attachments, successful screenshot/build identity.
The compiled backend uses owned temporary storage, an OS-only environment
allowlist and a child-only HTTP(S)/fetch deny preload. Browser page traffic is
limited to its owned test origin. PID verification precedes mutations. No real
provider credentials, real dataset, live port-3901 server or paid run is used.

PASS locally: actual Chromium UI startup/upload of synthetic 60-row CSV, page 2
(Buyer 25), full CSV download with all 60 rows including Buyer 59, Enter/Space
country/importer expansion and rendered supplier, tab refresh and selected-file
persistence through a backend process restart. Successful screenshot inspected.
This is real rendered E2E evidence, NOT manual/live installation visual QA.

First run failed because the test expected HTTP 200 rather than the API's
correct 201 Created; corrected to exact 201. Second reached all workflow steps
but caught a connection-refused console event while we deliberately stopped the
backend under an open polling page. The restart scenario now closes the page,
restarts, and reopens in the same context; offline-while-open is a separate open
test, not a whitelisted error. Rerun passed (8.0s test / 11.5s total), with no
page/console errors. Build-ID and commit-shape assertions were added afterward.

PASS: E2E typecheck, existing full check, production build/release smoke,
production npm audit high gate (two existing moderate UUID/ExcelJS findings).
Windows CI browser job and synthetic evidence upload are configured as an
additional publish prerequisite; hosted result remains NOT VERIFIED until run.
See docs/BROWSER_E2E.md for official references, isolation and remaining scope.
Not exhaustive: settings/diagnostics, contacts/research/provider failures,
race/cap tests, scroll/page/accordion persistence, accessibility audit, long leak
testing, live-company truthsets, installer/update and clean-Windows gates remain.

## Country drill-down failure boundaries — 2026-10-24

Country/importer detail loaders validate response shapes and numeric fields,
encode scope identifiers, use a 30s deadline, and distinguish genuine empty data
from transport/schema failure. Failed requests cannot synthesize empty/partial
details from metadata-only browser rows. Complete scoped local copies retain
the existing fallback. UI exposes retryable error states. At most four detail
operations (a country operation has two HTTP calls) are in flight; duplicate
opens share the pending operation. Unmount cancels pending work and prevents
obsolete completion updates. Importer keys use unambiguous namespaced tuples.

Country/importer headers now have button roles, focusability, Enter/Space
activation, aria-expanded/labels and visible focus styling. These are source
changes, NOT a claim that actual keyboard/browser behavior has been exercised.
PASS: country_details synthetic success/encoded scope/malformed/500/offline/
zero/empty/timeout/cancellation, actual backend country/importer loaders in the
isolated stored_file_export fixture, npm run check, build/release smoke.
NOT VERIFIED: real rendered retries, request-cap behavior, unmount races or
keyboard interaction. Broader country export partial-row fallback and plain
object country-name cache key edge cases remain for independent investigation.
Visual QA and all other outstanding production gates remain open.

## Country overview uses its actual dataset scope — 2026-10-24

The existing /api/countries route now supports overview=1, returning the list
and aggregate cards from the same normalized backend rows. Legacy list callers
are unchanged. Importers are name/country entities (as in existing drill-down),
exporters are unique names across the scope, value is the sum of stored trade
rows, and zero is distinct from unavailable. No per-file summary counts are
blindly added into a fake unique global count.

CountryView uses that compact overview without loading row bodies. A selected
metadata-only file no longer falls back to another file's rows. Local fallback
requires all rows of every scoped file, proven against summary row counts.
Missing/incomplete overview gives a retryable unavailable state, not fabricated
zero. Initial request has a 30s deadline and abort cleanup. File-scope changes
remount file-specific country/importer caches rather than reusing another file's
drill-down state. Stable empty props avoid an effect refresh loop.

PASS: country_overview denominator/dedup/zero/unknown/schema and scoped static
markup; actual isolated overview API selected/all/empty/missing-file and legacy
list compatibility in stored_file_export; full check, build and release smoke.
The first all-files API assertion exposed built-in demo data in the isolated
test process; fixture setup now clears that owned process's demo files before
seeding, and the exact test passes. No production dataset was modified.
NOT VERIFIED: rendered cards or scope-switch interaction. Country/importer
drill-down network-failure fallback and keyboard access remain open; this slice
does not claim the entire Country view is audited. Existing normalization and
stored duplicate trade-row semantics are preserved, not reconciled here.
React guidance influenced stable defaults, memoized aggregates and scope keys.

## File page failure/loading/count truth — 2026-10-24

FileViewer now associates each server page with its exact file/filter/sort/page
request and retry generation. A changed request cannot render the previous
page's rows; obsolete requests are aborted and cannot replace current state.
Loading, failed and genuinely empty pages are distinct. A 30-second deadline
ends stalled loads and a Retry page action is available. Failed responses do not
expose arbitrary server error text. Both pagination labels use the effective
server count rather than sorted browser-local rows (previously zero).

The page boundary validates rows, exact page length/count and filter options;
an incomplete 200 response is a visible failure, not an empty-success fallback.
PASS: file_page_loading synthetic malformed/partial/500/offline/timeout/abort
cases and initial static FileViewer loading markup; stored_file_export now also
loads actual API page two (rows 25–49 of 17,612) through the new loader; full
check/build/release smoke. Initial typecheck caught union-narrowing/test promise
typing mistakes; corrected and rerun. No real browser interactions verified.
Remaining: rendered retry/navigation race QA, refresh/scroll persistence,
country totals/accessibility, full UI inventory and other release gates.

## Official-page phone recall corrected — 2026-10-24

Reimplemented the useful phone-recall portion of QA reference f527fe1, without
its unrelated selection/batch changes. Deterministic projection now accepts Cell
labels and unlabelled international numbers from successful resolved official
pages, including markdown-only content. Third-party profile attribution remains
restricted. Phone patterns cannot consume a date/postcode on the next line;
fax labels, wrong-country numbers and oversized numeric sequences are rejected.
Overlay version is 18 so historical projections can recompute from retained raw
evidence; no data was injected into operational records and no paid run started.

PASS: official_phone_recall (six expected unique channels plus adversarial
negatives), search_snippet_email_admission, historical_evidence_preservation,
official_page_body_budget, npm run check, production build/release smoke.
NOT VERIFIED: fresh Surgilinks or other live company run, resulting API/UI
display, the full importer dataset, or whether COMPLETE adequately communicates
coverage. This is projection recall improvement, not proof of exhaustive search.

Exact prior f6faae98cedf5c2331f25062636f6ac31ba3d2d8 package check passed
manifest/unchanged staged and extracted launch checks; build
e27188d3b237776f7bfc31d8dff89c074526d4c6d2da6bc96efcf45ceefc8e2d,
disposable ZIP SHA256 be59a28484c49f285d4a64e71e28efb93eefab1ced4e2ca6f5e44907b14327c8.
It remains a developer ZIP requiring Node/npm, not clean-Windows acceptance.
Supported Computer Use initialization was retried and failed before enumeration:
`failed to write kernel assets: The system cannot find the path specified. (os error 3)`.
No permission UI or browser control was obtained; visual QA remains open.

## Contact report defaults aligned — 2026-10-24

Both Contacts export actions now carry the current scope: Exporter -> exporter,
Importer -> importer, mixed/research filters -> both. The modal mounts a fresh
dialog per opening/scope, avoiding a stale previous report choice without a
state-reset effect. Explicit report choice remains available. Persisted contact
selections were not removed. Report buttons expose their selected state.

PASS: contact_export_scope (request defaults/override/selection and static React
markup), stored_file_export (actual isolated HTTP, 17,612 rows and five formats),
npm run check, production build and production release smoke. The first typecheck
caught test union-access errors; these were corrected and the full check rerun.
NOT VERIFIED: browser reopen/change/click behavior, downloaded report appearance,
the historical 633-versus-626 exporter discrepancy, or deployment on port 3901.
The React skill guided keyed state reset rather than effect-driven state drift.
This closes a narrow default-selection defect, not the full export/UI gate.

## Full stored-file export round-trip fixed — 2026-10-24

QA reference 948bcfe identified a useful server-owned export direction but was
not cherry-picked wholesale with its interdependent UI/scope changes. This branch
now wires FileViewer Export Full -> GlobalExportModal -> compact request builder
-> POST /api/export/file/:fileId -> exact db.files rows -> existing export manager.
No full-row prefetch or re-post through the browser; the 5 MB JSON limit stays.

Unlike the reference candidate, this endpoint enforces files-only authority and
rejects any client rows, selections, filters or unknown override fields. Missing
or empty files do not fall back to global data. Client selection/filter mixtures
fail visibly rather than silently exporting a wider file. Existing contacts and
filtered export request semantics remain unchanged. New route shares the export
admission budget and uses safe filename headers/validation and sanitized errors.

`stored_file_export.test.ts` uses an owned isolated actual server and synthetic
17,612-row file whose JSON exceeds 5 MiB, plus a separate sentinel file. Request
under 1 KiB produces all 17,612 CSV rows including the last, never the sentinel.
Oversized legacy request still gets413. Tests cover override rejection, missing
file, all five formats on a small file, generic contact selection compatibility
and actual modal initial markup showing the server record count without rows.
This is source/API/initial-render evidence, NOT a browser click/download proof.

Focused test, typecheck/lint/V1 suite, build and production release smoke passed.
No runtime/data changes on Qoder's original workspace or live installation.
Report column formatting stays the existing canonical full-dataset format;
lossless original-file backup/all-original-column export is not claimed. Browser
verification, very-large export concurrency/memory and live deployment remain open.

## Recovered work and privacy projection — 2026-10-24

Reopened available Advice 7/8 chats and compared the earlier reconciliation
against actual branch history. Updated RECONCILIATION_2026-10-10_23.md with dated
evidence instead of erasing old unfinished rows. Connector pages are bounded;
complete October 10–18 turn-by-turn retrieval is still NOT VERIFIED.

Latest coordinator QA reports unresolved full-file export/5 MB request failure,
duplicate pagination totals, contact-report scope mismatch, phone recall with an
overstated COMPLETE label, and missing country totals/keyboard semantics. The
separate QA worktree already has mixed uncommitted fixes touching these areas.
Do not duplicate or bulk-copy them. Its findings are attributed QA evidence,
not this writer's own browser pass. Reconcile/review coherent fixes when ready.

An isolated vendor-neutral boundary now exists in shared/monitoring_privacy.ts.
It builds new frozen, null-prototype output from fixed event/enumeration codes,
bounded numeric metrics and separately supplied build/installation metadata.
It drops arbitrary properties/messages, exception bodies/stacks, URLs, headers,
prompts, contact/business records and property-supplied operation UUIDs. Fixed
error messages retain useful error grouping without copying exception text.
Review found final-newline and UUID-provenance gaps; tests cover their correction.

Data egress classification for this boundary:

| Classification | Fields/policy |
|---|---|
| LOCAL ONLY | Complete local errors/evidence remain local; projection does not mutate them. |
| SAFE TELEMETRY | Fixed product-event/provider/stage/outcome/error codes; bounded HTTP/timing/resource numbers; validated build/version/channel. |
| PSEUDONYMOUS | Installation UUID from a trusted local protected-random identity authority; syntax validation here does NOT establish provenance. |
| SENSITIVE | Dataset/company/job identifiers, business totals, raw errors and paths: not accepted from event properties. |
| NEVER TRANSMIT | Credentials/tokens/cookies, contacts, raw files/rows/evidence/provider bodies/prompts, raw HWID. |

Focused adversarial tests retain approved metadata (empty-output implementations
fail utility acceptance) and reject private markers, malformed/newline identity,
unknown/inherited codes, UUID-shaped business IDs, getters/toJSON, revoked proxies,
numeric boundary violations and deeply nested inputs. Arbitrary JavaScript Proxy
trap execution is not sandboxed; thrown errors fail closed. Identity provenance
is a caller prerequisite, not a claim of this pure projection.
The same provenance requirement applies to numeric measurements: a type/range
check cannot identify a phone number relabeled as RAM. Real integration must use
trusted resource/timing collectors, never arbitrary provider/business objects.

Status: privacy MODULE PARTIAL for full monitoring. No SDK imports, initialization,
credentials, network activation or product call-site wiring added in this slice.
Re-ran the original Qoder adapter probe read-only: same source SHA256
1c6ed5e7eef5f83213b7c7efc35e9036ebd3dabee6c2822b417aab2b31dcd15b,
all nine leak probes still FAIL. Do not enable it. Final SDK envelopes/batches,
automatic errors/logs/traces, replay-off enforcement, bounded offline transport,
actual Sentry/PostHog delivery and Diagnostics UI integration remain unfinished.
Focused projection test, typecheck, existing V1 suite, build and production
release smoke passed for this slice; no rendered or remote-delivery PASS implied.

Recovered requirements are still open, in acceptance order: actual enrichment
recall/provenance and scope/UI fixes; full export behavior and rendered QA;
privacy-safe integrated monitoring; restore/crash/performance/long-run gates;
self-contained Windows installer, trusted update/acceptance/rollback/signing;
exact three final artifacts, clean Windows and Stable end-user deployment.
Earlier all-provider/unbounded-research ideas are superseded by current bounded
V1, not abandoned features to resurrect. No release readiness claim.

## Parallel ownership and parser dependencies — 2026-10-24

Owner confirmed Qoder writes only the original Pharma-AI workspace and
`edgeview-chatgpt` is exclusively ChatGPT's worktree. Resume this branch without
editing or merging Qoder's dirty tree. Existing commit 0652b15 was independently
inspected/tested and retained, not recreated. Its focused AI destination,
connection binding, diagnostic-payload and credential-origin checks pass.
Real unauthenticated model endpoint checks previously reached NVIDIA (200)
and Groq (401); this is NOT verification of saved credentials or live UI.

Production audit newly failed on body-parser1.20.8 (GHSA-27r3-jxmh-p828) and
multer2.4.0 (GHSA-q7qp-rjg7-q26m). Narrow refresh keeps Express4.22.3, resolves
body-parser1.20.9 and multer2.5.0, and raises the direct Multer floor. Current
upload filter is synchronous, so the Multer advisory's asynchronous-filter
prerequisite was not demonstrated in EdgeView. No forced ExcelJS downgrade.

The compiled-server release smoke now sends valid gzip/deflate (must reach
routing), compressed frames plus trailing garbage, and a staged deflate request
whose trailing bytes arrive after the response begins. After delayed decoder
errors it checks server liveness. These follow upstream failure classes; the old
package crash was not independently reproduced before upgrading. Independent
review prompted the staged-timing and stricter valid-frame controls.

Local `npm ci --ignore-scripts` FAILED on a Windows-locked Rollup native file and
temporarily left dependencies incomplete. `npm install --ignore-scripts`
repaired them successfully, with a leftover locked cleanup-directory warning.
After repair: installed versions verified, typecheck/lint/V1 suite, upload HTTP
regressions, build and expanded production release smoke PASS. Production audit
at high threshold PASS, but two MODERATE uuid/ExcelJS findings remain. Clean
reinstall on this workstation is not marked PASS; hosted clean-install evidence
for the new commit remains pending. No live app restart or production-data
change was performed. Windows customer/runtime/visual/update gates remain open.

## Migration recovery retention reconciled — 2026-10-23

Frozen Qoder pruning was reimplemented, not copied: it ran before migration
success, hard-coded `edgeview.db` and followed links. The active branch previously
had no pruning. New retention runs only when this initialization created a
backup AND the migrated database was durably written, reopened, integrity-checked
and schema-checked. Keep immediate recovery plus two newest other exact numeric
backup names for the actual DB basename (timestamp/name deterministic ties).
Current-version restart does not prune. A failed schema/write/reopen attempt
does not delete any recovery image. After a later successful migration, older
failed-attempt images may be pruned: filenames do not permanently classify them.

The helper skips linked ancestors, junctions, hard-linked/nonregular entries,
malformed/unrelated names; rechecks file identity before unlink. Cleanup failures
are counted/warned without failing a successful migration. This is not protection
against a malicious concurrent Windows-account filesystem writer or power-loss
certification.

New `migration_backup_retention.test.ts` runs actual sql.js migration/reopen with
alternate metacharacter basename, preserved legacy row/bytes and more than three
backups, plus schema failure, controlled ENOSPC write failure, reopen denial,
current-schema restart, ties, junction/hardlink boundaries and deletion denial.
Passed alongside existing initialization safety test, typecheck/lint/V1 suite,
build and production release smoke. CI explicitly runs the new regression.
No production database was changed. Full restore transactionality, crash/power
recovery, installer rollback and clean-Windows verification remain open.

## Shared export admission budget — 2026-10-23

The prior compiled app allowed repeated GET export generation outside the
mutation budget; the new release regression failed on that behavior before
implementation. All `/api/export` formats/methods and the importer-statistics
CSV export now share a fixed 24-request/60-second process-local budget before
generation/body parsing. Counter storage is constant-size; failed/unsupported
requests in these export namespaces also count. Restart resets the budget.

Independent review discovered an initial double-slash stats-mount bypass.
The corrected guard mirrors the nested Express mount, and compiled-server
tests now cover that bypass, uppercase/trailing aliases, encoded importer,
GET/HEAD/POST/OPTIONS, shared exhaustion, structured 429/Retry-After, ordinary
CSV/stat downloads and unaffected health/file reads. All five unified download
formats remain checked by the same release smoke. Typecheck, lint, V1 suite,
build and expanded release smoke passed. Timed window rollover was inspected
in source, not exercised by waiting a real minute. This is admission throttling,
not proof of concurrent-export memory safety or long-duration load stability.

## Missing/ambiguous Host rejection — 2026-10-23

Raw HTTP against the previous compiled app reproduced missing Host acceptance
(HTTP 200). First global middleware now requires exactly one raw Host header
and an exact allowed local authority; optional absent Origin remains supported.
Independent security review found no blocking bypass/regression. This closes
an admission-policy gap, not demonstrated browser credential theft.

Expanded production release smoke exercises HTTP/1.0 and 1.1 absent/empty Host,
duplicate mixed-case header names in both orders, absolute-form and OPTIONS
asterisk targets, allowed local authorities, foreign authorities and null Origin.
Typecheck/lint/V1 suite/build/release smoke passed. These are isolated compiled
server checks, not live browser QA. Default loopback binding is source-inspected;
the existing HOST environment override remains and was not changed here.

Supported Windows and browser QA initialization both retried and failed before
session enumeration with `failed to write kernel assets: The system cannot find
the path specified. (os error 3)`. No permission UI appeared. Passive live health
still reports PID 30112, frozen workspace, commit f96a6da and build
2143be7901f9d1806144f63311d99255e1be624d7fc61e2d272ca274b2e5a973:
recent branch fixes are not yet deployed there. Do not label this live QA PASS.

## Upload filename boundary — 2026-10-23

Reproduced bare `csv` acceptance on all four multipart aliases before changing
the shared router. Exact multipart names now require a supported real suffix;
paths, controls, trailing Windows-normalized characters and reserved device
names are rejected before buffering/parsing/hash lookup/persistence. No filename
trimming or silent path repair. Legacy multipart clients sending a full
`C:\fakepath\...` name are deliberately rejected; modern browser File names
remain supported.

`upload_extension_validation.test.ts` exercises the actual shared HTTP router
on all four aliases, unchanged JSON/SQLite/in-memory state after rejection,
ordinary and extended multipart filenames, Unicode, valid CSV/NVL/XLSX,
deduplication bypass attempts and malformed XLSX. Focused test, typecheck,
lint, V1 suite, build and production release smoke passed. CI runs the focused
test explicitly. This is not browser upload QA or a clean-Windows gate; those
remain open. The frontend bundle-size warning remains unresolved.

## Ownership resolved; official-page capture and contact UI — 2026-10-23

Owner identified the earlier concurrent writer as the coordinator/QA ChatGPT
conversation and explicitly stopped its repository writes. ChatGPT Desktop is
sole writer; coordinator is read-only QA. The three handed-over diffs were
inspected separately, not bulk-committed. Earlier writer-block notes below are
historical. Frozen Qoder workspace remains untouched.

- 49a5449: successful search evidence only for snippet/domain projection;
  snippets must contain official-domain/subdomain emails, not arbitrary free-mail.
  Official-page published free-mail remains supported. Adversarial failures were
  reproduced before correction. Hosted release checks run 39923794099 completed
  SUCCESS, Docker/verify SUCCESS, publish SKIPPED. This is not release acceptance.
- 584d0b5: retained useful coordinator proposal with fixes. Generic direct reads
  remain 2 MiB; resolved official crawl gets 4 MiB only on matching domain/hops.
  External redirects fall back to 2 MiB. Page count, deadlines, DNS pinning and
  private-address rejection are unchanged. Every direct attempt now has its own
  response/failure and normalized-result reference; the regression exposed prior
  suppression of the second failure when a URL was attempted twice.
  Synthetic actual-engine/transport/storage/projection regression covers 3.67 MiB
  tail contacts/leadership, exact 4 MiB, declared/chunked/multibyte overflow,
  cross-domain and subdomain redirects, private DNS, repeated failures and 503
  response bodies. Existing outbound/crawl regressions passed.
- 8be3f04: shared classification makes summary, Contacts filters and bulk retry
  agree. Pakistan exporters are excluded even if historical research exists;
  All Companies/export still retain them. Excluded summary dispatches EXCLUDED,
  not UNRESEARCHED. Summary actions are keyboard-native buttons. Explicit saved
  ENRICHED selection survives remount instead of being migrated repeatedly.
  Actual isolated summary API, initial rendered row matrix and callback tests
  passed. Categories measure retained state, not verification of contact truth.
- e626e4d: separate directory pagination recovery with fixes. At most 100 rows
  are projected/rendered; country boundaries do not drop/duplicate rows. Page is
  restored from a versioned UI preference, not reset on every data replacement;
  loading cannot overwrite it before rows arrive. Empty/invalid/denied-storage
  initial rendering covered. Country header distinguishes page count from total.
  Browser navigation, refresh effects and scroll position remain NOT VERIFIED.

Live transport check using the engine's existing headers on this date: Emerchemie
homepage HTTP200/3,675,830 bytes; contact-us.php HTTP200/3,668,585 bytes;
leadership.php HTTP200/3,677,672 bytes. All fit the new ceiling. A preliminary
request without those engine headers returned HTTP406; this is not hidden as
successful content retrieval. No manually fetched data was injected into EdgeView.
These checks do not prove live enrichment, accurate company projection or UI
display. Final-URL/source attribution remains a separate open provenance review;
body-budget scoping is not full redirect-origin trust verification.

After the final UI changes: typecheck/lint/V1, build and isolated release smoke
passed. Focused official-body, contact-scope, directory-presentation and actual
summary/export endpoint tests passed on e626e4d. Exact clean e626e4d package QA:
buildId 5f1d485f95944f83824398badfad4f98b23e6f6f14c95abdbb97dae1144763f3;
manifest 147 files, staged/extracted unchanged-launch PASS, private-state filename
check PASS. Disposable ZIP SHA256
885d5bd1c346db7d29bf2416cef5792ecc188ab3f0b7cab49708b65067e14a77.
117 developer files remain; installed Node/npm required. NOT customer distribution,
not a content secret scan, not clean Windows or browser acceptance. The 514 kB
client chunk warning persists; no leak/performance clearance is implied.

Remaining gates are not removed: upload filename correction/tests, frozen security
and recovery work, telemetry privacy and real delivery, rendered QA/truthsets,
live deployment identity, real importer reconciliation, installer/update/signing,
clean Windows and uncle deployment. Verdict remains NOT READY.

## Sole-writer handoff and package QA — 2026-10-23

HTML export recovery: de8aeb3 contains only the renderer, exact route/import/error
hunks, focused helper/actual-endpoint tests, and their two CI lines. Useful frozen
renderer/layout recovered with fixes: parsed HTTP(S), pre-trim C0/DEL rejection,
five-character HTML escaping, noopener/noreferrer. Endpoint regression failed
against the old route on executable markup and passed after the patch. Actual
isolated source-server test covers fields, quotes, schemes, controls, multilingual
text, headers, filtering/empty selection and sanitized failure. Broader check,
build and release smoke passed during development; downloaded rendering remains
NOT VERIFIED. Supported Computer Use initialization retried and still failed
before window enumeration: kernel-assets os error 3, no permission UI.

An unrelated external edit appeared in active server/job_manager.ts during these
checks. It was left untouched, unstaged and excluded from de8aeb3; owner asked to
stop any other writer. Its contact-admission change is not accepted or verified.
Therefore whole-tree/exact-commit packaging acceptance must be rerun once the
tree is reconciled; do not attribute the mixed-tree broad checks to a clean
release commit. No edits were made in the frozen Qoder workspace.

Qoder retired by owner instruction. Active source authority remains the
chatgpt/release-reconciliation-20261023 branch in edgeview-chatgpt. Frozen Qoder
workspace remains read-only at ef1c074 with eleven modified and eleven untracked
files; none bulk-imported. Earlier parallel-ownership notes below are historical.

e2ddbb4 adds isolated developer-package QA. Exact tested source and limitations
are recorded in ISOLATED_PACKAGE_QA.md. Manifest (143 files), staged/extracted
unchanged-launch checks and private-state filename exclusion passed. Customer
distribution remains OPEN: 113 development files, installed Node/npm required.

Vite dependency remediation candidate raises the npm minimum to ^6.4.4 and lock
to 6.4.5. Clean npm ci completed; installed bytes now report 6.4.5. Before clean
installation, npm metadata misleadingly reported the new version while actual
package bytes remained 6.4.3; initial checks/build are not upgrade evidence.
After clean installation: installed/lock regression, high-threshold production
audit, typecheck, lint, V1 tests, production build, isolated release smoke and
build-recovery test passed. Audit still reports two MODERATE ExcelJS/UUID entries;
no force downgrade applied. Historical bun.lock remains stale and is NOT an
approved/reverified installation path. No live deployment/browser/clean-machine
acceptance is implied. Telemetry privacy failures and other release gates remain.

## Parallel release reconciliation branch — 2026-10-23

Exclusive worktree edgeview-chatgpt; branch
chatgpt/release-reconciliation-20261023. Main/Qoder dirty files untouched, no
merge/live restart. These branch commits require review/integration and do not
certify deployed behavior:

- b6b8cdc: Oct10–23 matrix in RECONCILIATION_2026-10-10_23.md. Git begins Oct19;
  bounded earlier chat/report coverage explicitly incomplete.
- e877303: independent license inventory/security evidence workflow and
  Dependabot configuration. Default-branch activation/security entitlement not
  inferred. Metadata warns for unknown/copyleft, no legal approval.
- b244158: bounded A–K evidence-reference checker; hashes/gates cannot grant
  release acceptance. Synthetic adversarial tests passed.
- 275fc01: MSIX/update decision record identifies root-writable state and
  Node/npm-dependent ZIP blockers; not an installer or tested rollback.
- 1448db1: read-only offline probe of Qoder telemetry source SHA identifies nine
  synthetic privacy leaks. Do not enable customer telemetry until strict boundary
  and SDK envelope/delivery acceptance. See OWNER_SUPPORT_PRIVACY_HANDOFF.md.
- 42ed139: hosted inventory success at275fc01, but Windows audit failure;
  current production-lock audit reports1high/2moderate (Vite6.4.3/uuid/ExcelJS).
  Qoder owns dependency remediation; audit thresholds not weakened.
- f486754: bounded exact-version license-text collector/tests;397entries with
  legal files/16without/101not installed. This is not complete notices or runtime
  inventory. See LICENSE_TEXT_EVIDENCE.md.

Live GET health now reports PID30112, build commit f96a6da and buildId2143be79…;
newer source fixes are not certified deployed. Computer Use still fails during
kernel initialization before app selection. See LIVE_RELEASE_DRIFT_2026-10-23.md.
ResearchWorkspace async selection/error UX now has a branch source fix and
focused request/initial-markup regressions; check/lint/V1/build/isolated release
smoke passed. See RESEARCH_READ_RECOVERY.md. Actual rendered interaction,
integration, live restart and package verification remain unverified. All A–K,
real-company UI truthsets, clean Windows, updater, monitoring account delivery,
private data separation and uncle deployment gates remain open. NOT READY.

## Working-tree cleanup slice D — run-cache truncation removed — 2026-10-23

Reviewer verdict: do not ship current cache truncation. Removed, not redesigned:
`MAX_V1_RUN_CACHE_ENTRIES`/`trimRunCaches()` never entered git and are now
absent from the working tree entirely. The original concern understated the
defect: `listV1RunIdentityHeaders()` rewrote identity-index.jsonl from the
truncated in-memory array, which would have permanently dropped discovery
history past 5000 entries — worse than a RAM bound. Run caches are again
whole-process indexes over the immutable per-run files, matching pre-cleanup
behavior. Unbounded-growth risk is accepted until a redesign that bounds memory
without losing discovery is independently reviewed. Verification: grep confirms
absence across the repo; typecheck and focused v1_requirements, v1_blob_storage
and v1_atomic_persistence tests pass. No commit contains D hunks; the upcoming
slice B commit on server/v1_engine.ts is the reviewable proof of absence.

## Delimited-text allocation boundary — 2026-10-23

CSV/TSV/TXT and analogous text NVL now reject fields beyond 512 columns during
tokenization and charge padded row width plus 24 alias/default slots before row
construction against a fixed two-million-cell budget (also 100,000 row ceiling).
Limit errors propagate through NVL fallback catches and return no partial rows.
The existing upload API returns 422 FILE_PARSE_FAILED before summary/persistence.
Rejected limits require splitting the input, not silent truncation. These are
local deployment safety limits, not a claim of unlimited file size or scale.

Parser-only regressions passed for oversized headers/later rows, cell-budget
exhaustion, CSV/TSV/TXT/NVL propagation, duplicate/empty headers, quoted delimiters
and all 17,432 synthetic trade rows. Existing deduplication/grouping tests passed.
Independent boundary investigation and one fresh patch review found no concrete
surviving scoped issue. Typecheck/lint/V1/build passed. The new release fixture
initially used its request helper before initialization; corrected and rerun:
release smoke passed, including 422 and unchanged persisted file list. CI runs
the focused parser suite. No live dataset/provider request was used for this fix.
Binary DBF and compressed XLSX/DOCX expansion are separate unverified boundaries;
this change does not claim to remediate them or improve existing CSV syntax.

## Export path boundary increment — 2026-10-23

Contact ZIP exports no longer incorporate download names into filesystem paths.
Request and direct-processor validation reject separators, drive/ADS syntax,
controls and Windows-invalid filename characters. Each export owns a unique
temporary directory with opaque exclusive filenames; logical Unicode ZIP names
are retained separately. Outer finally cleanup includes partial writes.
Focused regression covers malicious prefixes, direct entry points, concurrent
isolation, partial-write cleanup, outside-file preservation and readable archives
for all four contact report modes plus full-dataset export. Synthetic empty trade
indexes avoid production history/provider access. Independent patch review found
no concrete surviving bypass/regression. Typecheck/lint/V1, production build and
release smoke passed. These are not rendered download/browser tests.

Supported Windows Computer Use initialization was retried on 2026-10-23. The
JavaScript host failed before app enumeration with: `failed to write kernel
assets: The system cannot find the path specified. (os error 3)`. No permission UI
or screenshot was returned; no bypass/alternate-port approach was attempted.

## Paginated export increment — 2026-10-23

Filtered export now uses server result count rather than the empty metadata row
array and explicitly collects every matching page with the active search,
country/importer/product/date filters, grouping and sort. Collector-owned paging
bounds override caller parameters. Country reports load each selected source
instead of substituting unrelated cached rows; page failure stops before opening
the export modal. Full-file export also stops visibly on fetch failure. Busy
states prevent repeat submission during collection. React review kept this work
in click handlers (no automatic fetch effects or new polling).

Focused paging tests exercise 1,503 matching rows, preserved Unicode/filter/sort
parameters, paging overrides, failed/empty/changing responses and unchanged caller
options. Typecheck/lint/V1/build/release smoke passed. Actual button clicks,
large-dataset browser memory and rendered downloads remain unverified because
Computer Use initialization fails before app enumeration. No enrichment/provider
calls or production records were changed by these export tests.

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
