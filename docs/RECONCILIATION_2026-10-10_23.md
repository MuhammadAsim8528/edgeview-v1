# October 10–23 release reconciliation

## October 24 evidence addendum (does not erase historical claims below)

Current exclusive ChatGPT branch is based on 860b6e4. Owner reconfirmed Qoder
uses the original workspace; ChatGPT uses `edgeview-chatgpt`. Do not merge a dirty
worktree or copy the separate QA worktree's mixed changes.

- Export HTML escaping/URL guards: de8aeb3 endpoint/security checks, rendered
  downloaded document still NOT VERIFIED.
- Upload filename boundary: 12d2273 all four HTTP aliases, rejection before
  persistence, valid CSV/NVL/XLSX checks. Browser upload still NOT VERIFIED.
- Missing/duplicate Host: 8906c1c compiled raw-HTTP regressions PASS; no browser
  DNS-rebinding exploit claim or removal of existing HOST override.
- Export admission budget: ae3be06 compiled GET/HEAD/POST/OPTIONS and nested
  stats-mount aliases PASS; concurrent memory/load acceptance remains open.
- Migration backup retention: 45bab8b post-write/reopen/integrity/schema gating,
  failed-schema/write/reopen preservation and link boundaries PASS. Full restore,
  interrupted restore and installed-update rollback remain PARTIAL.
- AI credential transport: existing 0652b15 independently rechecked; query and
  extraction destinations, DNS pinning, HTTPS/redirect/body and origin checks
  PASS in synthetic fixtures. Actual configured-provider/company/UI run open.
- Request parsers: 860b6e4 production audit has zero HIGH findings; two MODERATE
  uuid/ExcelJS findings remain. Failed local clean install/repaired install and
  exact developer-package evidence are recorded in OUTSTANDING_WORK.md.
- Dependabot config and release/security/license evidence tooling exist on this
  branch. Default-branch activation, hosted feature entitlement, exact final
  release CI and trusted customer release are not inferred from file presence.

Reopened available chats “AI Agent Build Advice 7” and “AI Agent Build Advice 8”.
Their current connector pages report no older cursor but expose only bounded
recent turns, NOT the complete October 10 onward history. Latest QA conversation
reports full-file export hitting the 5 MB request limit, duplicate/miscounted
pagination summaries, exporter-report default mismatch, incomplete official phone
recall despite COMPLETE, and missing global country totals/keyboard semantics.
These are acceptance blockers, not disproved by green existing tests. The
separate `edgeview-qa-fixes` tree already contains uncommitted changes touching
these subsystems; preserve/review its coherent slices rather than duplicate them.
Reports of live/QA provider health and rendered behavior are attributed reports,
not this writer's independently repeated browser verification.

All unclosed rows below remain in scope. The original evidence cutoff and
ownership text are historical; use this addendum plus OUTSTANDING_WORK.md for
current state. Final recommendation remains NOT READY.

Evidence cutoff: 2026-10-23. Branch base: ef1c074. This is a companion to
OUTSTANDING_WORK.md, not a replacement or a favorable readiness report.

## Evidence rules and provenance

VERIFIED COMPLETE applies only to the bounded behavior named in a row, not the
entire product. Prior execution evidence is dated; it does not certify a new
commit, installed package, renderer or customer machine. IMPLEMENTED NOT VERIFIED
means source exists without sufficient execution evidence. PARTIAL means some
acceptance criteria remain. BLOCKED requires an identified external prerequisite.
REGRESSED requires a demonstrated break, not just suspicious source.

Sources inspected: Git log/reflog (history begins fa7fcda on October 19),
AGENTS.md, OUTSTANDING_WORK.md, engineering/security/QA/operations reports,
DELIVERY_PIPELINE, OSS_INVENTORY, build/credential/resource/recovery docs,
CI/SBOM scripts, and recent available turns in “AI Agent Build Advice 7”,
“AI Agent Build Advice 8”, “EdgeView Night Watch”, plus this Work conversation.
The available chat connector returned bounded recent turns, not a complete
October 10–18 transcript. Earlier requests below are reconstructed from the
supplied conversation and dated reports, NOT invented pre-October-19 commits.
Full archive retrieval remains incomplete; do not label this an exhaustive
turn-by-turn history.

Historical QA report claims October 11 browser operation and importer totals;
the same report also records later browser-control denial. Those statements are
historical claims, not new source→API→render verification. Reported 2,092 importer
coverage and 1,176 profiles must be re-established from the intended dataset,
identity scope and rendered UI before final acceptance.

