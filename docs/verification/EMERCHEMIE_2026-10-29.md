# Emerchemie Sri Lanka: fresh retrieval failure and correction

Status: reproduced failure; candidate correction requires fresh acceptance.

The actual HTTP upload/enrich/persist/export/restart path was exercised on
source f7edda83e9f5cfa4c0fd0cc606cb1110e6ba5321, build
008ea69e0a42ae2ef6698c8998745ac80c6717ecd8c467567631c68f0a14edcf,
version1.0.0-rc.2. Input was only the public company name and Sri Lanka in an
isolated synthetic trade row. No expected facts were supplied to the engine.

Run `run-mvscdk97-099199092b` resolved emerchemie.lk but retained only1email,
0phones,0addresses and0people. It was PARTIAL, not a completed profile. Official
homepage variants and leadership.php timed out; later guessed management routes
returned404. The real contact-us.php was not reached within the page budget.
Real NVIDIA/Serper operations returned200. Original source credentials hash was
unchanged, temporary protected credential copies removed, owned child stopped
through the durable shutdown bridge. Immutable capture remains private outside
Git in the owned `edgeview-emerchemie-http-rWej9U` acceptance directory.

Independent official sources, read on October28:

- https://emerchemie.lk/contact-us.php publishes head-office and warehouse
  addresses, separate general/warehouse mailboxes, telephone and fax channels.
- https://emerchemie.lk/leadership.php publishes directors and business leaders.

Subsequent guarded direct retrievals returned200 for both pages:3,668,585bytes in
3,928ms and3,677,672bytes in1,201ms respectively. This shows availability during
that probe, not that the earlier timeouts were fabricated or cannot recur.

Candidate correction gives contact routes equal priority with management guesses,
derives at most two CMS suffixes only from the resolved publisher's URLs, and
allows at most two extra transient capture attempts for the entire official
crawl. It does not retry aborts, policy refusals, body limits or HTTP failures.
Every original failure and repeat response remains raw evidence; success clears
the result's failed-capture metadata. Existing pinned DNS/redirect protections,
2MiB generic/4MiB official caps,10s absolute attempt deadline and page-count bound
remain. The retry allowance adds at most20s, not an unlimited crawler or run SLA.

Synthetic tests failed for missing local CMS contact routes and transient loss
before the correction. They now prove contact discovery after an unavailable
homepage, actual bounded transport retry, exhaustion, original-failure retention,
immutable storage and country-scoped projection. Typecheck/lint/full V1,
production build and release smoke passed. No rendered UI, complete public-info
recall, installed-package or broader country correctness acceptance is claimed.

## Fresh repeat after crawl correction — still incomplete

Run run-mvtrc2gh-d3453b35b3 used exact source
7fc82f14ac5229dcb5b24f13cd9afeca79c46c0d, build
41eabcc075d03a225e8ba9ba4424422772fc93dc8a2075922066add86c3366df.
The real contact-us.php now entered the crawl, and transient retries were retained,
but official pages again timed out. Persisted result was2emails/0phones/
0addresses/0people, PARTIAL. The required published contacts remained missing.
HTTP/export/restart preserved that weak result; persistence success does not turn
it into accurate/complete company intelligence. Original credentials unchanged
and isolated temporary protected copies removed. This repeat FAIL remains open.

Instrumentation through the existing guarded transport observed HTTP200 then
only102,815body bytes in20seconds. A later15second probe received150,815bytes.
The page is about3.67MB. Increasing retry count alone cannot guarantee retrieval.
The server continued sending identity encoding when gzip was offered. No partial
page is promoted and no independent expected facts are injected into product data.

The new opt-in gzip path is separately verified on Slim Pharma's official contact
page: HTTP200,173,771decoded bytes from30,387wire bytes in1,638ms. This proves a
working bounded compressed capture, not that Emerchemie supports it or that the
fresh Emerchemie acceptance passed. Broader failure fallback remains necessary.
