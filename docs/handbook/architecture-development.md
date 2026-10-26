# Architecture and development

Working engineering guide. Git is the source-control authority; Desktop Versions
are immutable reviewed snapshots, never a second development workflow.

Current implementation is React 19/TypeScript/Vite/Tailwind, Node/Express, sql.js
operational SQLite, existing JSON dataset authority and immutable V1 run files.
There is no Python backend, Electron/Tauri shell or cloud database replacement.
Do not revive archived autonomous research modules.

The main path is exact company+country → bounded query generation → deterministic
provider capture → identity/domain resolution → bounded retrieval/extraction →
evidence-scoped historical projection → durable contact state → API/UI/export.
AI suggestions/confidence are not facts. Original evidence and downstream failures
remain inspectable; failed later work must not erase stronger research.

server.ts owns HTTP boundaries; server/v1_engine.ts owns bounded capture;
server/job_manager.ts owns projection/jobs; server/contact_country_scope.ts owns
field scope. shared/v1_contact_contract.ts is the contact contract. The active UI
store and components are under src. AGENTS.md contains the current source map.

The original Pharma-AI development directory remains preserved. Reviewed work is
currently on integration/edgeview-v1-20261024 in edgeview-integration; reconciliation
back to the requested original location remains a gate. Do not overwrite either
tree or assume divergent commits are automatically accepted.

Developer checks include npm run typecheck, npm run lint, npm run test:v1,
npm run build and npm run test:release. Package and browser tests are additional
gates. Tests must use isolated paths and synthetic fixtures, never customer state.
Real-provider acceptance is opt-in, bounded and must compare independent sources.
Passing fixtures/builds cannot establish clean-Windows or real rendered correctness.
