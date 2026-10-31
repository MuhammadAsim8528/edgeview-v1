# EdgeView V1 architecture

## Distribution decision: local-first Windows application

EdgeView V1 remains a React 19 + Vite interface served by a loopback Node.js/Express process. Trade files, normalized profiles, provider payloads, job checkpoints, and run evidence remain on the user's computer. Research sends selected company/country queries and bounded source content to configured providers. Separately configurable Sentry error reporting and PostHog usage analytics use the strict outgoing monitoring projection; they must not receive business records, evidence, credentials or private paths. Monitoring is not required for startup.

V1 does not require Next.js, Angular, Docker, a hosted database, a CDN, cloud user accounts, OAuth, or a public application server. Adding those layers would not improve retrieval quality and would create new deployment and privacy failure modes.

Device-bound licensing is deliberately outside the V1 enrichment critical path. A future commercial release may use a locally generated installation identifier, a privacy-preserving machine fingerprint, and a signed license document with an offline grace period and recovery mechanism. It must not expose raw hardware identifiers or prevent access to locally owned research data when a licensing service is unavailable.

## Product boundary

EdgeView turns an exact company name and country from an uploaded trade dataset into a bounded, evidence-backed public-company profile. V1 is a research and evidence system; it is not an outreach system, a private-data broker, or a guarantee that every company has public contact data.

## Active enrichment path

1. `server.ts` receives a single-company or persistent-job request.
2. `server/job_manager.ts` owns resumable batch state, five bounded workers, checkpoints, provider counters, stop/resume behavior, and failure isolation.
3. `server/v1_engine.ts` runs the V1 pipeline:
   - The configured AI priority controls query generation and evidence extraction. The shipped default is NVIDIA NIM primary, with Groq as the other enabled-provider fallback. If AI query generation is unavailable, bounded deterministic company-country queries remain available; this does not fabricate extracted facts.
   - Serper performs every web-search request.
   - Opaque Google result links use Serper's separate bounded resolution operation. Original search and resolver captures remain distinct; unresolved links cannot become company-source evidence.
   - deterministic code preserves each provider response or a structured failure record.
   - official candidate sites are fetched directly with bounded timeouts and internal-page discovery.
   - Hunter is queried only after a credible official domain is identified.
   - AI extracts structured facts from a bounded evidence workspace; it does not retrieve pages or decide what raw evidence is retained.
4. `server/v1_identity.ts`, `server/company_identity.ts`, and projection rules keep company/country identity attached to every result and suppress obvious third-party-directory contamination in the primary profile.
5. Immutable run files under `data/v1-runs/` retain provider payloads, page captures, failures, normalized results, raw references, latency, status, and timeline events.
6. Canonical uploaded datasets remain in JSON; sql.js operational SQLite holds derived history, contact overlays and jobs. The in-memory `server/db.ts` indexes are rebuilt projections, not another durable authority. See the ownership map below.
7. React screens read the public API. `SourceEvidenceModal` exposes the profile, evidence, and all retained captured results.

## Provider policy

| Capability | Primary | Fallback | V1 status |
|---|---|---|---|
| Query generation / evidence extraction | Configured priority (default NVIDIA NIM) | Other enabled NVIDIA/Groq provider | Enabled when configured |
| Web search | Serper | None | Enabled |
| Domain email enrichment | Hunter | None | Enabled when an official domain exists |
| Official website pages | Direct bounded HTTP capture | Structured failure | Enabled |
| Firecrawl, Tavily, Exa, Linkup, Apify, Gemini | — | — | Disabled and outside the V1 critical path |

Provider response fields are not silently discarded. The normalized schema references the immutable raw record so UI summaries never replace the source evidence.

## Failure and recovery model

- Every provider attempt records success or a structured error.
- A later-stage failure does not delete earlier search results or page captures.
- Jobs checkpoint progress and resume pending/interrupted companies after a restart.
- Transient AI/provider failures open a short cooldown rather than causing an uncontrolled retry storm.
- Per-company work is bounded by query count, page count, timeouts, and the fixed worker pool.
- Disk space must be monitored because complete raw evidence is intentionally retained.

## UI state and launch model

- Active tab, sidebar state, selected file, Contacts view/filter/page/selection, selected research run, and scroll positions use persistent browser storage.
- Enrichment never changes the active tab.
- `EdgeView.bat` reopens a healthy instance from the same project or refuses another installation owning port3901. On a new start it checks dependencies and production build identity, then starts the backend and opens the browser after health responds.
- `scripts/build-if-needed.mjs` provides the fast incremental launch check.
- A shortcut launches its configured project/installation. Changes in a separate worktree do not update that installation or an already-running process. Deployment requires reviewed reconciliation/build and an explicitly controlled restart; opening the progress workspace is not deployment.

## Durable state ownership

