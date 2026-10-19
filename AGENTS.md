# EdgeView — Engineering Architecture & Fast Production Engineering Contract

This document is the persistent engineering specification and system contract for **EdgeView** (Parent product: **Pharma AI**). It outlines the existing architecture, file mappings, development constraints, enrichment pipeline design, export specifications, and multi-agent operational rules.

---

## 1. Project Overview & Architecture Map

- **Product Identity**: EdgeView (Standalone desktop/web application for pharmaceutical export and trade data analysis).
- **Parent Product**: Pharma AI.
- **Architectural Boundary**: EdgeView runs independently as a full-stack application (Vite + React frontend, Express/Node backend, SQLite + JSON database). **Hermes is NOT integrated**, is NOT required, and MUST NOT be introduced. EdgeView must remain 100% functional independently.

### Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Recharts, Motion.
- **Backend Server**: Node.js (v20+), Express, `tsx` (TypeScript runner), `esbuild` (bundler).
- **Database Layer**: SQLite (`sql.js` in-memory with file persistence to `edgeview.db`) + File-backed JSON store (`sqlite_persistence.ts` reading `edgeview_db.json`).
- **AI & Enrichment**: Primary LLM: NVIDIA NIM (`server/ai_providers.ts`), Fallback LLM: Groq (`llama-3.3-70b-versatile`), Web Scraper: Firecrawl (`https://api.firecrawl.dev`), Search Provider: Serper (`https://google.serper.dev`).
- **Export Frameworks**: `docx` (Word documents), `pdfkit` (PDF generation), `xlsx` (Excel spreadsheets), `jszip` (ZIP archiving).

---

## 2. Codebase Map & Subsystem File Reference

### Frontend Subsystem (`src/`)
- **Contacts UI**: `src/components/Contacts.tsx` (Enrichment trigger, table display, contact detail drawer).
- **Batch Enrichment Modal**: `src/components/BatchEnrichmentModal.tsx` (Enrichment selection and queueing).
- **Global Export Modal**: `src/components/GlobalExportModal.tsx` (Multi-format export payload builder).
- **Settings & Telemetry**: `src/components/SettingsTab.tsx` (API keys, provider health, circuit breaker statuses).
- **Source Evidence Modal**: `src/components/SourceEvidenceModal.tsx` (Displays source URLs and field confidence).
- **Application Store**: `src/store/appStore.ts` (Zustand-style React hook managing active file, contacts, reports).
- **Export Validator**: `src/utils/exportValidator.ts` (Parses `Content-Disposition`, validates binary responses).
- **API Client**: `src/utils/safeFetch.ts` (Safe fetch wrapper returning structured status/errors).
- **Types**: `src/types/index.ts` (Shared TypeScript interfaces for contacts, files, reports).

### Backend Server Subsystem (`server/`)
- **Server Entrypoint**: `server.ts` (Express server setup, route endpoints, SSE logging stream, `/api/export`).
- **Enrichment Engine**: `server/enrichment.ts` (Single/Batch enrichment flows, evidence saving).
- **Research Director**: `server/research_director.ts` (Autonomous research state machine, query planning, SSRF protection).
- **AI Providers**: `server/ai_providers.ts` (NVIDIA NIM primary, Groq fallback, circuit breakers, rate limits).
- **Resource Governor**: `server/resource_governor.ts` (Rate limiting, API key rotation, concurrency control).
- **Export Manager**: `server/export_manager.ts` (Multi-format payload processor for CSV, XLSX, PDF, DOCX, ZIP).
- **Header Encoder Utility**: `server/utils/header_encoder.ts` (Canonical RFC 6266 / RFC 8187 header encoder).
- **DOCX Report Generator**: `server/docx_report.ts` (Professional 4-column directory generator with single-cell title table).
- **PDF Report Generator**: `server/pdf_report.ts` (PDF document generator using `pdfkit`).
- **Database Engine**: `server/sqlite.ts` (SQL.js SQLite wrapper with non-destructive corrupt file backup), `server/sqlite_persistence.ts`, `server/db.ts`.

