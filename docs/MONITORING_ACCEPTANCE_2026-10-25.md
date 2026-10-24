# Monitoring connection acceptance — 2026-10-25 (Pakistan)

## Verified scope

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