Paths below are relative to the resolved writable data root unless stated otherwise. Default app-root state and opt-in separate state are not simultaneous competing authorities. Legacy activation/migration remains an acceptance gate.

| State | Authority | Boundary |
|---|---|---|
| Uploaded datasets | `edgeview_db.json`, through `server/sqlite_persistence.ts` | Canonical primary rows/file identity; malformed existing data fails closed |
| Trade-history index | `edgeview.db` history_data | Derived rows with file ownership; legacy reconciliation must not invent ownership |
| Projected contacts | SQLite v1_contact_enrichment plus canonical dataset identity | Rebuilt in-memory indexes; current overlay policy and exact entity required |
| Jobs/checkpoints | SQLite research_jobs | Durable progress; not a replacement for raw research evidence |
| Provider settings/credentials | `config.json`, through `server/settings.ts` | Same-user DPAPI envelope; no plaintext customer fallback |
| Monitoring preferences | Same canonical settings | Separate error/usage switches; launch-level disable remains authoritative |
| Immutable research | `data/v1-runs/` run records and blobs | Original captures/failures preserved; policy revalidation does not rewrite evidence |
| Local logs | `logs/edgeview_runtime.log` and bounded rotations | Redacted diagnostics, not a business-data authority |
| Monitoring identity | `data/installation.json` | Random installation UUID; not completed HWID/licensing |
| Build identity | Application `dist/build-info.json` | Version/commit/content-derived build identity; not writable customer configuration |

## Historical pre-V1 architecture

The pre-V1 campaign, orchestration, and autonomous-research modules were removed from active source on 2026-10-19. Their recovery history is described by `docs/LEGACY_ARCHIVE_MANIFEST.md` and Git baseline `fa7fcda`. The historical archive is not part of this package and must not be restored or imported into the active V1 pipeline. Provider helper functions that remain in current files do not make an obsolete provider part of the supported research path.

## Runtime truth surfaces

- `config.json` is the single local configuration authority. `POST /api/settings` validates and atomically persists the V1 provider toggles, models, and primary AI provider; query generation and evidence extraction read that same state.
- Each completed immutable V1 run contributes once to a durable aggregate in `data/v1-runs/provider-metrics.json`. Average latency is total completed primary-provider call latency divided by completed calls; success rate is successful calls divided by completed calls. Uncalled providers return `null`, not fabricated zero/success. The independently rate-limited `serper-resolve` operation retains separate raw/timeline status and duration and does not masquerade as search-service health or search-credit usage.
- `GET /api/governor/provider-metrics`, `GET /api/system/health`, and `GET /api/runtime/state` expose only Serper, Hunter, NVIDIA, and Groq. A configured key remains `unknown` until a real request/test supplies evidence.
- EdgeView has provider suppression and short cooldown guards, not a generic circuit breaker. The UI uses the name “Routing guard” and reports `available`, `cooldown`, `suppressed`, `disabled`, or `unconfigured`.
- The Node/Express process owns runtime logging. `server/runtime_log.ts` writes redacted JSON lines to a 10 MB rotating local log with three archives. `GET /api/logs/system` reads at most the final 1 MB and returns at most 1,000 entries.

## Main code ownership map

| Area | Files |
|---|---|
| API and static app host | `server.ts` |
| V1 retrieval/capture/normalization | `server/v1_engine.ts` |
| Persistent jobs and worker pool | `server/job_manager.ts` |
| Identity and profile projection | `server/v1_identity.ts`, `server/company_identity.ts`, `server/contact_projection.ts` |
| Dataset provenance | `server/dataset_provenance.ts` |
| Storage | `server/db.ts`, `server/sqlite.ts`, `server/sqlite_persistence.ts` |
| Provider configuration | `server/settings.ts`, `config.json` |
| App state/navigation | `src/store/appStore.ts`, `src/App.tsx` |
| Contacts and full evidence | `src/components/Contacts.tsx`, `src/components/SourceEvidenceModal.tsx` |
| Live jobs/research | `src/components/BatchEnrichmentModal.tsx`, `src/components/ResearchWorkspace.tsx` |
| Build/package/launch | `EdgeView.bat`, `scripts/build-if-needed.mjs`, `scripts/package-windows.mjs` |

## Stored export boundary

Contact downloads resolve requested IDs against stored contacts and ignore browser-provided facts.
File downloads use a stored file ID; optional bounded view options share the paging calculation
in `server/file_view.ts`. Grouped exports use computed grouped values rather than stale sample-row
aliases. Generic browser-row file exports are rejected. Summary/country downloads resolve explicit stored file IDs and reject client row overrides.
Stats downloads resolve explicit file IDs and applied filters through the shipment selector
used by the read API, then project canonical renderer fields. Retired outreach exports return410.
The Reports path still requires separate authority/content acceptance; see the ledger rather
than assuming every dataset has this boundary.
