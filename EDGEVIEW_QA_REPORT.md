# EdgeView V1 production QA report

## 2026-10-18 release-hardening addendum

- Replaced the legacy Settings screen with a V1-only surface for Serper, Hunter, NVIDIA NIM, and Groq. Disabled experimental providers are no longer shown as live options.
- Enforced the same four-provider allowlist on the settings-test API and health response; legacy provider test requests now return HTTP 400.
- Added loopback Host and Origin enforcement, CSP and browser security headers, local mutation rate limiting, hidden framework identification, and a 5 MB structured-body limit (file uploads retain their separate 50 MB limit).
- Added an isolated production smoke test covering startup, headers, origin rejection, provider allowlisting, and secret redaction.
- Added Windows CI for install, typecheck, V1 tests, production build, release smoke, and packaging.
- Collapsed the upload target after a dataset is loaded and reduced file-view padding/spacing so the grid begins higher in the viewport.
- Added a deferred privacy-preserving offline HWID licensing design; no unapproved license gate was introduced.
- Updated vulnerable transitive packages and removed SheetJS `xlsx`, which had an unfixed high-severity advisory. Excel parsing/export now uses ExcelJS; `.xls` uploads are rejected in favor of `.xlsx`, formula-leading exports are neutralized, and dedicated parser/export regressions pass. The production audit has no high or critical findings; moderate transitive advisories remain in Mammoth and ExcelJS dependency trees.
- Expanded package exclusions to include local `.antigravity` metadata after a secret-pattern audit found that directory could contain machine-local material.
- Rebuilt `C:\Users\asimh\outputs\EdgeView-V1-Windows.zip` and verified the live production health contract on port 3901.
- Live provider checks: Serper, NVIDIA NIM, and Groq verified successfully. Hunter credentials are valid but the billing-period search quota is exhausted, so Hunter was disabled without deleting its key and Serper remains the active deterministic retrieval provider.
- Local read-load smoke: 240 requests, concurrency 12, zero failures, 656 ms p95, 3.1 s maximum, RSS 143.5 MB to 183.9 MB.

Computer-use remains blocked by the saved localhost browser-control permission. The UI is visibly open in the in-app browser, but this addendum does not claim a new button-by-button automated click pass.

Date: 2026-10-11  
Installation: `C:\Users\asimh\antigravity\Pharma-AI-File-Viewer-2026-08-13-3b80f`

## Final human-interface regression pass

- Operated the live application in Chrome at `http://127.0.0.1:3901` using normal clicks, tab changes, scrolling, refresh, and backend restart.
- Verified Contacts exposes all 2,724 company entities, 2,092 researched importers, 1,176 profiles with contact details, 916 profiles needing deeper research, and 632 excluded Pakistan exporters.
- Verified Emerchemie and Slim Pharmaceuticals appear with official domains, multiple contacts, leadership, phones, and evidence access.
- Verified Research loads retained V1 queries, normalized results, raw records, failures, and timeline data.
- Verified active navigation survives browser refresh and backend restart without forcing the Research tab.
- Removed disabled experimental providers from the Settings telemetry surface. Only Serper, Hunter, NVIDIA NIM, and Groq are shown for V1.
- Replaced invalid legacy log dates with an explicit `Time unavailable` state.
- Added display-time decoding and duplicate-text compaction for historical email, address, phone, person, and designation values without mutating immutable source evidence.
- Prevented misleading zero importer totals in Country View when large file rows are not resident in browser memory.
- Re-ran TypeScript validation, the production build, and all V1 requirement, identity-quality, and dataset-provenance suites successfully.

Known limitation: old enrichment events created without a valid timestamp cannot be assigned a trustworthy time retrospectively; the interface now labels them honestly rather than inventing one.

## Release scope

This release validates the frozen V1 flow: exact company and country in, compact AI-generated identity queries, deterministic retrieval/capture/storage/normalization, evidence-linked UI display, and resumable bounded batch processing.

## Automated checks

| Check | Result |
|---|---|
| TypeScript compile (`npm run lint`) | Pass |
| Requirement-driven V1 tests | Pass |
| Identity-quality regression tests | Pass |
| Dataset-provenance tests | Pass |
| Production client/server build | Pass |
| Windows package secret/state exclusion audit | Pass |
| Fast no-change launch/build check | Pass |

## Live operational checks

| Scenario | Observed result |
|---|---|
| Server cold start | SQLite file loaded, V1 overlays hydrated, job state initialized, port 3901 healthy |
| Interrupted job recovery | Completed count preserved; only interrupted work returned to pending |
| Job stop and resume | Resume continued from persisted checkpoint without resetting completed work |
| Provider allowlist | Serper/Hunter/Groq/NVIDIA active; Firecrawl/Tavily/Exa/Linkup/Apify/Gemini remained at zero requests |
| Raw evidence retention | Provider payloads and structured failures retained in immutable run records |
| Disk-pressure behavior | ENOSPC was detected during QA; job was stopped, unrelated cache space was freed, checkpoint was verified, and processing resumed without deleting evidence |
| UI navigation contract | Enrichment source contains no active-tab mutation; persisted tab/file/sidebar state compile and build successfully |
| Desktop deployment | Symbol-only logo, multi-resolution ICO, desktop shortcut, conditional rebuild launcher, and health-gated browser open installed |
| Repeated launcher click | Detected the healthy port-3901 instance, opened it, and exited successfully in 3.3 seconds without starting a conflicting server |
| Live UI-facing API smoke test | 15/15 major read contracts returned HTTP 200; company-directory response was the slowest at about 2.0 seconds for 2,724 profiles |

## Representative identity regression

Emerchemie NB Ceylon Limited was rerun through the public enrichment endpoint. The official site resolved to `https://emerchemie.lk`; historical evidence was preserved across refreshes and multiple public emails, phone variants, address variants, and named managers remained available instead of being erased by a weaker later run.

## Full-dataset completion evidence

- Dataset: 17,612 trade rows, 2,724 unique companies.
- Importer research scope: 2,092; researched: 2,092; not researched: 0.
- Pakistan exporters excluded from this run: 632.
- Recovery batch: 1,316/1,316 complete; failed: 0.
- Result coverage: 1,176 importer profiles with at least one retained public profile field; 916 researched without a public contact/profile result.
- Retained values: 853 email addresses across 392 companies; 1,072 phone values across 387 companies; 538 address values across 363 companies; 1,042 named contact/leadership rows across 716 companies; 840 social links across 317 companies; 759 websites.
- Provider use for the recovery batch: Serper 5,092; Hunter 23; Groq 162; NVIDIA 292; all excluded providers 0.
- Post-run contamination audit: 0 known directory/trade platforms promoted as primary websites, 0 known directory-domain emails, 0 date/length-invalid retained phone rows, and 0 generic headings such as “Corporate Management” retained as person names.

## Browser interaction status

Chrome exposes the live EdgeView tab, but its saved browser-control preference blocks automated access to localhost. The computer-use security policy prohibits bypassing that preference through another browser surface. Therefore this report does not claim button-by-button automated clicking unless that saved permission is changed and the interaction suite is rerun.

## Known limitations

- Public-web enrichment cannot guarantee a contact for every company, especially truncated names, shell entities, freight references, or organizations without an indexed web presence.
- Direct website capture cannot bypass authentication, CAPTCHAs, robots restrictions, or inaccessible sites.
- Hunter is quota-dependent and is intentionally not called until a credible official domain is known.
- AI extraction is bounded; large evidence sets are chunked and summarized with references rather than loaded into one unlimited context.
- Complete raw evidence consumes disk space and requires operational monitoring.
