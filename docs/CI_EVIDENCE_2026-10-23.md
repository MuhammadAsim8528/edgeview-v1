# Hosted CI and dependency evidence — 2026-10-23

This supersedes only the access/unknown portions of earlier branch notes, not
their historical observations. GitHub connector404 was not repository absence:
existing Git Credential Manager authentication permitted read-only REST access.
Credentials were held transiently in process variables, not printed/persisted.
Repository metadata confirms private=true/default_branch=main. The returned
security_and_analysis value was null: CodeQL, secret scanning and push protection
enabled/entitlement state remain NOT VERIFIED, not disabled or unavailable.

## Exact hosted evidence

Commit275fc016a055a33ef32511aa9726d45e8b55e470:
- Release evidence inventory run39915804165: completed/success.
- Main checks run39915804872: completed/failure.
- docker-qa job120289008438: success.
- Windows verify job120289008744: failure at step8,
  `npm audit --omit=dev --audit-level=high`.
- publish job120289707363: skipped. No release/customer acceptance inferred.

Commitb2441588c3609a61d50bef86af3ce87da7840242:
- Inventory run39915617518: success.
- Main checks run39915617509: failure (not independently inspected to root cause).

Commit1448db1dd7ec6f0df5737578d42950e1b4413bfd:
- Main checks39916230615 and inventory39916230704 were queued when read.
  A queued handle is not a pass or a failed observation; inspect its terminal
  state separately. This document records a dated snapshot only.

Run links:
- https://github.com/MuhammadAsim8528/edgeview-v1/actions/runs/39915804165
- https://github.com/MuhammadAsim8528/edgeview-v1/actions/runs/39915804872
- https://github.com/MuhammadAsim8528/edgeview-v1/actions/runs/39916230704

## Fresh local production-lock audit

Command `npm audit --omit=dev --package-lock-only --json`, no dependency install
or package change, returned exit1. Counts: zero critical, one high, two moderate.
This differs from historical October20 audits: do not reuse their severity counts.
Vite6.4.3 is direct; uuid8.3.2 via ExcelJS4.4.0 remains moderate (npm also reports
the affected parent ExcelJS). A package count is not the count of unique CVEs.

High Vite/launch-editor advisory:
https://github.com/advisories/GHSA-587h-7wmj-h5pm
The official reviewed advisory lists Vite<=6.4.3 affected and6.4.4 patched.
Other Vite advisories were returned by npm as well; rerun audit after upgrading,
don't assume one version change clears every future advisory.

uuid advisory: https://github.com/advisories/GHSA-w5hq-g745-h8pq
Affected buffer APIs described upstream are v3/v5/v6; this record does not claim
a reachable exploit through EdgeView. A breaking forced ExcelJS downgrade is not
approved or a safe substitute for compatibility review.

## Qoder-owned integration action

package.json/package-lock.json are actively changed by Qoder. ChatGPT did NOT
edit them or weaken the audit threshold. In a narrow dependency commit, resolve
Vite's patched compatible6.x line, inspect the resulting lock delta and run exact
install/typecheck/lint/build/static-default/no-HMR/release tests and audit, then
confirm hosted Windows+Docker results on that exact commit. Keep unrelated new
telemetry dependencies out of this dependency-only commit if not yet accepted.

server.ts statically imports Vite but only enables middleware when
EDGEVIEW_DEV_SERVER=1. That constrains production reachability; it does not patch
the shipped dependency or justify marking the high-severity gate green.

Inventory green proves only inventory tests/collection/history pattern steps at
the named commit. It does not prove app tests, package installation, visual QA,
telemetry safety, license clearance or clean Windows. Overall verdict NOT READY.
