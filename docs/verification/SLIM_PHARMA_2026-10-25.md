# Slim Pharmaceuticals Sri Lanka — isolated acceptance, 2026-10-25

## Independent public comparison

The connected Firecrawl research account returned insufficient credits; no retry
or billing change. Ordinary web retrieval read the official pages instead:

- [Corporate management](https://slimpharma.com/corporate-management/): Sumith
  Premaratne / Chairman; Vindya Wijegunawardana / Deputy Chairman; Luhith
  Premaratne / Executive Director; Gayan Edirisinghe and Shamal Fernando / Managing
  Directors; Christopher Fernando / Director, Institutional & Tender Business;
  Nelum Ambawela / Senior Manager, Human Resources. Biographies describe overseas
  study or prior work; those references do not establish current foreign offices.
  Riza Cassim is expressly labelled CEO **of Slim Healthcare**, so that qualifier
  must survive attribution rather than becoming an unqualified Pharmaceuticals CEO.
- [Contact](https://slimpharma.com/contact/): published organizational email
  info@slimpharma.com; shared telephone channels include +94 11 7 533 581,
  +94 11 2 684 298 and +94 11 2 681 680. Head Office is in Malabe, Sri Lanka;
  corporate/regulatory offices in Colombo. Fax labels are separate from telephone.

These are statements published by the organization, not employment guarantees or
an exhaustive independently verified corporate registry. No personal contact
details were inferred. A historical CEO appointment news item does not override
the present management page's explicit Healthcare qualifier.

## Fresh engine run, before correction

Input: `SLIM PHARMACEUTICALS PVT LTD` + `Sri Lanka`. Source line at 5e39c22;
run `run-mvo5cfpk-db4cf66328`, status PARTIAL, resolved slimpharma.com. Four Serper
searches, NVIDIA query generation and two NVIDIA extraction calls returned 200.
Direct retrieval successes/failures were retained. Hunter/Groq were not exercised
by this run; configured is not tested. The 183,951-byte management page was
captured in both slash/no-slash URL variants (duplicate retrieval remains debt).
Nine extraction chunks included all of the leadership material; seven leader
claims survived extraction, so the immediate loss was not an exhausted AI context.

Projection retained one email, four phone representations, four addresses and
only three people. Canonical phone normalization reduces those representations
to three distinct numbers, all matching the independently read shared channels.
The four address strings describe three offices: the regulatory address appears
both with and without an office label. That presentation deduplication remains open.
The general email matched the independent source. Gayan and Shamal were present
in both capture and accepted claims, but contactFactScope returned foreign: the
previous biography's Australia reference carried into the next person's card.
This is a reproduced projection defect, not an absent-public-information claim.

Probe used its own empty dataset, SQLite/evidence/config paths. Source config
hash was unchanged; temporary DPAPI credential copies were removed in finally.
Raw capture is private outside Git in an owned temporary acceptance directory;
it is not a customer distribution fixture or final operational backup. One
in-progress sample was 90.4 MiB working set, 89.5 MiB private memory, 267 handles;
this single snapshot is not a benchmark or memory-leak test.

## Candidate correction and evidence

The deterministic correction permits formal official management cards to use
explicit local Head/Registered Office evidence only when the page publisher
matches the target company and no captured address/HQ evidence conflicts.
It records person and company-country sources separately. This establishes
organization affiliation, not a person's residence or nationality. Countries in
overseas education/history no longer leak between those cards. Explicit current
foreign location, typed person location and branded related-employer qualifiers
remain exclusions. Missing/ambiguous headquarters does not authorize inference.

Synthetic tests failed before correction and pass for recall, absent/foreign/
conflicting headquarters, wrong publisher, related business and current/typed
foreign location, explicit foreign office headings, country-shaped person headings
and script/comment template exclusion. Formal card inference is bounded to 100
cards/page, 8,000 characters/card context and 2,000 headings/page; exceeding the
heading budget does not authorize inferred local affiliation. Reprojection of the same untouched real capture now retains
seven Pharmaceuticals people above; Healthcare's CEO remains in original evidence
without being relabelled into that profile. Email/phone/address counts remain
1/4/4 before canonical phone deduplication. Additional accepted people have `local_head_office_management` provenance
with both original result references. Entire captured evidence-tree hash unchanged.
The deterministic HTML extractor also recovers Christopher's published card,
which was captured but absent from the model's accepted-claim list; AI output is
not the sole authority deciding what the source contains.

Policy 26 invalidates older projection trust for normal offline revalidation;
stored records and original evidence are preserved. This is not a universal
multilingual biography parser, employer graph, a person's location verifier or
proof that every management layout works. Fresh post-fix provider repeat,
durable/API/UI/export and installed acceptance still require verification.
No live port-3901 restart, production-data write or manually injected contact.

## Fresh HTTP, durable storage and compact export repeat — 2026-10-26

Retained acceptance-summary.json was re-read on 2026-10-28. Fresh run
run-mvpa7k7e-1ed426d348 used source877aba84ee13fa5672f35681fb06ed95f850f307,
version1.0.0-rc.2 and build
e58583edf5e0803f40e7ec31725d7abc9cd7419d4baeb04008606b761b70b571.
The actual upload/enrich/persisted-company API path resolved slimpharma.com and
returned PARTIAL:1email,3phones,4address representations and7published leaders.
The independently checked general email, shared phones and three official offices
matched. Related Healthcare CEO remained excluded; no Pakistan phone/address was
admitted. Real NVIDIA/Serper operations returned200; retrieval failures remained
observable. Hunter/Groq were not exercised.

The compact HTML export contained checked local phone/address. Owned backend
shutdown/restart preserved contact arrays and run identity. Temporary credential
copies were removed and original configuration hash remained unchanged. Expected
facts were not injected into the engine. This closes the fresh post-fix HTTP and
restart gap stated above, not rendered UI, complete multi-value/leadership export,
installed-package or universal country-attribution acceptance. Four address
representations for three offices remain a deduplication follow-up.