Git remote read on this date: main=314ee32; local main/base=ef1c074.
GitHub connector get_repo returned 404 although git ls-remote succeeded. This is
an access/connector proof gap, not proof that repository/security features do not
exist. Current hosted Actions and account feature availability are NOT VERIFIED.

## Requirement matrix

| Requirement | Classification | Evidence / remaining acceptance |
|---|---|---|
| Preserve React19/TS/Tailwind/Vite + Express/Node | VERIFIED COMPLETE | Source architecture at base; no Python/native-host migration. |
| Remove competing legacy critical paths | VERIFIED COMPLETE | 8c92de1 archive + dependency graph; archive is not unfinished functionality. |
| Exact company + country, bounded query generation | PARTIAL | v1_engine/v1_identity; real ambiguous-name/country truthsets pending. |
| Serper retrieval/raw responses/structured failures | PARTIAL | Engine and V1 suites; full paid real-user workflow not reverified. |
| Hunter domain/contact enrichment | PARTIAL | Official-domain gated adapter; historical exhausted quota, current state unknown. |
| NVIDIA/Groq configuration and model discovery | PARTIAL | c669822/47e5e41; catalog200/83models/257ms at f96a6da does not prove generation. |
| Credential origin for every key-bearing engine operation | PARTIAL | Existing model-origin checks; Qoder B transport review outstanding. |
| Official-site/contact/management discovery | PARTIAL | 5d4aa21 bounded discovered links; completeness/leadership UI truthsets pending. |
| Immutable evidence, blob integrity, failures | VERIFIED COMPLETE | e6eb3b3/99fd233/atomic+blob tests, scoped persistence behavior. |
| Strong historical evidence survives weaker runs | PARTIAL | Historical-preservation tests; complete dataset projection/render proof pending. |
| Contacts/leadership quality and provenance display | PARTIAL | Canonical contract/admission; no unsupported names/phones; real-company acceptance open. |
| Global Pharmaceuticals Pakistan / Thorne Berry | BLOCKED | Source→raw→admission→API→UI truthsets not exercised; browser helper fails. |
| Emerchemie / Slim Pharma | PARTIAL | Historical report claims success; current exact-build rendered recheck absent. |
| All importer scope / excluded Pakistan exporters | PARTIAL | Historical 17612rows/2724entities/2092importers/632exporters claims; reconcile current dataset. |
| Parsing/file preservation/provenance | PARTIAL | 9c80d00; synthetic17432row preservation at314ee32; document/archive bounds remain. |
| Text parser resource bounds | VERIFIED COMPLETE | 314ee32 width/cell rejection +422/no persistence; not archive expansion or RAM guarantee. |
| sql.js operational + JSON dataset authorities | PARTIAL | Existing authorities preserved; concurrency/large-scale limits remain. |
| Durable write failure propagation | VERIFIED COMPLETE | 4492cc8/4418de1/6da1736, isolated failure/recovery gates. |
| UI tab/selection/refresh state | PARTIAL | Existing persistence; latest rendered/restart verification absent. |
| Bounded resumable batch/dashboard | PARTIAL | ce43a52 API/static markup checks; real running-job renderer/stop responsiveness open. |
| Complete paginated export | PARTIAL | e970426 collector regression1,503rows; actual button/download unverified. |
| Export filename/path isolation | VERIFIED COMPLETE | 3af6bd0 opaque owned staging, direct guards, partial cleanup, all ZIP modes. |
| HTML blocks / legacy stats CSV safety | PARTIAL | Qoder A pending; CSV quote-boundary finding remains. |
| Launcher/bootstrap/install recovery | PARTIAL | e8a73d5/31cfbf3/npm-policy tests; installed Node/npm required. |
| Build identity/source freshness | PARTIAL | f51c16d compiled restart tests; live loaded build not certified. |
| Doctor/status diagnostics | PARTIAL | acfc47c/resources/build; full Diagnostics sections/export/owner support unfinished. |
| Local bounded/redacted logs | PARTIAL | Existing security tests; support export/correlation/full privacy review remain. |
| Process/system resources | PARTIAL | ab98219 sampler; unsupported metrics unknown; sustained real-workload measurements open. |
| Production CSP/no HMR/security headers | VERIFIED COMPLETE | Static-default release smoke; not all endpoint security. |
| Host/Origin/nonloopback safety | PARTIAL | Existing host/origin checks; missing Host + network bind concerns need behavioral proof. |
| Retrieval DNS/redirect/absolute deadline | VERIFIED COMPLETE | f96a6da synthetic transport + real catalog; not all AI POST transports. |
| DPAPI/provider secret storage | PARTIAL | a4d3d17/703f8a3; occasional config-open failure unresolved; exposed keys need owner rotation. |
| SQLite integrity/migrations | PARTIAL | 4418de1 failed init protection; migration matrix/rollback open. |
| Backup publication/integrity | PARTIAL | e885e79 INCOMPLETE→promotion tests; overrides/config.prev completeness open. |
| Restore/rollback executable flow | PARTIAL | Qoder uncommitted F; manifest/link/transaction/stale-file risks not accepted. |
| Normal shutdown/flush/restart | PARTIAL | e36135b isolated signal/drain checks; broader crash/upgrade lifecycle open. |
| Fatal crash handling | PARTIAL | fatal_errors/shutdown contracts; owner remote delivery not proven. |
| Load/performance | PARTIAL | cf3e1bc bounded100request probe; no long repeated representative trend proof. |
| Leak/stress budgets | NOT STARTED | No accepted long-run CPU/RSS/handles/listeners/browser trend baseline. |
| GitHub CI / Docker QA | PARTIAL | Historical ab98219 run39466064224 green; current exact release CI unknown. |
| SBOM | PARTIAL | 2306c55 CycloneDX production-lock inventory; not byte-exact runtime inventory. |
| License/third-party notices | PARTIAL | OSS_INVENTORY flags missing metadata/MPL; complete notices/legal review absent. |
| Secret/history/package scanning | PARTIAL | Existing pattern scans; no complete entropy/history guarantee or rotated-key proof. |
| Dependabot | NOT STARTED | No config at base; default-branch activation separate from branch implementation. |
| CodeQL / push protection / hosted secret scanning | BLOCKED | Repository connector404; entitlement/enabled state not established. |
| Sentry/PostHog | PARTIAL | Qoder dirty dependencies/adapters only; actual project delivery/privacy/offline proofs absent. |
| Installation UUID/keypair | PARTIAL | Qoder uncommitted implementation; DPAPI/restart/update/corruption acceptance pending. |
| Privacy egress inventory / diagnostics export | NOT STARTED | Requirements known; one canonical state/strict safe schema needed. |
| Playwright/rendered workflow | BLOCKED | No base infrastructure; supported Computer Use kernel-assets os error3, no screenshots. |
| Accessibility/keyboard/responsive QA | NOT STARTED | Current exact-build interaction evidence absent. |
| MSIX/.appinstaller evaluation | NOT STARTED | Current source/runtime ZIP is not self-contained installer. |
| Stable/Beta/Canary updater | NOT STARTED | No trusted channel/update acceptance implementation. |
| Update post-health / last-known-good recovery | NOT STARTED | Need chosen installer, trust model, schema/data-safe downgrade policy. |
| Production code signing | BLOCKED | No demonstrated trusted signing identity/service. |
| Clean Windows without Node/npm/Git | BLOCKED | Current ZIP requires Node/npm; clean VM/environment unprovided. |
| Final frozen source/data/customer artifacts | NOT STARTED | Gates not closed; don't freeze dirty main or bundle secrets/private data. |
| Uncle Stable deployment/automatic support | BLOCKED | Clean-machine/update/monitoring/UI gates precede deployment. |

## Priorities and ownership

Qoder owns main's A–H cleanup, server.ts, engine/providers/upload/sqlite,
package files, doctor/package scripts, telemetry/identity implementation and its
active CI changes. ChatGPT branch owns this reconciliation and isolated new
release/security evidence files. No cross-worktree writes or automatic merge.
Do not carry main's dirty changes into this branch by copying whole files.

Suggested release progression: stabilize/security/recovery → privacy-reviewed
owner observability → rendered/failure/performance QA → self-contained installer
and trusted updater → health acceptance/rollback → freeze/artifacts → clean
Windows → uncle Stable installation. A–K stay open; recommendation NOT READY.

## Reconciliation limitations

No fresh runtime/provider/browser/package verification was performed for this
inventory. Existing execution records are distinguished from prose claims. No
whole-repository exhaustive scan, exact current importer audit or complete
October10–18 transcript is claimed. Capture new evidence with exact commit,
command/environment/result and artifact digest; source presence is not PASS.
