# Isolated rendered-workflow checks

These engineering checks supplement the existing Node/tsx tests. They do not
certify the live port-3901 installation, real provider accuracy, all UI controls,
or clean-Windows customer installation. Supported live Computer Use QA remains
a separate gate; this runner does not attach to or bypass that browser session.

## Run

From the development checkout with locked dependencies installed:

```
npm run build
npx playwright install chromium
npm run typecheck:e2e
npm run test:e2e
```

Playwright 1.64.1 is pinned as a development dependency (Apache-2.0, Node >=20;
the project CI uses Node 24). Browser binaries are an explicit developer/CI
installation, not part of the customer runtime or frontend bundle.

## Isolation and evidence

- Each test creates its own private temporary JSON/SQLite/config/evidence paths;
  tests do not inherit another case's uploads or settings.
- It starts the compiled production-mode backend, not Vite or a mocked UI.
- It chooses an unused loopback test port and verifies the backend PID before
  upload; it never reuses a running server or accepts an external target URL.
- Only a small OS environment allowlist reaches the backend. Provider keys and
  developer dotenv/config files are not inherited.
- A child-only preload blocks outbound HTTP(S)/fetch. Browser page traffic is
  restricted to that owned origin. No real-company/provider run is requested.
- The workflow uploads a generated synthetic CSV through the actual UI. There
  is no production test-seeding endpoint or manually injected research success.
- The fixture owns shutdown/restart and removes only its own temporary directory.
- No retries are configured to hide a first-run failure. Failure screenshots,
  traces and console/page errors are retained under `.test-cache/e2e-artifacts`.
  A successful workflow also retains a screenshot and allowlisted build identity.
- Windows CI uploads synthetic artifacts for seven days. Do not point this test
  at customer data or put private fixtures into it.

Current workflow targets startup, CSV upload, backend pagination, full CSV
download contents, country/importer keyboard drill-down, tab/selection refresh
and backend restart persistence. Expand independently to settings/diagnostics,
contact filters/selections, provider failure UX, races and accessibility. A green
single workflow is not exhaustive QA or a leak test.

The restart case closes the UI page before stopping/restarting its owned backend,
then reopens it in the same browser context. It does not certify graceful Windows
shutdown, in-flight write recovery, offline-while-open UX, page/accordion/scroll
restoration or a production launcher restart. Those remain separate gates.

The controlled-failure case injects only failed/malformed responses, never a
successful dataset. It checks visible file/country/importer errors, absence of
stale rows and private server text, and recovery after restoring the real API.
Deliberate HTTP 500/503 console resource errors are retained and narrowly checked
in that failure case; the happy path still requires no console/page errors.

The contact-export case checks the visible exporter default, an explicit importer
override, reset when reopening, selected-company persistence through refresh,
and actual selected-export CSV contents. It performs no enrichment/provider call.
These tests establish only their synthetic scenarios, not the historical
633-versus-626 exporter discrepancy or real contact accuracy.

## Official setup references

The Settings case changes provider toggles, primary AI provider and Groq model
through the rendered form, verifies the actual persisted API response, restarts
the owned backend, and checks both restored controls and backend values. It also
checks that a disabled provider cannot be tested and a missing Groq key produces
a visible failure, not success. No credentials or provider credits are used.
This proves persistence for these settings, not configured-provider routing,
real authentication, quota handling, or live installation behavior.

- [Playwright web-server/environment behavior](https://playwright.dev/docs/test-webserver)
- [Screenshots and retained traces](https://playwright.dev/docs/test-use-options)
- [CI browser installation and worker guidance](https://playwright.dev/docs/ci)

The documentation retrieval connector returned HTTP 402; official Playwright
pages were read directly instead. Registry metadata confirmed the pinned version,
license and engine requirement. No proprietary source was sent in doc searches.
