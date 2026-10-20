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
