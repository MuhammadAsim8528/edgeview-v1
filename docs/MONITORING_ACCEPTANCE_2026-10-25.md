# Monitoring connection acceptance — 2026-10-25 (Pakistan)

## Current routing/release correction (dashboard acceptance pending)

Actual account inspection found routine app_started/resource_sample events as
Sentry issues. The adapter previously sent every projected event to both vendors.
A new actual-transport regression reproduced app_started going to Sentry.
Routing now follows the existing vendor-independent event allowlist:

| Event | Destination / behavior |
| --- | --- |
| runtime_error | Sentry fixed error code/message only; no duplicate PostHog error tracking |
| Allowed product events emitted by implemented paths | PostHog only; reserved event names do not prove a feature exists |
| doctor_run | Both, only for explicit controlled diagnostic/delivery checks |
| resource_sample | No standalone vendor event; retain at most five numeric resource values as short-lived error context |
| operation_timing | Not forwarded as an issue or product event; performance-span integration is not complete |

Latest resource context expires after six minutes (monotonic clock), carries a
bounded age, and is not treated as a current reading after expiration. Explicit
error measurements take precedence over the cached sample. No raw data retained
in this cache. Release is reconstructed as edgeview@<version>+<full build hash>
and environment as validated channel at both SDK initialization and final event
projection. Invalid identity fails before SDK initialization. SDK v11 explicit
all-false dataCollection, zero trace rate, disabled auto-integrations/replay and
strict final field projection remain in force. No 100% tracing was enabled.

Local observed checks: actual vendor routing/release/resource expiry regression,
invalid-identity no-SDK/no-send control, transport privacy and rejection/offline/
recovery tests PASS. Probe helper requires exact --send-real opt-in, official
Sentry public-key DSN shape and US PostHog ingestion key, empty temporary local
storage and verified child PID/build; normal controls send no real event. Real
probe additionally submits the fixed frontend report code to the owned runtime;
HTTP 202 is only accepted locally, never asserted as delivery or actual React
crash. Current-build dashboard receipt, alert rules, retention/access and customer
monitoring on/off controls still require acceptance.

The older observations below are preserved historical evidence, not current
release approval or proof of this corrected compiled build.

## Historical verified scope

The integration checkout is configured locally for Sentry project `edgeview-backend`
in organization `dupido-technologies` and PostHog US project `682784`.
Ingestion configuration is in ignored `.env`; no ingestion token or DSN is committed here.
This is not deployment to the existing live port-3901 runtime.

Tested version: `1.0.0-rc.2`.
Tested source commit: `3bb42fbce05b2e0504aa30a2e194b8a5081aaa36`.
Tested build ID: `c957a314dd1650f2f3858d4d738604361999f218ebaed8d390d10c4295e57a46`.

A temporary compiled runtime used empty JSON/config, its own SQLite/evidence/identity
paths and an OS-environment allowlist plus only the monitoring ingestion settings.
The probe verified the child PID before POSTing `/api/monitoring/test`.
The temporary runtime was stopped and its state removed afterward.
No live provider credentials or production dataset were used.

## Results actually observed

- Production build passed; Vite warned about the existing >500 kB frontend chunk.
- First owned-runtime attempt failed readiness within 45 seconds. No delivery success
  was claimed from it. A second fresh owned runtime completed the API proof.
- `/api/monitoring/status` began at `CONFIGURED_UNVERIFIED` for both vendors.
- `/api/monitoring/test` returned projected=true and both vendor results=true.
- `/api/runtime/state` reported both vendors `TRANSPORT_OK`, replay `OFF`, and
  dashboard_verified=false. Runtime does not infer dashboard visibility.
- PostHog Activity displayed app_started, resource_sample and doctor_run from the
  temporary installation. Expanded doctor_run properties matched the exact build ID
  and version above; geo-IP enrichment was disabled and replay was unavailable.
- Sentry issue search filtered by the exact build ID displayed app_started,
  resource_sample and doctor_run in the intended backend project.
- Actual SDK transport privacy regression passed: 10 local recorded requests,
  with no synthetic private business/contact/evidence/prompt/path/key markers.
- Test-mode dotenv isolation regression passed after configuring local monitoring.
- Earlier commit 3bb42fb passed application/E2E typecheck, lint, runtime-recovery
  regression and isolated rendered disabled-monitoring/API acceptance.

## Remaining acceptance limits

Network-derived IP metadata is still visible in PostHog event properties, and Sentry
project IP-storage prevention was observed disabled. Payload allowlisting does not
prevent server-side network metadata enrichment. This privacy requirement is OPEN.
No claim of complete privacy acceptance, frontend crash coverage, tracing, outage /
rejected-ingestion behavior, clean-Windows acceptance or full release readiness.
The positive real-account proof covers operational events, not a deliberate crash.

Git history and build metadata provide version/build provenance. They are not code
signing, licensing authentication, a device keypair or an application updater.
No merge, push, package publication or live runtime restart was performed.
