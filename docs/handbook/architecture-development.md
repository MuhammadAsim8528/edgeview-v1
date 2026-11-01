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

The permanent Pharma-AI development checkout now uses development/edgeview-v1,
based on reviewed integration source3ac6c39. The former integration checkout is
retained for reference; active source changes belong in the permanent checkout.
Older main history remains available. Source reconciliation does not deploy a
running backend or update its dependencies. A controlled build/runtime handoff
and customer-data compatibility acceptance remain separate gates.

Developer checks include npm run typecheck, npm run lint, npm run test:v1,
npm run build and npm run test:release. Package and browser tests are additional
gates. Tests must use isolated paths and synthetic fixtures, never customer state.
Real-provider acceptance is opt-in, bounded and must compare independent sources.
Passing fixtures/builds cannot establish clean-Windows or real rendered correctness.
