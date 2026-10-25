# Existing monitoring projects — independent browser review

Reviewed 2026-10-25 (Asia/Karachi), from release branch parent 5dd926d.
No monitoring credentials, private event payloads or network addresses are recorded here.

## Actually observed

- Supported Chrome browser connection works for the external dashboards.
- Sentry organization dupido-technologies has edgeview-backend and edgeview-frontend.
- Backend issue feed contains app_started, resource_sample, doctor_run and an
  Unexpected EdgeView error. This alone does not bind every issue to one build.
- PostHog US project 682784 shows app_started, resource_sample and doctor_run
  within the selected last-24-hours interval.
- Expanded doctor_run has version 1.0.0-rc.2, beta channel and build ID
  c957a314dd1650f2f3858d4d738604361999f218ebaed8d390d10c4295e57a46.
  It has a pseudonymous installation UUID and numeric resource properties.
- The same event shows GeoIP disabled=true, but still includes a network-derived
  IP property. Backend Sentry project has server-side/default scrubbing enabled
  and Prevent Storing of IP Addresses disabled.

These observations corroborate the older controlled integration proof, not a new
test from this branch or the owner's live application. No event was sent in this
review; no key, project, account, permission grant or paid service was created.

## Repository reconciliation

Monitoring is implemented on integration/edgeview-v1-20261024, not on this
release-reconciliation branch or original main. Relevant commits include
bc738de, b5867c1, a58fb28, d1d95a8, b5fe935 and 365021c. The integration branch
also has c8019b7 for opt-in writable-state separation. Do not recreate these
systems or copy a dirty workspace wholesale. Their coherent changes and actual
SDK transport/privacy/failure tests need reconciliation before adopting them.

The integration acceptance document binds the above test build to commit
3bb42fbce05b2e0504aa30a2e194b8a5081aaa36 and explicitly excludes port 3901.
The newer integration implementation is not certified by the older delivery.

## Open actions / limits

- Owner approved future-event IP suppression. Sentry backend and frontend
  Prevent Storing of IP Addresses are now enabled; PostHog project 682784
  Discard client IP data is enabled. All three values were read back after
  reload. No historical events were deleted and no unrelated setting changed.
- Independently reran integration commit c8019b7's actual SDK transport/privacy
  and rejected/offline-delivery tests with an OS-only child environment. Both
  passed; six local captured requests contained no private synthetic markers.
  These used local test endpoints, not a new real-account delivery.
- Need a fresh privacy-reviewed controlled event after that change and adoption
  of the intended exact integration build. Do not relabel historic events as new.
- Browser acquisition of http://127.0.0.1:3901 was explicitly denied by a saved
  origin permission. No alternate browser, port, raw CDP, indirect execution or
  backend substitute was used to obtain the blocked page's state.
  A new attempt after the owner reported changing permission returned the same
  saved-origin denial. External Sentry/PostHog dashboard access remains usable.
- No live app connection, frontend crash proof, replay/privacy acceptance,
  updater acceptance or customer-ready verdict follows from this review.

Official PostHog documentation distinguishes project IP capture policy from
GeoIP enrichment: https://posthog.com/docs/product-analytics/privacy

## Fresh controlled delivery after IP suppression

Sent one controlled probe at 2026-10-25T08:37:03.879Z using the existing compiled
integration artifact, commit 365021cc0dbad109901463e727edebe8c1e00be5, version
1.0.0-rc.2. Build ID:
`b475329a4f8032cfd4f6769ec24e1afb19760de78845774b2c8d8ee73a4f481a`.
The disposable installation ID was `57e498c8-fd1b-46a6-ab7b-6cf90cd8086f`.
No provider credentials or operational dataset were loaded. The process and
temporary state were removed afterward; the compiled artifact remained unchanged.

- PASS: both transports acknowledged delivery.
- PASS: actual PostHog doctor_run event matched build/installation IDs and sent
  timestamp 2026-10-25T08:37:04.721Z. With Hide null values turned off, its expanded
  event showed no IP property.
- PASS: actual Sentry doctor_run event `df8de2834c9e4f94b096d653eb5314ca`
  in EDGEVIEW-BACKEND-2 matched the same build/installation IDs. No stored IP
  field was visible in the event details.
- WARN: Sentry still displays derived geography. IP suppression does not itself
  remove that information. Owner approval for additional location scrubbing is
  pending; historical events were not deleted.
- NOT VERIFIED: live port 3901, this branch/current integration source, frontend
  crashes, comprehensive doctor results, traces, update recovery and final privacy
  acceptance. A controlled doctor_run event is a delivery signal, not proof of
  all doctor checks or crash capture.

The helper `scripts/probe-existing-monitoring-build.mjs` requires explicit
`--send-real`, validates existing artifact identity, isolates state and suppresses
credentials/child output. Its output deliberately leaves dashboardVerified false;
the dashboard observations above were performed separately through Chrome.
The latest supported local-tab acquisition still returns saved-origin denial
despite the supplied Always allow screenshot. This remains a browser integration
blocker, not evidence of EdgeView failure.