### Tests (`server/tests/`)
- `server/tests/header_encoder.test.ts` (Unit & SSRF security tests)
- `server/tests/export_unicode_e2e.test.ts` (End-to-end HTTP header export tests)

---

## 3. Fast Production Engineering Contract & Mandatory Rules

Future agents working on EdgeView MUST strictly observe these 20 engineering rules:

1. **Preserve existing functionality**: Never break working user flows, UI components, or working export routes.
2. **Prefer modifying existing abstractions**: Never build duplicate database layers, duplicate provider wrappers, or duplicate UI components.
3. **Do NOT introduce Hermes**: Hermes integration is strictly out of scope. Do not add Hermes dependencies, APIs, MCP servers, or agents.
4. **Do NOT expose secrets**: Never leak API keys or backend credentials to frontend responses or client state.
5. **Do NOT hardcode API keys**: All credentials must be read from environment variables or settings store (`getAppSettings()`).
6. **Do NOT hallucinate contact data**: Never fabricate emails, phone numbers, addresses, or person names. Empty fields must report "Not found".
7. **Preserve mandatory source evidence**: Every extracted contact attribute must maintain its provenance (`source_url`, `confidence`, `evidence_text`).
8. **Validate AI structured data deterministically**: Validate emails, URLs, and phone numbers using deterministic application code before saving.
9. **Cache-first policy**: Fetch Info must check cache before issuing external API requests. Complete cached records must return immediately.
10. **Search & Scrape Efficiency**: Limit search planning to 3–5 targeted queries; rank search results and scrape only high-value pages.
11. **Maintain non-blocking async behavior**: Long-running research tasks must use asynchronous background queues or SSE streams.
12. **Preserve existing UI design**: Maintain Tailwind styling tokens, layout structure, and design conventions unless requested.
13. **Avoid unnecessary refactors**: Keep changes focused on real bugs and production priorities (P0/P1).
14. **Run appropriate tests after modifications**: Execute typechecks (`npx tsc --noEmit`), unit tests, and export tests before declaring work finished.
15. **Never perform destructive database operations**: Do not wipe SQLite or JSON database files. Corrupted files must be backed up as `edgeview.db.corrupt.<timestamp>`.
16. **Request Coalescing / Per-Company Locks**: Prevent duplicate enrichment requests for the same company running simultaneously.
17. **Preserve Unicode data**: Do not strip non-ASCII characters from company names, addresses, or contact names (`José García`, `Company •`).
18. **Treat HTTP headers as ASCII-safe boundaries**: Encode `Content-Disposition` using RFC 6266 / RFC 8187 (`filename*=UTF-8''...`) with percent-encoded `attr-char` specials (`'() *`).
19. **Use canonical utilities**: All export endpoints must use `getSafeContentDisposition()` in `server/utils/header_encoder.ts`.
20. **Keep frontend/backend responsibilities separated**: UI handles display and state; backend handles AI provider orchestration, scraping, and export generation.

---

## 4. Intelligent Contact Enrichment Specification

### Pipeline Architecture
```
USER (Fetch Info)
  ↓
Check Cache / DB (`server/db.ts`, `server/sqlite.ts`)
  ↓ (If cached & complete: RETURN IMMEDIATELY)
Determine Missing Fields (emails, phones, address, leadership)
  ↓
AI Query Planner (NVIDIA NIM primary, Groq fallback) -> 3 to 5 targeted queries
  ↓
Search Provider (Serper API / Google search)
  ↓
Search Result Metadata & AI Relevance Ranking
  ↓
Filter to High-Value Pages (Contact, About, Leadership, Export)
  ↓
Scraper (Firecrawl API / Apify)
  ↓
Internal Link Discovery (Follow /contact, /about links)
  ↓
Evidence Corpus Construction
  ↓
Structured Extraction (NVIDIA NIM / Groq with JSON Schema)
  ↓
Deterministic Validation (Regex email/phone check, deduplication, URL validation)
  ↓
Source Evidence & Provenance Binding
  ↓
Cache & Database Persistence
  ↓
Contacts UI Update (Real-time progress states: Planning -> Searching -> Extracting -> Complete)
```

