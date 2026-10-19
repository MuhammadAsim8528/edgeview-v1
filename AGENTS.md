# EdgeView V1 — Engineering Contract

This file is the authoritative orientation document for coding agents working on the current EdgeView repository.

## 1. Current product boundary

EdgeView V1 is a local-first trade/company intelligence application. It is not the retired autonomous-research system that previously existed in this repository.

The current V1 pipeline is intentionally bounded:

```text
exact company + country
→ constrained AI query generation
→ deterministic provider retrieval
→ immutable raw evidence capture
→ deterministic identity resolution
→ bounded official-site retrieval
→ evidence extraction
→ deterministic evidence verification
→ trusted historical projection
→ persisted contact/UI state
```

Core rule:

**AI may suggest or extract. Evidence and deterministic code decide what becomes trusted data.**

Do not reintroduce autonomous planners, campaign engines, research directors, multi-agent orchestration, or another competing company-data store.

## 2. Legacy source archive

Historical pre-V1 architecture was deliberately removed from active source paths on 2026-10-19.

- Git baseline before extraction: `fa7fcda`
- Local historical ZIP: `.archive/edgeview-pre-v1-legacy-2026-10-19.zip`
- Inventory and hashes: `docs/LEGACY_ARCHIVE_MANIFEST.md`

The archive is for recovery/reference only.

**Do not import from it. Do not bulk-restore it. Do not infer that archived subsystems are unfinished V1 features.**

If an old endpoint must remain for stale callers, it must be an explicit `410 Gone` tombstone rather than a hidden fallback into archived code.

## 3. Active stack

- Frontend: React 19 + TypeScript + Vite + Tailwind
- Backend: Node.js + Express + TypeScript
- Operational database today: `sql.js` persisted to `edgeview.db`
- Uploaded dataset persistence today: `edgeview_db.json`
- Immutable V1 evidence: `data/v1-runs/`
- Primary current AI providers: NVIDIA NIM and Groq
- Current search/contact providers exposed by V1: Serper and Hunter
- Exports: CSV/XLSX/PDF/DOCX/ZIP
- Local deployment boundary: loopback (`127.0.0.1`) unless deliberately redesigned later

`sql.js`, JSON-backed row storage, and in-memory row Maps are known future scaling limits. Do not mistake them for the intended Panjiva-scale final architecture.

## 4. Active source map

### Frontend

- `src/App.tsx`: active application router/shell
- `src/store/appStore.ts`: active UI/application state
- `src/components/Contacts.tsx`: company/contact intelligence UI
- `src/components/ResearchWorkspace.tsx`: read-only V1 run/evidence workspace
- `src/components/SettingsTabV1.tsx`: current settings surface
- `src/components/SystemHealthPanel.tsx`: current provider/runtime health
- `src/components/SourceEvidenceModal.tsx`: source/evidence rendering
- `src/components/FileViewer.tsx`: uploaded trade-data view
- `src/components/GlobalExportModal.tsx`: export workflow
- `src/types/index.ts`: current client contracts (being hardened toward canonical V1 contracts)

### Backend

- `server.ts`: Express entrypoint and API boundary
- `server/v1_engine.ts`: bounded V1 research/enrichment engine and immutable run store
- `server/v1_identity.ts`: identity/domain resolution
- `server/job_manager.ts`: persistent batch jobs and trusted historical projection
- `server/contact_projection.ts`: contact projection into active company records
- `server/ai_providers.ts`: current AI provider transport
- `server/settings.ts`: settings and credential handling
- `server/url_safety.ts`: outbound/SSRF controls
- `server/runtime_log.ts`: bounded redacted runtime logging
- `server/sqlite.ts`: current sql.js operational DB wrapper
- `server/sqlite_persistence.ts`: current uploaded-file/history persistence
- `server/db.ts`: active in-memory projection/indexes
- `server/routes/upload.ts`: file upload parsing path
- `server/export_manager.ts`: export construction

If a future agent sees a file named `research_director`, `research_runtime`, `resource_governor`, `orchestrator`, `campaign_workers`, or the old `SettingsTab.tsx`, it should not exist in active source. Consult the legacy manifest rather than recreating it.

## 5. Non-negotiable V1 invariants

