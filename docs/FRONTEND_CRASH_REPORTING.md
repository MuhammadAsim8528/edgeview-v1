# Frontend render crash reporting

The existing React ErrorBoundary sends a fixed REACT_RENDER_FAILED code to the
loopback backend. It never submits the Error, component stack, URL or app data.
The backend rejects extra fields, attaches trusted build/install identity and uses
the existing strict monitoring projection. HTTP 202 means accepted locally, not
confirmed delivery. Reporting is limited to five attempts per page with a three
second abort deadline. Existing Host/Origin and mutation-throttle middleware apply.
Monitoring being disabled/offline does not prevent rendering the recovery UI.

The fallback no longer displays raw exception messages or claims uploaded data
is safe without evidence. Reset Section retries the affected view.

## Verification on 2026-10-25 (Pakistan)

- frontend_crash_privacy.test.tsx: static recovery markup excludes a synthetic
  private exception; offline report failures are contained; request body is exactly
  the fixed code; five-report budget enforced; safe projection retains fixed message.
- Isolated Chromium component fixture: actual React render failure reaches the real
  compiled backend endpoint with HTTP 202, fixed-code-only POST, no private marker in
  rendered UI, and successful Reset Section recovery. Extra-field request returns 400.
  The fixture is browser-routed test content, never a shipped application crash hook.
- All three diagnostics browser cases passed (27.4 seconds total), including disabled
  monitoring honesty and log-error refresh recovery.
- Application and E2E typechecks, lint, both monitoring privacy regressions, all nine
  V1 suites, production build and release smoke passed.
- CI now includes the frontend privacy regression. Hosted execution is not verified.

## Limits

This covers React errors caught by the existing boundary. It does not establish
coverage of unhandled promises, out-of-boundary errors, browser termination or native
process crashes. Real Sentry/PostHog delivery of this new render-crash event remains
unverified; earlier operational-event connection acceptance is separate evidence.
React/browser diagnostics may still contain errors in the local developer console;
this adapter does not upload those console records. No new tracing or replay enabled.
The build retains the existing >500 kB frontend bundle warning.
No package, deployment, merge, push or live runtime restart was performed for this slice.
