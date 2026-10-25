# Getz Pharma Kenya: reproduced attribution/recall gap

Date: 2026-10-25. Status: partial acceptance; NOT release approval.

## Independent public-source comparison

Official source: https://getzpharma.com/contact-us/
The Kenya regional-office block publishes 63 Westlands Road, Nairobi, Kenya and
+254 20 426 1000. The same page also publishes Pakistan and other offices.
https://getzpharma.com/global-presence/ independently describes Kenyan operations.
A globally shared official domain is legitimate; it does not confer Kenyan scope
on every contact from that domain. No Kenyan email was established in this check.

## Actual provider run before correction

Source base: integration 7baea6d. Exact input: Getz Pharma + Kenya.
Run: run-mvny1m0m-b16760bc7c, isolated writable storage, no live runtime restart or
customer dataset alteration. Source configuration read-only, SHA256 unchanged;
only approved active provider secrets copied to a Windows-DPAPI protected temporary
configuration. Monitoring disabled. No secrets entered source or this report.

Observed real requests: NVIDIA query generation HTTP 200, four Serper searches
HTTP 200, direct retrieval, two NVIDIA extraction responses HTTP 200. Hunter/Groq
were configured but not called; their success is NOT implied. Provider failures
included a retrieval timeout and unsupported PDF content. These remain recorded.
Run status PARTIAL; resolved getzpharma.com. Captured contact-page HTML includes
the Kenya phone/address, but original projection produced neither.

Root cause: the field-scope guard chose a single flattened text representation
over HTML retaining office boundaries, marking the contact ambiguous. Generic
labelled address blocks also escaped deterministic address extraction.

## Permanent correction and tests

Prefer visible HTML carrying the actual fact, preserving block boundaries; strip
script/style/comment content from that visible context. Retain text/markdown when
HTML does not carry the value. Extract generic span-labelled address blocks,
then apply existing country/identity checks. No Getz-specific URL, CSS, contact
value or company exception was added. Overlay policy increments to 22 so older
projections need revalidation rather than silently retaining prior policy.

New synthetic office_html_country_scope.test.ts failed before correction and
passes afterward: local mailbox/phone/address survive flattened global text;
foreign parent facts stay excluded; raw input unchanged. Existing Kenya/Pakistan,
Sudan/South Sudan, global-office, distributor and unscoped controls also pass.

Reprojected the SAME immutable actual provider capture without another search:
Kenyan phone/address now match the independently read official page. Local email
remains empty. Source IDs, official URL and quoted evidence accompany admitted
fields. Actual local SQLite durable write, DB reopen and hydration pass with this
projection; original saved run remains byte-equivalent when hydrated. An initial
acceptance harness omitted test mode and correctly hit the test-only DB-reset
guard; corrected only the isolated harness before the successful repeat.

## Observed checks and limits

Typecheck, lint, full current test:v1, official-page body-budget, cached-overlay
policy, offline batch-revalidation, production build and isolated release smoke
pass. Expected synthetic ENOSPC test diagnostics are controlled failure evidence.
Build warning: frontend chunk remains above 500 kB.

A personal LinkedIn search result was projected as a country manager, but this
check has NOT independently verified that person's present role. It must not be
presented as an independently verified leadership truthset.

Live Chrome tab 2115921035 was identified at http://127.0.0.1:3901/; supported
getTab access was rejected by saved origin permission/managed policy. No alternate
browser surface, port or indirect live-UI workaround was attempted. Rendered UI,
actual download/export, a fresh post-fix provider run, full importer dataset and
installed customer package remain NOT VERIFIED. Controlled DB hydration is not
proof of any of those behaviors. Temporary real-run evidence is private and is
not a distributable fixture or final operational backup.

## Fresh post-fix provider repeat

Exact source commit: 18d6ffbf35ff41b1461acf5ce52affcb3c34bd0f.
Fresh run: run-mvnycq8a-b6e77eb318, same Getz Pharma + Kenya input, distinct empty
scratch storage. Again resolved getzpharma.com and projected +254 20 426 1000 and
63 Westlands Road, Nairobi, Kenya with source references and quotes. No Kenyan
email asserted. This confirms the result was not dependent on manually editing
an old run or injecting a successful profile. Runtime still reported PARTIAL;
contact completeness label is a field heuristic, not exhaustive Internet coverage.
Original configuration SHA256 unchanged in this repeat too. Both temporary
DPAPI-encrypted credential configuration copies were removed after acceptance;
source credentials untouched and private raw captures retained outside Git.
This repeat closes the fresh-provider-run gap above; UI/export/installed-package
and the independently unverified personal-role limitations remain unchanged.

## Follow-up role presentation and corroboration

Later projection cleanup removes the repeated person name from the role; this
same capture now displays Muhammad Ashad / Country Manager. Field country scope
also distinguishes country-shaped given names from actual location labels.
Overlay policy at that checkpoint was 24; earlier policy numbers above are dated observations.

Independent secondary report:
https://radiogeneration.co.ke/health-and-wellness/111752/doctors-warn-of-rising-undiagnosed-diabetes
(dated 2026-09-06) identifies Muhammad Ashad as Getz Pharma country manager for
Kenya. A LinkedIn community contribution also displays that self-reported role:
https://www.linkedin.com/advice/1/what-best-ways-prepare-medical-sales-pitch-skills-medical-sales
Direct personal-profile retrieval timed out during independent checking.
This is corroboration as of those public sources, not an employment guarantee
for today. No personal email or direct number was inferred or manually inserted.

## Structured-office follow-up (policy 25)

Implemented in 70d7d38eaceb891f075cd01e15c8e47220c7a381. Exact build
4c9a89561ab6f2831e92c114c40c53ae6fb2f1b3e91743222ad75e1e1ef98278
passed production smoke and disposable developer-package verification. This is
not a customer installer or proof of Getz fields rendered in the live UI.

A later synthetic regression found ISO-coded JSON-LD offices could inherit
visible Kenya navigation: PK parent email/address/person wrongly became local.
The corrected structured carrier isolates each object's address country, handles
explicit ISO codes and textual addresses, and prevents graph-sibling or parent/
distributor relation inheritance. Nationality is not employment-location proof.
Parsing has explicit script/node/depth budgets; unsupported/malformed or
over-budget structured-only facts abstain. It does not resolve arbitrary @id
graphs or prove every office layout/relationship/language correct.

Read-only reprojection of retained actual run run-mvny1m0m-b16760bc7c passed after
this change: +254204261000 and 63 Westlands Road/Nairobi/Kenya retained, no guessed
email or Pakistan/Karachi address; full retained evidence-tree hash unchanged.
This used separate empty test config/JSON/SQLite paths. No live dataset rewrite,
fresh provider run or rendered UI/export verification was performed in this check.
Policy-24 overlays require the existing normal revalidation path; their stored
records and original evidence are preserved.
