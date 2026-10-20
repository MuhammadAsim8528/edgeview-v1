# Provider verification evidence — 2026-10-20

One explicitly invoked existing POST /api/system/health/test round against the
real 3901 backend (PID 36216) returned:

| Provider | Observed backend state | Diagnostic round-trip |
|---|---|---|
| NVIDIA | healthy, model catalog request | 230 ms |
| Groq | healthy, model catalog request | 483 ms |
| Serper | healthy, one `test` search request | 3,335 ms |
| Hunter | disabled, not called | unknown |

No configuration, credential, company record or research result was injected.
These are connectivity/schema diagnostics, not evidence of actual text-generation
entitlement, contact discovery, extraction accuracy or rendered UI. Serper may
charge a search credit; AI checks do not invoke text generation. No claim of an
account balance or remaining quota is made. Disabled Hunter was not re-enabled.
The returned diagnostic timestamps were 18:09:01–18:09:04 UTC.

The live round exposed missing lastHttpStatus for successful checks. Source now
carries actual response status from AI/search/contact transport through settings
and the diagnostic report, rather than relying only on a message regex. Network
failure remains null; a schema failure can correctly retain HTTP 200 without
becoming healthy. Diagnostic error bodies also use the existing bounded reader.
Tests cover 401/403/429/503, malformed success, network failure and successful 201
without inventing 200; compiled API tests check healthy 200 and auth-failed 401.

The source fix is not deployed to PID 36216 and was not visually exercised.
Recent diagnostic timing remains separate from retrieval averages/denominators.
Do not trigger paid checks on page render or repeatedly poll provider endpoints.
Hunter's current opt-in diagnostic still uses example.com domain-search; moving
it to a documented account endpoint remains an evaluation, not a claimed fix.
