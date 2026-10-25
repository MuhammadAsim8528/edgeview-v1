# Monitoring connection acceptance — 2026-10-25 (Pakistan)

## Current isolated artifact: actual dashboard receipt

Verified source `5f33d838654218a702d6991fccd49a32832e628d`, version
`1.0.0-rc.2`, beta build
`2219c29203493cf7c3c3faad437fc966ea85cc5d86e95532639035941893d186`.
The opt-in probe started at 2026-10-25T17:16:51.380Z using empty temporary
storage, no provider credentials/dataset, installation UUID
`aad22c93-6b13-4675-b545-3456cbb677ec`. Its owned runtime was stopped afterward.
The existing live port 3901 was not restarted.

Actual authenticated browser observations (not inferred from SDK flush):

- Sentry backend project `4512304043065344`, organization `dupido-technologies`:
  issue `7811771267` / `EDGEVIEW-BACKEND-5`, event
  `0059dbf45dfb48a081458d0e0621ca98`. Fixed message "EdgeView interface rendering
  failed", `REACT_RENDER_FAILED`, matching build/installation and beta environment.
  Release includes version and full build hash. Geography displays filtered fields;
  replay/attachments absent. This exercises the controlled frontend report API,
  not an actual React render crash or every fatal startup path.
- PostHog US project `682784`: expanded doctor_run and app_started entries match
  the same build/installation. Doctor event UUID
  `01a17410-ad4a-7076-a8ad-5e12a0e1cb84`; sent_at
  `2026-10-25T17:16:52.428Z`. GeoIP disabled=true; expanded properties show no
  IP/location or business payload. Displayed event timestamp differs by about
  twenty seconds; exact clock/ingestion adjustment was not investigated.
- Sentry backend privacy readback: data scrubber/default scrubbers/IP prevention
  enabled, additional sensitive fields city/subdivision/region/country_code/
  ip_address; safe fields empty. PostHog discard-client-IP enabled.
- PostHog web autocapture was enabled: switched OFF, success toast observed,
  reloaded and verified aria-checked=false. Web-vitals/dead-click autocapture off.
  Session replay page explicitly shows Record user sessions=0 and Recording is
  disabled. Disabled console/network replay subcontrols retain enabled defaults;
  replay is not enabled to edit these and no active replay collection is claimed.
  Replay retention UI shows 30 days, which is not analytics/error retention proof.

Hosted checks on this exact source passed: release checks `40215633218`,
release evidence inventory `40215633265`, research read contracts `40215633196`.
These are not clean-Windows or live browser QA.

Existing Sentry backend error monitor `10733752` is connected by project to alert
`6216926`, "Send a notification for high priority issues". History actually shows
the controlled render failure triggering at 2026-10-25 17:16 UTC. Conditions cover
new/existing high-priority issues; existing recipient policy is Suggested Assignees
with Recently Active Members fallback. No recipient access was expanded and no
duplicate alert created. Changed repeat throttling from every trigger to one hour
per issue; saved detail page reads "1 hour" and updated modification time. This
proves rule triggering/configuration, not receipt in the owner's email inbox.

Remaining: exact owner notification delivery, analytics/error retention and access assessment,
broader crash coverage, final packaged release delivery and
live rendered acceptance. No claim of full monitoring or release completion.

## Customer monitoring choices (candidate implementation)

Settings now has independently labelled error-reporting and usage-analytics
checkboxes. Save uses `/api/monitoring/preferences`, strict two-boolean validation,
one in-flight save and the existing atomic canonical settings/DPAPI store.
It does not accept ingestion identifiers or provider credentials. Persisted
choices load before monitoring initialization; unreadable preferences fail closed.
The environment master switch remains an upper bound, not something this UI
can override. Reset Settings preserves the monitoring choices rather than
silently opting a user back in while resetting provider configuration.

Disabled choices gate capture and SDK transport. Serialized transitions drain
queued-but-unsent events without vendor requests before allowing re-enable.
In-flight network requests cannot be recalled; historical dashboard data is not
deleted. No opt-out event is sent. Resource cache is cleared on a choice change.
The source-of-truth remains config.json; no browser-storage consent authority.

Actual local SDK transport regression passed startup opt-out, independent vendor
choices, pending analytics discard (including a network-failed in-flight batch)
and no resurrection on re-enable. A disposable mutation removing the PostHog
transport guard failed at the actual queued-event network assertion as required.
Four
isolated compiled-browser tests passed real UI/API save, invalid payloads, restart
durability, installation-level disabled behavior, mocked 503 honest UI and
keyboard disclosure/provider settings. These use synthetic empty storage and blocked external
network access, not the policy-denied live 3901 UI. Final candidate checks pending.

An additional adversarial identity case failed before correction: enabling a
previously disabled vendor after rejected build identity showed
CONFIGURED_UNVERIFIED despite no SDK initialization. Initialization errors are
now retained and enabling a choice does not manufacture readiness; the regression
passes with ERROR/INVALID_IDENTITY and no SDK/network access.

## Current routing/release correction

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
