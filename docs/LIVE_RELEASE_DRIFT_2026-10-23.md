# Live installation versus source — 2026-10-23

Read-only actual HTTP observation at http://127.0.0.1:3901/api/health:

- app.name=edgeview; status=ok; app.pid=30112.
- app.build.version=1.0.0 (app.version was null; do not confuse the fields).
- buildId=2143be7901f9d1806144f63311d99255e1be624d7fc61e2d272ca274b2e5a973.
- sourceHash=4a2112e6c21913b5cf25c34bf132ac8dc4ea8b111622d1a2b33e295cbc135054.
- artifactHash=dd6ae238266e4d7cd6bb48d3827b4d37ad84d6b7509c441d5d0c335b7c2a26e8.
- builtAt=2026-10-22T12:43:34.3Z.
- gitCommit=f96a6da068d44a8ed8d0d51aae4b017f96db3038.
- Provider names=nvidia, groq, serper, hunter. This is an allowlist observation,
  NOT four successful provider calls or current quota/credential validation.

This running build predates ce43a52/3af6bd0/e970426/314ee32 and subsequent release
branch tools. Healthy API is not proof that these fixes are deployed. Build
metadata is the app's startup report, not independent binary attestation. No
backend restart, source copy, customer packaging, data mutation or paid provider
operation was performed. Qoder's installation remains its responsibility.

Supported Computer Use initialization again failed before app enumeration:
`failed to write kernel assets: The system cannot find the path specified.
(os error 3)`. No screenshot, permission prompt or UI action was obtained. No
alternate port/browser/CDP bypass. Visual QA stays NOT VERIFIED.

## Source-to-control tracing started, not completed

| Control | Source | Backend/action | Acceptance still needed |
|---|---|---|---|
| Settings initial load | SettingsTabV1.tsx load | GET /api/settings, masked/configured flags | Rendered configured/disabled/error states |
| Test connection (four providers) | testProvider | POST /api/settings/test with candidate key/model | Actual credits/status, no secret exposure, UI feedback |
| Save configuration | save | POST /api/settings, persistent authority, mask cleared after success | Restart + routing + UI validation |
| Research refresh | ResearchWorkspace.tsx load | GET /api/v1/runs?limit=1000 | Exact-build refresh/error/empty handling |
| Research run selection | selectedId effect | GET /api/v1/runs/:id | Out-of-order response and failure UX |
| Expand captured fields | expanded state | Local display of retained result | Every field visible; full content/scroll/accessibility |
| Open source | result URL anchor | External navigation, not retrieval | Scheme safety and normal browser interaction |

Important source-review risk: ResearchWorkspace's selectedId/runs effect does
not abort or ignore superseded responses; a slow prior request can overwrite the
new selection. Failed list/details requests have no explicit error presentation,
so a failure can appear empty or leave unrelated old details. This is a concrete
source path requiring a focused reproduction/fix, NOT a completed rendered
reproduction. Settings already has different error-toasts; do not generalize one
component's behavior to the whole app. Full safe-control inventory is incomplete.

## Passive provider-metrics observation

Later read-only GET /api/governor/provider-metrics on the same live installation:

| Provider | Status | Routing | Completed count reported | Success rate | Average latency ms |
|---|---|---|---:|---:|---:|
|Serper|unknown|available|16|1|2477|
|Hunter|disabled|disabled|0|unknown|unknown|
|NVIDIA|unknown|available|8|0.75|3823|
|Groq|unknown|available|3|1|1401|

These are reported retained/runtime aggregates, not new operations or a current
health probe. Unknown must not become healthy; available routing does not prove
authentication, quota or generation success. No key, error body, company or raw
provider content was printed. Hunter was not tested/reenabled. Full enabled-
provider verification and real-company behavior remain open.
