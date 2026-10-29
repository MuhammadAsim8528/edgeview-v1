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
