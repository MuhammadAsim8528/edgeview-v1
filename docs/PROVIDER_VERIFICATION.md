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

Further source audit found two misleading surfaces: recent completed real
operations were ignored without a separate diagnostic, and uninstrumented
cache/retry counters were emitted as zero. A recent operation now participates
in the existing 120-second freshness rule and newest-observation selection;
disabled configuration and actual routing suppression/cooldown still override it.
Operational health also requires a request begun after process startup or the
last credential/model/base-URL replacement. Old aggregates without request-start
timestamps remain historical only; they do not certify a new key. Aggregated
latency/counts are not erased. A request begun with the old configuration cannot
become proof for a replacement merely because it completed later.
No periodic paid health requests were added. Cache/retry counters stay null until
instrumented, and cache counts/rate display Unknown rather than fabricated zero.
Client payload validation accepts null only for the explicitly nullable fields.
API/presentation/client-recovery tests are separate from rendered UI verification.

Settings Test connection and the system-wide diagnostic action now use the same
bounded observation recorder. A saved-key/model/base-URL check updates the shared
health report; an unsaved candidate key/model/URL only returns its own test result.
It cannot certify or overwrite the canonical configuration. A diagnostic that
finishes after configuration replacement is ignored for shared health. Input
type/length checks reject malformed test fields before provider access. Compiled
API fixtures exercise saved-key propagation, an invalid unsaved candidate that
does not replace healthy state, and invalid field rejection. No claim of an
actual browser click or rendered result follows from these API assertions.

Audit of the older provider_model_discovery_e2e test found that it swallowed
model-list transport/assertion errors then printed overall 100% success. It now
defaults to an explicitly isolated synthetic-catalog contract with an unexpected
network trap and temporary configuration. Live catalog mode requires explicit
EDGEVIEW_LIVE_PROVIDER_TESTS=1 and fails on missing/failed catalogs; it was not
rerun live as part of this change. Neither mode is browser or generation QA.
Subprocess regressions deliberately fail each isolated catalog and require exit 1
without the overall PASS message. Both test modes avoid dumping raw provider
exceptions. The guarded synthetic failure switches exist only in the test file.
