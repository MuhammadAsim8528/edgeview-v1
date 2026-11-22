# 04_BUG_MEMORY.md — Escalation & Hop-Limit Ledger
**Rule 2 Enforcement**: Strict 3-attempt cap. If a test or build fails 3 times on the same file, stop immediately, log here, and escalate.

---

## Resolved Escalations
| Ticket ID | Target File / Area | Symptom / Failure | Attempts | Escalated To | Final Resolution |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **ESC-001** | `scripts/test-no-egress.cjs` | Synthetic history fault didn't trigger HTTP 500 in `export-history-failure.spec.ts` | 2 | Antigravity | Updated query string match from exact equality to `.includes('FROM history_data')`. |
| **ESC-002** | `server/trade_relationship_resolver.ts` | Query bypassed SQLite when `loadedTradeFileIds.has(fileId)` was true | 2 | Claude Code | Removed memory short-circuit so SQLite integrity is verified on every build. |
| **ESC-003** | `server/routes/upload.ts` | Unwrapped SQLite inserts blocked event loop for 2.6s on 17k rows | 1 | Kimi Code | Wrapped in `BEGIN TRANSACTION` / `COMMIT`. Insert latency dropped to 0.18s. |

## Active Escalation Watch
- **Watch 1**: Large-contact 4-format ZIP generation (3,200 rows) must complete within the 150s extended response timeout.
- **Watch 2**: Cross-company research isolation in `server.ts:856` (OpenCode Session 2 security audit).
