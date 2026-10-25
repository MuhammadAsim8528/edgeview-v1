# EdgeView application readiness research

Research date: 2026-10-25. This is a prioritized engineering comparison, not certification or a claim that every item is implemented.

## Findings and scope

A local desktop product needs reliable core behavior, protected writable data, understandable failures, controlled network requests, reproducible versioned releases, trusted installation, safe upgrades and recovery, accessible controls, and a support process. It does not inherently need accounts, a cloud database, session recording, or a new application framework.

Keep React/TypeScript/Vite, Node/Express, the current bounded V1 engine, and existing persistence until measured requirements justify migration. Keep business data local; external search/AI requests must be disclosed separately from monitoring. No automatic raw log, company record, prompt, key, evidence, or file-path upload.

## Source evidence

- Microsoft App Installer update behavior: https://learn.microsoft.com/en-us/windows/msix/app-installer/auto-update-and-repair--overview
- Microsoft MSIX downgrade preserves appdata; this does not implement database rollback: https://learn.microsoft.com/en-us/windows/msix/desktop/managing-your-msix-deployment-downgrading
- Microsoft package differential updates: https://learn.microsoft.com/en-us/windows/msix/app-package-updates
- Microsoft settings guidance includes privacy, help, and version information: https://learn.microsoft.com/en-us/windows/apps/design/app-settings/guidelines-for-app-settings
- NIST SSDF final 1.1 describes secure development and retained release/integrity evidence: https://csrc.nist.gov/pubs/sp/800/218/final
- OWASP ASVS supplies security verification requirements: https://owasp.org/projects/asvs
- OWASP logging guidance addresses useful security events and sensitive data exclusion: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- W3C WCAG 2.2 covers keyboard access, focus, labels, and understandable errors: https://www.w3.org/TR/WCAG22/
- GitHub immutable releases protect published tags/assets and provide release attestations: https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases
- PostHog privacy controls apply at collection, ingestion, and storage: https://posthog.com/docs/privacy
- Sentry server-side scrubbing configuration: https://docs.sentry.io/api/projects/update-a-project/

These sources establish useful practices. The following priorities are EdgeView-specific engineering judgments, not requirements attributed to every source.

## Prioritized gap comparison

| Area | Existing evidence | Work before broad release |
| --- | --- | --- |
| Company/country correctness | Country-aware keys, bounded search, evidence verification, regression tests | Trace every extracted field through local entity scope; test foreign parent, distributor, ambiguous country and historical cache cases |
| Local API security | Loopback Host/Origin checks, CSP, outbound URL validation, limits | Regression review of changed routes; packaged-runtime checks |
| Monitoring | Sentry/PostHog adapters, allowlist projection, HTTP rejection/offline tests, earlier account delivery proof | Finish account IP/location controls; verify fresh events after adapter hardening; audit remaining crash coverage |
| Support | Preview and downloadable allowlisted support JSON | Safe structured error history if useful, support instructions and retention; no silent raw upload |
| Privacy and identity | Random installation UUID, restricted monitoring fields | Visible user controls, truthful privacy notice, inspect licensing/HWID separately; do not send raw HWID to analytics |
| Version control | Git/GitHub and build metadata | Reviewed release tags, channel policy, changelog, traceable build/schema/package identity, remote CI evidence |
| Data durability | Existing atomic persistence, backup checks, opt-in separate writable root | Transactional legacy migration, interrupted migration recovery, executable schema-aware rollback |
| Installer/runtime | Windows SDK tools available, existing developer/source package tooling | Bundled Node and launcher, signed MSIX, stable publisher identity, owned HTTPS update feed |
| Update safety | Build recovery and planning documents | Pilot/stable manifests, integrity/signature checks, failed-update behavior, actual upgrade/recovery acceptance |
| Supply chain | Lockfile and existing dependency/license work | Review actual SBOM/license/scanning output; retain provenance and release checksums; resolve findings explicitly |
| UX/accessibility | Existing screens and browser tests | Keyboard/focus/error/loading/empty/offline checks, cancellation and bounded waits, useful recovery instructions |
| Performance | Existing limits and smoke checks | Target-device soak and import/search/export measurements; memory/disk budgets; no scale claims from unit tests |
| Operations | Doctor, build IDs, local diagnostics | Clean Windows install/update/uninstall/reinstall, support runbook and known limitations |

## Execution sequence and acceptance

1. Company/country correctness: reproduce actual paths with synthetic mixed-country evidence; fix narrow defects; preserve parent/local attribution; accept only with regression and existing V1 checks. No paid provider calls or real customer-data changes required for these fixtures.
2. Privacy/support: verify settings and fresh event payloads; document every external recipient and controls; test disabled/offline behavior. Policy must match actual behavior and publisher identity.
3. Release identity: Git commit + build ID + app version + schema version + update channel. Source rollback, package downgrade, and data recovery are distinct operations.
4. Writable state and recovery: explicit migration plan, preflight, backup, journal, atomic promotion, interruption recovery, stale-file policy, target/link validation, mid-operation failure tests.
5. Runtime-only installation and updates: preserve current product; bundle runtime; create signed MSIX and appinstaller tooling; establish signing identity and owned feed. Never expose provider/admin credentials in packages.
6. Clean-device pilot: first install, restart, offline use, real upload/search/export, update with retained data, failed/interrupted update, recovery, uninstall/reinstall and support export. Publish only after recording actual outcomes and unresolved risks.

## Deliberately deferred

Cloud accounts, payments, auto campaign agents, a second database authority, session replay, broad UI redesign, analytics warehouse replacement, and custom binary patch machinery are not prerequisites. Prefer MSIX update facilities over an unproven bespoke updater. Benchmark larger-dataset storage separately.

## Coordination observations

Integration was clean at c8019b7 before this work. Qoder/main tree history includes 05d4e1f, 5ab65a6, b8e0266, 0ebb6f5, 8ad12f4 concerning launcher behavior and tests. These were observed in local Git history only, not reviewed or integrated. No native taskbar control is exposed in this session; the process title query returned no accessible ChatGPT/Qoder windows. No prompt was sent. Do not represent a written assignment or a history inspection as delivery to an agent.

This document does not authorize or establish successful signing, publication, live-runtime replacement, or release acceptance.

## First implementation and remaining country-scope finding

A new synthetic regression initially failed: Getz Pharma + Kenya accepted getzpharma.pk from Pakistan-only evidence through the exact-global fallback. The resolver now excludes known foreign country-code domains from that fallback unless target-country evidence exists. Explicit Kenya content on a foreign parent domain remains eligible. Neutral global .com discovery remains unchanged. The four-case regression is included in test:v1.

Important remaining inspection finding: projectDeterministicContactFields in server/job_manager.ts selects all successful same-domain official pages and domain-attributable mailboxes; same-domain ownership alone does not establish Kenyan contact scope. Hunter domain results, public profiles, accepted claims and historical overlays need coordinated local/parent attribution review. This first resolver fix does not solve same-domain global contact mixing. Do not describe the full user-reported issue as fixed. Next acceptance fixture should place Kenyan and Pakistani contacts on one global company domain and assert that foreign facts cannot fill Kenyan fields, while parent facts remain separately attributable.

Executed for this first unit: new test failed before change and passed after; typecheck, lint, all existing V1 tests plus the added regression, production build and release smoke passed. Existing frontend chunk-size warning remains. No new customer installer was produced; no live runtime was restarted. Package/signing/clean-device acceptance remains unexecuted.
