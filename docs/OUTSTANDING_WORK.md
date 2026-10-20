# EdgeView completion ledger — 2026-10-20

This ledger reconciles the requested work. Source/tests, deployed behavior, and
visual verification are separate gates. Earlier progress reports are not proof.

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
| GitHub and CI/CD | Private MuhammadAsim8528/edgeview-v1 created, main pushed. Windows + Docker QA and gated version-tag Windows releases configured. First hosted run failed; investigate actual logs before shipping/tagging. |
| Docker | Non-root isolated QA image built; offline release smoke passes. Not a supported Linux production replacement for Windows DPAPI. |
| Local live deployment | Restarted same-root production build on port 3901 after confirming no active jobs; health PID 31216 verified. expconfig.nvl still listed; config protected without printing secrets. Future source changes need build/restart; not every UI behavior verified. |
| Performance | Prior bounded load checks are documented; repeated large-dataset/browser memory and full enrichment measurements remain. No modest-hardware or million-row readiness claim. |
| Documentation and final handoff | Architecture/control/security/operations/delivery docs exist. Final report must name exact exercised behaviors, provider coverage, limitations and launch steps. |
| HWID/no-cloud concept | Licensing design document only; not verified implemented authentication or a public-service security model. No cloud deployment or multi-user readiness claim. |

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
| 24, 29: release / CI | EXISTING Windows and Docker QA, cold-package checks, checksums and tag-gated delivery. BLOCKED release: hosted Windows credential transport timeout investigation remains; no skipped encryption gate. PLANNED SBOM/audit attachments, signing evaluation, clean-shutdown proof and supported E2E gate. No release tag until acceptance passes. |
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
- [ ] M2: Close security/database/contract/recovery gaps with regression tests.
- [ ] M3: Independent company truthsets and normal-user rendered enrichment QA;
  reconcile all importer scope, weak records and resource measurements.
- [ ] M4: Privacy-safe diagnostic export; evaluate crash/trace/analytics tooling,
  activate nothing externally without a concrete configuration/privacy boundary.
- [ ] M5: Packaged runtime E2E, clean restart/update/restore proof, passing hosted
  CI and factual release handoff. Conditional cloud/device/WebView tasks stay
  explicitly conditional rather than being silently omitted or falsely completed.
