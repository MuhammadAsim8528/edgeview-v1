# EdgeView V1 control audit

This inventory covers the components reachable from `src/App.tsx`. The retired `SettingsTab.tsx` is not imported and is excluded from the Windows package. “Runtime verified” means the backing API or resulting persisted state was exercised directly; it does not mean the control was visually clicked.

| UI surface / control group | Owner and backend path | State or side effect | Evidence |
|---|---|---|---|
| Sidebar open/close and tab navigation | React `Header`, `Sidebar`, `appStore` | Browser state; active tab persisted locally | Source traced; visual interaction blocked by browser policy |
| Upload/drop file | `UploadArea` → `appStore.uploadFile` → `POST /api/files/upload` | SQLite/file metadata and parsed rows | Parser/security and provenance tests pass; visual interaction blocked |
| Select/reload/delete file | `Sidebar`, `FileViewer` → `/api/files`, `/api/files/:id` | Selected-file state; delete is persistent | Routes traced; destructive delete was not invoked |
| File filters, sorting, pagination, table/text view | `FileViewer` → bounded `/api/files/:id/data` | React query/view state | Routes traced; runtime reads covered by load smoke |
| Save to history | `FileViewer` → `POST /api/files/:id/save-to-history` | Persistent history snapshot | Isolated synthetic save and durable JSON row count verified; test-mode record intentionally excluded from real-history listing; not visually clicked |
| Export buttons and format/scope selectors | `GlobalExportModal`, `CountryView`, `Summary` → `/api/export`, `/api/export/country/csv` | Download artifact | Unified API exercised for CSV/XLSX/DOCX/PDF/all-formats ZIP; selection content checked in CSV/XLSX/DOCX, PDF signature and ZIP members checked; all format buttons not visually clicked |
| Country and statistics drilldowns | `CountryView`, `StatsTab` → `/api/countries/*`, `/api/stats/*` | Read-only filtered views | Isolated exact-country/importer/filter/summary checks added; broad visual drilldown remains unverified |
| Contacts filters, selection and pagination | `Contacts` | React state plus `/api/summary`, `/api/international-importer-directory` | Routes traced; visible data not visually audited in this run |
| Fetch details / force fetch | `Contacts` → `appStore.enrichCompanyAutomated` → `POST /api/enrich/company` | Immutable V1 run and persisted contact projection | V1 requirement tests and real provider diagnostics pass; no new paid full run performed |
| Batch enrichment selection/start/stop/resume | `BatchEnrichmentModal` → `/api/enrich/jobs*` | Persistent resumable job | Endpoints traced; production dataset job not restarted during release audit |
| Research run selection/refresh/result expansion | `ResearchWorkspace` → `/api/v1/runs*` | Read-only immutable evidence | Runtime and release tests pass; visual expansion blocked |
| Provider enable/model/primary/save | `SettingsTabV1` → `/api/settings` | Atomic `config.json`; consumed by V1 router | Save/read/restart persistence verified; routing-order regression test passes |
| Provider test / Test enabled providers | `SettingsTabV1`, `SystemHealthPanel` → `/api/settings/test`, `/api/system/health/test` | Process-local diagnostic result; small provider request | Serper/NVIDIA/Groq verified; invalid Serper key rejected; Hunter disabled; isolated timing/recovery API tests pass |
| Telemetry refresh | `SystemHealthPanel` → `/api/governor/provider-metrics` | Read-only durable aggregates and live guard state | Runtime verified; no fabricated healthy state |
| System/enrichment log tabs, refresh, search | `LogsViewerPanel` → `/api/logs/system`, `/api/logs/enrichment` | Read-only bounded log tail | Runtime verified including restart and secret-redaction probe |
| Error-boundary retry | `ErrorBoundary` | Component remount/refresh | Source traced; deliberate UI crash not injected |

## Removed or hidden release controls

- The database-reseeding **Sample Files** button was removed from the active header. Its API now returns 404 unless the process is explicitly started with `EDGEVIEW_ENABLE_SAMPLE_DATA=1`.
- The retired multi-provider `SettingsTab.tsx` and compatibility wrapper are excluded from the Windows package.
- Log deletion and the empty legacy synchronization-log tab are not exposed in V1.
- The pre-V1 dynamic scoring/capability-weight editor is not part of active V1.
  `/api/governor/limits` returns 410, and unsupported settings (including obsolete
  provider weights) are rejected rather than acknowledged as saved.

## Visual verification limitation

The browser-control authority denied the local `http://127.0.0.1:3901` origin and explicitly prohibited alternate-browser or raw-control workarounds. Consequently, the code/API/persistence audit is authoritative for behavior, but a true click-by-click rendered audit remains outstanding.
