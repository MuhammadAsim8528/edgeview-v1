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

- Requested owner approval for future-event IP suppression; no setting changed.
- Need a fresh privacy-reviewed controlled event after that change and adoption
  of the intended exact integration build. Do not relabel historic events as new.
- Browser acquisition of http://127.0.0.1:3901 was explicitly denied by a saved
  origin permission. No alternate browser, port, raw CDP, indirect execution or
  backend substitute was used to obtain the blocked page's state.
- No live app connection, frontend crash proof, replay/privacy acceptance,
  updater acceptance or customer-ready verdict follows from this review.

Official PostHog documentation distinguishes project IP capture policy from
GeoIP enrichment: https://posthog.com/docs/product-analytics/privacy
