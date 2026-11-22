# 01_SPEC.md — 5-Live-Session Swarm Orchestration Matrix

> [!IMPORTANT]
> **MULTI-AI FACTORY DIVISION OF LABOR (5 LIVE SESSIONS)**
> Orchestrated by Antigravity across active desktop terminals and web sessions.

---

### Department-to-Live-Session Mapping

| # | Live Session | Backend / Engine | Department Role | Exclusive Zone & Lock | Hard Boundaries |
| :- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Claude Code CLI** | Moonshot Kimi K3.1 (via Bedrock Proxy) | **Dept 2: Backend Core & CI Gatekeeper** | `server.ts`, `server/db.ts`, `server/trade_relationship_resolver.ts`, `server/export_manager.ts` | **NEVER** edit `src/` or document templates. Focus on backend tests (`npm run test:v1`). |
| **2** | **Kimi Code CLI** | Moonshot Kimi K3.1 (via Bedrock Proxy) | **Dept 3: Frontend UI & Exporters** | `src/`, `server/parsers.ts`, `server/docx_report.ts`, `server/pdf_report.ts`, `server/docx_stream.ts` | **NEVER** edit `server.ts` or database persistence layers. Ensure clean XML/binary exports. |
| **3** | **OpenCode Session 1** | Nvidia NIM Nemotron 3 Ultra 550B High | **Dept 4: Security & Adversarial Review** | Read-Only Diff Reviewer across all files | Scan for SSRF, unhandled promise rejections, credential exposure, and memory leaks. |
| **4** | **OpenCode Session 2** | DeepSeek / Qwen | **Dept 1: Architecture & Spec Verification** | Read-Only Spec Reviewer (`01_SPEC.md`, `AGENTS.md`) | Verify Thorne Berry healthcare export contracts (Kenya, Somalia, South Sudan, Sudan). |
| **5** | **Hermes Original Session** | Hermes Agent (`20261122_085129_650057`) | **Dept 6: Floor Dispatch & Bug Escalation** | `.ai-brain/03_LIVE_FEED.md`, `.ai-brain/04_BUG_MEMORY.md` | Log 1-line heartbeats. Enforce max-3 retry limit and escalate to Antigravity. |
| **6** | **Antigravity** | Gemini 3.8 Flash High | **Central Swarm Arbiter & Release Master** | Build pipeline, Parallel QA Subagents, Git & GitHub Releases | Execute `npm run build`, E2E test runs, auto-approvals, and git push to GitHub. |

---

### Non-Collision Invariants
1. **Single-Writer Lock**: No two sessions may edit the same file at the same time. Check `02_TASK_BOARD.md` before writing.
2. **Hop Limit**: If any session fails a test or build 3 times, it MUST stop immediately and log the issue in `04_BUG_MEMORY.md`.
3. **One-Line Heartbeat**: All milestone completions are logged in `03_LIVE_FEED.md` in the standard format:
   `[HH:MM:SS] [Session] [Action] -> [PASS/FAIL]`
