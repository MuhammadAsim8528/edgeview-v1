# EdgeView V1 architecture

## Distribution decision: local-first Windows application

EdgeView V1 remains a React 19 + Vite interface served by a local Node.js/Express process. Trade files, normalized profiles, provider payloads, job checkpoints, and run evidence remain on the user's computer. The application contacts only the explicitly configured enrichment providers.

V1 does not require Next.js, Angular, Docker, a hosted database, a CDN, cloud user accounts, OAuth, or a public application server. Adding those layers would not improve retrieval quality and would create new deployment and privacy failure modes.

Device-bound licensing is deliberately outside the V1 enrichment critical path. A future commercial release may use a locally generated installation identifier, a privacy-preserving machine fingerprint, and a signed license document with an offline grace period and recovery mechanism. It must not expose raw hardware identifiers or prevent access to locally owned research data when a licensing service is unavailable.

## Product boundary

EdgeView turns an exact company name and country from an uploaded trade dataset into a bounded, evidence-backed public-company profile. V1 is a research and evidence system; it is not an outreach system, a private-data broker, or a guarantee that every company has public contact data.

## Active enrichment path

1. `server.ts` receives a single-company or persistent-job request.
2. `server/job_manager.ts` owns resumable batch state, five bounded workers, checkpoints, provider counters, stop/resume behavior, and failure isolation.
3. `server/v1_engine.ts` runs the V1 pipeline:
   - Groq generates a compact identity-anchored query set; NVIDIA NIM is the fallback.
   - Serper performs every web-search request.
   - deterministic code preserves each provider response or a structured failure record.
   - official candidate sites are fetched directly with bounded timeouts and internal-page discovery.
   - Hunter is queried only after a credible official domain is identified.
   - AI extracts structured facts from a bounded evidence workspace; it does not retrieve pages or decide what raw evidence is retained.
4. `server/v1_identity.ts`, `server/company_identity.ts`, and projection rules keep company/country identity attached to every result and suppress obvious third-party-directory contamination in the primary profile.
5. Immutable run files under `data/v1-runs/` retain provider payloads, page captures, failures, normalized results, raw references, latency, status, and timeline events.
6. `server/db.ts` and `server/sqlite_persistence.ts` persist uploaded data, projected contact profiles, and resumable job state in `edgeview.db`.
7. React screens read the public API. `SourceEvidenceModal` exposes the profile, evidence, and all retained captured results.

## Provider policy

| Capability | Primary | Fallback | V1 status |
|---|---|---|---|
| Query generation / evidence extraction | Groq | NVIDIA NIM | Enabled |
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
- `EdgeView.bat` installs missing dependencies, rebuilds only when watched source files are newer than `dist`, starts port 3901, waits for health, and opens the browser.
- `scripts/build-if-needed.mjs` provides the fast incremental launch check.
- The desktop shortcut points to the real installation, so future source changes flow into the launched app automatically.

## Deliberately dormant code

The repository still contains older experimental campaign, orchestration, provider, and research modules. They are retained for reference and possible future migration, but the routes above do not call them in the V1 enrichment critical path. Removal should happen only after a separate dependency and data-migration review.

## Runtime truth surfaces

- `config.json` is the single local configuration authority. `POST /api/settings` validates and atomically persists the V1 provider toggles, models, and primary AI provider; query generation and evidence extraction read that same state.
- Each completed immutable V1 run contributes once to a bounded durable aggregate in `data/v1-runs/provider-metrics.json`. Average latency is total completed-call latency divided by completed provider calls; success rate is successful provider calls divided by completed provider calls. Uncalled providers return `null`, not zero or a fabricated success.
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
| Dataset provenance | `server/dataset_provenance.ts`, `server/data_provenance.ts` |
| Storage | `server/db.ts`, `server/sqlite.ts`, `server/sqlite_persistence.ts` |
| Provider configuration | `server/settings.ts`, `config.json` |
| App state/navigation | `src/store/appStore.ts`, `src/App.tsx` |
| Contacts and full evidence | `src/components/Contacts.tsx`, `src/components/SourceEvidenceModal.tsx` |
| Live jobs/research | `src/components/BatchEnrichmentModal.tsx`, `src/components/ResearchWorkspace.tsx` |
| Build/package/launch | `EdgeView.bat`, `scripts/build-if-needed.mjs`, `scripts/package-windows.mjs` |
