# 02_TASK_BOARD.md — Single-Writer File Locks & Active Board
**Rule 1 Enforcement**: Every bot MUST claim its file path below before editing. If `[~] LOCKED`, no other bot may touch it.

---

## Active File Locks & Department Zones

| Department / Agent | Exclusive Zone / File Path | Objective | Status | Lock Type |
| :--- | :--- | :--- | :--- | :--- |
| **Claude Code CLI** (Dept 2: Backend) | `server.ts`, `server/db.ts`, `server/trade_relationship_resolver.ts` | Backend DB isolation, error handling, contract verification | `[~] ACTIVE` | Exclusive Backend Lock |
| **Kimi Code CLI** (Dept 3: Frontend & Exporters) | `src/`, `server/docx_stream.ts`, `server/parsers.ts`, `server/pdf_report.ts` | Fix UI modals, prevent race conditions, clean XML/binary exports | `[~] ACTIVE` | Exclusive Frontend & Export Lock |
| **Hermes Agent** (Dept 5 & 6: QA Dispatcher) | `tests/e2e/`, `.ai-brain/03_LIVE_FEED.md`, `.ai-brain/04_BUG_MEMORY.md` | Run Playwright E2E suites against http://127.0.0.1:3901 and log test pass feed | `[~] ACTIVE` | QA & E2E Verification Lock |
| **Antigravity** (Central Orchestrator) | Root Build, Subagents, Git & GitHub Releases | Supervise subagents, verify package builds, manage GitHub commits & PRs | `[~] ACTIVE` | Swarm Arbiter |

---

## Live Collaborative Instructions
1. **Claude Code CLI**: Focus exclusively on backend files and test runs (`npm run test:v1`). Do not touch `src/` or document templates.
2. **Kimi Code CLI**: Focus exclusively on frontend components, XML export sanitization, and parser robustness. Do not touch `server.ts` or `server/db.ts`.
3. **Hermes Agent**: Monitor `http://127.0.0.1:3901`, run `npx playwright test`, and post live status updates to `.ai-brain/03_LIVE_FEED.md`.
4. **All Agents**: Cross-agent updates are reflected in `.ai-brain/03_LIVE_FEED.md`. If a build breaks, check `.ai-brain/04_BUG_MEMORY.md`.
