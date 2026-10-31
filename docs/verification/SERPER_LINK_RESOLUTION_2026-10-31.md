# Serper Google-link resolution — 2026-10-31

Status: scoped compatibility verification. This report does not establish full
company accuracy, live application deployment or customer release readiness.
The acceptance authority remains [OUTSTANDING_WORK.md](../OUTSTANDING_WORK.md).

## Source and provider notice

Initial implementation source: `28d2d584ad9d9dba657ff447a04ec037eaea093e`.
The subsequent independent-review corrections are recorded below; the package
hashes in this report apply to that initial commit, not automatically its successor.

The [official Serper notice](https://serper.dev/google-links), dated October 30,
2026, describes Google opaque `google.com/goto` result links. The first three
organic results are resolved by Serper; later links can require a separate POST
of the complete search response to `https://google.serper.dev/resolve`. Serper
documents zero credits, a separate rate limit, about 30 seconds immediately after
a search, and `retryAfter` when links are not ready. Zero credits is a provider
claim, not an independently measured account-billing result.

The web reader could not extract this page. The implementation owner fetched its
HTML successfully (HTTP 200) and inspected the documentation bundle linked by that
page. No new account, paid subscription or privileged management token was used.

## Implemented path

- `server/v1_engine.ts` collects search responses before resolving opaque links.
  Two workers share a 45-second resolution-phase budget. Each request is capped
  at 40 seconds or the remaining phase budget; response reads are bounded to
  8 MiB and the remaining time, up to 20 seconds.
- The provider key is sent only to the fixed HTTPS Serper endpoint. That request
  disables redirects. EdgeView does not decode opaque tokens or fetch the Google
  verification page as company evidence.
- `server/serper_links.ts` accepts substitutions for corresponding opaque organic
  items only. It checks collection shape and requires original position/title/
  snippet fields to remain present and unchanged; preserves the
  original titles, snippets, ranks and already-real links; and rejects unsafe or
  credential-bearing replacements, including the tested private-IP literal.
  Existing outbound DNS/redirect protections remain responsible for subsequent
  source retrieval. These checks alone are not complete SSRF proof.
- Original and resolver responses/failures remain separate raw records, linked
  through source/result identifiers. Resolver timing uses a monotonic clock.
  Deduplicated page retrieval copies actual scrape metadata without replacing
  each query's resolver provenance.
- Unresolved results carry `SERPER_LINK_UNRESOLVED`, remain visibly failed, and
  are excluded from direct retrieval. `retryAfter` remains in raw evidence; there
  is no unbounded retry loop. Existing real links remain usable after a partial
  resolver failure.
- Resolver requests are labelled `serper-resolve`. Their independently limited
  failures do not suppress Serper search or enter its search-provider aggregate
  metrics. Resolver status/latency remains available in the raw record/timeline;
  no separate resolver dashboard-health acceptance is claimed.
- If every returned result is unusable, the run is failed rather than successful
  empty research. Without retained trusted fields, historical projection reports
  failure instead of certifying that no company information exists. Previously
  trusted evidence still follows the existing preservation rules.

## Evidence actually recorded

The implementation owner recorded these results; this documentation task
inspected the source, assertions, saved logs and private probe summary. It did not
repeat provider requests or change the running application.

| Check | Observed scope/result |
| --- | --- |
| `node --import tsx server/tests/serper_link_resolution.test.ts` | PASS: actual V1 flow with synthetic provider responses, deferred calls, two-worker ceiling, lower-ranked links, no resolver call for already-real links, preserved original payload and raw storage roundtrip, no synthetic key in run, partial/retryAfter, 429, malformed shape, unsafe/private replacement and all-opaque failure. |
| `npm run check` | PASS in saved log: typecheck, lint and the wired V1 suite. This is local evidence, not hosted CI. |
| `npm run build` / `npm run test:release` | Owner observed PASS. The saved build log and release checkpoint identify production output; no live3901 replacement occurred. |
| Cached HTTP and fresh-batch durability regressions | Owner observed PASS after the change. These use isolated synthetic state; they do not establish final company/UI acceptance. |
| Live public-company provider probe | One public Getz Pharma Kenya search: search HTTP 200, eight organic results, five opaque links; resolver HTTP 200, all five substituted, 24.869 seconds for resolution and 27.500 seconds total; no `retryAfter`. Original configuration hash remained unchanged. |

The live probe saved its public search/resolver responses privately. No raw
business responses, credentials or machine-specific capture paths are included
here. It did not retrieve the resulting source pages, run full enrichment,
exercise the rendered company profile or mutate customer data.

## Exact developer-package checkpoint

The isolated package checker recorded the exact reviewed commit above with build
`df494d80d75c12e6b128bd850cdb965a20931d00e6a31a34ae1c70ac654a1479`.
Its manifest verification covered 149 files. Launch, packaged-backup contract and
prohibited-private-file checks passed. The disposable ZIP had SHA-256
`86c5793fb11c7ce03926da3bad85dd7d63b03dc0f2e137836bb22212d8d12416`.

The checker removed that ZIP. It still contained 117 development inputs, required
installed Node/npm and reported `customerRuntimeReady=false`. It is not an
accepted runtime-only distribution, signed MSIX, clean-Windows installation,
update/rollback result or final Desktop release snapshot.

## Remaining acceptance

### Independent review and follow-up

A separate read-only review reproduced two blockers that the initial focused
suite missed: one malformed organic sibling skipped resolution for valid sibling
links, and missing position/changed title or snippet could substitute a different
source URL beneath original company facts. Neither finding asserts that Serper's
actual service returned malicious data.

New tests failed before correction. Resolution now follows eligible normalized
rows despite a retained partial-schema warning; every remaining opaque row is
failed. Stable original position/title/snippet fields must match before link
substitution. Original malformed warnings remain observable. The mixed-sibling
and changed/missing identity regressions pass, as do local typecheck/lint/full V1.
Reapplying the stricter helper to the actual privately retained provider pair
still accepts all five resolved links, with no new network calls. This is a
correction after independent review, not a claim that the reviewer approved a
final release. Deadline-expiry/body-stall/cancellation and final rendered/live
provider workflow remain separate acceptance work.

Complete real-company source-to-projection/API/UI/export checks on the intended
release, including country/parent/distributor attribution. Exercise real resolver
failure/deadline behavior and final installed workflows where appropriate. The
synthetic test does not prove the 45-second deadline under a stalled real service.
Final live/manual visual QA remains deferred. Hosted CI has an account execution
blocker; local results must not be represented as hosted passes. No Store/public
publication or customer deployment has been accepted by this checkpoint.
