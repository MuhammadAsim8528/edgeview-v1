# Emerchemie scoped acceptance

Result: FAIL overall. Rendered UI NOT VERIFIED.

The fresh isolated run `run-mvv9bnan-1bb1f23bea` used source
`61b25071be898c7e96ee3d6fcb925dc3773a2b52`, build
`b057903add64cc2db1d86e30c9f8fa06f8349dbded295f85c5ddef719eabbc46`.
It used an isolated synthetic record for Emerchemie NB Ceylon Limited, Sri Lanka,
and the existing enabled provider configuration, temporarily protected with DPAPI.
Source configuration hash stayed unchanged; copied credential files were removed
after normal shutdown. No customer dataset or live port 3901 was changed.

## Source comparison

Independent official references:

- https://emerchemie.lk/contact-us.php
- https://emerchemie.lk/leadership.php

The contact page publishes separate head-office and warehouse contacts. The
leadership page publishes a board and management list, including a Group CEO.
These are reference observations, not manually injected enrichment results.

The fresh provider→capture→projection→HTTP run returned four emails, seven phones,
one address and ten people. Both official role mailboxes, the checked head-office
phone, head-office address and Group CEO were present. HTML export included all
saved email/person collections; normal stop/restart retained them and the run ID.
The warehouse address was missing, so the real acceptance assertion failed.
Actual visual rendering/download appearance was not exercised.

## Reproduced cause and correction in progress

Complete official contact HTML was captured. Its normalized text includes the
warehouse location, and the model received that source chunk, but no warehouse
address claim was emitted. Deterministic address extraction does not yet cover
the observed strong-label followed by ordinary paragraph layout. This is a recall
defect, not proof that the source is absent or that a different-country address
should fill the gap.

The raw page also contains a commented older contact block. Older flattening
retained its text, allowing a comment-only mailbox into the profile. The new
hidden-contact regression reproduced the defect before correction. Offline
reprojection with the current correction reduces this run to three emails,
seven phones, one address and nine people; the comment-only mailbox is absent.
This offline projection is not another fresh provider run or rendered acceptance.
The original raw response remains retained.

## Retrieval observations and limits

Current pinned requests reproduced both HTTP 200 followed by a 12/20-second
deadline and complete 3,668,585-byte responses in roughly 1–4 seconds. A request
without browser-style headers returned 406. A Range request was ignored. One
alternative Accept-Encoding probe completed, but a paired unchanged-header
request also completed; no causal header fix or compression support was inferred.
No speculative transport change or raw partial-response admission was added.
Transient acquisition failures remain observable and are not counted as success.

Remaining: deterministic warehouse-address recall, wider fact-by-fact source
review, fresh integrated enrichment/export/restart after correction and actual
rendered UI acceptance. No whole-company or whole-product correctness claim.

## Subsequent scoped correction

The ordinary-label regression failed before the parser change. It now extracts
country-explicit street paragraphs following generic office/warehouse labels,
without depending on this company's CSS or expected address. Fixtures reject
foreign office paragraphs, distributor blocks, comments, stock/order prose and
countryless addresses; existing country and hidden-evidence regressions pass.
Equivalent address strings differing only in trailing punctuation are deduplicated.

Offline reprojection of the actual captured run now returns both the head-office
and warehouse addresses, each with official source URL and local-country evidence.
It retains three emails, seven phones and nine people after the hidden-contact
correction. This closes the reproduced deterministic recall case in projection;
it does not turn the earlier failed run into a passed fresh/provider/UI test.
Full V1, typecheck, lint, build and release smoke passed for this scoped change.

## Compiled saved-evidence acceptance after correction

Source c6415cb5e6434e866f89950a6a8d81f8bd96bcf1; build
9d31e311926a44a3a80d3afb0e255028925d31455f8f5e14c856d6fb1c20e8e1.
Copied only the previous isolated public-company test state into a new private
temporary root. Original fixture had no config/config.prev files; new config was
empty, monitoring disabled and backend HTTP/HTTPS/fetch denied. No customer state
or live3901 was touched.

Actual ordinary company POST with reuseOnly:true returned200/reused_evidence:true
for the original run-mvv9bnan-1bb1f23bea. The stale-policy overlay was withheld
before action, then current projection contained3emails/7phones/2addresses/9people.
Assertions checked independently published head-office and warehouse addresses,
both role mailboxes, head-office phone and Group CEO designation. Comment-only
stores mailbox was absent. HTML export contained warehouse address/mailbox and
excluded the hidden mailbox. Normal shutdown/restart preserved the collections.
All raw-run/blob file hashes stayed unchanged in both source fixture and copy;
egress-attempt marker absent. Scoped result PASS, not a fresh provider capture or
real-company rendered UI acceptance. Private summary retained under the owned
temporary root edgeview-emerchemie-retained-2CTOGQ.

Initial harness checked nonexistent title/role properties instead of the actual
contact-person designation contract and failed; corrected that assertion to
require CEO in designation, then reran the complete workflow successfully.
No product result was changed to satisfy the assertion.