1. Never fabricate company/contact facts.
2. Preserve raw provider evidence or a structured failure record.
3. A weak/new failed run must not erase stronger historically trusted evidence.
4. Company identity is anchored by company + country, not name alone when ambiguous.
5. AI confidence is not evidence.
6. A model-produced claim must pass deterministic source/evidence checks before becoming trusted data.
7. Unsupported claims may be rejected or left unknown. Abstention is valid behavior.
8. Directory/trade-data/social platforms must not be silently promoted to official company domains.
9. Do not bypass SSRF/outbound URL protections.
10. Never expose provider credentials to the frontend, logs, Git, packages, or error responses.
11. A persistence failure must not be reported to the user as a successful durable write.
12. Tests must not mutate production databases, provider secrets, or V1 evidence.
13. Do not create duplicate database/persistence authorities without an explicit migration plan.
14. Do not add new agents/planners just because an AI model can implement them.
15. Prefer small verified changes over broad aesthetic refactors.

## 6. Release/development behavior

Production/static mode is the default even when `NODE_ENV` is absent.

Vite/HMR development middleware is enabled only by:

```text
EDGEVIEW_DEV_SERVER=1
```

The production release must not contain Vite HMR/React Refresh clients. Release tests enforce this.

Launcher/build behavior includes recovery of the previous working `dist` if a rebuild fails. Do not weaken that behavior.

## 7. Security boundary

EdgeView V1 is currently a local application, not a multi-user Internet service.

Keep:

- Host/Origin loopback checks
- strict production CSP
- X-Frame-Options / nosniff / referrer / permissions headers
- bounded JSON/upload sizes
- mutation throttling
- SSRF/private-network protections and redirect revalidation
- bounded response bodies/timeouts
- credential masking/redaction
- bounded runtime logs
- safe Content-Disposition/header encoding
- database integrity checks and safe recovery behavior

Do not claim local-first means safe against a compromised Windows user account.

## 8. Failure UX contract

Failures should remain visible and machine-readable.

Prefer structured errors such as:

```json
{
  "success": false,
  "code": "STABLE_ERROR_CODE",
  "message": "Short human-readable explanation",
  "recoverable": true,
  "remediation": "What the user can do next"
}
```

If a feature cannot operate because a required capability is unavailable, the frontend should eventually disable the action and display the reason. Do not fake healthy provider state.

## 9. Data-scale direction

The future target is much larger raw trade datasets, potentially millions+ rows and eventually Panjiva-scale warehouse behavior.

Long-term design must separate:

- raw trade warehouse
- operational/job/contact state
- immutable evidence/provenance

Do not solve large raw trade data by loading everything into browser memory, one JavaScript Map, one giant JSON object, or an ever-growing sql.js image.

Candidate analytical approaches such as DuckDB + Parquet must be benchmarked on the actual Windows target before adoption.

## 10. Evidence/hallucination architecture

The V1 identity/evidence system is strategically important.

The intended reasoning model is:

```text
model proposes
→ entity/source identity is resolved
→ source authority/ownership is checked
→ quoted evidence is verified
→ contradictions are considered
→ code accepts / rejects / abstains
```

Do not simplify this into “ask another LLM whether the answer is correct.”

## 11. Required checks before declaring a V1 change complete

At minimum, run the checks relevant to the change. For release-impacting work run:

```text
npm run typecheck
npm run lint
npm run test:v1
npm run build
npm run test:release
npm run package:windows
npm run verify:package
```

`typecheck` runs TypeScript without emitting files. `lint` is a separate ESLint static-quality gate. Keep both green for release-impacting changes.

For dependency/security claims, state exactly which audit ran and what remained unresolved.

## 12. Git and recovery discipline

Current Git history begins at:

```text
fa7fcda baseline: verified EdgeView V1 release candidate
```

There is no earlier Git history in this working copy.

Before broad edits:

- inspect `git status`
- keep secrets/runtime data ignored
- make bounded commits after verified phases
- use Git for rollback instead of restoring the legacy ZIP into active source

## 13. Definition of done

Do not write “fully production ready”, “Panjiva scale”, “100% secure”, or “everything fixed” without evidence.

A completion report should distinguish:

- verified
- inferred
- blocked/unverified
- known limitations

The objective is not to make EdgeView look sophisticated. The objective is to make its behavior reflect runtime truth.