---

## 5. Export & Header Architecture Specification

### Server-Side Canonical Header Utility (`server/utils/header_encoder.ts`)
ALL export endpoints must use a single canonical utility to set `Content-Disposition`:
```typescript
export function getSafeContentDisposition(filename: string, inline: boolean = false): string {
  const sanitized = filename.replace(/[\r\n\0]/g, '').trim() || 'export';
  const safeAscii = sanitized.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_').trim() || 'export';
  const utf8Encoded = encodeURIComponent(sanitized).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  const dispositionType = inline ? 'inline' : 'attachment';
  return `${dispositionType}; filename="${safeAscii}"; filename*=UTF-8''${utf8Encoded}`;
}
```

### Custom HTTP Header Rule
- Custom headers like `X-Export-Failed-Formats` MUST NOT contain arbitrary Unicode text or bullet characters. They must be strictly ASCII-sanitized using `getSafeAsciiHeaderValue()`.

### DOCX Contact Directory Export Standards (`server/docx_report.ts`)
- **Margins**: 0.75 in (1080 dxa).
- **Title Banner**: Single-cell bordered table, width 100%, background shading `#F0F9FF`, 12pt `#0284C7` borders, Arial 14pt Bold, centered, Sky Blue accent.
- **Main Table Widths**:
  - `S.No`: 0.5 in (600 dxa)
  - `Company / Name`: 2.2 in (3200 dxa)
  - `Designation`: 1.5 in (2200 dxa)
  - `Contact Info`: 2.3 in (3360 dxa)

### Canonical Cache Identity Strategy
- Contact cache entries use deterministic compound keys: `${normName}__${countrySlug}__${roleSlug}`.
- Prevents collisions between corporate entities operating in different countries or under different trade roles (Importer vs Exporter).
- When country/role are omitted, lookup falls back to normalized `${normName}`.

---

## 6. Multi-Agent Operational Rules & Coordination Layer

The multi-agent engineering workflow is governed by persistent files in `.agent/`:
- `.agent/checkpoints/TEAM.md`: Role definitions and responsibilities for Antigravity (Lead Integrator), OpenCode + Nemotron (Advisor/Fixer), and Codex (Reviewer/Fixer).
- `.agent/checkpoints/TASKS.md`: Active task board and subsystem work area tracking.
- `.agent/checkpoints/DISCUSSION.md`: Discovered issues, proposed fixes, and architectural decisions.
- `.agent/checkpoints/CHANGELOG.md`: Detailed engineering changelog.
- `.agent/checkpoints/HANDOFF.md`: Catch-up guide for Codex when returning online.

1. **Antigravity**: Primary implementation and integration agent.
2. **OpenAI Codex & OpenCode / Nemotron**: Independent reviewer & engineering agents.
3. **Defect Fixing**: When any agent identifies a verified defect (P0/P1), the agent is expected to fix it immediately, run regression tests, and verify resolution rather than leaving report-only debt.
4. **Avoid Conflict**: Inspect existing code state and `.agent/checkpoints/ACTIVITY.md` before editing; preserve working changes and make focused, non-destructive updates.

---

## 7. Testing & Quality Assurance Contract

Every major update must be verified using:
1. `npx tsc --noEmit` (TypeScript typecheck across frontend and backend).
2. `npx tsx server/tests/header_encoder.test.ts` (Unit & SSRF security tests).
3. `npx tsx server/tests/export_unicode_e2e.test.ts` (End-to-end HTTP export tests).
4. Verified HTTP responses for CSV, XLSX, PDF, DOCX, and ZIP endpoints without `ByteString` header exceptions.
