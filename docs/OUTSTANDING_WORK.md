# EdgeView completion ledger — 2026-10-20

Current readiness verdict: NOT READY

### November 6 release audit checkpoint

Hosted 4c4dd35 release run 41336659353 finished with native launcher, Docker and 152-step verification success. Browser job 124937852365 failed on saved-history pagination. The test armed a one-shot error route broad enough to catch the in-flight return to the newest page. c0a98cd waits for that page's actual run option and matches the injected error by the exact older-page cursor. Three isolated browser repeats passed with all 1,005 saved runs, pagination, injected 503 recovery, restart and zero provider calls. Hosted c0a98cd release run 42208336543 passed browser, native launcher, Docker and 152-step verification. Research 42208336499 and inventory 42208336538 also succeeded. The backup verifier was added after that run and has separate local test evidence.

The latest local handoff check found no port 3901 listener and neither previous backend nor launcher process. The legacy numeric lock still records the previous backend PID. The backup script refuses any existing backend lock. Real backup, compatibility copy and desktop replacement remain pending. C: measured 6.81 GiB free before package staging.

Follow-up: c64ebd5 adds an explicit expected stale-PID backup mode. Default refusal remains. Tests passed for actual dead-owner acceptance, live-owner refusal and changed-lock rejection before publication. The real backend was stopped and the old lock remained in place. The private backup independently verified 10,640 files and 2,609,424,024 bytes with manifest SHA-256 ec02d4857dc97690390d16b97230d3a99460c955b4c4cf75ddeeee8bffffc1e5. Snapshot SQLite schema 1 passed integrity check. A separate compatibility copy is underway. Hosted release, research and inventory succeeded on prior 3a9a7ac; ca7ae9c and c64ebd5 are pushed for the next run.

Product first: five isolated Chromium checks passed for Settings keyboard operation, privacy, provider stalls and malformed provider responses. Reviewed the captured visible privacy panel. The c64ebd5 candidate passed build and release smoke, then reproduced the 4c4dd35 privacy screenshot byte-for-byte in the same local Chromium setup. Full scrollable views and approved screenshot coverage remain open. VMware Workstation 26.0.0 and about 15.7 GiB host RAM are present. Local free space remains too small for a clean Windows 11 guest. A separate local disk is needed for that later install test.

Desktop compatibility passed on exact c64ebd5 build 36fe5f09b98433390de051d85a0270d7e41ef9dc554261ae20755ee37ee80641. The verified manifest-bound copy opened twice under the compiled production backend on an owned isolated port. Both starts exposed the same persisted dataset ID and 17,612 rows. The copy advanced SQLite schema 1 to 2, passed integrity checks, preserved the history row count and retained an exact pre-migration database image. Installation identity persisted across restart, and no outbound request was attempted. The original SQLite, primary dataset and config hashes still matched the backup. Real launcher and port 3901 replacement remain pending.

Live handoff follow-up: the launcher installed its locked production dependencies in a private stage. The staged runtime passed a real-data-copy smoke check before promotion. The journal retained the previous build and dependencies plus the verified backup digest. Both launcher preflights accepted the promoted files without reinstalling or rebuilding. The real backend opened the original data root, advanced schema 1 to 2, retained an exact pre-migration DB and passed SQLite integrity. A graceful owner shutdown exited 0 and released its lock. `EdgeView.bat` restarted the same build with a new PID and reopened Chrome. Live API confirmed one dataset and 17,612 rows. A first PowerShell count misread the singleton response; direct JSON verification corrected it. Foreign Host and Origin returned 403 and retired NVIDIA diagnostics returned 410. The first Host probe used fetch, which did not transmit the supplied Host, so the verified check used node:http.

Live backend provider connectivity: Serper, NVIDIA and Groq each returned HTTP 200 on the aggregate built-in diagnostic. Hunter was configured but disabled and received no diagnostic request. The public settings and health contracts exposed the supported provider set. Browser Use denied observing Chrome at http://127.0.0.1:3901 because its saved origin permission blocks access. No live UI controls were exercised through that browser. The backend audit remains separate from the UI gate.

Hosted c64ebd5 release run 42212498638 passed native, Docker and verification jobs. Browser failed on the transient research feedback assertion. Artifact 13499753482 showed the enrichment response returned 200 and the expected failure toast appeared in the frame snapshot before the assertion started. The test now starts visibility and color assertions with the click. Three isolated repeats passed all five outcome cases. Hosted acceptance passed on 0abbbfb in release run 42215929427 and companion runs 42215929428 and 42215929502. Research and inventory succeeded on c64ebd5.

The internal runtime-only factory built c0a98cd successfully from a clean checkout with a regular locked dependency install. The initial dependency junction was rejected by license collection and replaced with a normal install. Build 0dbb414dedc6d19b90c6221481478cc24425215ab4ab424f1706e4e637af1ec9 produced an 82,145,568-byte unsigned MSIX with 14,131 files and SHA-256 12a7a7f32ab3422cc1f37618fd79cd93be41b4ec74d04bdb8a2e2d6582d2ce64. Archive execution, signing, installation and clean Windows remain open. Owner sequence places product and recovery work before installer acceptance and Store submission.

The new read-only backup verifier checks the published snapshot inventory and streams file SHA-256 hashes. It can bind the snapshot to an independently recorded manifest digest. The existing backup/reopen rehearsal passed with tampering, missing and extra files, traversal, alternate data streams, Windows device names, case collisions and a linked ancestor rejected. Matching application/schema rollback and the real data handoff remain open.

### November1 Slim compiled captured-source acceptance — scoped PASS

Exact4c4dd35/build ec0c353bbd99122d381a789bc3840c2150c7313f34ec4d6fce573e021749a2f4. Persisted today's actual official236,494-byte page as a deliberately PARTIAL public-capture-only immutable fixture (no generated queries, model extraction or fabricated provider responses). Synthetic same-name Sri Lanka/Pakistan trade controls remained separate. Current projection durably saved all3independently published office addresses, exactly the public general mailbox and checked phone. API/intelligence and normal restart retained every address; local source provenance asserted. Rendered Contacts/Intelligence and actual selected CSV control PASS. Downloaded CSV/XLSX/PDF/DOCX/all-format ZIP each contained all3office address identifiers, mailbox and phone. Explicit saved-only reuse succeeded with network denied, immutable run bytes unchanged and0provider calls; no additional unreviewed fields promoted. The private isolated prior Slim folder was unavailable; no claim to rerun its original live-provider capture. This verifies current captured-source downstream behavior and the reproduced parser defect, not fresh query/provider/extraction, customer deployment, final visual QA or clean Windows. Original data/config/dist and live3901 untouched.

Emerchemie follow-up18:31Z: one bounded request to the independently published www.emerchemie.lk/contact-us.php using the unchanged hardened helper completed200/3,668,585bytes. Current projection includes both published Sri Lankan office/warehouse addresses and public info/warehouse mailboxes. A navigation telephone anchor also exists in actual source; whole-contact factual acceptance is not inferred from matching only primary fields. This is fresh full official-page retrieval under the existing4MiB scoped cap, not a claimed causal fix to the earlier root-host timeout or guaranteed future availability. No partial body, loosened cap, provider quota or customer update. Fresh complete engine/rendered Emerchemie acceptance remains open.

### November1 Slim official-page address recall — regression and correction under acceptance

Fresh hardened direct retrieval of https://slimpharma.com/ returned200/236,494bytes. Existing deterministic projection admitted its published phone/mailbox but no addresses. Actual source has office headings with linked text followed by two closing layout wrappers before ordinary address paragraphs. Synthetic ordinary_office_address regression failed before correction; current narrow parser crosses at most3closing div wrappers only, recognizes Regulatory and Tender Office, and accepts Gardens as a street term. It does not cross opening blocks, new headings, navigation or unrelated text, and country/other-entity admission remains separate. Expanded fixture PASS: local head/corporate/regulatory addresses, foreign country, distributor, countryless paragraph, over-bound wrappers, comments and intervening navigation. Offline reprojection of the same captured bytes now returns all3published local office addresses plus the unchanged phone/mailbox. No provider call, customer-state write, live restart or new persistence authority. Full npm run check (typecheck/lint/V1) PASS using isolated locked dependencies; final expanded focused regression PASS separately. Build and downstream current-build acceptance pending; this does not close Slim or whole-country truthset acceptance.

Fresh Global Pharmaceuticals official contact endpoint returned500; no failed response was admitted as evidence. Official public-source research is available, but source identities/domain/address differences must be reconciled rather than combined by similar name. Do not replace an observed remote failure with a success claim or broaden retrieval limits.

Correction committed/pushed as4c4dd35b25d909105de3280f56045c051ff309ec. Clean committed-source typecheck/lint/frontend/backend build/release smoke PASS in the isolated dependency stage. Prepared-not-deployed build ec0c353bbd99122d381a789bc3840c2150c7313f34ec4d6fce573e021749a2f4. Actual compiled Getz saved-capture regression repeated PASS on this build: country-separated synthetic trade rows, durable profile, APIs, rendered Contacts/Intelligence, selected CSV, CSV/XLSX/PDF/DOCX/ZIP, saved-only reuse, normal restart, unchanged immutable evidence and0additional provider requests. No additional unreviewed fields promoted. This is Getz non-regression, not Slim downstream acceptance. Hosted release41336659353 still in progress at18:27Z; native-launcher/research41336659339/inventory41336659382 already SUCCESS. No release/source snapshot or original dist replacement. Existing546.34KB frontend chunk warning remains a deferred non-critical finding.

### November1 Getz Kenya live truthset checkpoint — scoped acceptance passed

One quota-capped isolated current-engine run used the existing configuration read-only: NVIDIA query generation200,4Serper searches200,8official captures and2NVIDIA extraction responses200. Hunter was disabled and was not enabled/called; Groq fallback was not needed. Original config digest was unchanged. Current resolver selected getzpharma.com. Admitted fields matched the independently retrieved official contact page's Kenya phone/address; no Pakistan phone/address was promoted and no email/person/social/other unreviewed field remained promoted. Operator budget marker prevents another automatic paid pass for this case. No original contact, dataset, database, evidence or running3901build was updated.

Actual production-compiled build8dcef5835fdf4819235817d0165b409861b2b7f79c69eab5296265a4758e27bb/bcc135c then passed the isolated downstream path using synthetic trade rows and that real immutable research capture: same-name Kenya/Pakistan rows remained separate; canonical overlay saved durably, hydrated after normal restart, returned correct fields/provenance through company/intelligence APIs, and explicit saved-only revalidation reused the same run with0additional provider requests. Rendered Contacts and Intelligence showed the admitted phone/address. Actual selected-company CSV control and CSV/XLSX/DOCX/PDF/all-format API downloads retained those fields. A second normal shutdown/restart preserved the profile; original run bytes stayed unchanged and backend egress guard observed0attempts during acceptance. Screenshot and safe summary remain private ignored review artifacts. This verifies the captured promoted fields for this single Kenyan case in isolation, not the original user's deployment, all countries/companies, whole dataset, final visual QA or clean Windows.

Exact15cf767d09bfd83e7f4ffa990b59fbd19c526def now has hosted release41333770151 SUCCESS (152Windows steps/browser/native/Docker), research41333770134 SUCCESS and inventory41333770147 SUCCESS. This closes the known export-wait CI failure and hosted sub-gate for bcc135c settings/circuit fixes; final frozen-customer-package gates remain open.

### November1 bounded export-artifact waits and Getz verification checkpoint

Exact1760f388997f6b3ab731cc416d596e34cc34c5f2 release41316482264 passed152Windows checks/native launcher/Docker; research41316482337 and inventory41316482338 SUCCESS. Browser36/37passed; saved-report export download wait failed15s. Inspected the actual synthetic hosted trace (artifact13087946212): /api/export returned200,49-byte CSV,17,680.06ms total. This establishes a too-short artifact waiter, not a reproduced export-generation failure or an identified cause of hosted slowness. Test-only shared45s export-artifact wait now replaces default15s waits across file/contact/derived/stats/report/retry workflows; larger existing upload/export-response budgets, controls/expectations15s, retries0 and product limits are unchanged. Report test additionally asserts actual200, compact request<1024bytes and attaches delivery timing/build identity. Private delayed-response probe first reproduced15s timeout while holding an actual200/49-byte backend response16s; revised test passed25.4s. Canonical affected export suite11tests4.8min PASS, including3200-row6,005,332-byte CSV and all-format ZIP using187-byte requests, all-format contents, scope/tamper/failure/retry and restart controls. E2E typecheck and diff check PASS. No application rebuild was needed for these test-only changes; compiled bcc135c product source remains unchanged. New hosted confirmation pending; no small-export performance target or customer installation acceptance implied.

Getz evidence review advanced without provider quota or customer-state mutation: fresh official https://getzpharma.com/contact-us/ capture using the application's existing headers returned200/81,848bytes. Current deterministic projection admitted the published Kenyan address63Westlands Road,Nairobi,Kenya and+254204261000, with no mailbox promoted from that page. Read-only comparison of the owner-reported saved case found empty promoted contact fields and retained official capture403failures, not demonstrated Pakistan contacts promoted into this Kenyan profile. Its retained target country and both old/current deterministic domain resolution were Kenya/getzpharma.com; reprojecting the old run alone cannot manufacture missing page text. Oldb6db239already used the same headers, so fresh access200must not be presented as a new header fix or guaranteed removal of remote403s. Full current-engine provider→evidence→persistence→API/UI/export verification remains open. No raw owner records, identifiers, private contact values, config or evidence blobs were added to Git/progress view.

### November1 research-configuration consistency unit (local acceptance passed; hosted pending)

Confirmed supported-path Medium: changing Hunter enablement during an actual mocked Serper response produced COMPLETED under the original recorded context before correction (provider_request_path assertion RED: actualCOMPLETED/expectedPARTIAL). The active five stage helpers independently reread settings. Correction captures one private in-memory settings snapshot per operation, passes it through query/search/resolver/Hunter/extraction, checks relevant current selections/credentials before further provider operations and before declaring completion, and saves interrupted evidence as PARTIAL/FAILED with fixed RESEARCH_CONFIGURATION_CHANGED. Already-started bounded requests may finish; resolver workers drain before persistence. Monitoring preferences do not interrupt research. No extra network abstraction, telemetry field, credential fingerprint or persistence authority. Research-context pipeline revision advances1→2 so older immutable captures remain readable/revalidatable but cannot automatically claim the new consistency guarantee. Operational schema2/contact policy30 remain unchanged. Focused synthetic wire tests pass all five stages, rotation/new retry, resolver drain/disk stability and unrelated-preference positive control; full checks/build/restart acceptance pending. Live3901/customer data untouched. Previous prepared build marked SOURCE_CHANGED_REBUILD_REQUIRED until new exact-source build acceptance.

Related rotation regression also reproduced RED: a late old-key401after the normal settings reset poisoned the replacement account's shared suppression state (actualFAILED/expectedCOMPLETED on fresh retry). Existing circuit-breaker updates now require the issuing snapshot to remain current; obsolete raw failures remain evidence. Synthetic wire matrix passes old401/403/429with replacement keys for Serper/Hunter/Groq/NVIDIA, plus Groq/NVIDIA old socket-failure cooldowns and unchanged-account positive controls. Actual request headers/query credentials and AI model selections are asserted, not inferred from status alone. Two overlapping distinct-company operations prove private snapshots do not become shared global settings. Full npm run check passed from allowlisted tracked test inputs using isolated locked dependencies and minimal environment, including fresh-process context2 persistence and all existing V1 tests. An extended actual HTTP fixture additionally passed: old pipeline1 refuses automatic reuse409 across single/SSE/job paths, remains explicitly revalidatable without a live operation, and its immutable bytes stay unchanged. The fixture's live-operation body is synthetic; no real provider account acceptance implied. Build/browser acceptance pending.

Exact implementation bcc135cbd9d0423e77b6ab0965c3df39477aef2b rebuilt with locked staged dependencies: typecheck/lint/frontend/backend build/release smoke PASS. Build8dcef5835fdf4819235817d0165b409861b2b7f79c69eab5296265a4758e27bb is PREPARED_NOT_DEPLOYED; independently recomputed canonical source digest and staged artifact digest both match. Full npm run check was repeated and passed after the circuit-state fix, not just before it. Focused provider wire test also passed after the final concurrency/refusal/socket controls; final canonical-source typecheck passed. Actual compiled browser suite6tests1.8min PASS: pause/timeouts/retry, resume, truthful FAILED/PARTIAL/COMPLETED feedback,1005-run country-separated history/restart and saved/live choices/restored intent. Sources and .test-cache test inputs were inspected for one-writer ownership; live dist/node_modules/customer data remained untouched. New exact-source hosted evidence is pending; these local results do not close real-provider, clean-Windows or customer deployment acceptance.

### November1 current-build history, resource and dependency checkpoint

Application change768efd99748b1df88cd5a269a9ffe68df5813e24 adds selected-capture details to the existing read-only ResearchWorkspace. Existing immutable run context/raw records provide operation, mode, start/completion and deduplicated recorded providers; missing/unknown legacy metadata stays unknown. A recorded attempt is not labelled a connected provider or successful delivery. No backend authority, schema, evidence, storage or monitoring change. Existing static presentation regression extended for known/legacy metadata, provider deduplication, unknown labels and denied browser storage. Staged source typecheck/lint/E2E types, production build and release smoke passed. Compiled browser history/reuse suite3tests42.9s passed metadata after restart, legacy fallback,1005-run paging/country isolation, no provider egress and distinct saved/live intent. Build1d09665c3b36315442929a4cc834a17eae696953c7a5298936395bd6b38ec74f is PREPARED_NOT_DEPLOYED; the old live backend was not replaced.

PERF01 current-build observation: existing opt-in resources.spec.ts completed300seconds of paced workload plus idle/settling,15cycles/18samples,362.13seconds measured body time; Playwright terminal PASS1test6.4min. Synthetic60-row upload, paging, countries, Contacts search, Settings and local logs only; no paid provider research or export workload. Zero page/console errors. Backend RSS initial148,344,832bytes, peak148,344,832bytes, settled120,954,880bytes; heap initial46,223,896bytes, peak49,783,832bytes, settled47,928,200bytes. Slowest measured cycle3,366.19ms. Browser heap estimate was coarse10,000,000bytes; settled DOM3is about:blank, not proof that application DOM never grows. No forced GC or leak-free/target-scale claim. JSON attachment remains in ignored staged soak-artifacts/results.json.

SEC02 locked-stage production npm audit returned valid nonzero report with10moderate/0high/0critical; .test-cache/current-locked-production-audit.json is the current local report, not the older original-checkout prod-audit.json. No audit fix, forced override, downgrade or dependency mutation. Official advisories https://github.com/advisories/GHSA-g3hv-75wg-m249 and https://github.com/advisories/GHSA-3g3m-2fjr-6pw4 identify minimatch11.0.1/glob14.0.2 fixes; that alone does not prove compatibility with old callable APIs. Scoped dynamic probe used a rejecting CommonJS loader guard for glob/minimatch/readdir-glob, proved refusal with an intentional positive control, then separately ran existing actual excel_parser_security and uuid_excel_compatibility tests: both PASS,8target module loads and0globbing calls during each tested pipeline. This covers those XLSX parsing/export/formatting paths only, not every package path or Sentry ESM behavior. Sentry's bundled globFiles remains installed; runtime adapter disables default integrations/tracing. All10advisory entries remain unresolved pending compatible remediation or complete supported-path disposition.

Existing report-export authority was verified rather than rebuilt: actual compiled browser/API saved-report-export test PASS1test1.0min; server report-ID lookup, all5format choices and override/missing-ID refusal remained correct. Reports are held in an in-memory Map, not a durable historical-report store; no current frontend creation caller was found and no retired generator was revived. Browser account-control reinitialization still fails with kernel-asset path error; no dashboard setting or event receipt claimed. All earlier release/customer gates remain open as individually recorded.

Hosted terminal observation2026-11-01T13:49:58Z: exact1d4a81c9fc6a00dc76a2423e047f75ddd2012d4b release41311800581 SUCCESS (152Windows steps/browser/native launcher/Docker), research41311800369 SUCCESS and inventory41311800387 SUCCESS. Awaited terminal state before pushing another documentation checkpoint so the existing branch-concurrency policy would not cancel its acceptance. Prepared source/artifact digests were independently rechecked against the canonical source and staged build: both match. This is committed-source/isolated-runtime evidence; native customer installation, clean Windows, current real-company accuracy, monitoring dashboards and safe live handoff remain open.

Current active task: finish EdgeView product acceptance on the live desktop build. The data handoff and enabled-provider backend checks passed. Live Chrome controls require origin access. Continue remaining research, security, recovery and hosted checks before installer acceptance and Store submission.

### November1 source ownership and desktop handoff checkpoint

November1 18:20PKT continuation: exact a8643921aece3398ee1d77e0f17c8818959d9517 now has all hosted workflows SUCCESS: release41299362038 (152Windows verification steps, browser job124826900457, native launcher and Docker), research41299362036, evidence41299362169. This verifies that source against the executed CI gates, not installed/customer acceptance. C: free space now7,769,653,248bytes, satisfying the measured backup/copy headroom preflight at this observation. Old backend health still200/PID41388. Owner was asked again for a normal console stop; backup, live artifact replacement and dependency promotion remain unexecuted. Do not reuse the earlier low-space result as a current blocker or treat the running process as stopped.

Continuation acceptance: isolated compiled-runtime research-history/reuse-choice browser tests passed3tests55.0s with locked staged dependencies. They cover opening saved evidence beyond1000 runs, restart persistence with no provider requests, saved-only versus explicit live request intent, and visible restored live intent. These reuse existing verified behavior; they do not close HIST01 provider summaries, per-stage settings consistency or complete live-provider acceptance. Owner reported another Ctrl+C stop, but actual health again returned200/PID41388. OS inspection confirms node41388 is still the listener, parent cmd32648; neither has a main window. No force termination or lock removal performed.

Getz public-source check: current official https://getzpharma.com/contact-us/ separately lists Kenya at63Westlands Road,Nairobi with+254204261000 and Pakistan headquarters inKarachi with+9221111111511. The official global-presence page https://getzpharma.com/global-presence/ describes Kenyan operations; Kenya regulator documentation distinguishes the Pakistan manufacturer from its Kenyan local technical representative. These are references for field/country/relationship verification, not facts injected into profiles. An isolated direct capture through the current hardened outbound helper returned403 before projection; no anti-bot bypass, provider quota or customer data modification attempted. That operator probe did not reproduce the full engine request headers and therefore does not establish an engine regression. Final current-build API/UI/export truthset acceptance remains open; search-readable official content is not proof of application retrieval.

November1 handoff follow-up: owner reported a normal console stop, but the subsequent read-only TCP check still found PID41388 listening on3901 and its database lock present. Do not treat the reply as observed shutdown, remove the lock, or replace running dependencies/dist. Available C: space measured3,413,921,792bytes. Approved state totals2,609,424,024bytes; independent backup plus compatibility copy require5,218,848,048bytes before working headroom. Owner offered to free another4GB; reaching at least7GB total remains unverified. The temporary normal-interrupt helper was refused by Windows script execution policy before execution; no signal was sent to the real backend and no policy bypass was attempted. The disposable interrupt probe was the only cleanup target. Browser/native control initialization also remains unavailable (kernel asset path error), so dashboard/account changes are not verified.

Exact-source89329e081d7a799a6b49529fdd3b570bb03efcc2 hosted observation at2026-11-01T10:46:09Z: research41297004543 and release inventory41297004548 SUCCESS; release41297004635 passed152Windows steps, native launcher and Docker, but browser failed1of37. The prior full-export workflow now passed7.5s. Remaining failure is job-pause-feedback: missing unconfirmed-checkpoint alert, plus an intercepted runtime-state request ECONNRESET. Cause is under investigation; neither product correctness nor a test-only cause is established. Keep CI01 open; do not rerun blindly or weaken assertions.

Pause-test follow-up: downloaded only the synthetic browser artifact for that run and inspected its error context. The backend-availability message had changed to timed out while this scenario was testing intentionally held stop requests. Original test passed once locally45.8s and three repetitions2.0min, so this does not establish a repeatable product defect. Narrow test isolation now reads/asserts the owned backend runtime-state response once before navigation and replays that synthetic available capability; background availability transport no longer changes the independent job-control scenario. Stop503, held-request timeout, checkpoint503, private-marker exclusion, continued polling and eventual STOPPED/resume assertions remain intact. Changed scenario passed1.2min using the prepared compiled application and locked staged dependencies; E2E typecheck and diff check passed. No application code, runtime timeout or global retry policy changed. New exact-source hosted evidence remains required. Latest real health still returns200/PID41388; backup/promotion remains blocked by actual shutdown and disk headroom.

Owner explicitly confirmed this session is the sole writer and requested updates in the original desktop project. Both checkouts were clean before handoff. Initial comparison at52e0154 found original mainb6db239 with37main-only/205integration-only commits; existing reviewed dispositions below were reused, not a blind merge. Stronger current Node floors, safe SBOM reads, package scanning, storage and country fixes were preserved; rejected restore and unsafe old live-port harness were not restored. New target tracked paths were checked for existing untracked/ignored collisions:0. Original checkout now uses development/edgeview-v1 at3ac6c39; main remains recoverable and integration remains a reference checkout. No customer/configuration/dependency/dist file was copied or replaced by this tracked-source switch. Live health still proves the October26 b6db239 build; source handoff is NOT runtime deployment. Dependency preflight found Sentry/PostHog roots missing from the original node_modules; prepare verified dependencies before any restart. No live enrichment job was active at the read-only preflight. Disk headroom varied from0 to1.25GiB and fell below0.5GiB again without our deleting user files; do not start a full dependency install/package build on uncertain capacity or substitute stale dependency success.

52e0154 fixes a confirmed incomplete-export success bug: the shared response validator ignored X-Export-Failed-Formats. Pure and rendered regressions first failed, then passed after the validator refused incomplete archives before reading/downloading them, using a fixed safe error. Actual UI retry generated a complete real4format ZIP, with zero unexpected provider calls. Typecheck/lint/E2E typecheck and production build passed. 3ac6c39 removes FileViewer's old collect-all-pages/client CSV fallback and makes the server-owned export callback required. Paging test/typecheck/lint/build passed; rendered filtered/full/retry tests passed37.3s, including zero extra paginated data reads during export. Initial browser retest failed ENOSPC before acceptance; a later disk-space check recovered headroom without our deleting user files, and the completed rerun is the accepted evidence. These are scoped fixes, not complete EXP01 or release acceptance.

Desktop update preparation checkpoint: isolated npm ci --ignore-scripts completed against exact source manifest/lock;22production roots verified. Original installation comparison found412matching packages,156missing and1uuid version conflict, so the running dependency tree was not patched in place. Sourcea2a6a86 was built separately with those locked dependencies; staged typecheck/lint, frontend/backend build and production release smoke passed. Build1eb816a966ce87217898802aa0eb53b53cb709b5848d2e0da64f617a404a3efe remains PREPARED_NOT_DEPLOYED. No dotenv/customer/configuration data entered this temporary build; only tracked public assets were copied. Initial alternate-root type resolution did not pick up React declarations; corrected the staging helper's declaration mapping without changing application types. Normal installed-root checks remain required after handoff. Four actual isolated browser checks passed25.5s: HTTP500/partial ZIP/retry, actual sql.js history-read fault/refusal/recovery, filtered export without browser page collection, and quick full export. Provider egress was denied. Owner normal-stop handoff is pending because the oldb6db239 backend lacks the newer ownership bridge; no force termination, database lock removal or live artifact/dependency replacement occurred.

Hosted evidence: c0fd56d release41277471887, inventory41277471897 and research41277471836 all SUCCESS;31d372d release41278453913 (151successful Windows steps plus browser/Docker/native), research41278453935 and inventory41278453917 all SUCCESS. Sourcee6f7faa release41294441959 passed151Windows steps/Docker/native but browser failed1of36: full-export HTTP200 arrived after18.739s while its download waiter used15s. Reviewed actual hosted trace/context, not just prose. 5e8aba0 gives this artifact wait45s without changing product/network limits and adds status/compact-body/timing evidence; all61CSV lines and last record remain asserted. Both the unchanged real workflow and a private harness variant holding the actual backend response16seconds passed43.5s, including country keyboard controls and restart. This does not establish a small-export performance target or clean-Windows acceptance. Final E2E typecheck with locked staged dependencies passed. Exact latest-source hosted acceptance remains pending.

## Full owner acceptance checklist

This is the full owner acceptance view, not a replacement for the goal/evidence records below. A verified sub-fix does not close a broad item. [ ] not started/awaiting prerequisites, [~] partial/in progress, [x] fully verified for this acceptance item, [!] external blocker. The short board groups these requirements; new directive items are separately tracked there until reconciled. Detailed commits/tests/limitations remain in dated checkpoints and the capability matrix.

### Research and data accuracy

- [ ] CC05: **Evidence-backed company aliases** Finish conservative evidence-backed entity aliases, backend admission, raw-name provenance, country isolation, uniqueness/concurrency and restart-safe migration; reuse current identity mechanisms.
- [~] HIST01: **Research history and reuse** Complete local research-history navigation and explicit valid reuse/live refresh, bounded pagination and freshness/version/provider/objective semantics on existing immutable records.

- [~] CC01: **Country isolation** Complete company-country isolation across extraction, cache, history, UI and exports.
- [~] CC02: **Parent and subsidiary attribution** Finish parent, subsidiary, distributor and field-level source attribution.
- [~] CC04: **Emerchemie live research** Complete fresh Emerchemie official-page retrieval and rendered acceptance; corrected retained evidence is verified only in its stated scope.
- [~] QA01: **Company fact checks** Verify Getz Kenya, Global Pharmaceuticals, Thorne Berry, Emerchemie and Slim Pharma against public sources through persistence/API/UI/export.
- [ ] DATA01: **Importer dataset reconciliation** Reconcile the real importer dataset, duplicates, exporter exclusions, weak profiles, contacts and counts.
- [~] CORE01: **Provider verification** Verify all four enabled providers, including quota, authentication, timeout and recovery.
- [~] JOB01: **Batch recovery** Finish batch progress, cancellation, retries and interrupted-job recovery.

### Data safety and recovery

- [~] DATA02: **Legacy history repair** Finish applying legacy-history reconciliation safely; isolated journaled repair is not live installation acceptance.
- [~] MIG01: **Data migration and backups** Complete stable-data-directory migration with backups and interruption recovery.
- [~] REC01: **Safe restore** Finish safe restore, link/junction protection and stale-file handling.
- [ ] REC01: **App and data rollback** Prove compatible application and customer-data rollback together.
- [~] DATA03/PERF01: **Storage failure recovery** Complete corruption, permission, disk-full and unexpected-termination acceptance across supported workflows.

### Security, monitoring and support

- [~] SEC01: **Integrated security checks** Recheck security protections against the final integrated build, including the active provider-transport correction.
- [~] SEC02/CI01: **Dependencies and secret scanning** Resolve dependency findings and verify final secret/history/package scans, licenses and SBOM.
- [ ] SEC02: **Exposed key rotation** Owner plans to revoke previously exposed keys later. Track the account action separately from local engineering and verify it when completed.
- [~] MON01/MON02: **Monitoring delivery and privacy** Verify fresh final-build Sentry/PostHog receipt, privacy controls and crash coverage; current browser-tool access is unavailable.
- [~] DIAG01: **Diagnostics and support** Finish diagnostics, redaction, retention and support instructions/acceptance.
- [~] PRIV01/UX01: **Privacy and license notices** Finish truthful privacy, external-provider disclosures, About and third-party notices.
- [x] ID01: **Installation identity recovery** Creation, persistence, corruption recovery, reset and test isolation passed. The verified backup, migrated desktop identity and live health response agree after restart. Deferred licensing design remains in EDGEVIEW_LICENSING_DESIGN.md.

### Release and installation

- [x] REL01: **Desktop handoff and data check** Exact c64ebd5 is live in the original checkout on port 3901. Locked dependencies, verified backup, schema migration, integrity and restart passed. One dataset and all 17,612 rows are present after restart.
- [~] REL01: **Freeze release version and build** Freeze accepted version, commit, build, schema and channel identities.
- [~] CI01: **Hosted release checks** Exact a864392 source passed release41299362038, research41299362036 and evidence41299362169, including152Windows steps/browser/native/Docker. Final frozen-customer-package evidence remains pending. Preserve historical failures.
- [~] DIST01: **Self-contained Windows installer** Finish a self-contained customer package without installed Node/npm or developer files.
- [!] DIST01/MS01: **Signed install and native launch** Verify trusted MSIX installation and native launch; signing/application-control/account gates remain open.
- [ ] UPD01: **Updates and recovery** Finish the selected Store-compatible update mechanism, post-update acceptance and recovery.
- [ ] PILOT01: **Clean Windows pilot** Test install, upgrade, interrupted upgrade and uninstall/reinstall on clean Windows.

### Final acceptance and handoff

- [!] QA01: **Live UI control audit** Browser Use denies the live Chrome origin. Complete live visual and control QA when access is available.
- [~] UX01: **Accessibility and offline workflows** Complete accessibility, offline and essential-workflow acceptance.
- [~] PERF01: **Performance and soak tests** Repeat representative current-build and target-device performance/long-running checks.
- [~] FINAL01: **Desktop release folders** Populate Desktop documentation, accepted version snapshots and installer folders accurately; working documentation alone is not final artifacts.
- [ ] FINAL01: **Source, data and runtime artifacts** Produce separate full-source, private-data and customer-runtime artifacts.
- [ ] FINAL01: **Checksums and release notes** Produce final checksums, notices, release notes and readiness report.
- [ ] FINAL01: **Owner review before shipping** Stop with a verified owner-review packet before publication or uncle deployment.

## Live customer-readiness board — additional directive reconciled 2026-10-31

Same ledger and goals, not a replacement roadmap. [ ] NOT STARTED/not yet accepted; [~] IN PROGRESS/partial; [x] VERIFIED for stated scope only; [!] BLOCKED by an identified external dependency. Detailed capability matrix and dated evidence below remain authoritative. Stop after known supported-path High/Medium findings and required acceptance close; do not expand into cosmetic/speculative hunting. Store publication still requires the owner's later checkpoint.

### P0 BLOCKERS

- [x] SEC01 / directiveA provider-transport correction: existing pinned HTTPS boundary now owns credentialed research/settings requests; scoped regression, independent review correction and actual Serper/Hunter positive controls passed. This closes the confirmed transport-policy gap, not all SEC01 security/release acceptance. Runtime exploit/exfiltration was not established.
  - [x] SEC01.SERPER: search and resolver use safeFetchProviderRequest; actual public search200 returned8 results and5 opaque links, all5 resolved with resolver200; total26.03s. Synthetic3MiB replay and8MiB boundary pass. No profile/UI accuracy claim.
  - [x] SEC01.HUNTER: research and settings use pinned transport; synthetic actual caller coverage passes. Actual settings diagnostic returned200 with valid payload in1.30s; source configuration hash unchanged. Full enrichment/UI acceptance remains CORE01/QA01.
  - [x] SEC01.DIAGNOSTICS: private/mixed DNS refusal, public authority pinning, valid payload, redirect refusal,256KiB body limit and observed status preservation pass in provider_request_path and provider_diagnostic_payload tests.
  - [x] SEC01.DNS: provider_request_path and outbound_connection_binding pass private/mixed-answer refusal, numeric-address connection and retained TLS/Host controls using synthetic wire/DNS.
  - [x] SEC01.REDIRECT: actual provider/settings caller tests reject redirects before a second destination and preserve observed302; existing outbound helper regression passes.
  - [x] SEC01.BOUNDS: actual-wire tests cover default2MiB request ceiling, explicit8MiB replay/response exact boundary and oversized rejection,256KiB diagnostics, body-stall timeout and invalid bound before transport. Public official gzip behavior remains separately tested.
  - [x] SEC01.ERRORS: independent review exposed lost account suppression after capture rejection; reproduced RED then corrected. Both Serper/Hunter401/403/429 retain actual HTTP status and stop repeated requests. Resolver quota remains separate from search suppression.
  - [x] SEC01.FOCUSED: actual diagnostic/research wire test and scoped raw/global/computed/aliased-fetch lint test pass. Existing provider response, credentials, SSRF, pinning, destination and official-page regressions pass. Lint is an accidental-misuse guard, not a security sandbox.
  - [x] SEC01.V1: npm run check (typecheck, lint, V1), production build and release smoke passed on the reviewed patch. Subsequent test-only8MiB assertions passed separately. Exact committed-source packaging is recorded in the following checkpoint when executed; hosted CI remains externally blocked.
- [~] CC01–CC04 / directive8: correct company-country, local/parent/distributor and every admitted field through history/UI/export. Scoped fixes verified; representative final truthsets and same-company concurrent completion ordering remain open.
  - [x] QA01.GETZ_CURRENT_FIELDS: isolated current-engine real research and independently checked Kenya phone/address; durable overlay, country-separated control, API, rendered Contacts/Intelligence, actual selected CSV and CSV/XLSX/PDF/DOCX/ZIP downloads, saved-only reuse with zero additional provider calls and normal restart passed on compiled bcc135c/build8dcef583. Immutable run unchanged; no additional unreviewed fields promoted. Original customer deployment and other companies remain outside this acceptance.
  - [x] QA01.EMERCHEMIE_CURRENT_CAPTURE: the complete official 3,668,585-byte contact page retrieved over bounded transport. On compiled 4c4dd35, isolated persistence, API, rendered Contacts and Intelligence, exports and restart passed. Both office addresses, both public mailboxes and all seven admitted contact-page phone values matched the capture. CSV, XLSX, PDF, DOCX and ZIP retained both addresses and mailboxes. Saved-only reuse made zero provider requests and preserved immutable evidence. Full live query, extraction and leadership acceptance remain open.
- [~] DATA02/MIG01/REC01 / directiveB,O: preserve JSON dataset/sql.js operations/immutable evidence/settings authorities; close cross-store upload/delete interruption, actual supported migration/restore/update/data rollback acceptance.
  - [x] REC01.SNAPSHOT_VERIFICATION: read-only inventory, manifest binding and file hash checks passed on a real synthetic backup and SQLite reopen. The rehearsal rejected corrupt, missing, extra and unsafe entries. Matched package/data rollback remains open.
  - [x] REC01.ISOLATED_RECOVERY: the operator command prepared a new data root from a verified backup, recording its manifest digest and schema. The compiled app opened the recovered root twice with the same installation ID and checkpoint dataset. Later writes stayed in the original data root. Wrong manifest, wrong schema and existing destination were refused. This verifies the isolated recovery workflow with the tested build. Installed application and data rollback remain open.
  - [x] REC01.REAL_BACKUP: the stopped desktop installation was backed up and independently verified. The existing numeric lock remained intact. All 10,640 files matched; schema 1 passed SQLite integrity check.
  - [x] REC01.REAL_COMPATIBILITY: a separate copy of the verified desktop snapshot passed current-build startup, schema 1 to 2 migration, integrity, dataset discovery and normal restart. Live handoff subsequently passed with the original root and the preserved pre-migration snapshot.
- [~] PG01 / directive10: verified arbitrary v* tags previously reached a write-permission publisher for the developer ZIP after CI; removed that automatic publication path. This intentionally prevents shipping while customer-artifact/acceptance gates are open, not a completed promotion system.
  - [x] PG01.AUTO: parsed all3 workflow YAML files locally, confirmed read-only contents permission/no release-create action or command, retained every previous verification job; no tag or publication performed.
  - [ ] PG01.IDENTITY: accepted source/app/build/schema/channel/tag consistency and frozen customer artifact lineage.
  - [ ] PG01.EVIDENCE: exact accepted package, clean-Windows/recovery evidence and owner-review checkpoint.
  - [ ] PG01.PROMOTION: select and test promotion through the approved Microsoft distribution route without rebuilding accepted bytes. No replacement custom updater/publisher added.

### P1 HIGH-RISK

- [x] CI01.EXPORT_ARTIFACT_WAIT: actual hosted200/17.68s exceeded15s waiter. 15cf767 test-only finite45s waits retain status/content/scope/failure controls; actual delayed-response RED→GREEN,11affected local browser cases and hosted41333770151all jobs PASS. Product/performance limits unchanged; cause of hosted small-export delay was not established.

- [ ] CC05 / new owner add-on: conservative evidence-backed canonical aliases; formatting similarity alone never authorizes a legal-entity merge.
  - [ ] CC05.ARCH: inspect active identity/contact/index/evidence/storage/migration paths; propose smallest consolidated backend design, files/schema changes and invariants before feature edits.
  - [ ] CC05.ADMISSION: EXACT_SAFE/PROBABLE_ALIAS/AMBIGUOUS/DISTINCT decisions backed by evidence; same-country boundary, parent/distributor distinctions, no fuzzy-only/suffix-only merge.
  - [ ] CC05.DURABILITY: preserve raw source names/provenance and immutable evidence; controlled aliases survive restart, race-safe uniqueness and idempotent/recoverable migration/backfill.
  - [ ] CC05.REGRESSION: all13 requested variant/country/collision/domain/typo/generic/ambiguity/restart/provenance cases, plus existing country and import/export regressions.
- [~] HIST01 / new owner add-on: existing immutable run store/read-only workspace and exact-country retained-run reuse are baseline, not completed History/reuse semantics.
  - [~] HIST01.ARCH: run/header/blob/index/overlay/job/report/cache paths inspected and reused across the scoped History units; no second history store. Full History actions/retention and canonical-alias integration remain open.
  - [~] HIST01.VIEW: selected-run capture details and bounded pagination are verified below; full list summaries, direct history reuse/live actions and retention remain open. Do not infer live freshness from a saved capture.
  - [x] HIST01.CAPTURE_DETAILS: 768efd9 selected immutable-run operation/profile/start/end/recorded-provider summary. Static presentation, typecheck/lint/E2E types, production build/release smoke and3compiled browser tests passed42.9s: metadata/legacy fallback, beyond1000/restart/country pages, saved/live intent and zero backend outbound attempts. No new persistence, inferred freshness or provider calls. Full History list summaries/actions/retention remain open.
  - [x] HIST01.PAGING: cursor pages on existing immutable headers; actual HTTP plus browser opens beyond1000 records, equal-time ordering/concurrent arrivals/restart/countries/failure retry; zero backend outbound attempts. Remaining VIEW semantics are open.
  - [~] HIST01.POLICY: seven-day recorded-context eligibility and explicit historical/live choices passed local single/SSE/job gates; settings consistency local acceptance passed below, hosted checks/complete History actions/alias integration/final acceptance remain open.
    - [x] HIST01.SETTINGS: bcc135c single private snapshot, bounded interruption, revision2 context and fresh retry; all listed local wire/runtime/full-check/build/browser and hosted15cf767/41333770151criteria passed. Real four-provider/account acceptance remains CORE01.
      - [x] HIST01.SETTINGS_QUERY: model-provider enablement change during real query-transport fixture stops before Serper; actual failed capture persisted.
      - [x] HIST01.SETTINGS_SEARCH: search-stage enablement/model/key changes stop follow-on provider calls and preserve captured partial evidence.
      - [x] HIST01.SETTINGS_RESOLVER: only already-issued resolver pair may finish; delayed sibling is drained, returned/persisted bytes stay stable, Hunter is not called.
      - [x] HIST01.SETTINGS_HUNTER: change during Hunter stops before public crawl.
      - [x] HIST01.SETTINGS_EXTRACTION: model change during extraction cannot publish COMPLETED; query/extraction still used the same captured model selection.
      - [x] HIST01.SETTINGS_ROTATION: interrupted credential rotation does not serialize private snapshot; new explicit operation succeeds using new key. Monitoring-only preference changes do not interrupt research.
      - [x] HIST01.SETTINGS_ACCOUNT: all4supported providers × old401/403/429 preserve actual refusal evidence without suppressing replacement keys; unchanged-account hard refusal/backoff controls still pass.
      - [x] HIST01.SETTINGS_NETWORK: Groq/NVIDIA obsolete socket failures cannot cool down replacement accounts; unchanged-key network cooldown remains enforced.
      - [x] HIST01.SETTINGS_CONCURRENT: overlapping distinct-company operations keep separate snapshots; interrupted old run and successful replacement run persist separately.
      - [x] HIST01.SETTINGS_REVISION: context2/index/fresh-process restart and actual HTTP old-pipeline1 refusal in single/SSE/job preflights, explicit historical revalidation/no live call and unchanged old bytes pass.
      - [x] HIST01.SETTINGS_ACCEPTANCE: full typecheck/lint/V1, wire/runtime/fresh-process restart, committed build/release smoke and6affected browser cases passed; hosted15cf767 release41333770151all jobs SUCCESS, including152Windows checks and browser suite.
  - [x] HIST01.ELIGIBILITY: completed/current-context/time/entity-country gate, no live fallthrough, explicit saved/live controls, durable job intent/offline refusal and visible resumed live permission passed focused/full V1 and browser regressions. Real providers are not proved by synthetic operation seams.
  - [x] HIST01.CONTEXT: new immutable request context, key-exclusion, prefix/index/restart metadata, capture/compatibility response and rendered not-live feedback passed focused/full V1 and isolated retained HTTP/browser checks. Freshness admission is still open.
  - [ ] HIST01.ACTIONS: distinct Open evidence/history, Use existing valid result, Refresh live; history opening has zero provider calls, explicit force-refresh creates a new research operation.
  - [ ] HIST01.SAFETY: durable-before-publish, concurrency, restart/recovery, existing security/privacy and country boundaries; no raw history/identity facts in telemetry.

- [~] JOB01 / directiveN: saved-only reuse and failed-overlay restart boundary verified; same-company interactive/batch ordering, cancel/stop/retry and crash/restart acceptance still require direct evidence.
  - [x] JOB01.PUBLICATION: late same-contact publication loss reproduced and fixed across interactive/background batch; full V1/typecheck/lint/build/release, focused HTTP/restart and no-serialization mutant passed. Final rendered/real-provider acceptance is separate.
  - [x] JOB01.QUEUE_FAILURE: isolated queue test confirms same-contact serialization, different-contact parallelism, exact persistence-code rejection and next-operation recovery; this is queue behavior, not entire job recovery acceptance.
  - [~] JOB01.CANCEL: actual stop while waiting on publication rejects early restart409 JOB_DRAINING; drained resume succeeds with no duplicate count. Eight-company fixture now proves5 in-flight finish/3 remain queued across restart and explicit resume. Other cancellation stages/rendered Pause failure controls remain open.
  - [~] JOB01.RETRY: eight-company stopped/interrupted resume exact counters and no completed-company replay verified; actual provider/storage-failure retry and force-refresh acceptance remain open.
  - [~] JOB01.CRASH: actual on-disk5-company checkpoint survives owned-child SIGKILL; restart PAUSED5/3pending, explicit resume completes8 without completed-company replay. Actual registered shutdown handler also drains/flushes exit0 in test-only signal-delivery fixture. Windows launcher/OS signal delivery and real-provider acceptance remain unverified.
  - [~] JOB01.CONTROLS: rendered Resume409/503/private-text omission/actual15s deadline/success retry and Pause503/15s timeout/unconfirmed checkpoint/continued polling/STOPPED recovery verified; wider progress, cancellation stages, modal-close/context races and real-provider acceptance remain open.
- [ ] API01 / directiveL: verify supported endpoint input/conflict/provider/storage/internal status taxonomy; retain redaction and honest recovery UI.
- [~] EXP01 / directiveM: contact-download authority fixed through current stored contacts; wider file/derived endpoints still require their own acceptance.
  - [x] EXP01.CONTACT_FACTS: actual HTTP regression reproduced forged browser company/email in download; contact requests now resolve scoped IDs to current stored records and ignore client facts, including selected object values.
  - [x] EXP01.CONTACT_SELECTION: actual HTTP rejects empty, missing, mixed stale, duplicate and out-of-scope IDs with400 INVALID_EXPORT_REQUEST; valid selected object IDs yield only the stored selected contact. Existing rendered selection/export workflow passes.
  - [x] EXP01.CONTACT_FORMATS: existing actual CSV/XLSX/DOCX/PDF/ZIP renderer contract passes; final production build and scoped browser/API checks pass. This is not final downloaded-document visual acceptance.
  - [x] EXP01.HTML_SELECTION: actual endpoint previously widened malformed string/null/object IDs to all contacts; now rejects malformed/stale/mixed/duplicate IDs400 INVALID_EXPORT_REQUEST. Existing explicit omitted-ID all export and empty-array none semantics preserved; hostile markup, multilingual data, field scope and failure-redaction checks pass.
  - [x] EXP01.FULL_FILE_CALLERS: App quick Export Data now shares the store callback and existing sourceFileId endpoint; no full-row browser roundtrip. Actual rendered browser RED on generic /api/export before fix, GREEN on compact stored-file request/no records/full60-row download after fix. Existing17,612-row stored-file/all-format contract and restart/navigation workflow pass.
  - [x] EXP01.FILTERED_FILE: supported filtered/grouped file button sends stored source+view, not rows; paging/export share existing normalization/grouping/filter/sort logic. Parent here means scoped authority acceptance, not final visual/performance acceptance.
    - [x] EXP01.FILE_REFERENCE: actual browser requires stored-file route/no records; generic files+browser-rows endpoint now rejects400 STORED_FILE_REQUIRED (RED200 before correction). Client builder rejects unanchored files too.
    - [x] EXP01.FILE_VIEW: actual API/browser tests search/product/country/importer/date range/grouping/sort-desc, no-match refusal, cross-country contradiction and malformed/unknown/oversized options. Repeated search query values return400 INVALID_FILE_VIEW rather than a raw TypeError.
    - [x] EXP01.GROUP_FACTS: regression exposed first-item/first-amount loss from stale raw aliases; server-owned grouped projection now exports both fixture items and correct30.00 total. No browser business values accepted.
    - [x] EXP01.FILE_CHECKS: typecheck/lint/full V1/E2E typecheck/build/release smoke, focused browser export/contact workflows and17,612-row existing stored-file contract pass. Release smoke now exercises actual uploaded authority in all5formats instead of inventing browser rows; final downloaded-document visual/clean-Windows acceptance remains separate.
  - [~] EXP01.DERIVED_REPORTS: preserve actual report semantics while binding each dataset to its existing authority; summary/country completed in the scope below, stats/report still open.
    - [x] EXP01.SUMMARY_COUNTRY_SCOPE: current Summary/CountryView buttons submit explicit stored file IDs instead of fetched row unions; server rejects absent/empty/stale/mixed/duplicate scopes and any row/selection overrides. Summary requires exactly one file; country can explicitly combine files without implicit fallback to all.
    - [x] EXP01.SUMMARY_COUNTRY_CONTENT: actual browser downloads include60 rows beyond page1 and exclude an unrelated stored file; explicit two-file API scope includes both. Separate actual API checks confirm marker content in CSV/XLSX/DOCX/PDF and all-format ZIP for both datasets. These are content/authority checks, not final visual or customer-installation acceptance.
    - [x] EXP01.STATS_AUTHORITY: bound Stats downloads to stored files and the same normalized shipment selector as the read API, without browser shipment records; scoped checks below passed. Final real-data/visual acceptance remains QA01.
      - [x] EXP01.STATS_VALUES: actual browser CSV RED displayed LOCALMED/50 but exported N/A/N/A; corrected server projection preserves product/value in existing six-column format.
      - [x] EXP01.STATS_SCOPE: actual browser/API verifies selected file+Kenya, excludes Pakistan/unrelated file, allows explicit ALL and explicit two-file union, rejects stale/duplicate/missing/forged selections without fallback.
      - [x] EXP01.STATS_APPLIED_RANGE: export uses the successfully loaded scope, not an unapplied edited date; impossible calendar date and no-match future range reject400. Broader period-control QA is not implied.
      - [x] EXP01.STATS_FORMATS: actual stored marker verified in CSV/XLSX/DOCX/PDF/all ZIP; typecheck/lint/V1/build/release smoke and affected browser suites PASS.
      - [x] EXP01.RETIRED_ALIAS: old outreach dataset alias independently reproduced200 with invented contact rows; generic API now returns410 RETIRED_EXPORT_DATASET. No retired outreach functionality revived.
    - [x] EXP01.REPORT_AUTHORITY: inspected Reports→global export→resolveStoredReportExport: existing request uses report_id and server-held content; overrides/missing IDs reject. Current compiled browser/API regression passed1test1.0min, preserving custom table/text through CSV/XLSX/DOCX/PDF/all ZIP. Origin is db.reports, an in-memory Map populated by /api/reports/upload; no current frontend creation caller found. No durable-report/restart claim, new report generator or persistence added. Broader supported workflow/retention remains explicit acceptance work.
- [~] SEC02: final secret/history/package/dependency/SBOM checks; previously exposed provider keys still require owner rotation. Fresh ed69ff8 production registry audit reports10 moderate/0 high/0 critical findings; supported-path reachability and compatible remediation remain open. Do not reuse older zero-count results as current acceptance.
  - [x] SEC02.HISTORY_PATTERN: current bounded all-ref scan PASS306 commits/603 historical paths,0 prohibited paths/0 known credential-pattern file matches. Not an entropy scan, ignored-file audit or proof exposed credentials are safe.
  - [~] SEC02.DEPENDENCIES: fresh npm audit --omit=dev --json completed with10 moderate package entries involving glob/minimatch chains in Sentry/ExcelJS; assess supported-path reachability and compatible fixes. No npm audit fix --force or package downgrade applied.
  - [ ] SEC02.FINAL_SUPPLY_CHAIN: current complete dependency/license/SBOM/staged-secret evidence and hosted exact-source checks after final source freeze.

### P2 MEDIUM-RISK

- [ ] SCALE01 / directiveC,D,E: measure supported V1 workloads, pagination/search and evidence-view payload/browser cost. Fix demonstrated supported-path regressions only; disk-backed replacement remains post-V1 unless the target workload fails.
- [~] TYPE01 / directiveF,G: tighten touched security/customer contracts. Large backend/component decomposition, global strict TypeScript and bundle splitting remain post-V1 improvements unless needed for a demonstrated blocker. Do not weaken gates or rewrite working architecture.

### CUSTOMER EXPERIENCE

- [x] UX02 / directiveJ: actual isolated rendered browser reproduces FAILED green-toast bug before fix, then verifies red FAILED, blue PARTIAL/NOT_FOUND, green COMPLETED and amber unknown feedback after correction. Production UI/store are real; endpoint outcomes synthetic. Broader real-provider workflows remain QA01/CORE01.
- [x] UX03 / directiveK: reproduced stale directory after successful contact refresh in isolated rendered browser; corrected derived-view invalidation, obsolete-request cancellation and15s bound. Browser verifies current office replaces old,503 ends with retry UI, retry recovers, and adjacent contact-export selection remains correct. Wider customer-data accuracy remains QA01/CC01.
- [x] UX04 / directiveH,I: reference search confirmed unused store sent-status function/export and unused objective fallback computation; removed41 dead lines. Actual research_assessment display remains. Typecheck/lint and both actual rendered contact/evidence presentation regressions pass; no outreach backend added and no claim those unused scores were displayed.
- [x] UX01.STATS_COUNTRY: actual browser reproduced same-importer country change retaining foreign products, and API reproduced mixed-country950 total labelled Kenya. Corrected complete-scope reload and truthful All Countries aggregate label. Pending/error scopes withhold old metrics,503 Retry recovers, and4 held real browser requests reach a visible15s timeout with Retry enabled. This is analytics scope/failure acceptance, not completed research/company-country truthsets.
- [~] QA01/UX01 / directive7,8: each supported control needs expected action/code path/success/failure/executed evidence. Final live/manual QA stays last/deferred; isolated rendered regressions continue. Broader accessibility/offline/empty/error acceptance remains open.

### OBSERVABILITY / SUPPORT

- [~] MON01/MON02/DIAG01/PRIV01 / directive4–6,P,20: reuse strict existing adapters, visible opt-outs and diagnostics projection; no replay/unreviewed tracing, business payloads, private exceptions or hardware identifiers. Prior specific-build real dashboard receipt preserved; final-package receipt/crash/alert/retention acceptance remains open.
- [!] Current account/browser verification blocked by supported tool kernel-assets initialization error; no guessed dashboard state or SDK-flush-only receipt claim.

### PACKAGING / UPDATE

- [~] DIST01/MS01/UPD01/REL01 / directive9–16: intended customer route MSIX/Store-managed Stable updates, account/signing still unverified. Bundle runtime, separate writable state and protect app/data compatibility. Do not build a competing updater for Stable or claim package downgrade is data rollback. Reviewed tracked source is now in the original checkout on development/edgeview-v1; its running artifacts/dependencies and customer state remain preserved pending controlled handoff.
  - [x] DIST01.CURRENT_SDK: existing factory on6b21ac0 produced SDK-validated unsigned internal MSIX; exact archive SHA256 recorded below. First missing-PNG attempt failed closed and remains unexplained WARN, not a claimed source fix.
  - [x] DIST01.EXTRACTED_RUNTIME: exact current archive independently re-extracted; vendor Node bytes/source artifact/file hashes verified, global Node/npm absent from PATH, empty first launch, synthetic country-separated upload/HTML export, missing-provider503, safe diagnostics, owner-pipe shutdown/restart/UUID/data and no app-root writes passed. Not installed/native/clean Windows acceptance.
  - [x] DIST01.RUNTIME_INPUTS: derives12 roots from actual server build, preserves canonical overrides, verifies327 canonical lock components and actual npm install/startup/static shell/all5formats/restart without Vite/frontend Node packages. Host executable used; not an installed distribution.
  - [ ] DIST01.RUNTIME_FACTORY: integrate derived manifest/lock plus needed runtime resources and retained compiled-frontend notices into the actual MSIX factory, then re-extract and test that exact archive.
  - [~] DIST01.RUNTIME_PAYLOAD: current27411-file prototype still includes frontend/build Node packages. Backend external-import graph measured; finish runtime-only dependencies while retaining compiled UI, required resources and proper license/SBOM evidence.
  - [~] DIST01.CONTENT_LICENSE: developer-package content scanner and adversarial canary/failure/preservation regressions PASS; license-inventory helper PASS never confers clearance. Final MSIX-wide content/SBOM/license review remains open.
  - [!] DIST01.TRUSTED_ACTIVATION: native launcher was compiled but NOT EXECUTED/installed in this probe; publisher identity, trusted signing and supported native activation remain unverified. No Windows security setting changes.
  - [ ] DIST01.UPDATE_ACCEPTANCE: accepted installer-compatible updates, preserved user state and compatible application/data recovery.
  - [ ] DIST01.CLEAN_WINDOWS: exact customer installation and target-device gate; PATH masking on this developer host is only scoped evidence.
- [ ] Prepare correct version/build/schema/channel/checksum/SBOM/notes, actual package identity/assets and immutable candidate lineage. No final source/customer copy before acceptance, no public upload.

### CLEAN-WINDOWS ACCEPTANCE

- [ ] PILOT01 / directive17: exact self-contained install→configure→import→research/batch→evidence/export→close/reopen→monitoring/diagnostics→upgrade→restart→uninstall/reinstall/data-retention sequence without dev Node/npm/repository/config.
- [~] PERF01 / directive18: supported target workload/time/RAM/navigation/research/export/idle/long trend evidence; five export repetitions are not a long leak test.
  - [x] PERF01.LIVE_READ_SMOKE: November 7 live backend PID 33344 handled 100 read-only requests at concurrency 12 with zero failures, p95 247 ms, max 661 ms and RSS 273.4 to 295.5 MB. The probe covered health, runtime state and company reads. Long-duration and installed-device checks remain open.
  - [x] PERF01.NAVIGATION_768EFD9: current compiled build1d09665c completed300seconds/15paced60-row navigation cycles plus idle/settling,18resource samples, zero page/console errors; final RSS115.35MiB versus peak141.47MiB. This is a scoped baseline, not long-run leak, large-dataset, research/export or installed-device acceptance.

### FINAL RELEASE GATES

- [x] OPS01: small read-only local dashboard verified in current source. scripts/progress-workspace.test.mjs PASS9queues/33acceptance/35board entries/counts/private-pattern omission/HTML escaping/missing-section refusal; actual isolated browser PASS dark render/currentHEAD/counters/pause-resume-persistence/manual refresh/no CSP or page errors. Only status projection, no raw notes/logs/business storage or customer runtime changes. This internal view does not close release acceptance.
- [~] CI01: November1 hosted337c736 run41275709204 passed native launcher, browser and Docker; exact-source read/evidence workflows also passed. Windows verification reached125successful steps then failed telemetry-runtime.test.mjs:82 (saved Serper diagnostic). Its synthetic fixture intercepted fetch but the hardened provider transport uses pinned HTTPS; b922bf4 updates this test-only fixture to the existing wire adapter with unexpected DNS/socket traffic refused. Local telemetry-runtime test passed. Exact-source hosted rerun remains required. No spending settings changed.
- [ ] FINAL01 / directive19,21–24: run exact-source final matrix after implementation queue closes, freeze three distinct artifacts, readiness report and owner checkpoint. Verdict cannot be READY while known supported-path High/Medium, installer/update/data/security/monitoring/CI gates remain open. Do not submit/publish.

### NEW HIGH/MEDIUM FINDINGS

- [x] Medium QA01.SLIM_OFFICE_WRAPPERS: actual official-page capture reproduced missing deterministic addresses; narrow bounded-layout correction/adversarial regression, full checks/build and compiled captured-source persistence/API/rendered UI/all-format export/restart acceptance PASS on4c4dd35. All3published addresses and public mailbox checked; zero provider calls. This verifies the parser defect, not full live provider/extraction or clean-Windows acceptance.

- [x] Medium HIST01.CONFIGURATION_CHANGE: bcc135c RED→GREEN five-stage/key/drain/concurrent, full check/restart/HTTP policy/build/smoke/6browser and hosted15cf767/41333770151PASS. Not a claimed credential leak or entity-contamination exploit.
- [x] Medium HIST01.OBSOLETE_ACCOUNT_RESPONSE: bcc135c RED→GREEN old-key refusal/reset,4provider refusal/2AI network/cooldown/full check/build/browser and hosted15cf767/41333770151PASS. No credential exfiltration claimed.

- [x] Medium EXP01.LITERAL_VALUES: compiled history-failure/retry acceptance exposed PRODUCT_A becoming PRODUCTA. A focused raw-company regression also reproduced Literal_Company*Ltd becoming LiteralCompanyLtd (RED). a2a6a86 preserves structured values instead of treating them as Markdown. Actual CSV, both DOCX generators, PDF text extraction and XLSX reload regression passed; existing directory DOCX/completeness/all-format export tests passed. Rebuilt compiled-browser recovery now preserves both exact product codes and the Unicode company name. This proves the stated literal-value defect, not multilingual PDF layout or the full export parent.

- [x] Medium EXP01.HISTORY_READ_FAILURE: e6f7faa refuses to publish an incomplete trade index after a SQLite history-read failure (focused RED then GREEN, including complete repair/retry). The compiled production runtime was additionally tested through an opt-in isolated sql.js prepare fault: actual /api/export returned500/EXPORT_FAILED, no artifact was downloaded, private marker was absent from response/UI, repairing the fault allowed the actual complete CSV download with both products and exact shipment count. Zero provider egress. Real customer DB corruption/restore and full EXP01 acceptance remain separate gates.

- [x] Medium EXP01.PRIVATE_EXPORT_ERRORS: afee4a4 keeps5xx raw exceptions out of the customer error UI and the unified route response. Focused private-marker regression RED then GREEN; compiled rendered500 → incomplete ZIP → real retry passed, and actual injected SQL failure returned only fixed safe error information. No demonstrated remote exploit is claimed. This closes the stated export error boundary, not all application error handling or monitoring acceptance.

- [~] High EXP01.REPORTED_LARGE_EXPORT: reproduced on isolated current source. Contacts serialized stored enrichment/trade objects; compact stored-ID request repair is under acceptance. A second dense-product indexing bottleneck was reproduced and corrected locally; large all-format generation remains under test. No request-limit increase, real data change or live restart. Parent remains open.
  - [x] EXP01.REPRO_LARGE: actual rendered Contacts importer Export Report → CSV and All Formats → Proceed / Export, 3,200 synthetic uploaded rows (6,005,332-byte CSV), both POST /api/export bodies 5,835,383 bytes returned HTTP413 before the handler under the existing5MiB Express parser. Recorded .test-cache/large-export-red.log. Existing backend already resolves record IDs to authoritative stored contacts; client needlessly retransmitted trade_feature_recurrence. Compact candidate sends187bytes in the same actual control; final all-format/download acceptance remains open.
  - [ ] EXP01.SURFACE_AUDIT: trace file viewer/full/selected/filtered, Contacts, importer/exporter directory, country/summary/stats/reports, company intelligence, single/multi-company controls to actual handlers.
  - [ ] EXP01.COMPACT_REQUEST: verify authoritative stored IDs/scope/filter/report configuration and explicit all-matching intent; remove any remaining full-array/enrichment-object round trip and browser collect-all-pages requirement. Large selections must stay bounded and small.
  - [ ] EXP01.LARGE_CSV: small and previously failing large CSV, exact expected counts/Unicode/enriched values/country scope, no omissions/duplicates/stale client facts.
  - [ ] EXP01.LARGE_PDF: small and supported large PDF, truthful boundary if unsupported, correct document download and scope.
  - [ ] EXP01.LARGE_DOCX: small and supported large DOCX, preserved Unicode/scope/content and successful artifact.
  - [ ] EXP01.LARGE_XLSX: available XLSX behavior and supported-size boundary verified alongside the other advertised formats.
  - [~] EXP01.LARGE_ALL_FORMATS: reproduced large Contacts CSV/all-format control now passes (3,200 dense-product rows,187-byte requests, HTTP200, ZIP contains all4formats, no failed-format header). Existing17,432-row repeat matrix passes. Remaining supported-size/resource/enriched/restart and cross-surface acceptance stays open.
  - [~] EXP01.PROCEED_FULL: actual Contacts Proceed / Export downloaded large CSV/all formats; separate rendered quick full-file export includes beyond-page rows and uses stored reference. Full cross-surface audit and cancellation/retry acceptance remain open.
  - [ ] EXP01.LARGE_SELECTION_FILTERS: enough selected IDs, invalid/missing/tampered identities, selected/filter/full semantics and server-recognized result counts; arbitrary client business objects cannot inject exported facts.
  - [ ] EXP01.LARGE_FAILURE_RETRY: sanitized useful failure, truthful success only after artifact, bounded cancellation/retry and every supported entry point.
  - [ ] EXP01.LARGE_RESTART_RESOURCES: retained dataset/enrichment across restart; measured memory/latency at documented supported maximum, streaming/chunking assessment and no extra million-record browser copy. Reuse existing export-memory regression infrastructure.
  - [ ] EXP01.LARGE_ACCEPTANCE: every required sub-item has actual evidence before closing this High issue; report old/new request shapes, size reduction, all audited/affected surfaces, exact tests and remaining limits. Then resume the prior High/Medium queue.

  Additional current-source export acceptance: derived-file-export.spec.ts (2cases), saved-report-export.spec.ts and stats-export-authority.spec.ts passed38.5s, covering stored summary/country/stats content in all5formats and rejection of browser overrides. Together with the5above:9rendered cases passed. stored_file_export.test.ts passed17,612rows above5MiB, compact source reference, file isolation, invalid/tampered parameters and all-format routes after replacing one obsolete selectedRows-shape assertion with selected stored-ID references. export_unicode_e2e.test.ts passed filename/header Unicode roundtrips (a pure encoder/parser check, not installed-package multilingual rendering). No claim that historical live data, every supported-size boundary, cancellation, or clean-Windows release acceptance is complete.

  November1 implementation checkpoint (not parent acceptance): 2f9384f replaces Contacts object roundtrips with existing backend-authoritative `{records:[{id}]}` references, preserving explicit selection and rejecting duplicate/missing/out-of-scope IDs. Actual large CSV/all-format downloads completed with187bytes versus5,835,383bytes before (99.9968% reduction), HTTP200, complete4-member-format ZIP and no partial-failure header; real rendered reproduction passed1.2minutes total. 725238e replaces repeated growing product-string scans in the export index with exact product sets joined once (preserves distinct substring products, history-only rows and country scope). New3,200-product regression passed96ms; manual same-shape probe219ms, no product truncation. Existing17,432-row export-memory regression passed all formats/five repeat cycles (observed peak511MiB; repeat RSS spread65MiB; smoke guard, not leak proof). Typecheck/lint, contact-export scope, selection-validation, contact-directory export, production build and full test:v1 passed. Dense all-format reproduction also exposed PDF long-word wrapping and argument-count stack overflow (actual RangeError at pdf_report.ts product-line append). 74f9621 uses exponential/binary prefix fitting and iterative append; the actual reproduced download now passes. Four additional rendered contact authority/scope/filtered-file/quick-full-file export tests passed45.3s. Final typecheck/lint, E2E typecheck and production release smoke passed. No parser limit raised; no live/customer/runtime/package change. Logs remain ignored under.test-cache; board derives from this ledger. Parent remains open for the other enumerated acceptance items.

- [x] Medium runtime-only startup prerequisite: old compiled backend required Vite eagerly and failed MODULE_NOT_FOUND against the12-root runtime install. Vite now loads only in the existing developer branch; packaged bootstrap fences developer mode. Actual reduced-runtime startup/static shell/all5formats/restart passed. Factory integration/native installation remain open.

- [~] Medium customer-package factory: first current MakeAppx attempt refused missing mapped PNG files. Observational retry retained both PNGs at every copy/npm/compiler/SDK phase and produced a verified current internal MSIX; exact extraction/runtime checks passed. Original disappearance is unexplained WARN, not a source fix or Windows security diagnosis. Final runtime-only/customer acceptance remains open.

- [x] Medium supported-path Pause feedback: actual rendered503 stop refusal produced no alert. Bounded mutual-exclusive Pause/Resume actions and safe refusal/timeout/checkpoint uncertainty feedback passed rendered regression and full local checks; stop acknowledgment alone must not halt checkpoint recovery.

- [x] Medium supported-path Resume feedback: rendered modal silently ignored JOB_DRAINING and other HTTP refusal. Browser RED reproduced missing alert; bounded/disabled action and safe draining/generic/timeout messages passed actual rendered refusal/held-request/retry checks; this is synthetic isolated UI acceptance, not final live/provider acceptance.

- [x] High supported-path stopped-job ownership: actual HTTP stop/start accepted a duplicate loop while its predecessor was blocked in contact publication (200 versus expected409). Separate draining ownership and structured JOB_DRAINING refusal verified with full check/build/release and actual HTTP stop/drain/resume/single-count/restart assertions. Rendered resume-error acceptance remains separate.

- [x] High supported-path research publication race: delayed earlier durable save could erase a newer completed projection. Reproduced with actual isolated HTTP/storage/immutable captures; per-contact serialized projection/save/publication correction passed full V1/typecheck/lint/build/release and focused HTTP/restart/mutation checks; exact-source developer packaging follows. Raw evidence remains preserved.

- [x] Medium supported-path saved-report export loss: actual custom table CSV became trade N/A fields; long text PDF lost its ending. Stored report-ID authority/custom content and flowing saved-report PDFs now pass real browser/API artifact assertions in all5formats, including ZIP PDF contents. Session durability/final visual acceptance remain unverified.

- [x] Medium supported-path Stats export data loss: actual rendered product/value were exported as N/A/N/A because normalized shipment names were not mapped to renderer fields. Fixed through server-owned scoped projection and actual artifact checks.
- [x] Medium retired export alias: outreach dataset bypassed the current contact authority and accepted invented rows. Reproduced200, then required410 tombstone under the V1 contract.

- [x] Medium supported-path analytics country attribution: mixed-country importer aggregate was labelled with the first country, and changing country for the same importer did not refresh its facts. Independent API and rendered browser failures reproduced; corrected label/scope reload and honest failure/timeout behavior. Wider research-country admission remains CC01, not newly marked fixed.

- [x] Medium supported-path grouped export data loss: actual download selected stale raw ITEM/TOT_FC aliases over computed grouped values. Corrected server-owned view export; independent two-item/summed30.00 CSV assertions pass. Full unrelated grouping/date semantics are not newly claimed.

- [x] Medium supported-path export authority: actual HTTP contact download accepted browser-forged facts; fixedad578ae with stored-ID authority and adversarial stale/mixed/object-selection checks. Other datasets remain EXP01, not assumed fixed.
- [x] Medium supported-path HTML selection: actual malformed company_ids widened a download to every contact. Exact endpoint regression reproduced200 instead of400, then passed after strict validation; explicit documented all/none behavior retained.
- [x] Medium release governance: former any-v-tag publisher could ship the developer ZIP without customer acceptance; removed7c416d1. This blocks unintended publication, not a completed promotion pipeline.

- [x] Provider transport policy gap corrected8dfa908; scoped tests and real Serper/Hunter positive controls recorded above. Fixed endpoints alone did not establish pinning;8MiB evidence/replay contracts preserved. Final release-wide security remains SEC01.
- [x] Serper independent-review findings correctedf27fdcd: malformed sibling and changed/missing record identity probes now pass original reviewer reproductions. No final release approval inferred; deadline/cancellation/live UI remain outside this scope.
- [~] Older test runner/doc claims: preserve already-integrated stronger code; correct actual stale guidance and owned temporary memory fixture before automated inclusion. Literal filename mentions are not execution evidence.

### Parallel review corrections and Desktop evidence — 2026-10-31

Guidance reconciliation: preserved stronger current Node20.20/22.22/24 floor; corrected actual default configurable NVIDIA/Groq priority, removed active-architecture claims for retired orchestration and nonexistent provenance file, and used displayed health labels. Completed the actual JSON/SQLite/immutable/config/log/installation/build/monitoring state map. Corrected the false assertion that separate-worktree changes automatically deploy to an existing shortcut/process and disclosed optional monitoring separately from provider research. New shipped-docs contract PASS3guides/22source paths/5npm scripts, synthetic empty-config default, supported/unsupported Node cases, labels and the selected storage/deployment/privacy claims. Wired to CI; source/routing/UI runtime acceptance is not proved by prose consistency.

Test-isolation follow-up: export_memory_regression.test.ts now uses a unique owned OS temporary root for artifacts, JSON and SQLite instead of the fixed machine-specific opencode path. Normal and failure exits clean only that root after DB flush. Actual synthetic17,432trade rows/3,500contacts, CSV/XLSX/DOCX/PDF/ZIP and5repeats PASS; observed ALL peak RSS489MiB, repeat spread26MiB/max462MiB. Typecheck/lint PASS. Wired this formerly uninvoked case into CI. The broad inherited4GiB/400MiB assertions remain smoke ceilings, not supported target-device limits or long leak proof. No old29runner copied, live port touched or customer fixture used.

User explicitly requested parallel real-world workflow. Separate read-only reviewers assessed Serper and original/main handoff; a non-overlapping documentation writer added only the Serper report/index. No agent edited shared source or merged/deployed work. Independent Serper review reproduced two28d2d58 blockers: malformed sibling excluded all opaque links from resolver despite valid normalized rows, and missing position/changed title/snippet permitted source misbinding. New regressions RED, corrected logic GREEN; retained actual provider response pair still yields5strictly matched links without network calls. Original partial-schema warnings/raw evidence preserved. Typecheck/lint/full V1 PASS. Final source/package successor checks still required; reviewer findings are not final release approval.

Exact28d2d58 package PASS149files, builddf494d80d75c12e6b128bd850cdb965a20931d00e6a31a34ae1c70ac654a1479, disposable ZIP86c5793fb11c7ce03926da3bad85dd7d63b03dc0f2e137836bb22212d8d12416, launch/backup/private-file checks PASS,117development files/customerRuntimeReady=false. Original and10explicitly allowlisted committed working documents exported to actual resolved OneDrive Desktop with per-file hashes/byte checks, indexINDEX-28d2d58 and manifest. Earlier documentation preserved; no final Versions/Installers populated. Desktop README distinguishes source/docs from unchanged live app. Actual isolated browser render PASS32rows/current source/pause/resume/pause persistence, no page errors; screenshot unapproved and unrelated to deferred live QA.

Main-only review: verifier/dev-server/build-decision/tar/notices implementations already present or superseded; stronger current Node floor, bounded SBOM and private-content scanning must not regress. Do not import older package.json/restore tree. Genuine missing guidance still says Groq primary, names removed data_provenance and claims retired orchestration remains. Main's test-wiring checker only counts filename mentions and can falsely claim coverage. Old29suite also includes missing/unsafe live-port launcher test and a fixed machine-specific memory-test output root. Rework narrowly before running; no blanket merge or original-tree edits performed. Original reconciliation remains OPEN.

### CORE01/CC04 Serper Google-link compatibility — 2026-10-31

Official October30 notice verified at https://serper.dev/google-links (HTTP200 HTML and its linked documentation bundle; web reader could not extract this page). Serper now resolves top3 organic links; later links may be opaque google.com/goto URLs. Its fixed /resolve POST accepts the complete original response, documented0credits/separate rate limit, roughly30seconds, retryAfter if still pending. No paid subscription/account change or new provider key required.

Implemented deferred resolution after all searches, two workers and a shared45second phase budget, each request max40seconds/remaining budget and bounded8MiB body consumption. Original search and independent serper-resolve response/failure records retained with source/raw pointers and monotonic duration. Only corresponding opaque organic links change: original titles/snippets/ranks and already-real URLs preserved. Reject credential/private/unsafe replacement URLs; no Google opaque URL decoding/following, provider key goes only to fixed HTTPS endpoint with redirects disabled. Unresolved rows remain visibly failed and are excluded from direct retrieval. Resolver429 never suppresses the independently rate-limited search service. Resolver records use their own operation label rather than contaminating Serper search health/credit counts. retryAfter retained; no unbounded retry/polling. All-opaque failure is FAILED, not evidence of company absence; prior trusted fields still preserved. Corrected duplicate-fetch propagation to copy actual scrape metadata only, keeping each query's link-resolution provenance.

Actual V1 synthetic provider regression PASS: lower-ranked recovery, no calls for already-real responses, two-worker bound, full original request, raw roundtrip, no key in run, partial/retryAfter,429, malformed shape, unsafe/private replacements and all-opaque failure. Typecheck/lint/full V1 PASS; production build/release smoke plus cached HTTP and fresh-batch durability PASS. Live provider probe used one public Getz Pharma Kenya search: HTTP200/8organic/5opaque; actual resolve200 returned all5 real links in24.87seconds (total27.50seconds), no retryAfter, source config hash unchanged. Private captures under owned temporary edgeview-serper-resolution-live-7elnEW; no source page retrieval, full enrichment/UI, live3901 or customer-data change. Real-company final acceptance remains open.

Desktop progress generator f476b51 now reloads saved checkpoints every30seconds with accessible pause/resume; initial open page needs one reload to pick up this behavior. Not a deployed-app update or background work while session stopped. Hosted CI remains unavailable: owner has no budget and expects a usage reset November1; no financial workaround, unauthorized runner, billing change or fabricated hosted PASS. Workflows remain ready for a real rerun when execution becomes available.

### JOB01/DATA03 rejected overlay restart regression — 2026-10-31

Extended the fresh-batch test beyond immediate UI state: a reported failed overlay reappeared after a later job checkpoint and restart (RED). sql.js kept the rejected SQL row in memory after its flush failed. Added a synchronous one-row durable overlay operation at the existing SQLite boundary: capture previous row, apply, fsync/replace, and restore prior row (or remove newly inserted row) before returning failure. No whole-database preimage allocation, asynchronous transaction interleaving, schema change or second authority. If undo itself fails, exports/reads/mutations are disabled until explicit restart from unchanged disk; prepared mutations are also guarded.

Actual database-rename ENOSPC/EACCES tests PASS: exact old disk hash, full prior row, absent rejected new row, sibling later checkpoint, independent reopen, successful retry. Trigger-injected undo failure proves fail-closed behavior and unchanged disk/restart authority. Real compiled batch worker/HTTP failed restart now PASS with actual ENOSPC replacement interception, not merely an SDK/helper rejection; source evidence remains discoverable. Test excludes only dataset contact construction timestamp across restart, comparing every other field. No-durable mutant still killed at pending publication boundary. Typecheck/lint/full V1 and production build/release smoke PASS; exact committed/package checkpoint still pending. No general restore/power-loss guarantee inferred.

Owner reports no budget for hosted CI and expects usage reset November1. Continue local checks/evidence; do not incur charges or infer the observed billing error will reset automatically. New user-reported Serper change verified against official serper.dev/google-links HTML and its linked documentation bundle fetched200: unresolved results4–10 use Google goto links; POST the search response to fixed google.serper.dev/resolve, documented0credits/separate rate limit, approximately30seconds, retryAfter for remaining links. Existing engine currently lacks that step. Keep as a retrieval release blocker with bounded waiting, original/resolved evidence and no following credential-bearing arbitrary redirects. Implementation follows the current storage unit, not abandoned.

### Exact integrated checkpoint and external gates — 2026-10-31

236a96639616ebce3e0d21b834d14eb952d2fbf5 is pushed; clean integration tree rebuilt. Build9a786dc0127d5e1d326bbe9afba1fd56be591523150b54ae19cddc5596f6b3ed; isolated package PASS148files, launch/staged-backup/private-file checks PASS; disposable ZIP SHA256949d53f0b83aaec94c84794230eecd6cf26dbc36ba28bcc2906118793e3624da. Still116development files, customerRuntimeReady=false, requires Node/npm; removed after QA. Latest patch typecheck/lint/full V1, production build/release smoke, cached actual HTTP/rendered regression and fresh batch durability PASS. This is not an accepted installer, clean-Windows/update/recovery acceptance or final release snapshot.

GitHub API observed exact source release run41161010334 plus inventory41161010259 and research41161010252 completed failure. Release native-launcher/docker-qa/browser-e2e/verify jobs have no steps: exact annotation states recent account payments failed or spending limit needs increase. Publish skipped. No failing product test inferred and no hosted PASS claimed. Owner asked to review Billing & plans; no financial setting changed. Default-main dependency warning remains8(3high/4moderate/1low).

Supported Windows computer-use initialization and separate supported browser state call both freshly returned “failed to write kernel assets: The system cannot find the path specified. (os error 3)”. No session/window/dashboard action occurred. Current-release dashboard receipt remains open; preserve prior recorded account/privacy evidence. This is tooling initialization failure, not localhost diagnosis. Original development tree read-only rechecked clean atb6db239; no automatic reconciliation/runtime replacement. No Store/public feed/publication, Windows security bypass, real-data migration or final Desktop snapshot.

### CC02 role-to-employer projection boundary — 2026-10-31

Reproduced the previously recorded multi-employer concern: synthetic LinkedIn title CEO at Different Holdings plus snippet Director Exports at Scopeanchor Medical/Kenya produced CEO for Scopeanchor. Corrected deterministic profile parsing to bind each candidate role to its own explicit employer clause, normalize legal suffix/Pharmaceutical spelling only, and require exact employer identity rather than one shared brand token elsewhere. Failed sources, lookalike profile hosts and explicit former/previous roles abstain. Existing accepted model claims cannot bypass the same deterministic LinkedIn role/name/employer check. Local country evidence still independently required; parent/global domain ownership does not change that. Official management cards remain separately evidence-checked.

Focused regression red before correction, then PASS: distinct roles at two employers, shared-brand healthcare/distributor collisions, former roles, claimed-role bypass, failed/lookalike profiles, existing local/foreign title cases and formal management affiliation fixtures. Overlay policy30 withholds prior29 cached projections for explicit safe review, preserving SQL/raw recovery data and avoiding startup payload replay; previous-policy withholding test PASS. npm run check (typecheck/lint/full V1) PASS. This does not prove current real employment, resolve every date/alias/language or close Global/Thorne Berry truthset acceptance. Do not hard-code the user's expected CEO into product output.

JOB01 durable fresh worker committed/pushed6377a71. Focused HTTP/worker regression and no-durable mutant PASS (mutant killed at pending disk-flush publication assertion), npm run check PASS, production build/release smoke PASS. The single injected overlay-flush failure is not a disk-full/whole-DB transaction or power-loss acceptance claim.

### JOB01 fresh batch publication boundary — 2026-10-31

New real-worker/HTTP regression reproduced fields published while the SQLite overlay insert was still pending. Fresh worker now awaits explicit durable overlay save before Object.assign/index publication, reuses the canonical projected fields/quality, and reports storage refusal through existing per-company failure state. Separate barriers test both pending insert and pending disk flush, plus controlled flush rejection, successful durable restart and discoverable raw evidence. Provider transport is explicitly synthetic, outbound requests denied; this does not verify provider service behavior or power-loss semantics. A build-only mutant removing the durable flag was killed specifically by the pending-disk-flush publication assertion. Initial test harness mismatched the SQL spelling and lacked the Windows stdin bootstrap; those invalid runs were corrected before accepting the red/green result. No live backend termination or customer mutation.

### CC03/CC04 exact saved-review commit acceptance — 2026-10-31

Committed/pushed c6415cb5e6434e866f89950a6a8d81f8bd96bcf1 rebuilt with clean tracked source. Isolated developer package PASS148files/116developmentfiles, launch/staged-backup/private-file checks PASS; build9d31e311926a44a3a80d3afb0e255028925d31455f8f5e14c856d6fb1c20e8e1, disposable ZIP SHA256f6300192e3079c2e2910f7d8a27be9e5e1c6021e8f55167edb6dd69ad1a0205c. ZIP removed by bounded checker, still requires installed Node/npm and is NOT customer-runtime/install acceptance. Retained actual Emerchemie capture copied to new isolated state with empty config, monitoring off and backend egress denied. Actual POST reused exact run, current policy produced3emails/7phones/2addresses/9people, independently published offices/mailboxes/headphone/CEO assertions PASS; hidden stores mailbox absent. HTML export and normal restart PASS, raw hashes unchanged in original isolated fixture and copy, zero provider calls. Detailed report verification/EMERCHEMIE_ACCEPTANCE_2026-10-31.md. Fresh provider re-run and rendered real-company UI remain NOT VERIFIED; prior fresh failure is not relabelled.

### CC03/JOB01 saved-evidence API and rendered workflow — 2026-10-31

Reproduced ordinary company HTTP revalidation returning503 with providers absent despite retained exact-entity evidence. Corrected single, streaming batch and persistent job preflights to permit saved evidence only for matching company+country/status. Force still requires live capability. Explicit saved-only mode persists in existing company job state and refuses forced provider requests. Selection validation rejects duplicate/oversized/invalid IDs; ID/company/country disagreement returns409. Known foreign retained-run pointers are withheld during hydration without deleting SQL recovery data/raw evidence or loading whole payloads at startup. Eligibility uses existing identity headers and is transient, not another storage authority. Streaming alias now durably persists its projection before publishing it and reports projected contact quality rather than treating a completed capture as complete contact data. Cached timing is measured, not placeholder0.

Actual compiled isolated HTTP test PASS: stale-policy withholding, same-name Kenya/Uganda run isolation, ordinary cached review, missing-provider forced refresh refusal, mixed-selection refusal, saved-only job force refusal/completion, streaming alias, HTML export, normal restart persistence and zero outbound calls. Real isolated Playwright PASS: row review enabled, Force disabled, actual POST200/reused flag, email rendered, Contacts navigation retained across refresh, saved-review modal explanation and accessible close; browser/page errors empty. Screenshot/trace are unapproved regression artifacts, not final live visual acceptance. CI runs default and browser variants with failure artifacts. Synthetic evidence only; no current real-company truthset acceptance inferred.

Checks observed on this working patch: npm run check (typecheck/lint/full V1) PASS, production build PASS (build9d31e311926a44a3a80d3afb0e255028925d31455f8f5e14c856d6fb1c20e8e1), npm run test:release PASS, node scripts/cached-revalidation-runtime.test.mjs --browser PASS, git diff --check PASS. Exact committed-source/package checkpoint still required. Separate existing JOB01 finding: fresh persistent-batch worker mutates contact memory before a non-durable overlay save; this test does not verify that fresh path and it remains open for a focused correction. Company-country correctness, provider behavior and final rendered/live acceptance remain PARTIAL.

### CC04 ordinary office and warehouse paragraph recall — 2026-10-31

After hidden-carrier fix6b56ade, reproduced the missing address with synthetic strong-label/plain-paragraph markup; regression returned[] before correction. Added generic label/paragraph extraction, explicit street shape and exactly one explicitly named country, then existing per-field local/foreign/related-entity admission. No company-specific value or CSS, AI confidence or domain-only country inference. Countryless, foreign, distributor, stock/order prose and commented blocks abstain. Deduplicates equivalent trailing-punctuation address variants without merging different countries or records. New regression plus hidden/accordion/country fixtures PASS; typecheck/lint/full V1/build/release smoke PASS (runner43372 terminal0). New test wired into CI.

Offline projection of actual retained run-mvv9bnan-1bb1f23bea now yields two independently published addresses: head office and warehouse, with exact official contact URL and local-country evidence, alongside3emails/7phones/9people. No raw evidence was fabricated, expected fact injected, provider re-run or live overlay published by this probe. Fresh provider→persistence/API/export/restart and actual rendered UI still require acceptance. Existing prior provider run remains honestly failed rather than rewritten. Source verification report updated.

Next integration inspection: batch job creation/start currently applies live-provider capability before ordinary cached-evidence reuse. The unit offline revalidation test does not cover these HTTP guards; verify actual missing-provider behavior before claiming ordinary UI revalidation works offline. Keep this as part of existing CC03/JOB01 acceptance, not a separate engine or bypass of storage safety.

### CC04/QA01 fresh Emerchemie acceptance and hidden-contact defect — 2026-10-31

Reused existing real-provider acceptance harness on an isolated synthetic public-company record, not customer storage. Run-mvv9bnan-1bb1f23bea/source61b2507/buildb057903add64cc2db1d86e30c9f8fa06f8349dbded295f85c5ddef719eabbc46. Actual NVIDIA/Serper200s and complete official contact/leadership captures; API has4emails/7phones/1address/10people, both official role mailboxes/head-office phone/address/Group CEO present, saved collections in HTML export and normal restart preserved. Source credential hash unchanged and copied protected configs removed. Warehouse address absent, so acceptance exit1. No rendered UI claim. Evidence and public references in verification/EMERCHEMIE_ACCEPTANCE_2026-10-31.md.

Found the copied raw contact HTML has a commented older contact block. Old flattening published comment/script-only facts through the plain-text fallback. Synthetic regression red before correction (retired/template emails and a hidden phone plus adjacent address digits admitted). Corrected fresh visible-text generation and old-run carrier checks, excluded commented JSON-LD and preserved real href/structured carriers. Original raw HTML stays immutable. Contact policy29 withholds prior28 caches through the existing safe revalidation mechanism, not startup raw hydration or deletion. Focused comment, script, unclosed comment, same-value-visible positive, literal-comment-in-JS/attribute, old-cache, structured-country and accordion tests PASS; typecheck/lint/full V1/production build/release smoke PASS (runner54080 terminal0), build886730663448563c96a62e649db189056e613dabe55174e61d29786c7146a4ee. Initial full suite caught loss of genuine mailto/tel anchors; corrected anchored carrier handling without weakening the assertion. Offline real-run reprojection now3emails/7phones/1address/9people and no comment-only stores mailbox; not a fresh pipeline/UI verification. No claim to model all CSS/template visibility or resolve every unsupported address/person relationship.

Do not assume a transport fix: current pinned requests alternated deadline failures and complete3.67MB responses in1–4seconds; a paired unchanged-header request also succeeded. No speculative Brotli/Range/partial-HTML fallback added. Remaining warehouse recall is reproduced in the captured complete official source and provided extraction chunk. Also keep role-to-employer binding on CC02 review list: independently observed LinkedIn profile describes distinct Global/Thorne Berry roles; do not infer one employer's title from another mention or treat conflicting third-party dates as current employment proof. That wider role issue is not declared reproduced or fixed here.

### MIG01 exact committed runtime and package checkpoint — 2026-10-30

Exact61b25071be898c7e96ee3d6fcb925dc3773a2b52 rebuilt with clean tree. Actual compiled app-root→separate-data/schema1→2/UUID/dataset discovery/backup/new-root-only writes/restart workflow PASS again. Isolated developer-package check PASS:147 files, unchanged launch, actual staged-backup contract and prohibited-private-file checks. Buildb057903add64cc2db1d86e30c9f8fa06f8349dbded295f85c5ddef719eabbc46; disposable ZIP SHA2563252fadc76a88ed5cdfc7b375f98c13522997f48258c345d1c7a9ea2382a7042. Output removed by owner-bounded checker; still115 development files, installed Node/npm required, customerRuntimeReady=false. No final installer/clean-Windows/real migration, release publication or customer-data modification claim. Internal migration is prepared and tested in its stated scope; the capability remains PARTIAL until activation/support/installed acceptance closes.

### MIG01 private canonical legacy copy and interruption recovery — 2026-10-30

Added internal copyLegacyRuntimeData/retryInterruptedLegacyMigration; not an exposed UI/CLI or final installer. Existing sql.js/JSON/config/data/uploads remain authorities. Approves only fixed runtime roots/trees, disjoint new destination, ordinary ancestors/leaves, single-link regular files, canonical overrides and stopped backend. Refuses plaintext provider config and .env before destination creation; protected DPAPI envelope copies remain opaque same-user material. Existing destination is never overlaid; partial copies retained under owner-token archive names. Source preserved and independently rehashed before completion. Bounded64KiB transfer buffers,64MiB per file,4GiB total,50k files,32 directory levels, bounded streamed directory inventory/manifest and explicit refusal beyond budgets. SQLite integrity and supported schema, canonical JSON decoder and retained installation UUID checked. One exported schema constant avoids another schema authority.

Durable INCOMPLETE journal binds source-root hash, full inventory hashes and both maintenance-owner markers before copying data. Process termination leaves source/destination gates. Retry verifies exact unchanged source and definitely absent owner, archives partial destination and restarts a fresh copy, never sequentially overlays mixed files. Runtime root resolution refuses incomplete/malformed preparation and verifies completion-manifest SHA256 using bounded reads. This preparation hash is consistency evidence, not publisher signing or update trust. Maintenance-owner release reuses the existing atomic helper.

Focused tests PASS: same-user copy preserves DB/schema1/primary/identity/evidence/uploads, excludes code, never deletes source, refuses existing destination, plaintext/.env, overrides, future schema, oversized input, backend lock and real Windows junction; controlled ENOSPC retains original, SIGKILL at database-copy point is proven by exact stage marker/OS termination, unchanged-source retry succeeds and changed-source retry retains gates. Initial overly broad disk-failure injection hit owner creation instead of copying; corrected to the exact destination DB descriptor before accepting the result. Typecheck/lint/full V1/build PASS. Compiled runtime PASS: real synthetic app-root upload→stopped schema1 fixture→copy→missing-ready startup refusal→explicit data-root activation→same UUID/dataset/Kenya API discovery→schema2 with exact schema1 backup→new-root-only writes/restart. Initial fixture reused identical bytes and correctly received dedup200; changed the second synthetic payload rather than weakening the201 assertion. Existing separate-data runtime, backup contract and release smoke PASS. Final readiness-marker hash strengthening separately reran focused migration/path tests, production build, compiled migration workflow and release smoke PASS (runner97519 terminal0); buildb057903add64cc2db1d86e30c9f8fa06f8349dbded295f85c5ddef719eabbc46. Developer Node/NODE_PATH used; no clean-Windows claim. No real keys, source storage, launcher pointer or live3901 changed.

Still OPEN: installer/launcher activation policy, independent pre-update backup and matched app/schema rollback, recovery during initial/partial owner or journal creation, recovery itself interrupted after ownership publication, OS account/ACL and DPAPI access on target, retained-copy retention/support UX, power-loss/directory durability, clean-Windows acceptance. This copy is NOT a final clean release export, generic restore, installed updater or automatic migration of the owner's real data.

### DATA02 exact recovery commit package checkpoint — 2026-10-30

Exact source6ffa88c123edeb78256e12f39448fa42037602d1 rebuilt from clean tree. Compiled production interrupted-repair/refusal/rollback/repaired restart/sibling deletion runtime PASS again. Isolated package check PASS:146 files, unchanged launch, actual staged-backup contract and prohibited-private-file checks PASS. Build12d4ff9e0afe557c040faa6bb96ab4d1e5a8b19c5777a42feacab529217c3168; disposable ZIP SHA256caaa355f27eb72bb338d6c386177e5dc0bb79c3933a319a431018955ee5c2101. Output removed by owner-bounded checker. Still114 development files and installed Node/npm requirement; customerRuntimeReady=false. This is not installed-MSIX, generic recovery/update, clean Windows, final visual or live-customer acceptance. Original tree inspected read-only: clean b6db239, unchanged; integration reconciliation still open.

### DATA02 recovery interruption and compiled runtime acceptance — 2026-10-30

Extended 7f3c218 recovery across reproduced archive/recovery-lease lockups. Journal/preimage discovery now follows a deterministic owner-token-bound retained directory after archive publication. Recovery leases bind exact immutable journal/owner hashes, refuse live or unknown owners, and preserve dead-lease evidence before exclusive retry. Each lease is scoped to one transaction. Journal is durable before copying preimages: when interrupted copies are incomplete, recovery may clear only a verified unchanged original database/source; a changed candidate requires intact preimages. Partial rollback copies are retained separately and rebuilt from verified originals. Exact journal keys reject arbitrary target fields even when original hashes remain valid. Existing maintenance release now atomically renames a verified exclusive owner directory before cleanup, preventing the unlink/rmdir ownerless-gate window; unknown entries refuse release.

Observed adversarial evidence: new rollback-termination test failed EEXIST before correction; now PASS. Child tests use an esbuild-compiled helper with minimal environment, exact on-disk stage marker and supported SIGKILL termination (Windows exit1); spawn errors/timeouts/native assertions are not accepted as intentional termination. Earlier process.exit probes exposed an intermittent host Node24 Windows async assertion, so those results were discarded. Cases PASS: interrupted partial preimage copy, before/after DB replacement, partial rollback write, after rollback replacement, after archive rename, retry/recovery; real direct/ancestor Windows junctions and hard-linked DB refused; changed source/live PID/extra target field refused; exact original DB and primary bytes preserved. Actual atomic maintenance-release SIGKILL test PASS: no active ownerless gate, retired owner marker preserved, next acquisition succeeds.

Actual compiled production runtime PASS (runner52609 terminal0): reproduce same-name lost index in stopped synthetic storage, terminate compiled repair helper after replacement, compiled backend refuses startup while gate persists, explicit rollback restores original broken index exactly, subsequent repair restores both primary-owned records, startup/API discovery/deletion/shutdown preserve the sibling. Monitoring disabled, providers empty, owned temp app/data; no live3901 or real customer change. Backup contract, full V1, production build and release smoke PASS; typecheck/lint PASS. Build b1acf5d02c2d5ac0c71fc6e5977d46b293a645b492eb878ca3c32da39af9cd95 predates final journal-key-only strengthening, whose focused test separately PASS; exact committed rebuild/package follows.

Remaining acceptance: malformed/partial ownership or journal creation stays fail-closed and requires support review; power-loss/directory-entry durability is not proven by process termination. Retained recovery metadata and data copies need an explicit retention/support policy. Internal functions remain unexposed; no complete generic restore, legacy-root migration, matched installed application/data rollback or clean-Windows claim. Rebuilt legacy derived rows receive new index row IDs/timestamps; original preimages remain available, and retained owned rows keep their original metadata. This is not evidence that old original row ownership can be inferred from filenames.

### DATA02 journaled isolated repair and rollback — 2026-10-30

Added internal history_repair_transaction.ts with fixed edgeview.db/edgeview_db.json targets in a caller-selected ordinary storage root. No HTTP route, CLI or live invocation exposed. Reuses the existing startup/backup maintenance gate; refuses any backend lock, linked root/ancestor, nonregular or multiply-linked input, changed source/generation and oversized read. Bounded descriptor reads; private preimages and pending candidate fsynced before immutable journal, then one-file same-directory-filesystem rename and hash validation. Existing valid rows are retained by the candidate builder. Original JSON never replaced. Completed/controlled-failure preimages retained privately under UUID history-repair directories, not diagnostic exports; retention policy remains open.

Actual isolated filesystem/SQLite test PASS: success and no-op, normal exception after replacement restores exact original bytes, child process exit77 immediately before replacement and exit78 immediately after replacement both leave startup exclusion, explicit recovery restores exact original bytes and allows subsequent repair. Recovery verifies exact owner-marker binding, full original/current/source hashes and definitely absent prior PID, then acquires separate atomic recovery exclusion. A live PID is refused even with internally consistent journal hashes. Changed primary refuses recovery without clearing the gate. Controlled pre-replacement ENOSPC retains original and releases the gate. Real Windows junction refusal PASS. No actual app restart, power-loss or customer history operation claimed. Typecheck/lint/full V1/production build/release smoke PASS (runner38450 terminal0). New transaction test wired into CI.

Still OPEN: crash before a complete journal, crash during rollback/recovery or archive/gate-release boundaries, directory-entry durability across actual power loss, retained-image policy, explicit application/schema acceptance/restart, generic migration/restore/update safety and operator presentation. An uncertain interrupted state stays blocked rather than auto-removing ownership. The internal transaction must NOT be advertised as complete customer recovery or exposed in the UI until remaining acceptance closes. Microsoft Store/final visual gates and public shipping remain deferred.

### DATA02 offline repair candidate — 2026-10-30

Implemented buildHistoryRepairCandidate as an internal byte-in/byte-out operation; no filesystem paths, API exposure, live connection or apply permission. It uses the canonical saved-dataset decoder and existing exact-row preflight, captures independent input generations before asynchronous initialization, binds full primary/database SHA256, and clones schema2 SQL. Preserves valid owned row IDs/timestamps and unrelated rows/tables; replaces only justified legacy rows and recreates missing derived-index rows from primary IDs. Identical primary copies retain duplicate multiplicity without claiming old ambiguous row ownership. CURRENT returns no replacement. Refuses invalid authority, wrong schema/integrity, unmatched/cross-country rows, triggers, history foreign-key dependencies and bounded input/output overflow. Fingerprints remain private recovery metadata, never monitoring. Empty datasets now also require valid provenance in preflight.

Focused candidate and existing preflight tests PASS; a real buffer-mutation adversarial test initially failed because Buffer.slice shares memory, then passed after explicit copying. Tests cover preserved inputs/sibling data/owned metadata, physical SQLite reopen and integrity, lost rows, duplicate multiplicity, current no-op and hostile schema/source refusal. Typecheck/lint/full V1/production build/release smoke PASS (runner62447 terminal0); build9ff753781a045fbf67d99837dc7c597fd5d1eb747acc830290f34b18fa48960e. New regression wired into CI. Exclusive snapshot acquisition, approved paths/ancestor links, durable preimage/journal, atomic apply, interruption recovery, executable rollback and actual restart acceptance remain OPEN. This candidate does not fix existing live data or close DATA02/MIG01/REC01.

### Owner progress workspace — 2026-10-30

Added scripts/render-progress-workspace.mjs to generate a readable local HTML view from this ledger's capability matrix and latest checkpoints. Current output is the resolved OneDrive Desktop EdgeView/Progress.html, not a release artifact or second planning authority. Regenerate after meaningful work checkpoints; the page does not imply background execution or live automatic status while the session is stopped. Source values are HTML-escaped, no customer data/config/provider credentials are read. Thirty capability records currently appear. Script syntax, generation and diff checks passed; actual browser rendering is NOT VERIFIED. Codex file-open request was queued, not observed as displayed.

Owner requests faster completion. Preserve the existing finite release scope and dated conditional targets; prioritize demonstrated release blockers, avoid optional infrastructure expansion and repeated verification without new evidence. Immediate active task remains DATA02 reviewable offline repair candidate. No guaranteed hours-to-release assertion; signing, clean-device and deferred final visual gates remain open. Microsoft Store setup/public shipping remain deferred.

## Authoritative implementation ledger — reconciled 2026-10-25

### Historical checkpoint — 2026-10-29 (superseded by November1 handoff above)

Owner resumed on October28. Continue implementation; do not interpret the older
stop note below as an active stop. This session owns source/tests/docs in
edgeview-integration, integration/edgeview-v1-20261024. Original project remains
clean b6db239 and serves live3901, PID27072, database OK at the latest observation.
It does NOT contain the integration branch's newer fixes. Permanent original-tree
reconciliation remains open; no silent runtime swap/customer-data operation.

Verdict NOT READY. Keep all older unfinished goals. Microsoft account/Store setup
and final live/manual visual QA are deferred by owner; prepare package/tooling
first. No Store submission, public release, public installer/feed or final Desktop
snapshot is authorized. Working Desktop guides exist; incomplete installer/version
folders must not be represented as accepted releases.

Latest scoped results: f6ee2c9 complete saved-contact HTML collections; 4b306b3
reproduced late-upload navigation race corrected with actual rendered regression;
afa6abd bounded official gzip with real Slim wire reduction and adversarial tests.
Hosted release40915213513, research40915213324 and inventory40915213323 all SUCCESS
at afa6abd. These are not clean-Windows/factual-accuracy/customer-release proof.

Emerchemie remains an observed FAIL: correct domain but incomplete public contacts
after fresh provider/API/export/restart repeats. Its server currently sends a
large uncompressed page too slowly for capture deadlines. The official Serper
playground public implementation confirms a page endpoint; one guarded probe
returned200/2credits but only121bytes of page text, not complete contacts. No
production cloud fallback or expected fact injection was added. See CC04/report.

Current internal MSIX candidate uses source11c7caf, build
0b52634bbe7379796f778cbd277a31fc758ef837952df0c74153315501bf829d,
SHA2563c5e2b098ffa133c4207ddc4e3bd6af1bdbd15d7841b41f2d893f78259295afa.
SDK pack/unpack and extracted bundled-runtime upload/export/restart/diagnostic
checks passed. Native GUI execution, installed activation, trusted publisher,
current Node security selection, payload minimization/OSS, migration/update/
rollback and clean-Windows acceptance are NOT VERIFIED. Prototype monitoring OFF.
It is unsigned internal evidence outside Desktop, not a customer installer.

Screenshot capture infrastructure produced six UNREVIEWED synthetic images;
missing approved references deliberately fail comparison. No baseline approved.
Both supported browser/Windows-control initializations currently fail kernel
assets os error3. No dashboard/account click or final visual approval is inferred.

### Historical owner stop / resume checkpoint — 2026-10-26 (superseded)

STOP explicitly requested; no further implementation/account/visual work until
the owner resumes. Last implementation commit 877aba84ee13fa5672f35681fb06ed95f850f307.
Native Windows CI job121845264987 in run40400501890 actually executed both tests
(not skipped): owner-pipe and compiled launcher readiness/close/failure/foreign-PID
controls PASS. This independent Windows result does NOT lift this laptop's Smart
App Control signing block or verify rendered GUI/installed activation. At last
observation Docker PASS, main verify and browser jobs still in progress; inspect
their terminal outcomes on resume, do not infer them.

Fresh Slim HTTP run finished before stop: run-mvpa7k7e-1ed426d348, source877aba8,
build e58583edf5e0803f40e7ec31725d7abc9cd7419d4baeb04008606b761b70b571.
Resolved slimpharma.com; PARTIAL. Captured real NVIDIA/Serper200s and retained
direct retrieval failures. Persisted API has1 general email,3 shared phones,
4 address representations (3 independently checked offices),7 published leaders.
Independent official source comparison matches; explicitly related Healthcare
CEO is not admitted as Pharmaceuticals CEO. Compact HTML export includes checked
local phone/address; owned restart preserves contact arrays/run ID. No foreign
Pakistan phone/address admitted. No expected facts injected into the engine.
Evidence summary is in private owned temp directory edgeview-slim-http-82qM84;
source credentials hash unchanged. Rendered UI and complete export coverage not
verified. Address label duplication remains DATA01 follow-up. Source references:
https://slimpharma.com/contact/ and /corporate-management/.

On resume: review latest hosted outcomes, preserve trusted-signing requirement
without weakening host policy, continue unaccepted launcher/package/data recovery
and remaining country truthsets. Microsoft setup/final visual QA remain deferred.
Original source/customer data/live3901 unchanged. No public distribution.

### PKG03 launcher-owned shutdown bridge — implementing

packaging/windows/runtime-bootstrap.cjs adds a launcher-owned stdin control pipe,
not an HTTP/shell interface or a second backend shutdown implementation. A fixed
shutdown line or owner EOF reaches the existing SIGTERM save/drain controller;
early close is deferred until its listener is installed. Frames are bounded,
invalid/oversized input ignored without echo, and backend exit status is retained.
Synthetic child-process tests cover normal/early/EOF/failure paths. PASS.

The actual separate-data production-runtime regression now stages this bridge,
uses its pipe instead of a test-only IPC preload, and asserts clean exit. Empty
first start, upload, restart identity/data and correct backup placement PASS.
CI wires both tests. This is a lifecycle prerequisite, not an accepted Windows GUI
launcher or installed MSIX activation. It is not retroactively present in the
earlier unsigned prototype; next package work must explicitly include it and
validate the owning launcher. No live3901/customer state changed.

### PKG03 native launcher candidate — implemented but runtime BLOCKED

EdgeViewLauncher.cs and its headless factory regression are preserved separately
from the product runtime. Intended behavior: bundled Node only, cleared inherited
provider/dev environment, same-PID/build health readiness, bounded loopback reads,
browser open and owner-pipe durable close with truthful failure handling. No
customer package consumes it yet. Windows .NET Framework compiler exits0.

Actual scripts/windows-launcher.test.mjs exits1 at spawn UNKNOWN, before assertions
could exercise controller behavior. A direct factory-mode launch independently
returned the explicit OS message "An Application Control policy has blocked this
file." This is a genuine OS trust prerequisite, not a PASS or an app regression.
No alternate-host execution or security-policy bypass was attempted. Proper
approved signing/trust is needed before native execution/GUI acceptance here;
owner deferred Microsoft setup. The source candidate is NOT VERIFIED for runtime,
foreign-listener, save-failure or GUI cases merely because it compiles. Retain it
as an unaccepted candidate; do not ship/install it or weaken Windows controls.

2026-10-26 trust diagnosis: CodeIntegrity events3077/3033 identify the launcher
and policy0283ac0f-fff1-49ae-ada1-8a933130cad6 as a signing-level refusal.
VerifiedAndReputablePolicyState=1; no current-user code-signing certificate was
listed. CiTool policy listing returned access denied, not a complete policy
inventory. Official Smart App Control guidance states no individual-app bypass.
No registry/certificate/security settings changed. Owner requested a fix; use
trusted signing for this host, not a loader/policy workaround. Native candidate
tests are now assigned to the existing private Windows CI runner as independent
developer-environment validation. That is not lifting the local block, a signed
distribution, rendered QA or clean-Windows acceptance. Compiler/test children
receive only bounded OS environment settings, not inherited CI/provider secrets.

### Current owner order — 2026-10-26

Microsoft account/Store onboarding is DEFERRED at the owner's request. Prepare
the implementation and MSIX candidate first; final visual QA follows that work.
No submission, publication or public installer/feed upload is authorized now.
Desktop directories are not complete artifacts; no final source snapshot or
installer is to be fabricated to fill them. Original source/data stay intact.

### CI01/CC03 hosted closure — verified scoped checks

87d46596b42b8a1ee1613629b6e41939f589c801: hosted release checks 40320662231,
research contracts 40320662160 and release inventory 40320662180 all SUCCESS.
This verifies the integrated social-anchor/body-budget/durability fixes under
those workflows, not universal country correctness or installed acceptance.

### REC01 backup active-layout completeness — implementing

The fixed-root backup could omit active config/evidence located through explicit
overrides while publishing a completed manifest. It now refuses noncanonical
overrides/test-only layouts before creating staging; exact canonical overrides
remain supported. It preserves existing previous config and legacy JSON state.
No external path copying, multi-root restore or secret portability is introduced.
Synthetic regression PASS for refusals, supported overrides, complete file hashes,
SQLite/JSON/evidence reconstruction and previous config/legacy retention. Existing
lock, partial-copy and link-refusal controls remain. No real backup/data mutation.
Separate writable-root runtime, package and broader acceptance still pending.

30be361: separate writable-root compiled runtime upload, identity/data restart,
no application-root state writes and correct backup authority PASS. Production
build 575850ba37da1c8ae7e353ce942950ee337fab123ecf679da5c33ba81cf9949c,
release smoke and isolated developer-package verification PASS (139 files,
ZIP SHA256 5106c666a7067fcfd0263ca5bf86b902fcb3cb52480f132971b2bdf6d4c67efc).
Package is disposable, Node/npm-dependent, customerRuntimeReady=false.
This closes only the recorded backup layout omission; transactional migration,
restore/update/rollback/clean-Windows gates remain open.

### DOC01 current handbook and Desktop documentation — implementing

docs/README.md is the navigation index; docs/handbook provides six current working
guides (first use, installation/updates, privacy/licenses, support/recovery,
architecture/development, verification). Root README links the same task ledger
and now truthfully discloses existing bounded AI evidence extraction. No archived
source restored or historical Markdown deleted. Root/index link targets PASS.
The actual Desktop is OneDrive redirected. Export only this explicit documentation
allowlist from committed source to the existing category folders, with commit/hash
metadata and no overwrite of versioned documents. These are working guides, not
final source snapshots or accepted installers; Versions/Installers remain pending
their acceptance gates. Original project/data stay intact. Microsoft onboarding
remains deferred and final visual QA follows implementation/package work.

Desktop export observed: six allowlisted handbook files from commit
1a057754518df5412269f83de8c87d17762d7eed are now populated in the six existing
Documentation categories. Documentation/INDEX-1a05775.md and manifest-1a05775.json
record links, full source commit and SHA-256 hashes; copied bytes match committed
source. Root Desktop README explains current status. No customer records/config,
source snapshot, final version or installer was copied/claimed. Original data intact.

### PKG01 first-launch empty storage — verified scoped runtime fix

An actual production-mode separate-data test without a pre-created JSON dataset
failed: the database constructor automatically seeded demonstration companies.
Older tests pre-created [] and hid this first-boot path. Default construction is
now empty; demonstration seeding requires the existing explicit developer opt-in.
The strengthened compiled HTTP test proves zero companies/files at first launch,
then real synthetic upload, restart UUID/data durability, no installed-root writes
and correct backup placement. Typecheck/lint/full V1 and production build PASS.
This is not a bundled runtime or clean-Windows/MSIX install acceptance.
Follow-up: legacy demo literals still exist in the active seed function and must
be replaced with plainly synthetic examples before customer payload acceptance.

### PKG01 explicit demonstration payload — verified scoped source fix

The old opt-in sample function contained real company/trade names and unsupported
compliance/audit claims. It is replaced with five clearly labelled in-memory
synthetic format examples. No customer data/persisted rows are removed or migrated.
The explicit sample action remains available only under its existing developer
opt-in. A regression covers empty default state, five formats, synthetic content,
immediately usable indexes, repeat safety and unrelated uploaded-file retention.
Focused test, typecheck/lint and full V1 PASS. Build/package acceptance pending.
This removes those demo literals, not a universal private-data/source export scan.

### SEC01 fresh dependency audit — remaining two moderate findings

2026-10-26 npm audit --json exit 1 on this integration tree: 0 critical/high,
2 moderate (exceljs and transitive uuid 8.3.2). Advisory GHSA-w5hq-g745-h8pq
affects uuid <11.1.1; the ExcelJS call site observed uses CJS v4 without a buffer.
This reachability observation is not a security PASS or dependency exemption.
Do not apply npm's suggested major ExcelJS downgrade without compatibility review.
The default branch still has eight hosted alerts; integration audit and default
branch alerts are distinct evidence. Review a compatible bounded remediation next.

### SEC01 UUID dependency remediation — implemented, release checks pending

Independent read-only investigation confirmed ExcelJS uses CommonJS UUID v4()
without a caller buffer; no exploitable app path to v3/v5/v6 was demonstrated.
The affected installed dependency nevertheless reproduced missing bounds refusal
in a regression. Exact ExcelJS-scoped uuid 11.1.1 override replaces 8.3.2; no
ExcelJS downgrade or unrelated dependency upgrade. Upstream advisory identifies
11.1.1 as patched and its package exports support require().

Clean npm ci --ignore-scripts, resolved-dependency v3/v5/v6 short-buffer/overflow/
negative-offset rejection, unchanged rejected buffers, ordinary generation and
actual ExcelJS extended-CF XLSX write/reload/reserialize/application import PASS.
Existing XLSX/formula-safety and HTTP upload-extension tests PASS. Typecheck,
lint and full V1 PASS. New regression is wired into test:v1. One independent
post-patch review found no concrete bypass/regression; its missing-test-wiring
observation was corrected. npm audit --json and --omit=dev both exit 0 with zero
advisories on this integration tree. Default-branch alerts are not thereby closed.
Runtime tested on Node 24.19.0; Node 20/22 execution not established by this unit.
Deprecated dependency notices remain; this is not a universal supply-chain PASS.
Production build, smoke/package and hosted acceptance for this exact change pending.

01a9ed71ba479172b87a6502445fdd763c9c60a3 completion evidence: production build
e58583edf5e0803f40e7ec31725d7abc9cd7419d4baeb04008606b761b70b571,
release smoke and isolated developer-package checks PASS.139 files; disposable
ZIP SHA256 d6fc0b26f8670559743786dcf48a562928e6a15cbad217092118c83015540de8.
Hosted release40378776916, research40378776655 and inventory40378776557 SUCCESS.
Scoped security report retained through Codex Security artifact storage at
hardening/uuid-exceljs-remediation-20261026.md (SHA256
7d4d4fede5ad573ce7e47a7352aa6fdbf26a8e3e5382666a526e42eb2f7f74b9).
Developer ZIP still Node/npm-dependent, not an installer or clean-Windows proof.

### PKG02 bundled runtime / unsigned MSIX experiment — partial, not accepted

An owned production-dependency factory and copied signed Node executable launched
with no global Node path/NODE_PATH. Fresh empty storage, synthetic upload/export,
missing-provider503 and restart UUID/data/no-code-root-writes PASS. Real MSIX
format failures were isolated to a vendor developer fixture by mapping bisection;
exclude Mammoth test directory from runtime mapping, preserving canonical tests.
SDK MakeAppx then packed the unsigned internal prototype successfully and unpacked
it. The exact extracted payload repeated those backend/runtime checks PASS.

Prototype-only manifest/bootstrap inputs are preserved in packaging/prototype-msix;
report verification/BUNDLED_RUNTIME_MSIX_2026-10-26.md records lineage, hash,
discarded premature EBUSY attempt, limits and explicit NOT VERIFIED gates. No
install/sign/trust/account/publication or final visual QA occurred. No temporary
prototype is promoted to Desktop Installers or final Versions. Repeatable accepted
runtime builder, lifecycle UX, payload/license/asset audit, migration/update/recovery
and clean-Windows/installed activation remain release blockers. Do not confuse
extracted-component launch with installed MSIX acceptance.

### CC01/CC03 actual Getz Kenya repeat — verified scoped HTTP/export/restart

2026-10-26 source a053690, build f79fc44ca24659fba3faaf3632f7280929eaa46a6448da436a75ebdb5ccbed73:
fresh actual Enrich HTTP run run-mvor0s3i-a910e8d076 matched the independently
rechecked official Kenya phone/address in persisted API and HTML export, then
retained identical contact arrays/run ID after owned-process restart. No Pakistan
phone/address admitted; no guessed email. Real NVIDIA/Serper 200s observed;
Hunter/Groq not called. Credentials protected in isolated config then removed;
original configuration unchanged. Report verification/GETZ_KENYA_2026-10-25.md.
Saved Chrome permission still denies live 3901 observation; rendered/live and
wider company/leadership/dataset acceptance are NOT VERIFIED by this test.

### CC03 social-link office attribution — implementing

Hosted a053690 run 40319170045 now passes Docker and browser jobs, but verify
fails historical_evidence_preservation.test.ts (step 91): the social link was
not retained. Reproduction separates address/person/social assertions and shows
actual href-only social links lose their local office position when visible
label text replaces the URL. A dedicated red fixture demonstrates the same
loss on mixed Kenya/Pakistan pages. links[] alone is not country evidence.

The correction reads real http(s) href carriers at their HTML office position
only for social attribution; hidden comments/scripts and fake data/title href
attributes do not authorize a link. Foreign office links remain foreign, no
carrier/unknown country abstains. Structured-only countries keep their own
object semantics. Raw HTML stays unchanged. Positive/negative focused controls,
historical weak-refresh preservation and cached startup/reopen tests PASS.
Overlay policy 27 queues old-policy projections for existing offline revalidation
without rewriting original raw evidence. Broader checks and hosted repeat open.

### JOB01 interactive enrichment durable-before-publish — verified scoped fix, 2026-10-26

The actual HTTP route exposed a synthetic new email while its persistence call
was held pending. A test-only esbuild seam substitutes provider retrieval and a
controlled storage barrier; real Express upload/company/run routes, projection,
immutable capture and successful SQLite writes remain in use. External network
is disabled and every mutating request follows an owned-PID health check.
The assertion failed on the previous route, rather than merely mirroring code.

server.ts now awaits the existing durable overlay save before publishing fields
or rebuilding directory indexes. Pending/rejected saves leave the prior visible
contact untouched; successful saves publish and survive owned-process restart.
The immutable run remains discoverable even when contact saving rejects.
scripts/interactive-enrich-durability.test.mjs passes and is wired into test:v1.
This is synthetic HTTP/restart evidence, not a live browser or disk-full proof.
Existing persistence-failure tests cover separate real filesystem failures.
The existing endpoint's generic HTTP 400 error classification remains unchanged.
Typecheck, lint and full V1 suite PASS, including this HTTP/restart regression.
Commit 044b18fa92bda425334ffe3a809376c63d4aa8c2: production build
and release smoke PASS, build a6b60ea9b84ed28049903ccd470eb011044b671df19f932b627998dc95b39da3.
Package and hosted acceptance for this change pending.
Hosted 96d8546 release run 40223931168 is FAIL in the official-page body-budget
test (verify step 14); Docker and browser jobs PASS, publish SKIPPED. Research
contracts 40223931169 and inventory 40223931229 PASS. Investigate this separate
hosted failure next; local build/package success does not override it.

### CI01 body-budget fixture/country-policy mismatch — correction implementing

Reproduced hosted 96d8546 failure locally: the tail JSON-LD Person lacked any
country while the assertion expected Kenyan admission. Country projection now
correctly refuses that borrowed-prose scope. The fixture explicitly gives the
positive person addressCountry KE and adds PK and unscoped graph siblings which
must stay out. No runtime country protection was relaxed. Actual large-page
capture, full immutable storage, 2/4 MiB boundaries, redirects and private DNS
controls remain unchanged. Corrected focused test PASS; added to the ordinary
V1 command so this compatibility regression cannot be missed by local npm check.
Typecheck, lint and full V1 suite PASS with both body-budget and interactive
HTTP tests included. Hosted rerun pending. This does not verify real-company UI.

2026-10-26 checkpoint: committed source 429ea53, production build
f79fc44ca24659fba3faaf3632f7280929eaa46a6448da436a75ebdb5ccbed73:
build, release smoke, isolated developer package, unchanged launch/privacy-file
checks PASS. Package 139 files, ZIP SHA256
ebb50f16915aedc7c5862850da6b087e684669a670be9c067697f6ebbfce14af;
disposable output removed; customerRuntimeReady=false (Node/npm required).
Rendered contact-export and synthetic upload/paging/country/restart workflows
both PASS (2 tests, 18.3s), not live-company UI or installed acceptance.
Original main remains clean b6db23941b8523eb2ca4714ed6118059640b41ac,
read-only and unreconciled. No customer data/live runtime replacement.

Hosted 429ea53 run 40318735819 Docker failed because the new HTTP test imported
tests/e2e/no-egress.cjs, intentionally absent from Docker's allowlisted context.
Correction makes the no-network preload an owned, self-contained test fixture,
without expanding the Docker context or allowing external requests. Focused
HTTP/restart test PASS again. This is test portability, not a product-code fix;
hosted repeat must still prove the container behavior. Research contracts
40318735837 and evidence inventory 40318735808 PASS; release not green.

### CC02/CORE01 Slim Pharma real-source leadership loss — implementing

Fresh isolated exact company+Sri Lanka run run-mvo5cfpk-db4cf66328 resolved the
right domain and captured management HTML/accepted claims, but projected only
three people. Independent official-page comparison reproduced foreign biography
geography leaking between adjacent cards; Gayan/Shamal were incorrectly withheld.
Generic correction uses formal management cards plus explicit matching-publisher
local Head/Registered Office evidence, with person and HQ references kept apart.
It does not assert residence or use AI confidence. Current foreign/typed locations,
conflicting/absent HQ, wrong publisher and named related employers block inference.
Past geography cannot swallow a later current-foreign-location clause.
Explicit foreign office headings override the HQ inference; country-shaped names
are not office headings. Script/comment templates and uncarried model names are
not published management cards. No arbitrary employer/DOM/language graph claimed.

Red/green controls cover recall and negative cases. Same untouched real capture
now projects seven published Pharmaceuticals leaders, while Healthcare's explicitly
qualified CEO stays out of that profile. No expected real facts were injected.
Canonical three shared phone numbers match the independent contact source;
one address still appears with/without its office label (DATA01 follow-up).
All raw evidence-tree bytes and original credential config stayed unchanged;
temporary protected credential copies removed. Policy 26 requires normal offline
revalidation of older projections without startup evidence replay/data deletion.
Report: verification/SLIM_PHARMA_2026-10-25.md. Final checks, fresh post-fix repeat,
durability/API/render/export and live/installed acceptance remain open.

JOB01 source finding (now reproduced and corrected in the section above): interactive
/api/enrich/company assigns projected fields to ctxContact before awaiting
persistV1ContactOverlay(..., true). Both integration and frozen original main
showed this ordering; normal batch already uses durable-before-publish.

### CC01–CC03 structured office country isolation — verified scoped fix

New adversarial fixture reproduced foreign contact promotion: a page with Kenyan
navigation and JSON-LD offices using PK/KE/KEN codes admitted the Pakistan parent
mailbox as Kenyan. Projection controls also exercise addresses and people.
Structured-only facts now use the matching
object's address context, not visible navigation or graph siblings. Nested people
inherit their organization context unless their own address overrides it;
nationality/areaServed are not employment-location proof. Explicit distributor,
partner/agent/supplier and parentOrganization branches stay related_entity even
with the target country's address. Valid parent-hosted local office data remains.
Textual structured addresses remain supported; a positive recall assertion caught
and corrected an initial omission. Raw provider payloads are never rewritten.

Work is bounded to 32 scripts, 256 KiB/script, 2048 nodes and depth 24 per scoped
lookup; malformed/over-budget structured-only facts abstain rather than borrow
navigation scope. Quotes are bounded excerpts of original JSON, not invented
structured prose. No @id reference resolution, general relationship graph or
complete multilingual/layout acceptance claimed. Overlay policy 25 withholds
policy-24 caches pending normal offline revalidation, retaining stored recovery
data and raw evidence. Focused structured/office/field/cached-startup/batch checks
PASS. Actual retained Getz capture reprojects its independently checked Kenyan
phone/address, no guessed email/foreign address, with whole evidence-tree hash
unchanged. Source 70d7d38eaceb891f075cd01e15c8e47220c7a381, build
4c9a89561ab6f2831e92c114c40c53ae6fb2f1b3e91743222ad75e1e1ef98278:
typecheck/lint, full V1, cached-startup/offline batch and build PASS. Smoke was
rerun PASS after the build finished; an overlapping earlier smoke is not used.
Two compiled isolated rendered workflows PASS (contact/export selection and
synthetic upload/paging/CSV/country keyboard/restart), not real-company rendering.
Exact disposable package PASS, 138 files, unchanged-launch/privacy PASS, ZIP SHA256
a7b083290efe0d258743987dde9ef3f2b3d69021b6527770b14e0399be46b500;
customerRuntimeReady=false, 107 development files; removed after QA. Hosted,
fresh real-company UI/export and installed acceptance remain open. Original main tree
read back clean at b6db239, untouched; no automatic reconciliation performed.

### MON01/PRIV01 saved monitoring controls — verified scoped implementation

Separate error/usage choices now use the existing canonical settings store;
strict two-boolean endpoint, atomic save before runtime change, one in-flight save,
startup opt-out, capture/transport suppression and queued analytics discard.
Launch-level disable cannot be overridden. Accessible Settings controls have
bounded requests, explicit reload and honest unconfirmed-save feedback.
Actual local SDK transport controls PASS; compiled isolated browser save/restart,
invalid payloads, failed-save UI and disclosure checks PASS (three tests).
Source 05ab88719b3fb62cbe419d49b68ca5e1cbd31212, build
e484900678b43aa1b4916cb7fc8992450bc48266453ed8e7a23cc072bd1a6b19:
typecheck/E2E typecheck/lint, V1, config persistence, build/release smoke and final
four isolated rendered checks PASS. Exact disposable package PASS (138 files),
SHA256 bb11201957797beaeb0b343464ca8b4dee76cf67c538b475db54b62a4e84bbc5;
customerRuntimeReady=false, 107 development inputs, removed after QA. Fresh
synthetic delivery observed in both actual dashboards with matching build/UUID;
Sentry event 993f2f1641944cfb86a3bdb881f4ce2a. No live replacement.
PostHog granular access controls require Boost on current account; no paid
upgrade or permission expansion. Full retention/access and hosted release check
remain open. Docker passed on 05ab887; browser/verify later became cancelled
after the documentation successor push, not PASS. Current successor CI still
requires inspection; no stopped job is described as running indefinitely.
See MONITORING_ACCEPTANCE_2026-10-25.md for boundaries and remaining account,
crash-coverage, final package and live UI acceptance; wider country work retained.

### MON01 current-build dashboard receipt — verified scoped acceptance

Source 5f33d838654218a702d6991fccd49a32832e628d, beta build
2219c29203493cf7c3c3faad437fc966ea85cc5d86e95532639035941893d186:
fresh isolated synthetic error and product-event receipt observed in actual
Sentry/PostHog dashboards with matching build and temporary installation UUID.
Backend Sentry IP/location scrubbing and PostHog discard-IP read back enabled;
PostHog web autocapture switched OFF and verified after reload, replay read OFF.
Existing backend high-priority alert 6216926 actually triggered on the controlled
render failure; repeat throttle saved/read back one hour per issue. Existing
recipient policy retained; owner inbox receipt remains unverified.
Exact event IDs, privacy observations and limitations are in
MONITORING_ACCEPTANCE_2026-10-25.md. All three hosted workflows on this commit
completed success. No live runtime replacement, real customer data or final
package involved. Alerts, retention/access, customer controls, full crash coverage
and final-release acceptance remain open. Company-country wider acceptance also
remains open; this monitoring checkpoint does not supersede it.

### MON01 vendor routing and safe release identity — local verification

Existing Sentry dashboard visibly showed app_started/resource_sample as issues.
Actual source sent all projected events to both SDKs and final projection dropped
SDK release/environment. New real local-transport regression failed before fix
(app_started sent to Sentry), then passes: product events go to PostHog, fixed
runtime errors to Sentry, explicit doctor_run exercises both, resource heartbeat
is short-lived bounded error context rather than standalone vendor traffic.
Shared allowlist remains authoritative; no auto-capture or new tracing enabled.
Rebuild full-hash release/environment from validated identity, reject invalid
identity before SDK initialization, keep strict outgoing projection and v11
explicit collection restrictions. Tests verify actual payload routing, release,
resource expiry and private marker exclusion; rejection/offline/recovery PASS.
Typecheck/lint, full V1, production build/release smoke PASS. Copied/reviewed existing
explicit opt-in isolated monitoring proof helper and no-send controls into this
line; only four monitoring ingestion settings, no provider credentials/datasets,
official public-key destination validation and PID/build ownership. Synthetic
frontend-report HTTP 202 remains accepted locally, NOT asserted as delivery or
actual React crash. Current corrected-artifact dashboard evidence, alerts, cloud
retention/access and customer on/off control remain open. See existing monitoring
acceptance document for event definitions; old account evidence marked historical.

### SEC02 exact committed package acceptance — 2026-10-25

Scoped staged-credential publication finding verified at
98bf418a5db129c1833c19fcd179a1f8afa34ddf. Actual all-local-ref Gitleaks scan PASS,
findings 0; build/release smoke terminal PASS. Exact-commit disposable package
check PASS: 137 manifest files, unchanged launch/privacy-file checks, ZIP SHA256
e5dd2625d2377f779afc690e3b39699a7586b15b21a7572dba81c1d6bd242922,
build 0c55ff3cfb9bbd2401e002fc13554a80e146018f38555de57c83df25dbbed38a.
Package removed after QA. customerRuntimeReady=false, 106 development inputs;
no customer installer, clean-Windows, live UI, signing or update claim.
Standalone Codex Security evidence: hardening/windows-package-content-gate-20261025.md,
SHA256 9859f644ae434bc494139419154c2364a23ead7e648bfffac74bc60d0b978cce.
This closes this reproduced Windows-stage credential gate, not universal DLP,
source-export sibling, key rotation or the whole SEC02/release goal. Hosted
checks pending. Monitoring/account work resumes after this current slice.

### SEC02 staged-content gate — candidate verification, 2026-10-25

Fresh independent boundary investigation confirmed generated allowed files could
carry credentials through filename/integrity audits. Parent reproduced actual
publication of a never-issued credential canary before correction. Ported the
previous scanner candidate selectively; preserved original working tree/candidate.
Actual temporary stage now scanned before hashing/archive/publication, with pinned
Gitleaks SHA/version, neutral filenames, isolated rules/ignore, inline-ignore
suppression disabled, bounded payload/derived-copy/report sizes and static errors.
UTF-16 LE/BE with and without BOM covered. New independent reviewer reproduced a
gzip canary bypass; parent confirmed it. Current deliverable has no archive inputs,
so recognized compressed/container bytes and archive suffixes now fail closed,
including renamed gzip; no unbounded decompression added. Source-export sibling
package-safe-source.mjs is NOT covered by this Windows package gate.

Final actual packager regression PASS: benign multilingual ZIP; JS/map/shipped
Markdown/lockfile/SVG/vendor-named credential canaries; UTF-16 variants; gzip,
renamed gzip, ZIP and Brotli-suffix refusals; offline/HTTP/integrity/platform scan
failures; prior stage/ZIP byte preservation; no secret/scanner-error disclosure.
History controls PASS: benign, merge-only/deleted canaries, ignored/inline markers,
shallow-history rejection and scanner integrity. Package exposure/preservation and
isolated-path tests PASS; local typecheck/lint/current V1 suite PASS. Initial test
port needed shipped Markdown/public fixtures because internal docs are excluded;
encoding assertions prevent accidentally testing plain UTF-8 as UTF-16.

Build/release smoke and actual all-local-ref history audit are running/pending
terminal observation at this entry. Exact committed-source disposable package
acceptance follows this candidate commit; do not call SEC02 or release complete.
Scanner bootstrap currently requires Windows x64 and network; failure refuses
packaging. It is not shipped or required for ordinary app startup. This is a
heuristic credential gate, not universal DLP, trust signing or proof of absence
of business data/unknown encodings. Clean customer distribution remains open.

### Latest additive monitoring / clean-copy instruction — preserved

Existing MON01/PRIV01/recovery/version/distribution gates remain in order after
current security work. Verify existing owner projects and actual sanitized event
receipt, privacy settings, alert noise, retention/access and real customer controls.
Locked Sentry v11 removed sendDefaultPii: retain explicit all-false dataCollection
and final outgoing allowlist, not an unsupported property/cast. No 100% tracing,
replay or automatic collection added. No final clean copy before implementation
and configuration acceptance; original project/data intact. Owner performs any
identity/MFA/CAPTCHA/legal/payment step. Stop before Store submission/publication
and public installer/feed upload, then deliver verified review packet.

### Current implementation checkpoint — 2026-10-25 (supersedes older coordination observations)

Active reviewed code line is integration/edgeview-v1-20261024 at source checkpoint
5689c7f. Working tree clean on inspection. Original Pharma-AI/main remains clean
at b6db239 and was not replaced; its remaining changes still require review.
Desired permanent development location remains original Pharma-AI. Main and this
line remain divergent (37 main-only / 75 integration-only commits at this check);
selected reviewed hunks were adopted with provenance, not a wholesale merge.
No final source snapshot, customer installer or live-runtime replacement created.

Getz Pharma/Kenya now has actual isolated-provider and stored-evidence comparison
against its official Kenya phone/address, plus controlled durable DB reopen.
That does not close UI/export, all-company, all-country or installed-package gates.
Current contact overlay policy is 24, distinct from SQLite schema/app semver.
Latest unshipped candidate app version remains 1.0.0-rc.2. The owner's stop before
submission/publication/public feed upload remains mandatory after release review.


### Leadership title cleanup with original rejection preserved — 2026-10-25

Real Getz projection exposed role text containing the person's own name. A
separate synthetic regression failed with Alice Fixture - Country Manager rather
than Country Manager. Cleanup now removes only the exact name plus a separator,
AFTER original institutional rejection. Hyphen/en-dash/pipe fixtures pass; local
leadership stays available, foreign locations, generic headings and rejected
institutional roles remain excluded. Policy 24 requires cache revalidation.
Typecheck/lint, full current V1 suite, build/release smoke PASS. Same captured
Getz evidence projects Kenyan phone/address and the cleaned role. Independent
September public reporting corroborates the personal role, but direct profile
retrieval timed out; report records dated corroboration, not current employment
certainty. UI/export/installed-package and broad country correctness remain open.

### Country-shaped personal names: field-aware location evidence — 2026-10-25

New regression failed because Jordan Fixture was interpreted as the foreign
country Jordan even though the profile explicitly said Kenya. Corrected leader
scope only: ignore the exact escaped person value when reading country context,
not actual country labels elsewhere. Pass field identity through the existing
admission path; no extra LLM or location store. Jordan/Chad/Georgia synthetic
names now work with explicit Kenya, stay withheld without a location and fail
with explicit Pakistan. An ordinary person located in Jordan remains foreign.
Emails, phones and addresses retain existing country rules. Policy version 23
requires safe revalidation of previous overlays. No hard-coded real contacts.
Typecheck/lint, full V1 suite, cached-overlay policy, build and release smoke PASS;
existing multi-country/distributor controls still PASS. A separate role-title
format regression remains red and is the next unit, not included in this commit.
This does not prove every name, country alias or real personal employment claim.

### Reviewed visible desktop-launch failure handling — 2026-10-25

Adopted only the seven EdgeView.bat crash-handling lines from main b8e0266 after
review. New launcher-process-exit.test.mjs first failed on missing crash output,
then passes with the fix: actual batch routing shows server exit 3, returns 1,
normal zero stays clean, failed build/install cannot reach later steps. Fixture
replaces only external health decision and browser waiter, uses owned stub steps
and no listening server. It does not probe/mutate live 3901 or launch a browser.
Unlike Qoder's broader launcher-contract harness, it needs no process search/kill
by matching command lines. Updated operator error/fallback description and added
Windows CI step. Focused test, production build and isolated release smoke PASS.
Existing typecheck/lint and browser privacy/accessibility checks passed before
this batch-only change. Package/actual shortcut install acceptance stays open;
no claim that this proves health probing, a user-visible live crash or installer.

### PRIV01 accessible current-flow disclosure — 2026-10-25

Added PrivacyNotice.tsx to Settings: native collapsible keyboard disclosure,
local-data boundaries, company/country/search and selected-page AI egress,
provider connection requests/IP visibility, separate optional monitoring and
pseudonymous identity, replay off, review-before-sharing diagnostics and honest
retention/support limits. Explicitly discloses that an in-app monitoring on/off
control is not implemented; no invented support contact, licence or legal claim.
No new network call, polling, mutable state, analytics or third-party UI library.
Reviewed changed TSX against React skill: direct imports, native disclosure and
focus indication, no duplicate hooks/listeners or heavy component dependency.
Typecheck, lint, production build and release smoke PASS. Isolated compiled-app
Playwright privacy + settings-accessibility tests PASS (2/2): keyboard open/close,
separate disclosures, missing-control truth, no page errors. Screenshot actually
viewed: readable dark UI, visible focus and disclosure; default is collapsed.
This is isolated empty-data Chromium, NOT denied live Chrome/3901 QA. PRIV01 is
PARTIAL: persistent customer monitoring control, publisher privacy/support URLs,
About/notices/licensing and final package/account acceptance remain open.

### Fresh real-provider confirmation of office correction — 2026-10-25

Ran exact 18d6ffbf35ff41b1461acf5ce52affcb3c34bd0f in a distinct isolated storage
root with actual configured providers: new run run-mvnycq8a-b6e77eb318 reproduces
correct Kenyan phone/address, no local email asserted. No manually injected
profile or altered capture. Source credentials/config remained unchanged;
temporary protected credential copies removed. See Getz verification record
for independently checked official source and remaining UI/role/export limits.

### Getz Kenya actual-provider comparison and office-boundary fix — 2026-10-25

See [scoped verification record](verification/GETZ_KENYA_2026-10-25.md).
Actual isolated Getz Pharma/Kenya provider run on 7baea6d resolved correct global
official domain but lost captured Kenyan phone/address in projection. Reproduced
flattened multi-office HTML with a red synthetic test, corrected shared field
scope/context and generic labelled-address extraction; no company-specific facts
hard-coded. Same saved real capture now projects official Kenyan phone/address,
retains per-field source/quote and excludes Pakistan contacts. Durable overlay
write/DB reopen/hydration verified on isolated state; raw capture unchanged.
Overlay policy 22 invalidates older projections for ordinary safe revalidation.
No local email inferred; projected personal leadership remains independently
unverified. Live browser saved-origin permission still denies inspection; no
workaround/restart/customer-data change attempted. UI/export/fresh post-fix/live
full-dataset/installer acceptance stay open. Local required checks passed as
recorded in the report; previous full hosted release checks PASS at exact
7baea6d (40203275651), not yet this new correction. CC01–03 remain PARTIAL overall.

### Retained unscoped evidence repetition fix — 2026-10-25

Reproduced requirement gap with 250 repeated historical-source entries followed
by distinct evidence: old canonical projection returned 200 duplicates and hid
later facts (test failed 200 versus expected 6). Shared canonical normalization
now deduplicates before its 200-unique-entry bound, using field/value/source URL/
source passage/target country. First raw result reference survives; distinct
sources/passages/countries remain separate. No trusted-contact admission change.
Input raw runs are not changed and original references remain discoverable there.
New unscoped_fact_retention.test.ts also executes actual historical projection
over two persisted immutable synthetic runs: one displayed fact, no local email,
both stored runs unchanged. Canonical JSON round-trip and 1,000-entry unique cap
pass. Initial fixture used invalid run IDs; corrected fixture to required run-*
format before historical execution. Test wired in test:v1. Typecheck, lint,
complete current V1 suite, production build and isolated release smoke PASS.
Build dbcd0a624b1e3751dd2e862c1c680000f0b3033b1604bbcb38c58231c1c242dc
is pre-commit verification, not frozen customer release. Bundle-size warning
remains. Actual UI/export/large real-history/resource acceptance remains open;
this closes the reproduced duplicate projection case, not all provenance goals.

### Reviewed Windows development-launch fix — 2026-10-25

Independently reproduced main 31ccb24's bug on Windows: existing spawn of tsx.cmd
throws EINVAL before the stub server runs. Adopted only scripts/dev-server.mjs
and its endpoint-free synthetic test. Uses process.execPath --import tsx server.ts
instead of launching a cmd shim; no shell workaround. Focused test now PASS:
actual TypeScript enum loader, development flags/output, app exit 5 preserved,
owned stub termination reported as failure. Tightened adopted test to register
exit observation before kill and bound its wait to 10 seconds. Hosted Windows
step added. No live backend was launched, stopped or replaced; this addresses
npm run dev only, not installed-customer runtime or visual acceptance.

### Reviewed isolated rebuild decision coverage — 2026-10-25

Adopted only scripts/build-if-needed.test.mjs from main 8ad12f4 after reading
all cases and confirming its build gate/identity source has no integration
divergence from common ancestor. Independent execution PASS: current reuse,
stale version/source, tampered/missing/re-certified artifacts, corrupt metadata,
ignored non-build inputs, hollow-success refusal, late build failure, prior-build
byte restoration, removal of failed-build additions and backup retirement.
Tests run the actual build gate with synthetic npm commands in owned temp roots;
no live port, production dist, real customer files or published package touched.
Wired into hosted Windows verify beside existing build-recovery coverage.
This is development build recovery, NOT customer data rollback, installed update
acceptance or proof of current live runtime build. Qoder's reported mutation
counts were not independently repeated. Desktop .bat changes remain separately
reviewed, not accepted simply because this suite passes.

### Reviewed launcher runtime floor corrected against actual lock — 2026-10-25

Reviewed main ae031d3 individually. KEEP WITH FIXES: its Vite-only floor accepts
20.19 and 22.12, but locked posthog-node requires ^20.20.0 or >=22.22.0;
locked ESLint tooling also excludes Node 23. Adopted only dependency-bootstrap
and its tests, then set a coherent whole-stack policy ^20.20.0 || ^22.22.0 ||
>=24.0.0 in manifest, root lock metadata, guard and operator instructions.
No dependency versions changed. Local lock engine inspection found zero package
engine conflicts at 20.20.0, 22.22.0 and 24.19.0 (not execution on those versions).
Guard unit boundaries plus real CLI preload tests reject 20.18.3, 20.19.9,
22.12.0, 22.21.9 and 23.2.0 before npm starts or node_modules is created.
Dependency repair, npm-policy-isolation and Vite-install-boundary tests PASS.
Local typecheck, lint, production build and isolated compiled release smoke PASS.
Bundle-size warning remains. Build observed 159081c1606cd14f02a3e7b2524ca85a3f0183f75bba2c0cee16fb09e4cfbc17
was made from this pre-commit working tree, not a frozen customer artifact.
The developer ZIP still requires Node/npm; customer runtime bundling/installer
acceptance is NOT complete. No live runtime or original-tree files replaced.

### Hosted body-budget failure reproduced and fixture corrected — 2026-10-25

At b315a6c, hosted research-read and Docker passed and both typechecks passed.
Windows release verification failed official_page_body_budget.test.ts at tail
contact projection. Reproduced locally: its large HTML had no explicit country,
so current unknown-scope abstention correctly withheld the mailbox. Corrected
only this positive synthetic fixture with explicit Kenya office text at the tail;
kept every capture, size, redirect, failure-record, persistence and projection
assertion. No runtime country guard was relaxed. Focused test now PASS.
company_country_field_scope and contact_projection_country_isolation PASS,
including foreign parent, mixed office, distributor and ambiguous controls.
Local typecheck/lint and complete current test:v1 command PASS. Local SDK types
are still incomplete as recorded above; hosted exact-lock checks are stronger
compatibility evidence. New hosted full workflow result remains pending.
This is synthetic transport acceptance, not real company/UI/installer proof.

### Latest owner acceptance constraint and reviewed durability regression — 2026-10-25

Clean release export is AFTER implementation acceptance and reconciliation into
original development location. Preserve that project's data/configuration; export
with an explicit allowlist into a new immutable candidate, independently verify
empty storage/new identity and packaged behavior, then STOP for owner review
before Store submission, public publication or public installer/feed uploads.
Existing release blockers are unchanged; no final source copy was created.

Original main is clean at b6db239 on readback. Reviewed only its persistence
failure assertion: failed flush must return DISK_FULL or PERSISTENCE_WRITE_FAILED,
not an arbitrary exception. Adopted server/tests/persistence_failure_propagation.test.ts
and independently ran it: PASS including controlled write failure and repair.
Expected injected ENOENT diagnostics are not an unexpected production failure.
Qoder's reported mutation score was not independently rerun. No whole-tree merge,
live restart, customer-data change or release approval is implied.

### Historical coordination / organisation observation — superseded above

### Hosted SDK compatibility/privacy finding — 2026-10-25

### Reviewed Qoder test reconciliation — SSRF precision

Read final test changes at main 83c5dd2 and 9f0c4fa, compared the affected file
against common ancestor 860b6e4 and confirmed integration had no divergent hunks
there. Adopted only server/tests/ssrf_security_guard.test.ts, not the main tree
or its mixed historical ledger. Actual standalone execution passes exact guard
message assertions under isolated empty settings, unsaved synthetic keys,
loopback aliases/0.0.0.0/fd00 controls and an allowed documentation-address literal.
Corrected the output label: literal controls without a DNS lookup are not proof
of DNS resolution/binding coverage. Qoder's reported mutation score is prior
evidence, not an independently repeated mutation run here. Remaining main
commits are still pending individual review; original tree remains untouched.

Inspected actual GitHub runs at 30c7f9246c078de96a1f44636ae9ce52cb87ec0e:
40200261970 (research read) failed typecheck; 40200261939 (release) failed Windows
verify typecheck and Docker build. Browser-e2e succeeded; publish skipped.
Inventory 40200261965 succeeded. These are scoped results, not overall PASS.
Annotations identify server/monitoring.ts:100: sendDefaultPii is not a NodeOptions
property in locked @sentry/node/core 11.9.0. Local package metadata says 11.9.0
but declared build/types/index.d.ts is missing: local typecheck silently treated
the SDK as untyped, so previous local passes did not prove SDK compatibility.
Do not suppress/cast away the CI error or weaken the typecheck gate.

Official v11 migration guide replaces sendDefaultPii with dataCollection and
warns of more permissive defaults:
https://github.com/getsentry/sentry-javascript/blob/develop/MIGRATION.md
Candidate explicitly disables user/cookie/header/body/query, AI/MCP/GraphQL,
database/queue payload, stack variable and source-context collection. Default
integrations remain off and final safe-event projection remains in place.
Actual SDK-options regression failed before the change (undefined), then passes;
captured Sentry/PostHog transport test emitted six requests without private
synthetic markers; rejection/offline/recovery test passes. Clean exact-lock
temporary install completed and restored declared SDK types. The isolated tsc
reported no SDK option error, but failed because the validation-copy allowlist
omitted scripts/test-server-port.mjs imported by three endpoint tests. That setup
failure is NOT a full clean-typecheck PASS. Hosted complete-checkout acceptance
and local dependency-tree repair remain pending. No real-account
event was sent by these tests and no claim of prior private-data leakage is made.

Owner explicitly requested a stop before shipping in the latest instruction.
That supersedes earlier automatic-publication authorization: prepare and verify,
then return a pre-shipping checkpoint before submission/public distribution.
Qoder is still working in the original Pharma-AI directory; keep it read-only
from this session until a clean handoff. A pause message was NOT sent: native
control observed Qoder running, then could not access its minimized window.
Do not represent draft text or a failed UI action as delivered coordination.
Reviewed integration remains the temporary active line at 0f3f4d6; main was clean
at 79b1784 on the latest read. Reconcile main's divergent launcher/packaging/docs/
test tools individually after Qoder finishes; no blanket agreement or merge.

Windows resolved Desktop to C:\Users\asimh\OneDrive\Desktop. Created EdgeView/
README.md and empty Versions, Installers and Documentation audience subfolders
(User-Guide, Installation-and-Updates, Privacy-and-Licenses, Support-and-Recovery,
Engineering, Verification-Reports). Read back existence and README status.
No populated source version, installer, customer data or operational snapshot was
copied. No existing version was overwritten. Permanent development directory
restoration, allowlisted scanned snapshots and documentation inventory/index
remain open. This scaffold does not satisfy release/snapshot acceptance.

### CC03 startup-overlay policy — implementation in progress

Startup guard committed as 3a9672ee1e1d21f979ff3b84f274091f9c40789b and pushed.
Exact isolated package checks passed at build
ff32dc33f8017f1a4d1a5e5b90f6366de28693733c3f092d9c5c1b70061315a3;
136 manifest files, unchanged launch/private-file checks PASS, disposable ZIP
SHA256 9497fb6efd5fac1f0064dc3ca467a566e8811995781aacb62697dcf648bec53a.
This developer package has 105 development files and needs Node/npm; not an installer.

### CC03 ordinary-batch retained-evidence revalidation — follow-up

Actual createJob/runJobLoop regression initially completed a job without restoring
withheld cached fields: normal reuse skipped the new policy entirely. Ordinary
non-forced reuse now first verifies exact saved-run company+country identity;
stale contact output is reprojected from retained history, durably persisted and
then assigned/marked current. No new provider call is needed for this path.
Force Fetch remains the explicit new-retrieval path. Current valid caches still
reuse normally; a foreign saved-run ID cannot authorize another entity's cache.

Executed actual isolated job-loop test passes completion, durable entity-key
binding and zero http/https/fetch calls. Injected overlay-write ENOSPC yields a
FAILED job, retains the previous in-memory contact and needs_revalidation flag,
and still makes zero network calls. Its logged synthetic fatal-loop error is
intentional test evidence, not a production crash. npm run check, build and
test:release pass for the runtime candidate; startup cache guard also passes.
The new job-loop regression is wired in CI. No live/customer batch executed.

Still open: large per-company history can make offline reprojection expensive;
bounded/background revalidation performance, interruption/resume, actual API/UI
and export flow, broad entity relationships and real-company acceptance remain
release gates. This does not automatically revalidate every stale cache at startup.

Reproduced on the active hydrateV1ContactEnrichment SQLite path: an old v18 cache
loaded a foreign email at startup. New shared overlay policy v21 binds persisted
output to canonical company+country entity_key. Startup withholds older/unknown
policy or mismatched-entity overlays, marks needs_revalidation and retains their
stored rows and original run IDs. Current matching-entity overlays still hydrate.
Interactive/batch research clears the warning and persists the entity binding.
Missing contact-ID remapping uses identity headers rather than getV1Run full-body
hydration; no competing persistence authority or synchronous full-history replay.

Focused executed checks: cached_overlay_scope_policy initially failed before fix,
then passed old/wrong-entity withholding, unchanged stored recovery row, current
cache reopen and zero raw-body reads for matched contacts. Initial test cleanup
left a pending save timer after deleting its temporary directory; corrected by
flushing before reset/cleanup, rerun without that error. Static stale-profile
notice/escaping and historical-evidence preservation tests pass. npm run check,
npm run build and npm run test:release also pass on the final candidate; existing
bundle warning remains. Packaged runtime, actual API/UI/export and large-history/
startup performance acceptance remain pending. Original dataset-seeded fields
are not deleted. Latest read-only main observation: ae031d3, with Qoder modifying
server/tests/ssrf_security_guard.test.ts. Do not reconcile/switch its branch yet.
This withholds stale output; it does not yet implement automatic bounded cache
revalidation or prove every cached fact correct merely from a version/key match.

This section is the single current goal/phase authority. Earlier dated entries
below are retained evidence, not competing priorities. RECONCILIATION_2026-10-10_23,
REAL_WORLD_APP_READINESS_RESEARCH, UNCLE_INSTALL_UPDATE_SUPPORT_PLAN and security,
recovery, monitoring and distribution documents support these IDs. Their historical
claims do not automatically close current acceptance. New requests extend these IDs.

Writer: this session only. Authority: integration/edgeview-v1-20261024, initially
clean at 75e8cac. Research/review session owns no implementation. No review approval
is inferred. The older edgeview-chatgpt worktree has an unfinished, independently
reviewed package-content scanning candidate; preserve it without automatic merge.
No live 3901 restart, operational-data mutation or publication is authorized merely
by this plan. Synthetic isolated fixtures first.

State vocabulary: planned / implementing / verified / blocked. Capability vocabulary:
implemented / partially implemented / absent / unverified. Verified applies only to
the cited acceptance scope, never automatically to the whole product.

| ID / priority | Requirement; current state / capability | Code / commits / executed evidence | Remaining acceptance and dependencies |
| --- | --- | --- | --- |
| CC01 P0 | Company+country identity from upload to history; implementing / partial | Identity/country fixtures; fresh Getz Kenya/Slim Sri Lanka provider→HTTP/export/restart evidence; c6415cb actual cached API/streaming/job exact-entity refusal and isolated rendered controls PASS | Fresh Emerchemie capture remains recorded FAIL; corrected retained API/export/restart now PASS. Complex layouts/aliases, additional companies and final rendered/full-dataset acceptance remain |
| CC02 P0 | Field-level local/parent/subsidiary/distributor attribution; implementing / partial | 70d7d38 structured per-object scope; 6b56ade hidden fact exclusion; 23a8fc2 ordinary office recall; 236a966 exact role/employer binding and prior-policy withholding. Focused red/green and full V1 PASS | Broader office/parent leadership, relationship/@id graphs, multilingual names/dates and actual per-field real UI/export truthsets; no whole-product accuracy claim |
| CC03 P0 | Country-aware history/cache and no foreign repair of missing facts; implementing / partial | Policy30 includes hidden-carrier and role/employer admission; prior29 overlays withheld without deletion/startup body replay. c6415cb exact-entity saved review, provider refusal, export/restart and isolated rendered controls PASS | Large real-history cost, interrupted/retried jobs, aliases and current real dataset/API/UI/export acceptance; policy number alone does not prove fact correctness |
| CC04 P0 | Reliable official-page acquisition; implementing / partial with real failure | Bounded4MiB official/2MiB generic capture, afa6abd gzip. New real Emerchemie run-mvv9bnan-1bb1f23bea captured complete official pages; missing warehouse reproduced/fixed23a8fc2. Corrected retained compiled API/export/restart PASS3emails/7phones/2addresses/9people with unchanged raw evidence | Prior fresh acceptance remains FAIL; acquisition is intermittent, no speculative header cure. Fresh final integrated provider→UI acceptance and broader sources remain open |
| CORE01 P0 | Bounded V1/provider capture, evidence and prior-good preservation; implementing / partial | v1_engine.ts, job_manager.ts; actual NVIDIA query/extraction 200 and four Serper search 200 requests in each Getz acceptance run; direct failure records retained | Groq/Hunter real operations/failure/recovery not proven by configuration; full source-to-render truthsets, limitations and whole-dataset workflow remain open |
| DATA01 P0 | CSV/XLSX/NVL, importer scope, pagination/export/state; implementing / partial | Existing parsing/paging fixes; f6ee2c9 saved collections in HTML; 4b306b3 delayed upload preserves chosen tab, actual browser/export/restart checks PASS | Real importer/exporter/duplicate/count reconciliation and wider navigation/state acceptance; synthetic checks do not mutate or accept the customer dataset |
| DATA02 P0 | Legacy history ownership and safe repair; implementing / partial | Schema2 file_id, fail-closed legacy delete guard, 3099b09 offline candidate; 7f3c218/6ffa88c journaled exact rollback, forced termination, compiled startup/refusal/repair/restart PASS | No live history repair or exposed operator control; malformed initialization/support recovery, retention, generic restore/migration and installed matched app/data recovery remain open |
| DATA03 P0 | Invalid saved authority must not become empty storage; verified scoped implementation | ec3080c canonical strict decoder; exact DATASET_UNAVAILABLE, retained bytes/path, actual compiled invalid startup and post-start upload503/restart PASS | Wider failure UX and installed acceptance; file-symlink probe skipped on this host; do not claim every delete HTTP response now uses503 |
| EXP01 P1 | All saved contact collections in HTML export; verified scoped implementation | f6ee2c9; actual endpoint hostile text/source URLs, secondary contacts/leadership, same-name foreign selection and unscoped exclusion PASS | Final downloaded-document visual and real-company complete export acceptance remain part of QA01; no unsupported facts admitted |
| START01 P0 | Reused PID must not impersonate backend owner; verified scoped integration | e699dd2/8fc046d process-birth sidecar, conservative inspection failures; actual duplicate/reused-PID compiled runtime tests and hosted afa6abd checks PASS | Original/main still uses numeric legacy lock until reviewed integration; local native launcher trust remains a separate blocker |
| JOB01 P0 | Progress/cancel/retry, bounded waits and crash recovery; implementing / partial | c6415cb offline saved-only selection/jobs and measured cached timing; 6377a71 fresh overlay durable-before-publication, actual pending/rejected/successful restart regression and missing-wait mutant killed | Cancellation/transport termination, arbitrary kill/restart/retry, multi-company failures and broader spinner/lost-state acceptance remain; one injected flush failure is not full crash safety |
| SEC01 P0 | Local Host/Origin, SSRF/DNS/redirect/credential origin and resource limits; planned / partial | server.ts, ai_providers.ts, url_safety.ts, routes/upload.ts, security tests | Reconcile exact current tests and deployed build; alias/raw requests and malformed/error cases; preserve safe loopback boundary |
| SEC02 P0 | DPAPI secret authority/history/package scans; implementing / partial | settings.ts, scan-history-gitleaks.mjs; 98bf418 committed staged-content publication gate; actual hosted developer-package checks PASS | Previously exposed key rotation, final customer-package/history scope, default-main8alerts and private GitHub security feature availability remain distinct open gates |
| MON01 P0 | Privacy-safe Sentry/PostHog plus disabled/offline controls; implementing / partial | 5f33d83 actual dashboard receipt recorded a112dac; current saved per-purpose Settings controls, actual queue/opt-out transport regression and isolated rendered restart/failure acceptance | Broader actual frontend crash and startup/unhandled coverage, target installation and final-package acceptance; no SDK-flush-only dashboard claims |
| MON02 P0 | Account IP/location privacy; partially verified externally | a112dac/2b6b8d7: 5f33d83 synthetic dashboard receipt, Sentry backend geography filtered/IP prevention, PostHog GeoIP disabled/discard-IP, persisted autocapture OFF/replay OFF, existing error alert triggered/hourly throttle | Owner inbox delivery, access/retention, fresh separate frontend project effects and final release-wide acceptance remain unverified |
| DIAG01 P1 | Honest diagnostics preview/export/retention/support; planned / partial | support_diagnostics.ts, SystemHealthPanel.tsx; 365021c; support_diagnostics.test.ts | Review actual overview/provider/resource/error states, visible preview/download, offline and redaction; no raw logs/content leakage; support contact requires genuine publisher details |
| PRIV01 P0 | Accessible privacy notice and AI/search disclosures; implementing / partial | 960e95e PrivacyNotice.tsx, updated current MonitoringControls.tsx, per-purpose saved consent; isolated keyboard/save/restart/failure checks and screenshot inspected | Genuine publisher privacy/support URLs, About/notices/licensing and final package acceptance; live browser origin remains denied |
| ID01 P1 | Installation identity distinct from licensing/HWID; planned / partial | install_identity.ts random UUID; prior identity/doctor tests | UUID is not cryptographic licensing. Inspect DPAPI/private-key authority and corruption/recovery. Raw HWID authentication deferred; no hardware analytics |
| REL01 P0 | One integration line, narrow commits and version/build/schema/channel; implementing / partial | Current integration source/CI; version1.0.0-rc.2 and exact content-derived build/commit identities; fresh internal candidate11c7caf | Original/main remains b6db239 and unreconciled; review remaining main-only verifier/tar/test-debt work, channel/promotion identity and release notes; no different-byte promotion under one version |
| CI01 P0 | CI, dependency/license/SBOM/secret/release evidence; blocked / partial | Workflows and local checks exist. Exact236a966 release run41161010334 has zero-start jobs: GitHub annotation says recent account payments failed or spending limit must increase. Owner notified; no billing change made | Restore hosted execution, then actual exact-source jobs/artifacts; dependency/default-main8alerts/license/security availability remain distinct. Local green does not close hosted gate |
| STORE01 P0 | sql.js/JSON/evidence authority and integrity; planned / implemented, broader recovery unverified | sqlite.ts, sqlite_persistence.ts, v1_engine.ts; existing atomic/integrity tests | Old-version upgrades, failed writes, locking and interrupted runtime tests with exact schema evidence; no new persistence authority |
| MIG01 P0 | Stable writable root and explicit legacy migration; implementing / partial | Opt-in EDGEVIEW_DATA_DIR; private legacy_data_migration copy/journal/retry; actual schema1→2 compiled workflow preserves UUID/dataset and original bytes; interruption, no-overlay, link and readiness-manifest tests PASS | No real migration or final launcher selection; independent backup/matched installed rollback, uncertain initialization/support recovery, target account/ACL, retained-copy policy and clean-Windows gates remain open |
| REC01 P0 | Backup/transactional restore/schema-compatible rollback; planned / partial | backup-runtime.mjs, migration_backup_retention.ts, prior isolated tests | Rejected restore stays excluded. Executable matched app/data recovery, midway failures, integrity/restart and schema compatibility; package downgrade is not DB rollback |
| DIST01 P0 | Bundled runtime and immutable customer payload; implementing / partial, no accepted customer distribution | Committed internal MSIX factory and candidate11c7caf; exact extracted payload runs copied Node with no global Node/NODE_PATH, empty data/upload/export/restart/diagnostic checks PASS | Trusted signing/native activation, current Node security, source-map/test/dependency minimization/OSS, real clean Windows, complete lifecycle and MIG01/REC01/REL01 still required |
| MS01 P1 | Microsoft Store vs signed MSIX/feed decision; planned / unverified account | WINDOWS_DISTRIBUTION_DECISION.md is evaluation only | Current official eligibility/fees/publisher/account/signing/policy review and visible official account handoff if needed; user handles identity/payment/agreement/attestations. Choose one update authority |
| UPD01 P0 | Trusted update acceptance and compatible recovery; planned / absent accepted updater | UNCLE_INSTALL_UPDATE_SUPPORT_PLAN.md, build recovery only | Package trust, channel/schema compatibility, preserved state, restart health/build/DB acceptance, last-known-good recovery; depends selected distribution route and migration |
| UX01 P1 | Accessibility/About/notices/support; planned / partial | React UI, prior focused browser/a11y tests, license inventory | Keyboard/focus/dialog/forms/error/empty workflows, actual About/version/notices, genuine support details; no broad redesign |
| PERF01 P1 | Offline/failure UX and target-device long performance; implementing / partial | resource monitoring, prior smoke/soak JSON and bounded queues/logs | Fresh target idle/start/import/export/research/shutdown measurements; long repeated leak tests and disk/DB/permission/network failures; no scale claims from short smoke |
| QA01 P0 | Rendered controls and real company truthsets; implementing / partial, final live QA deferred | Actual synthetic browser regressions/hosted screenshots PASS; Getz/Slim source-to-HTTP/export/restart scoped evidence; Emerchemie fresh acceptance FAIL | Final live/manual QA deferred; browser/Windows helpers currently fail kernel-assets initialization, not an EdgeView port diagnosis. No baseline approval or country/product-wide acceptance; Global Pharma/Thorne Berry/whole dataset remain |
| QA02 P1 | Screenshot capture/comparison infrastructure; implemented and capture exercised | 032de45; two desktop/narrow cases produce six synthetic unreviewed screenshots, build metadata and failure traces; missing reference negative test exits1 | Approve consistent-platform references only after review; no baseline currently approved, no pixel comparison PASS and no final live visual acceptance |
| PILOT01 P0 | Clean Windows install/update/recovery/uninstall pilot; planned / absent acceptance | Existing developer ZIP/Docker are not evidence | Exact frozen self-contained package on clean Windows; synthetic import/research/export/offline/restart/update/failure/retention; then authorized real-data step |
| FINAL01 P0 | Freeze/three artifacts/report/uncle Stable deployment; planned / absent release acceptance | Existing release contract and preserved source/data architecture | Close dependent gates; exact source archive, private operational snapshot without casual credentials, runtime distribution/checksums/SBOM/notices/release notes; final READY/READY WITH WARNINGS/NOT READY from evidence |

### Ordered implementation phases and review packets

1. CC01–CC03 now: trace/adversarial mixed-country fixtures, narrow admission fixes,
   field provenance and history checks. Commit each coherent concern. Full real-world
   closure requires later rendered/source comparison, not passing fixtures alone.
2. CORE01/DATA01/JOB01/SEC01/SEC02: reconcile prior working fixes and current
   security/recovery paths. No blind branch/dirty-tree merge or revived legacy engine.
3. MON01/MON02/DIAG01/PRIV01/ID01/UX01: existing adapters first, visible privacy and
   honest support states; actual delivery and crash coverage, not installed SDK claims.
4. REL01/CI01/STORE01/MIG01/REC01: current release identity/evidence and transactional
   migration/recovery. Inspect main launcher commits 05d4e1f,5ab65a6,b8e0266,0ebb6f5,
   8ad12f4 before accepting any; older release branch fixes remain pending reconciliation.
5. DIST01/MS01/UPD01: verify official Store route/account and choose one distribution
   authority, then runtime bundling/install/update trust and post-update acceptance.
6. QA01/PERF01/PILOT01/FINAL01: actual rendered and target/clean-Windows acceptance,
   retained exact artifacts and freeze/deploy only after gates genuinely close.

Each phase checkpoint records goal IDs, exact commits/files, before/after behavior,
executed commands/results, unresolved failures/limitations and next phase here.
This matrix is a conservative reconciliation from source/history; historical test
claims are identified as prior evidence and are not fresh execution in this handoff.

### Checkpoint — handoff reconciliation and Phase 1 reproduction

### Phase 1 first implementation packet — explicit source/field scope

### Phase 1 follow-up packet — unknown evidence abstention

Implementation commit: 3ee7731369e4528c417f0f91016079f6fe7c8f80. Exact built
artifact 02b5e00dc160c3ed39c35dd0119c93aa29ca12cd408c73f987de3a43aa54f768
passed isolated developer-package checks (136 manifest files; unchanged launch
and private-file check). Disposable ZIP SHA256:
eb3a9dc2682449f88a63f7b9abef35cc4416e6fe18b4f356265bc321f8c02b97.
Removed afterward; 105 development files and required Node/npm mean
customerRuntimeReady=false. No installed/live/browser or clean-Windows acceptance.

CC01/CC02 remain implementing; CC03 startup/cache acceptance remains open.
The first follow-up regression failed on 22a7879 because an unlabelled same-domain
mailbox entered the Kenyan profile. Overlay v20 now withholds unknown-country
facts for country-specified runs and retains them as bounded unscoped_facts with
source/result/quote, target country and COUNTRY_SCOPE_UNPROVEN. Historical
projection, batch persistence and canonical JSON normalization carry that field.
No second store or rewritten raw capture. Existing no-country legacy test callers
remain compatible; real enrichment requires the exact country at its input boundary.

Explicit matching international phone prefixes provide number-country evidence
only when source scope was unknown; they do not override foreign/distributor
scope. This establishes the number's calling-code scope, not legal incorporation,
subsidiary status, or a person's workplace. Unknown mappings/local numbers provide
no such positive proof. SourceEvidenceModal has a collapsed, text-escaped notice
showing up to 50 retained unscoped facts; canonical retention is bounded to 200,
with full raw evidence still available in captured results. This is distinct from
verified local contact fields and does not add these facts to local-contact exports.

Positive public-profile/LinkedIn/free-mail fixtures previously omitted country
context. They now explicitly supply local-country evidence; a paired negative
preserves the original unscoped free-mail case and asserts withholding/retention.
This is an intentional stricter policy, not unchanged compatibility. Original
phone recall/history expectations passed unchanged. Unit check proves canonical
JSON round-trip does not promote retained unknown mailboxes to trusted email.
Static rendered markup test proves notice, escaped hostile text and no mailto
promotion, but browser expand/keyboard/API/UI behavior remains NOT VERIFIED.

Executed candidate checks: npm run check, build and test:release pass; separate
unscoped_contact_presentation, search_snippet_email_admission, official_phone_recall,
historical_evidence_preservation and contact contract checks pass. Earlier failures
are retained above, not relabelled as passing baselines. Existing bundle warning
remains. No port 3901 restart, actual-company calls or customer data changes.

Still open: previously persisted overlays are hydrated directly at startup without
v20 reprojection; a schema bump alone does not fix them. Safe bounded revalidation
and visible stale-validation policy are the next CC03 unit. Unknown facts need
deduplication/retention validation across repeated historical runs, broader country
aliases/languages and relationship extraction, actual persisted API/export and
rendered behavior, and performance measurement. No whole Phase 1 completion claim.

Goal IDs CC01/CC02/CC03: implementing, NOT wholly verified. This slice adds
server/contact_country_scope.ts, updates job_manager.ts projection/overlay v19,
adds explicit country-name matching in src/utils/countryNormalizer.ts and wires
company_country_field_scope.test.ts into package.json test:v1. No other session
has reviewed/approved this change. The initial four actual projection assertions
failed before implementation; seven scenario assertions plus HTML/JSON carrier,
address/leader/local-number, raw-preservation and provenance controls now pass.

Behavior: explicit foreign/ambiguous/distributor source context can no longer be
overridden merely by official-domain ownership. Local office sections remain
eligible on a shared global page and on a foreign parent domain. Longest proper
country names distinguish Sudan/South Sudan; natural-language US/IN-like words,
URL and email identifiers do not become country proof. Projection adds per-fact
result/URL/quote/scope references and reprojects historical raw runs through the
same guard. Original provider captures and accepted/rejected extraction evidence
are not rewritten. Existing valid social URL slash variants and older quoted
claim-only leader normalization were initially broken by the candidate; corrected
and their original expectations passed unchanged.

Observed commands: npm run check (typecheck, lint, V1 suite including new cases),
npm run build and npm run test:release all exit 0 on the final candidate; separate
search_snippet_email_admission, official_phone_recall and
historical_evidence_preservation checks pass. The expected injected ENOENT errors
in persistence tests are controlled failure checks, not production DB errors.
Frontend chunk-size warning remains. No live restart or operational-data writes.

Remaining acceptance is substantial: unknown/unlabelled evidence still follows
marked legacy admission (scope unknown, never labelled local); this does NOT
complete required abstention policy. Proper-name matcher does not yet establish
all aliases/languages/structured country codes. Distributor blocks conservatively
stay related_entity for the rest of their source, possibly withholding later valid
facts. Parent/global role versus subsidiary role, complex/flattened office layouts,
matching facts repeated across representations, Hunter country scope, ingestion
acceptance/chunk extraction and cached persisted overlays require further work.
No real-company/provider, actual API/UI/export, restart-cache invalidation,
packaged runtime or source-scoping performance acceptance is established here.
Next slice: strict unknown-evidence admission and relationship/provenance contract,
then isolated persisted API/export and rendered comparison. Keep CC01–CC03 open.

Commit 2a4f352 reconciles this authoritative matrix/phase order; it completes the
ledger-reconciliation subtask, not product release acceptance or all REL01 work.
The integration worktree was clean at initial inspection, HEAD 75e8cac, and no
other session is credited with implementing or approving this checkpoint.

New in-progress fixture server/tests/company_country_field_scope.test.ts exercises
the actual projectDeterministicContactFields function using isolated synthetic
results on one shared domain. Executed:
`node --import tsx server/tests/company_country_field_scope.test.ts` → exit 1,
all four assertions fail: Kenya inherits Pakistan parent email; Sudan inherits
South Sudan email; a global office page combines local/foreign email; a distributor
reference supplies the entity mailbox. This is red reproduction evidence, not a
passing regression or complete Phase 1 fix. No provider call, dataset write, live
restart, telemetry transmission or manual contact injection occurred. The fixture
remains in-progress and is not yet wired into the green V1 suite. Next patch must
preserve legitimate Kenyan content on parent domains and field/source provenance,
and must handle mixed-page and relationship scope rather than merely filter URLs.

MS01 official-source check (2026-10-25): Microsoft currently states both Individual
and Company registrations have no registration fee **in its new onboarding flow**,
entered through https://storedeveloper.microsoft.com/. Individual/business account
selection and required verification differ. This does not establish this owner's
account, eligibility, business verification or publication approval. Official guide:
https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account?tabs=individual
Microsoft recommends MSIX and describes Store-hosted signing/hosting/update
facilities: https://learn.microsoft.com/en-us/windows/apps/publish/get-started
Provisional preference is Store-managed MSIX, subject to actual account/product
acceptance; signed owned-feed MSIX remains an alternative, not a second updater
to implement in parallel. No signup, agreement, submission or publisher attestation
was performed. Sensitive account participation is deferred to the explicit browser
handoff once packaging and account verification are the active dependency.

## Anonymous installation identity for diagnostics — 2026-10-24

This path existed on no branch: `main` after the merge has no install identity and none of the
other agents' worktrees contain one, so it is landed here. Telemetry stayed out of this slice
entirely — it belongs to the other agents and three of their telemetry files already run in CI.

`server/install_identity.ts` mints a random UUID v4 per installation and stores it in
`data/installation.json`. The write is `tmp` + `wx` + `rename`, so a crash cannot leave a
half-written identity, and a file that is unparseable or holds a value that is not a UUID v4 is
replaced rather than propagated. `getInstallationIdentityPath()` follows the same test isolation
as the other writable runtime files (`EDGEVIEW_TEST_DB_DIR` / `EDGEVIEW_JSON_DB` directory), so a
test process can never mint an identity inside the real installation. `/api/health` now reports
`health.app.installation_id`; it is random, not hardware-derived or account-linked.
`scripts/doctor.mjs` replaced `device_identity: SKIPPED ("not yet implemented")` with a real
check: PASS on a well-formed UUID v4, FAIL when the file exists but does not hold one (the
operator cannot trust correlation), WARN when absent because the backend has not started yet.

Evidence:

- `node --import tsx server/tests/install_identity.test.ts` —
  `PASS installation identity: creation, restart, corruption, reset and test isolation behave`.
- `node scripts/doctor.test.mjs` —
  `PASS doctor states, locked dependencies, offline failure, safe output and full-check orchestration`,
  now covering all three identity states including `exitCode 1` on the corrupt file. The doctor
  fixture id is a deliberately synthetic UUID (`00000000-0000-4000-8000-000000000001`) so it can
  never be confused with the developer machine's real value.
- Live probe against the rebuilt `dist/server.cjs` with an isolated environment:
  `HEALTH IDENTITY PROBE: PASS id=ca7a475a-1716-47d4-829a-335225edcc4e` — the id appears in
  `health.app.installation_id`, is persisted in the isolated directory, and is stable across two
  calls.
- Mutation matrix, with both baselines restored before each mutant so nothing compounds:
  `shape_check_off` and `isolation_off` each fail only the identity test; `doctor_skipped` fails
  only the doctor test. After restoring, both tests pass and both files are byte-identical to
  baseline.
- The developer installation was not modified. `data/installation.json` already exists in the
  real project root (created `2026-10-23T06:40:06Z`, before this slice); the identity test reads
  it before and after resolving the isolated path and asserts byte-for-byte equality, so the run
  proves the isolated accessor never writes there.
- `npx tsc --noEmit` and `npx eslint` clean on the touched files.

Not claimed here: the identifier is anonymous and local-only, and nothing in this slice sends it
anywhere — there is no diagnostic upload path wired to it. It has not been verified against a
running browser session, only against the HTTP health endpoint.


## Activity endpoints no longer hydrate evidence bodies — 2026-10-24

Both /api/logs/enrichment and /api/enrich/activity-log now use a shared
activity-only reader of persisted timeline metadata, not map(getV1Run) retaining
twenty fully hydrated runs. Response tail defaults to 500, clamps to 1–1,000,
selects newest events within the existing latest-20-run activity scope, and
advertises that scope in X-EdgeView-Log-Scope. Historical identity discovery and
full getV1Run/evidence integrity behavior are unchanged. Corrupt/missing timeline
files yield explicit current read-failure diagnostics with RUN_TIMELINE_READ_FAILED;
these do not modify immutable runs or invent historical provider calls.

PASS: activity_log_no_hydration with 25 persisted runs and multi-megabyte raw
payload, blocked blob reads plus a positive full-reader control, legacy inline
fixture, repeated bounded reads, newest ordering, unchanged immutable checksum,
all 25 historical identities and explicit malformed-timeline failure. First
positive-control assertion expected an unwrapped probe error; corrected to
verify the real V1_BLOB_INTEGRITY_ERROR and exact probe cause, then rerun.
PASS actual HTTP on both aliases: corrupt raw blob leaves timeline available,
full evidence endpoint still fails closed, tail/scope/order are correct, corrupt
timeline is observable and backend stays healthy. Full checks, typecheck/lint,
production build/release smoke and four rendered E2E cases also passed (29.8s).

Limits: each persisted metadata JSON is still parsed; legacy runs with inline
raw bodies can therefore still require large reads. Other full-run consumers,
global summary/header-cache scaling, long memory/leak workloads, populated live
log UI, monitoring delivery, Settings persistence QA and live deployment remain
open. This removes a demonstrated hydration/retention path, not all memory risk.

## Activity-log failure truth and V1 schema mapping — 2026-10-24

Trace: existing /api/logs/system returns runtime log records; existing
/api/logs/enrichment returns immutable V1 timeline events with at/stage/status.
The old viewer expected timestamp/step/uppercase status, and swallowed failed
fetches into an apparent empty result. A new real-browser regression failed on
the old compiled code because no failure message was rendered after HTTP 500.

Viewer now shows loading and retryable failure separately from valid empty and
search-no-match results. It does not expose raw server errors or invent a zero
entry count when unavailable. Previously loaded entries can remain visibly stale.
Requests have a 30s deadline and abort/identity cleanup on refresh, tab change and
unmount. V1 at/stage and failed status map to timestamp/stage/ERROR; legacy
timestamp/step remains supported. Unknown values stay explicit. Projected buffer
is bounded at 1,000, final/rendered rows at 500 newest returned events, with bounded
field lengths. Source events and raw research evidence are not modified.

PASS: activity_log_projection uses actual V1TimelineEvent shape plus legacy,
malformed/empty/unknown/10,000-event ordering/bounds and input preservation;
runtime_log_security checks existing file/console/API redaction; full checks,
production build/release smoke and four rendered E2E cases (28.4s total).
The new browser case exercises 500 and malformed-200 errors, unknown count,
real empty refresh recovery, tab switch and search feedback. E2E test mode does
not install the runtime logger, so populated live/system log display is NOT
verified. Actual V1 timeline presentation is projection-tested, not a live-company
run or remote-support delivery test. React guidance informed bounded memoized
search and cleanup; no new logging framework or backend authority was added.

Open: enrichment log API still hydrates complete runs to extract timelines;
this frontend bound does not fix that backend memory path. Provider-toggle
save/restart QA, populated log/race/timeout UI cases, diagnostics architecture,
remote monitoring delivery and all remaining release gates remain open.

## Rendered failure recovery and contact export verification — 2026-10-24

Expanded isolated Playwright coverage to three cases, each with its own backend
process and private storage (one worker, no automatic retries). The earlier
worker-scoped fixture could inherit another test's files; test-scoped ownership
now prevents that contamination. Provider credentials/egress remain disabled.

PASS in actual Chromium UI: file HTTP 500 produces a visible retry state with
no stale buyer rows, fake empty result or injected private server message; an
incomplete HTTP 200 is rejected; restoring the real route and retrying shows
actual page-two Buyer 25. Country HTTP 503 and malformed importer detail both
show errors, then recover from actual backend responses. Failure screenshot
inspected. Only failed/malformed responses were injected, never successful data.
Console HTTP resource errors are retained and narrowly allowed in this failure
case; happy-path cases still require no page/console errors.

PASS rendered Contacts: exporter filter defaults report type to exporter,
explicit importer override works, reopen resets to current exporter scope,
selection/filter survive refresh, selected export defaults correctly and its
downloaded CSV contains Scope Supplier. PASS rendered Country overview cards:
60 importer-country entities, one exporter, $600 for the selected 60-row fixture.
This upgrades earlier source/API-only evidence for these exact scenarios, not
the real dataset or all controls. E2E typecheck and three-case suite passed
(25.8s total on the latest precommit run). Full checks/release smoke also passed.

Read-only live /api/health still reports PID 30112, commit
f96a6da068d44a8ed8d0d51aae4b017f96db3038, build
2143be7901f9d1806144f63311d99255e1be624d7fc61e2d272ca274b2e5a973.
It is NOT this branch's newly tested build. No Qoder-owned live server was
restarted or replaced. The prior GitHub status connector query returned 404;
hosted CI remains unverified. Historical exporter count discrepancies, real
enrichment, offline-while-open, races, settings/diagnostics and remaining release
gates are still open.

## First actual isolated rendered workflow — 2026-10-24

Added pinned development-only @playwright/test 1.64.1 (Apache-2.0, Node >=20;
CI Node 24). No application framework replacement or frontend dependency added.
One worker, no automatic retries, strict CSP retained, failure screenshot/trace
and console/page-error attachments, successful screenshot/build identity.
The compiled backend uses owned temporary storage, an OS-only environment
allowlist and a child-only HTTP(S)/fetch deny preload. Browser page traffic is
limited to its owned test origin. PID verification precedes mutations. No real
provider credentials, real dataset, live port-3901 server or paid run is used.

PASS locally: actual Chromium UI startup/upload of synthetic 60-row CSV, page 2
(Buyer 25), full CSV download with all 60 rows including Buyer 59, Enter/Space
country/importer expansion and rendered supplier, tab refresh and selected-file
persistence through a backend process restart. Successful screenshot inspected.
This is real rendered E2E evidence, NOT manual/live installation visual QA.

First run failed because the test expected HTTP 200 rather than the API's
correct 201 Created; corrected to exact 201. Second reached all workflow steps
but caught a connection-refused console event while we deliberately stopped the
backend under an open polling page. The restart scenario now closes the page,
restarts, and reopens in the same context; offline-while-open is a separate open
test, not a whitelisted error. Rerun passed (8.0s test / 11.5s total), with no
page/console errors. Build-ID and commit-shape assertions were added afterward.

PASS: E2E typecheck, existing full check, production build/release smoke,
production npm audit high gate (two existing moderate UUID/ExcelJS findings).
Windows CI browser job and synthetic evidence upload are configured as an
additional publish prerequisite; hosted result remains NOT VERIFIED until run.
See docs/BROWSER_E2E.md for official references, isolation and remaining scope.
Not exhaustive: settings/diagnostics, contacts/research/provider failures,
race/cap tests, scroll/page/accordion persistence, accessibility audit, long leak
testing, live-company truthsets, installer/update and clean-Windows gates remain.

## Country drill-down failure boundaries — 2026-10-24

Country/importer detail loaders validate response shapes and numeric fields,
encode scope identifiers, use a 30s deadline, and distinguish genuine empty data
from transport/schema failure. Failed requests cannot synthesize empty/partial
details from metadata-only browser rows. Complete scoped local copies retain
the existing fallback. UI exposes retryable error states. At most four detail
operations (a country operation has two HTTP calls) are in flight; duplicate
opens share the pending operation. Unmount cancels pending work and prevents
obsolete completion updates. Importer keys use unambiguous namespaced tuples.

Country/importer headers now have button roles, focusability, Enter/Space
activation, aria-expanded/labels and visible focus styling. These are source
changes, NOT a claim that actual keyboard/browser behavior has been exercised.
PASS: country_details synthetic success/encoded scope/malformed/500/offline/
zero/empty/timeout/cancellation, actual backend country/importer loaders in the
isolated stored_file_export fixture, npm run check, build/release smoke.
NOT VERIFIED: real rendered retries, request-cap behavior, unmount races or
keyboard interaction. Broader country export partial-row fallback and plain
object country-name cache key edge cases remain for independent investigation.
Visual QA and all other outstanding production gates remain open.

## Country overview uses its actual dataset scope — 2026-10-24

The existing /api/countries route now supports overview=1, returning the list
and aggregate cards from the same normalized backend rows. Legacy list callers
are unchanged. Importers are name/country entities (as in existing drill-down),
exporters are unique names across the scope, value is the sum of stored trade
rows, and zero is distinct from unavailable. No per-file summary counts are
blindly added into a fake unique global count.

CountryView uses that compact overview without loading row bodies. A selected
metadata-only file no longer falls back to another file's rows. Local fallback
requires all rows of every scoped file, proven against summary row counts.
Missing/incomplete overview gives a retryable unavailable state, not fabricated
zero. Initial request has a 30s deadline and abort cleanup. File-scope changes
remount file-specific country/importer caches rather than reusing another file's
drill-down state. Stable empty props avoid an effect refresh loop.

PASS: country_overview denominator/dedup/zero/unknown/schema and scoped static
markup; actual isolated overview API selected/all/empty/missing-file and legacy
list compatibility in stored_file_export; full check, build and release smoke.
The first all-files API assertion exposed built-in demo data in the isolated
test process; fixture setup now clears that owned process's demo files before
seeding, and the exact test passes. No production dataset was modified.
NOT VERIFIED: rendered cards or scope-switch interaction. Country/importer
drill-down network-failure fallback and keyboard access remain open; this slice
does not claim the entire Country view is audited. Existing normalization and
stored duplicate trade-row semantics are preserved, not reconciled here.
React guidance influenced stable defaults, memoized aggregates and scope keys.

## File page failure/loading/count truth — 2026-10-24

FileViewer now associates each server page with its exact file/filter/sort/page
request and retry generation. A changed request cannot render the previous
page's rows; obsolete requests are aborted and cannot replace current state.
Loading, failed and genuinely empty pages are distinct. A 30-second deadline
ends stalled loads and a Retry page action is available. Failed responses do not
expose arbitrary server error text. Both pagination labels use the effective
server count rather than sorted browser-local rows (previously zero).

The page boundary validates rows, exact page length/count and filter options;
an incomplete 200 response is a visible failure, not an empty-success fallback.
PASS: file_page_loading synthetic malformed/partial/500/offline/timeout/abort
cases and initial static FileViewer loading markup; stored_file_export now also
loads actual API page two (rows 25–49 of 17,612) through the new loader; full
check/build/release smoke. Initial typecheck caught union-narrowing/test promise
typing mistakes; corrected and rerun. No real browser interactions verified.
Remaining: rendered retry/navigation race QA, refresh/scroll persistence,
country totals/accessibility, full UI inventory and other release gates.

## Official-page phone recall corrected — 2026-10-24

Reimplemented the useful phone-recall portion of QA reference f527fe1, without
its unrelated selection/batch changes. Deterministic projection now accepts Cell
labels and unlabelled international numbers from successful resolved official
pages, including markdown-only content. Third-party profile attribution remains
restricted. Phone patterns cannot consume a date/postcode on the next line;
fax labels, wrong-country numbers and oversized numeric sequences are rejected.
Overlay version is 18 so historical projections can recompute from retained raw
evidence; no data was injected into operational records and no paid run started.

PASS: official_phone_recall (six expected unique channels plus adversarial
negatives), search_snippet_email_admission, historical_evidence_preservation,
official_page_body_budget, npm run check, production build/release smoke.
NOT VERIFIED: fresh Surgilinks or other live company run, resulting API/UI
display, the full importer dataset, or whether COMPLETE adequately communicates
coverage. This is projection recall improvement, not proof of exhaustive search.

Exact prior f6faae98cedf5c2331f25062636f6ac31ba3d2d8 package check passed
manifest/unchanged staged and extracted launch checks; build
e27188d3b237776f7bfc31d8dff89c074526d4c6d2da6bc96efcf45ceefc8e2d,
disposable ZIP SHA256 be59a28484c49f285d4a64e71e28efb93eefab1ced4e2ca6f5e44907b14327c8.
It remains a developer ZIP requiring Node/npm, not clean-Windows acceptance.
Supported Computer Use initialization was retried and failed before enumeration:
`failed to write kernel assets: The system cannot find the path specified. (os error 3)`.
No permission UI or browser control was obtained; visual QA remains open.

## Contact report defaults aligned — 2026-10-24

Both Contacts export actions now carry the current scope: Exporter -> exporter,
Importer -> importer, mixed/research filters -> both. The modal mounts a fresh
dialog per opening/scope, avoiding a stale previous report choice without a
state-reset effect. Explicit report choice remains available. Persisted contact
selections were not removed. Report buttons expose their selected state.

PASS: contact_export_scope (request defaults/override/selection and static React
markup), stored_file_export (actual isolated HTTP, 17,612 rows and five formats),
npm run check, production build and production release smoke. The first typecheck
caught test union-access errors; these were corrected and the full check rerun.
NOT VERIFIED: browser reopen/change/click behavior, downloaded report appearance,
the historical 633-versus-626 exporter discrepancy, or deployment on port 3901.
The React skill guided keyed state reset rather than effect-driven state drift.
This closes a narrow default-selection defect, not the full export/UI gate.

## Full stored-file export round-trip fixed — 2026-10-24

QA reference 948bcfe identified a useful server-owned export direction but was
not cherry-picked wholesale with its interdependent UI/scope changes. This branch
now wires FileViewer Export Full -> GlobalExportModal -> compact request builder
-> POST /api/export/file/:fileId -> exact db.files rows -> existing export manager.
No full-row prefetch or re-post through the browser; the 5 MB JSON limit stays.

Unlike the reference candidate, this endpoint enforces files-only authority and
rejects any client rows, selections, filters or unknown override fields. Missing
or empty files do not fall back to global data. Client selection/filter mixtures
fail visibly rather than silently exporting a wider file. Existing contacts and
filtered export request semantics remain unchanged. New route shares the export
admission budget and uses safe filename headers/validation and sanitized errors.

`stored_file_export.test.ts` uses an owned isolated actual server and synthetic
17,612-row file whose JSON exceeds 5 MiB, plus a separate sentinel file. Request
under 1 KiB produces all 17,612 CSV rows including the last, never the sentinel.
Oversized legacy request still gets413. Tests cover override rejection, missing
file, all five formats on a small file, generic contact selection compatibility
and actual modal initial markup showing the server record count without rows.
This is source/API/initial-render evidence, NOT a browser click/download proof.

Focused test, typecheck/lint/V1 suite, build and production release smoke passed.
No runtime/data changes on Qoder's original workspace or live installation.
Report column formatting stays the existing canonical full-dataset format;
lossless original-file backup/all-original-column export is not claimed. Browser
verification, very-large export concurrency/memory and live deployment remain open.

## Recovered work and privacy projection — 2026-10-24

Reopened available Advice 7/8 chats and compared the earlier reconciliation
against actual branch history. Updated RECONCILIATION_2026-10-10_23.md with dated
evidence instead of erasing old unfinished rows. Connector pages are bounded;
complete October 10–18 turn-by-turn retrieval is still NOT VERIFIED.

Latest coordinator QA reports unresolved full-file export/5 MB request failure,
duplicate pagination totals, contact-report scope mismatch, phone recall with an
overstated COMPLETE label, and missing country totals/keyboard semantics. The
separate QA worktree already has mixed uncommitted fixes touching these areas.
Do not duplicate or bulk-copy them. Its findings are attributed QA evidence,
not this writer's own browser pass. Reconcile/review coherent fixes when ready.

An isolated vendor-neutral boundary now exists in shared/monitoring_privacy.ts.
It builds new frozen, null-prototype output from fixed event/enumeration codes,
bounded numeric metrics and separately supplied build/installation metadata.
It drops arbitrary properties/messages, exception bodies/stacks, URLs, headers,
prompts, contact/business records and property-supplied operation UUIDs. Fixed
error messages retain useful error grouping without copying exception text.
Review found final-newline and UUID-provenance gaps; tests cover their correction.

Data egress classification for this boundary:

| Classification | Fields/policy |
|---|---|
| LOCAL ONLY | Complete local errors/evidence remain local; projection does not mutate them. |
| SAFE TELEMETRY | Fixed product-event/provider/stage/outcome/error codes; bounded HTTP/timing/resource numbers; validated build/version/channel. |
| PSEUDONYMOUS | Installation UUID from a trusted local protected-random identity authority; syntax validation here does NOT establish provenance. |
| SENSITIVE | Dataset/company/job identifiers, business totals, raw errors and paths: not accepted from event properties. |
| NEVER TRANSMIT | Credentials/tokens/cookies, contacts, raw files/rows/evidence/provider bodies/prompts, raw HWID. |

Focused adversarial tests retain approved metadata (empty-output implementations
fail utility acceptance) and reject private markers, malformed/newline identity,
unknown/inherited codes, UUID-shaped business IDs, getters/toJSON, revoked proxies,
numeric boundary violations and deeply nested inputs. Arbitrary JavaScript Proxy
trap execution is not sandboxed; thrown errors fail closed. Identity provenance
is a caller prerequisite, not a claim of this pure projection.
The same provenance requirement applies to numeric measurements: a type/range
check cannot identify a phone number relabeled as RAM. Real integration must use
trusted resource/timing collectors, never arbitrary provider/business objects.

Status: privacy MODULE PARTIAL for full monitoring. No SDK imports, initialization,
credentials, network activation or product call-site wiring added in this slice.
Re-ran the original Qoder adapter probe read-only: same source SHA256
1c6ed5e7eef5f83213b7c7efc35e9036ebd3dabee6c2822b417aab2b31dcd15b,
all nine leak probes still FAIL. Do not enable it. Final SDK envelopes/batches,
automatic errors/logs/traces, replay-off enforcement, bounded offline transport,
actual Sentry/PostHog delivery and Diagnostics UI integration remain unfinished.
Focused projection test, typecheck, existing V1 suite, build and production
release smoke passed for this slice; no rendered or remote-delivery PASS implied.

Recovered requirements are still open, in acceptance order: actual enrichment
recall/provenance and scope/UI fixes; full export behavior and rendered QA;
privacy-safe integrated monitoring; restore/crash/performance/long-run gates;
self-contained Windows installer, trusted update/acceptance/rollback/signing;
exact three final artifacts, clean Windows and Stable end-user deployment.
Earlier all-provider/unbounded-research ideas are superseded by current bounded
V1, not abandoned features to resurrect. No release readiness claim.

## Parallel ownership and parser dependencies — 2026-10-24

Owner confirmed Qoder writes only the original Pharma-AI workspace and
`edgeview-chatgpt` is exclusively ChatGPT's worktree. Resume this branch without
editing or merging Qoder's dirty tree. Existing commit 0652b15 was independently
inspected/tested and retained, not recreated. Its focused AI destination,
connection binding, diagnostic-payload and credential-origin checks pass.
Real unauthenticated model endpoint checks previously reached NVIDIA (200)
and Groq (401); this is NOT verification of saved credentials or live UI.

Production audit newly failed on body-parser1.20.8 (GHSA-27r3-jxmh-p828) and
multer2.4.0 (GHSA-q7qp-rjg7-q26m). Narrow refresh keeps Express4.22.3, resolves
body-parser1.20.9 and multer2.5.0, and raises the direct Multer floor. Current
upload filter is synchronous, so the Multer advisory's asynchronous-filter
prerequisite was not demonstrated in EdgeView. No forced ExcelJS downgrade.

The compiled-server release smoke now sends valid gzip/deflate (must reach
routing), compressed frames plus trailing garbage, and a staged deflate request
whose trailing bytes arrive after the response begins. After delayed decoder
errors it checks server liveness. These follow upstream failure classes; the old
package crash was not independently reproduced before upgrading. Independent
review prompted the staged-timing and stricter valid-frame controls.

Local `npm ci --ignore-scripts` FAILED on a Windows-locked Rollup native file and
temporarily left dependencies incomplete. `npm install --ignore-scripts`
repaired them successfully, with a leftover locked cleanup-directory warning.
After repair: installed versions verified, typecheck/lint/V1 suite, upload HTTP
regressions, build and expanded production release smoke PASS. Production audit
at high threshold PASS, but two MODERATE uuid/ExcelJS findings remain. Clean
reinstall on this workstation is not marked PASS; hosted clean-install evidence
for the new commit remains pending. No live app restart or production-data
change was performed. Windows customer/runtime/visual/update gates remain open.

## Migration recovery retention reconciled — 2026-10-23

Frozen Qoder pruning was reimplemented, not copied: it ran before migration
success, hard-coded `edgeview.db` and followed links. The active branch previously
had no pruning. New retention runs only when this initialization created a
backup AND the migrated database was durably written, reopened, integrity-checked
and schema-checked. Keep immediate recovery plus two newest other exact numeric
backup names for the actual DB basename (timestamp/name deterministic ties).
Current-version restart does not prune. A failed schema/write/reopen attempt
does not delete any recovery image. After a later successful migration, older
failed-attempt images may be pruned: filenames do not permanently classify them.

The helper skips linked ancestors, junctions, hard-linked/nonregular entries,
malformed/unrelated names; rechecks file identity before unlink. Cleanup failures
are counted/warned without failing a successful migration. This is not protection
against a malicious concurrent Windows-account filesystem writer or power-loss
certification.

New `migration_backup_retention.test.ts` runs actual sql.js migration/reopen with
alternate metacharacter basename, preserved legacy row/bytes and more than three
backups, plus schema failure, controlled ENOSPC write failure, reopen denial,
current-schema restart, ties, junction/hardlink boundaries and deletion denial.
Passed alongside existing initialization safety test, typecheck/lint/V1 suite,
build and production release smoke. CI explicitly runs the new regression.
No production database was changed. Full restore transactionality, crash/power
recovery, installer rollback and clean-Windows verification remain open.

## Shared export admission budget — 2026-10-23

The prior compiled app allowed repeated GET export generation outside the
mutation budget; the new release regression failed on that behavior before
implementation. All `/api/export` formats/methods and the importer-statistics
CSV export now share a fixed 24-request/60-second process-local budget before
generation/body parsing. Counter storage is constant-size; failed/unsupported
requests in these export namespaces also count. Restart resets the budget.

Independent review discovered an initial double-slash stats-mount bypass.
The corrected guard mirrors the nested Express mount, and compiled-server
tests now cover that bypass, uppercase/trailing aliases, encoded importer,
GET/HEAD/POST/OPTIONS, shared exhaustion, structured 429/Retry-After, ordinary
CSV/stat downloads and unaffected health/file reads. All five unified download
formats remain checked by the same release smoke. Typecheck, lint, V1 suite,
build and expanded release smoke passed. Timed window rollover was inspected
in source, not exercised by waiting a real minute. This is admission throttling,
not proof of concurrent-export memory safety or long-duration load stability.

## Missing/ambiguous Host rejection — 2026-10-23

Raw HTTP against the previous compiled app reproduced missing Host acceptance
(HTTP 200). First global middleware now requires exactly one raw Host header
and an exact allowed local authority; optional absent Origin remains supported.
Independent security review found no blocking bypass/regression. This closes
an admission-policy gap, not demonstrated browser credential theft.

Expanded production release smoke exercises HTTP/1.0 and 1.1 absent/empty Host,
duplicate mixed-case header names in both orders, absolute-form and OPTIONS
asterisk targets, allowed local authorities, foreign authorities and null Origin.
Typecheck/lint/V1 suite/build/release smoke passed. These are isolated compiled
server checks, not live browser QA. Default loopback binding is source-inspected;
the existing HOST environment override remains and was not changed here.

Supported Windows and browser QA initialization both retried and failed before
session enumeration with `failed to write kernel assets: The system cannot find
the path specified. (os error 3)`. No permission UI appeared. Passive live health
still reports PID 30112, frozen workspace, commit f96a6da and build
2143be7901f9d1806144f63311d99255e1be624d7fc61e2d272ca274b2e5a973:
recent branch fixes are not yet deployed there. Do not label this live QA PASS.

## Upload filename boundary — 2026-10-23

Reproduced bare `csv` acceptance on all four multipart aliases before changing
the shared router. Exact multipart names now require a supported real suffix;
paths, controls, trailing Windows-normalized characters and reserved device
names are rejected before buffering/parsing/hash lookup/persistence. No filename
trimming or silent path repair. Legacy multipart clients sending a full
`C:\fakepath\...` name are deliberately rejected; modern browser File names
remain supported.

`upload_extension_validation.test.ts` exercises the actual shared HTTP router
on all four aliases, unchanged JSON/SQLite/in-memory state after rejection,
ordinary and extended multipart filenames, Unicode, valid CSV/NVL/XLSX,
deduplication bypass attempts and malformed XLSX. Focused test, typecheck,
lint, V1 suite, build and production release smoke passed. CI runs the focused
test explicitly. This is not browser upload QA or a clean-Windows gate; those
remain open. The frontend bundle-size warning remains unresolved.

## Ownership resolved; official-page capture and contact UI — 2026-10-23

Owner identified the earlier concurrent writer as the coordinator/QA ChatGPT
conversation and explicitly stopped its repository writes. ChatGPT Desktop is
sole writer; coordinator is read-only QA. The three handed-over diffs were
inspected separately, not bulk-committed. Earlier writer-block notes below are
historical. Frozen Qoder workspace remains untouched.

- 49a5449: successful search evidence only for snippet/domain projection;
  snippets must contain official-domain/subdomain emails, not arbitrary free-mail.
  Official-page published free-mail remains supported. Adversarial failures were
  reproduced before correction. Hosted release checks run 39923794099 completed
  SUCCESS, Docker/verify SUCCESS, publish SKIPPED. This is not release acceptance.
- 584d0b5: retained useful coordinator proposal with fixes. Generic direct reads
  remain 2 MiB; resolved official crawl gets 4 MiB only on matching domain/hops.
  External redirects fall back to 2 MiB. Page count, deadlines, DNS pinning and
  private-address rejection are unchanged. Every direct attempt now has its own
  response/failure and normalized-result reference; the regression exposed prior
  suppression of the second failure when a URL was attempted twice.
  Synthetic actual-engine/transport/storage/projection regression covers 3.67 MiB
  tail contacts/leadership, exact 4 MiB, declared/chunked/multibyte overflow,
  cross-domain and subdomain redirects, private DNS, repeated failures and 503
  response bodies. Existing outbound/crawl regressions passed.
- 8be3f04: shared classification makes summary, Contacts filters and bulk retry
  agree. Pakistan exporters are excluded even if historical research exists;
  All Companies/export still retain them. Excluded summary dispatches EXCLUDED,
  not UNRESEARCHED. Summary actions are keyboard-native buttons. Explicit saved
  ENRICHED selection survives remount instead of being migrated repeatedly.
  Actual isolated summary API, initial rendered row matrix and callback tests
  passed. Categories measure retained state, not verification of contact truth.
- e626e4d: separate directory pagination recovery with fixes. At most 100 rows
  are projected/rendered; country boundaries do not drop/duplicate rows. Page is
  restored from a versioned UI preference, not reset on every data replacement;
  loading cannot overwrite it before rows arrive. Empty/invalid/denied-storage
  initial rendering covered. Country header distinguishes page count from total.
  Browser navigation, refresh effects and scroll position remain NOT VERIFIED.

Live transport check using the engine's existing headers on this date: Emerchemie
homepage HTTP200/3,675,830 bytes; contact-us.php HTTP200/3,668,585 bytes;
leadership.php HTTP200/3,677,672 bytes. All fit the new ceiling. A preliminary
request without those engine headers returned HTTP406; this is not hidden as
successful content retrieval. No manually fetched data was injected into EdgeView.
These checks do not prove live enrichment, accurate company projection or UI
display. Final-URL/source attribution remains a separate open provenance review;
body-budget scoping is not full redirect-origin trust verification.

After the final UI changes: typecheck/lint/V1, build and isolated release smoke
passed. Focused official-body, contact-scope, directory-presentation and actual
summary/export endpoint tests passed on e626e4d. Exact clean e626e4d package QA:
buildId 5f1d485f95944f83824398badfad4f98b23e6f6f14c95abdbb97dae1144763f3;
manifest 147 files, staged/extracted unchanged-launch PASS, private-state filename
check PASS. Disposable ZIP SHA256
885d5bd1c346db7d29bf2416cef5792ecc188ab3f0b7cab49708b65067e14a77.
117 developer files remain; installed Node/npm required. NOT customer distribution,
not a content secret scan, not clean Windows or browser acceptance. The 514 kB
client chunk warning persists; no leak/performance clearance is implied.

Remaining gates are not removed: upload filename correction/tests, frozen security
and recovery work, telemetry privacy and real delivery, rendered QA/truthsets,
live deployment identity, real importer reconciliation, installer/update/signing,
clean Windows and uncle deployment. Verdict remains NOT READY.

## Sole-writer handoff and package QA — 2026-10-23

HTML export recovery: de8aeb3 contains only the renderer, exact route/import/error
hunks, focused helper/actual-endpoint tests, and their two CI lines. Useful frozen
renderer/layout recovered with fixes: parsed HTTP(S), pre-trim C0/DEL rejection,
five-character HTML escaping, noopener/noreferrer. Endpoint regression failed
against the old route on executable markup and passed after the patch. Actual
isolated source-server test covers fields, quotes, schemes, controls, multilingual
text, headers, filtering/empty selection and sanitized failure. Broader check,
build and release smoke passed during development; downloaded rendering remains
NOT VERIFIED. Supported Computer Use initialization retried and still failed
before window enumeration: kernel-assets os error 3, no permission UI.

An unrelated external edit appeared in active server/job_manager.ts during these
checks. It was left untouched, unstaged and excluded from de8aeb3; owner asked to
stop any other writer. Its contact-admission change is not accepted or verified.
Therefore whole-tree/exact-commit packaging acceptance must be rerun once the
tree is reconciled; do not attribute the mixed-tree broad checks to a clean
release commit. No edits were made in the frozen Qoder workspace.

Qoder retired by owner instruction. Active source authority remains the
chatgpt/release-reconciliation-20261023 branch in edgeview-chatgpt. Frozen Qoder
workspace remains read-only at ef1c074 with eleven modified and eleven untracked
files; none bulk-imported. Earlier parallel-ownership notes below are historical.

e2ddbb4 adds isolated developer-package QA. Exact tested source and limitations
are recorded in ISOLATED_PACKAGE_QA.md. Manifest (143 files), staged/extracted
unchanged-launch checks and private-state filename exclusion passed. Customer
distribution remains OPEN: 113 development files, installed Node/npm required.

Vite dependency remediation candidate raises the npm minimum to ^6.4.4 and lock
to 6.4.5. Clean npm ci completed; installed bytes now report 6.4.5. Before clean
installation, npm metadata misleadingly reported the new version while actual
package bytes remained 6.4.3; initial checks/build are not upgrade evidence.
After clean installation: installed/lock regression, high-threshold production
audit, typecheck, lint, V1 tests, production build, isolated release smoke and
build-recovery test passed. Audit still reports two MODERATE ExcelJS/UUID entries;
no force downgrade applied. Historical bun.lock remains stale and is NOT an
approved/reverified installation path. No live deployment/browser/clean-machine
acceptance is implied. Telemetry privacy failures and other release gates remain.

## Parallel release reconciliation branch — 2026-10-23

Exclusive worktree edgeview-chatgpt; branch
chatgpt/release-reconciliation-20261023. Main/Qoder dirty files untouched, no
merge/live restart. These branch commits require review/integration and do not
certify deployed behavior:

- b6b8cdc: Oct10–23 matrix in RECONCILIATION_2026-10-10_23.md. Git begins Oct19;
  bounded earlier chat/report coverage explicitly incomplete.
- e877303: independent license inventory/security evidence workflow and
  Dependabot configuration. Default-branch activation/security entitlement not
  inferred. Metadata warns for unknown/copyleft, no legal approval.
- b244158: bounded A–K evidence-reference checker; hashes/gates cannot grant
  release acceptance. Synthetic adversarial tests passed.
- 275fc01: MSIX/update decision record identifies root-writable state and
  Node/npm-dependent ZIP blockers; not an installer or tested rollback.
- 1448db1: read-only offline probe of Qoder telemetry source SHA identifies nine
  synthetic privacy leaks. Do not enable customer telemetry until strict boundary
  and SDK envelope/delivery acceptance. See OWNER_SUPPORT_PRIVACY_HANDOFF.md.
- 42ed139: hosted inventory success at275fc01, but Windows audit failure;
  current production-lock audit reports1high/2moderate (Vite6.4.3/uuid/ExcelJS).
  Qoder owns dependency remediation; audit thresholds not weakened.
- f486754: bounded exact-version license-text collector/tests;397entries with
  legal files/16without/101not installed. This is not complete notices or runtime
  inventory. See LICENSE_TEXT_EVIDENCE.md.

Live GET health now reports PID30112, build commit f96a6da and buildId2143be79…;
newer source fixes are not certified deployed. Computer Use still fails during
kernel initialization before app selection. See LIVE_RELEASE_DRIFT_2026-10-23.md.
ResearchWorkspace async selection/error UX now has a branch source fix and
focused request/initial-markup regressions; check/lint/V1/build/isolated release
smoke passed. See RESEARCH_READ_RECOVERY.md. Actual rendered interaction,
integration, live restart and package verification remain unverified. All A–K,
real-company UI truthsets, clean Windows, updater, monitoring account delivery,
private data separation and uncle deployment gates remain open. NOT READY.

## Working-tree cleanup slice D — run-cache truncation removed — 2026-10-23

Reviewer verdict: do not ship current cache truncation. Removed, not redesigned:
`MAX_V1_RUN_CACHE_ENTRIES`/`trimRunCaches()` never entered git and are now
absent from the working tree entirely. The original concern understated the
defect: `listV1RunIdentityHeaders()` rewrote identity-index.jsonl from the
truncated in-memory array, which would have permanently dropped discovery
history past 5000 entries — worse than a RAM bound. Run caches are again
whole-process indexes over the immutable per-run files, matching pre-cleanup
behavior. Unbounded-growth risk is accepted until a redesign that bounds memory
without losing discovery is independently reviewed. Verification: grep confirms
absence across the repo; typecheck and focused v1_requirements, v1_blob_storage
and v1_atomic_persistence tests pass. No commit contains D hunks; the upcoming
slice B commit on server/v1_engine.ts is the reviewable proof of absence.

## Delimited-text allocation boundary — 2026-10-23

CSV/TSV/TXT and analogous text NVL now reject fields beyond 512 columns during
tokenization and charge padded row width plus 24 alias/default slots before row
construction against a fixed two-million-cell budget (also 100,000 row ceiling).
Limit errors propagate through NVL fallback catches and return no partial rows.
The existing upload API returns 422 FILE_PARSE_FAILED before summary/persistence.
Rejected limits require splitting the input, not silent truncation. These are
local deployment safety limits, not a claim of unlimited file size or scale.

Parser-only regressions passed for oversized headers/later rows, cell-budget
exhaustion, CSV/TSV/TXT/NVL propagation, duplicate/empty headers, quoted delimiters
and all 17,432 synthetic trade rows. Existing deduplication/grouping tests passed.
Independent boundary investigation and one fresh patch review found no concrete
surviving scoped issue. Typecheck/lint/V1/build passed. The new release fixture
initially used its request helper before initialization; corrected and rerun:
release smoke passed, including 422 and unchanged persisted file list. CI runs
the focused parser suite. No live dataset/provider request was used for this fix.
Binary DBF and compressed XLSX/DOCX expansion are separate unverified boundaries;
this change does not claim to remediate them or improve existing CSV syntax.

## Export path boundary increment — 2026-10-23

Contact ZIP exports no longer incorporate download names into filesystem paths.
Request and direct-processor validation reject separators, drive/ADS syntax,
controls and Windows-invalid filename characters. Each export owns a unique
temporary directory with opaque exclusive filenames; logical Unicode ZIP names
are retained separately. Outer finally cleanup includes partial writes.
Focused regression covers malicious prefixes, direct entry points, concurrent
isolation, partial-write cleanup, outside-file preservation and readable archives
for all four contact report modes plus full-dataset export. Synthetic empty trade
indexes avoid production history/provider access. Independent patch review found
no concrete surviving bypass/regression. Typecheck/lint/V1, production build and
release smoke passed. These are not rendered download/browser tests.

Supported Windows Computer Use initialization was retried on 2026-10-23. The
JavaScript host failed before app enumeration with: `failed to write kernel
assets: The system cannot find the path specified. (os error 3)`. No permission UI
or screenshot was returned; no bypass/alternate-port approach was attempted.

## Paginated export increment — 2026-10-23

Filtered export now uses server result count rather than the empty metadata row
array and explicitly collects every matching page with the active search,
country/importer/product/date filters, grouping and sort. Collector-owned paging
bounds override caller parameters. Country reports load each selected source
instead of substituting unrelated cached rows; page failure stops before opening
the export modal. Full-file export also stops visibly on fetch failure. Busy
states prevent repeat submission during collection. React review kept this work
in click handlers (no automatic fetch effects or new polling).

Focused paging tests exercise 1,503 matching rows, preserved Unicode/filter/sort
parameters, paging overrides, failed/empty/changing responses and unchanged caller
options. Typecheck/lint/V1/build/release smoke passed. Actual button clicks,
large-dataset browser memory and rendered downloads remain unverified because
Computer Use initialization fails before app enumeration. No enrichment/provider
calls or production records were changed by these export tests.

## Continuation directive intake (sections 0–28)

The 096e1b20 and e3289d42 continuation attachments are additive and equivalent
work packages, not proof of a current deployment. Preserve e8a73d5 npm-policy
isolation. New regression covers real offline npm with inherited allow-scripts,
unrelated user/global npmrc, missing config and restart; existing recovery tests
also cover partial installations, stale/corrupt markers and wrong/corrupt package
metadata. No production dependency reinstall is required for these fixtures.

Execution order: finish launcher verification/package; then extend existing
SystemHealthPanel/runtime metrics/doctor through one shared diagnostics authority,
including actual bounded resources and build identity. Sections 5–12 require
source-to-runtime-to-render evidence, safe log export and explicit unsupported
metrics. External monitoring (8–10) requires privacy-reviewed optional adapters,
no default replay or private-data transmission; unconfigured is not successful.
Sections 13–19 remain installation identity, DB restore, failure UX, bundled-runtime
clean-VM distribution, safe updates and measured long-run performance work.
Sections 20–25 add current-HEAD security/CI/license review, real-company truthsets,
normal-UI importer workflow and crash/shutdown recovery. Sections 26–28 preserve
all A–K completion gates below and evidence-backed final reporting.

Supported browser acquisition was genuinely attempted again at user request;
the tool returned a saved-origin permission denial, not an interactive approval
prompt. No alternate browser/port/raw-CDP workaround is permitted. Visual QA is
unperformed pending a supported permission change, not permanently abandoned.

Resource-monitoring increment: Node process/system/filesystem sampler now feeds
the existing health API, doctor and a Settings health panel. Sampling and API
regressions are separate gates; rendered QA and long-run measurements remain
unverified. See docs/RESOURCE_MONITORING.md. The owner closed the backend after
the dependency file-lock blocker; exact locked-toolchain restoration succeeded,
with zero direct-version mismatches. Source checks/build, isolated telemetry API,
release smoke and extracted-package cold install/rebuild passed for ab98219.

Backup increment: failed copies now stay INCOMPLETE until final publication;
existing backend locks and runtime/destination links are refused. Independent
fixtures verify interrupted-copy preservation, manifest hashes, isolated SQLite
integrity/row restore plus JSON/config/evidence retention. The Windows package now
includes the backup command; staged-script regression is a release gate. This is
not a VSS snapshot, concurrent-writer guarantee, production-data restore, portable
credential recovery or completed full crash-recovery audit.

Build-identity increment: source/artifact content digests, version/time/checkout
HEAD and build ID now flow through the build generator, startup-captured backend
health, doctor and Settings' Build identity disclosure. Launcher reuse/rebuild
uses those same digests, including old-timestamp source changes; failed builds
restore previous artifacts. Unit/static-presentation and compiled isolated
restart tests pass. A real deployment restart was rejected by execution policy;
do not relabel the old live process as deployed. Normal owner close/relaunch and
rendered verification remain required. See docs/BUILD_IDENTITY.md.

The extracted build-identity package passed locked installation, API smoke,
production rebuild, rebuilt identity reuse and second smoke on 2026-10-20.
Distribution integrity was checked before the rebuild, not against changed
generated files afterward. Node was preinstalled; clean-machine and visual gates
remain open. Retrying the existing Chrome EdgeView tab again returned saved-origin
denial without an approval dialog; no workaround attempted.

This ledger reconciles the requested work. Source/tests, deployed behavior, and
visual verification are separate gates. Earlier progress reports are not proof.

Database startup increment: corrupt/empty/unreadable operational files are no
longer automatically replaced by an empty database; failed schema initialization
retains original bytes and publishes no intermediate schema image. Legacy fixture
row/backup/integrity/reopen, compiled degraded-health and failed-flush exit tests
pass. Health/doctor distinguish dataset projection from operational readiness.
Source, V1, shutdown, release/history and packaged backup tests passed; this is
not a production migration/restore, full historical upgrade matrix, whole-app
read-only gating or visual failure-UX verification. See docs/SHUTDOWN_RECOVERY.md.

Normal shutdown increment: HTTP intake/job scheduling stop, bounded task drain,
initialized-DB flush, Vite close and lock release at exit now replace immediate
signal exit. Pending-write reopen and compiled production signal-handler/history
tests pass. Windows console delivery, forced termination, active provider drain
and full crash/upgrade lifecycle remain separate unverified gates; see
docs/SHUTDOWN_RECOVERY.md. No live-process control workaround used.

One live diagnostic round verified NVIDIA/Groq model-list connectivity and Serper
search-envelope connectivity; disabled Hunter was skipped. Actual HTTP status
propagation was missing on successes and is now tested in source/API fixtures.
See docs/PROVIDER_VERIFICATION.md; this does not close live deployment, visual
display, generation entitlement, company accuracy or full importer workflow gates.

| Requirement | Current evidence and remaining gate |
|---|---|
| Preserve V1 and remove competing old engine | Active dependency/archive graph checked; retired source archived, not restored. |
| Raw responses/failures and immutable evidence | Requirement, body-bound, schema/failure, blob/integrity tests pass. Real-provider coverage and full UI evidence inspection still required. |
| Correct company/country identity and multiple contacts | Existing deterministic identity/ownership tests. New bounded link discovery follows real contact/management CMS links rather than only guessed routes. Global Pharmaceuticals Pakistan, Thorne Berry, Emerchemie and Slim Pharma need fresh source-to-live-UI comparisons; never inject expected answers. |
| Whole importer dataset and weak/no-contact reruns | Historical jobs report completed, but this is not proof of accuracy or current full scope. Reconcile current real dataset identities/counts, exclude Pakistan exporters, exercise normal UI batch workflow, monitor resource use and review remaining gaps. No promise of retrieving the entire Internet or nonexistent contacts. |
| UI state, no forced Research navigation | Source changes previously made; refresh/restart/tab/selection/scroll behavior needs rendered end-to-end verification. |
| Compact uploader and table space | UploadArea uses compact layout when files exist; rendered layout remains unverified. |
| Every button / ordinary-user QA | Control inventory is in EDGEVIEW_CONTROL_AUDIT.md. Isolated API/export tests do not count as visual clicks. Local-origin browser policy still denies observation; do not evade with another port/browser. |
| Telemetry/logs/provider settings | Runtime/regression checks recorded in control audit. Repeat visible settings/diagnostics checks after latest deployment; do not restore retired scoring controls. |
| Security report findings | Origin-bound stored keys, redirect/timeout guards, whole-key cache digest, rate limits, bounded JSON, log redaction and headers already implemented/tested. Windows credential encryption implemented and isolated restart tested. Live startup migration now verified: config protected, zero nonempty plaintext key fields; .env and historical copies are separate limitations. |
| Exposed credentials | Owner must rotate exposed provider keys and replace them locally. Encryption/redaction is not revocation; do not print keys or revoke working credentials without a safe replacement plan. |
| Dependency advisories | Five moderate rollups previously remain; no claim every dependency is patched. UUID affected-buffer API not reached by application ExcelJS call sites; published sprintf-js fix unavailable at last check. Recheck when dependencies change. |
| Windows launcher/logo/shortcut/package | Existing launcher/package retained. Package checks pass. Verify user's actual desktop shortcut/icon/launch target visually; do not create a second installation authority. |
| GitHub and CI/CD | Private MuhammadAsim8528/edgeview-v1; hosted run 39466064224 for ab98219 passed Windows + Docker QA with artifact uploaded. Tag-gated publishing skipped/not exercised. Backup changes need their own hosted green run; no production-readiness claim. |
| Docker | Non-root isolated QA image built; offline release smoke passes. Not a supported Linux production replacement for Windows DPAPI. |
| Local live deployment | Last read-only check: production backend PID 36216 still owns port 3901 and reports no build identity. New content-identity build is NOT deployed. Owner close attempt did not stop it; process-control restart was policy-denied. Do not infer deployment from source/build/package success. |
| Performance | Prior bounded load checks are documented; repeated large-dataset/browser memory and full enrichment measurements remain. No modest-hardware or million-row readiness claim. |
| Documentation and final handoff | Architecture/control/security/operations/delivery docs exist. Final report must name exact exercised behaviors, provider coverage, limitations and launch steps. |
| HWID/no-cloud concept | Licensing design reconciled to random installation UUID/keypair as primary, optional hardware signal secondary; reuse one protected-storage owner. Design only, no enforced activation or implemented installation keypair. No cloud deployment or multi-user readiness claim. |

All unresolved rows remain release gates where applicable. Do not mark V1 complete
merely because builds, a job counter, or one provider diagnostic passes.

## Master directive intake (39 sections, added 2026-10-20)

This is additive. `EXISTING` means source exists, not that every acceptance test
passed. `PLANNED` is not implemented. Conditional items require the actual feature
or runtime, not an invented Python/WebView/cloud stack. One active source writer.

| Directive sections | Status / bounded task and acceptance gate |
|---|---|
| 1, 2: reuse and OSS acceptance | EXISTING principle; PLANNED dependency/license inventory, adoption record template, production SBOM using established tooling. Evaluate maintenance, advisories, Windows compatibility and distribution license before installation. Flag copyleft before adoption. |
| 3, 35: preserve architecture | EXISTING V1 contract and archive graph; every milestone must retain identity, evidence, canonical state, test isolation and user data. No platform-driven research/storage rewrite. |
| 4: AI/research boundaries | EXISTING constrained NVIDIA/Groq transports, extraction and deterministic admission. PLANNED gap audit of contradiction/provenance coverage. Model planning/information-gain expansion is not permission to restore retired autonomous systems; resolve against frozen V1 before any such feature. |
| 5: frontend | EXISTING React/TypeScript/Tailwind/components; evaluate accessibility/form/table/virtualization needs before new libraries. PLANNED component/accessibility tests where gaps exist. |
| 6: Python backend | CONDITIONAL: no tracked Python implementation/manifest found in active repository. Apply infrastructure/boundary principles to actual Node/Express backend; do not add a duplicate Python owner. |
| 7, 26: desktop/WebView2 | AUDITED: browser + loopback server + Windows launcher; no confirmed native WebView host. WebView2 bootstrap/CDP distribution conditional on future justified host adoption. No Electron/Tauri rewrite. |
| 8: doctor command | PLANNED npm command orchestrating existing checks, PASS/WARN/FAIL/SKIPPED plus JSON, bounded execution and nonzero blocking failures. Identify irrelevant Python checks explicitly. Never mutate production or claim browser QA from API smoke. |
| 9, 10: test pyramid / isolation | EXISTING static/unit/contract/integration/release fixtures and disposable roots. PLANNED coverage map, cancellation/schema drift tests and supported real-interface E2E when browser access permits. Keep live-provider tests opt-in and credit-bounded. |
| 11, 12: observability / diagnostics | EXISTING bounded redacted Node logging/metrics. PLANNED privacy-reviewed diagnostics export and correlation coverage. No duplicate logging framework or arbitrary file read endpoint. |
| 13: crash reporting | PLANNED Sentry evaluation for actual React/Node stack, consent/configuration boundary, release IDs, deduplication, offline-safe operation and scrubbing tests. Secure source-map upload only if adopted/configured; no public private maps. No cloud payloads sent during evaluation. |
| 14: analytics | PLANNED PostHog evaluation and central minimal event schemas, privacy/opt-in design; replay OFF. No trade data, credentials, document content or automatic external analytics activation. |
| 15, 23: traces / performance | EXISTING timing/metrics and limited load checks. PLANNED repeatable cold/warm start, CPU/RSS, UI responsiveness, large-directory and research benchmarks; evaluate OTel only for measured gaps, set evidence-based thresholds. |
| 16, 18: device/cloud identity | CONDITIONAL: no remote identity requirement established. PLANNED pseudonymous random ID/keypair/OS storage/recovery design if licensing/cloud needs it. No raw/HWID hash authentication, embedded secret salt, automatic cloud DB or service-role client keys. |
| 17: local database | EXISTING integrity checks, schema version, migration backup and idempotent migrations. PLANNED transaction/foreign-key/index/recovery audit and restoration tests. Preserve sql.js/JSON authorities until a justified tested migration; evaluate encryption only for a concrete requirement. |
| 19, 20: security/research inputs | EXISTING secret-pattern scan, local-origin guards, bounded requests/uploads, URL safeguards, redaction and evidence tests. PLANNED mature scanner/SBOM/dependency audit integration, names-only environment template, additional injection/parser contracts. Do not mark moderate dependencies patched merely because call sites are currently unaffected. |
| 21, 22: crash/hang recovery | EXISTING ErrorBoundary/provider deadlines; PLANNED top-level boot failure, stalled-worker/cancellation/UI recovery audit, diagnostics/report actions and rendered regression checks. No indefinitely spinning states. |
| 24, 29: release / CI | EXISTING Windows and Docker QA, cold-package checks, checksums and tag-gated delivery. Hosted run 39431744015 passed Windows credential, build, release and cold-package tests; artifact upload rejected a parent-relative glob. Absolute-path step-output correction queued for verification; no release tag until acceptance passes. PLANNED SBOM/audit attachments, signing evaluation, clean-shutdown proof and supported E2E gate. |
| 25: version information | PARTIAL package/API/runtime versions. PLANNED build ID, commit/date/schema diagnostics and report correlation without exposing secrets or machine identity. |
| 27: dev/production separation | EXISTING explicit Vite dev opt-in, static default, CSP and release-HMR tests. PLANNED source-map/debug-port/exposed-bridge audit across actual package. |
| 28: full-app tests | BLOCKED current localhost browser permission. Do not bypass using another browser/port/CDP. PLANNED supported production-runtime UI smoke with isolated storage/mock providers, failure screenshots/traces/console/build correlation when authority exists. |
| 30, 31: issue / research ledgers | EXISTING hardening chronology, control audit and this backlog. PLANNED structured records with symptom/repro/environment/cause/fix/test/commit/date, plus separate entity/source/missed-contact/contradiction quality cases and evidence-derived truthsets. |
| 32, 38: verification / definition of done | REQUIRED all milestones: exact files/checks/results/runtime evidence, warnings and NOT VERIFIED labels. Startup or counters alone do not establish completion. |
| 33, 34: work ownership / milestones | REQUIRED one writer; bounded read-only review when authorized. Finish tests for each logical milestone before new implementation. New requests append here; do not replace unfinished work. |
| 36, 37: read-only audit / roadmap | IN PROGRESS reconciliation in EDGEVIEW_ENGINEERING_AUDIT.md. Existing source/test evidence reused with dates; comprehensive new security/duplication audits are not claimed. Complete applicable audit gaps before broad platform changes. |
| 39: product focus | REQUIRED: infrastructure reuse; custom code concentrated on trade identity, evidence, provenance and product-specific behavior. No new R&D architecture by implication. |

### Execution order

- [ ] M0: Finish current hosted CI credential-transport investigation; retain local
  working app and test gates. Complete new directive's audit/gap report.
- [ ] M1: Doctor command, version/build diagnostics and OSS/SBOM records.
  Baseline doctor implemented and tested: `npm run doctor`, JSON and developer
  `--full` orchestration. Read-only live check and full check/build/release mode
  passed; provider reachability, visual QA, build freshness, independent secret
  probing, resources/Git-state and device identity explicitly remain WARN/SKIPPED.
  Full developer mode is not available in an end-user ZIP lacking test/dev tools.
  See docs/DOCTOR.md; M1 remains open for these gaps and SBOM/version work.
  Standard npm CycloneDX production-lock inventory now generated locally (437
  components), with canonical identity/preservation regression tests and CI/release
  attachment wiring. See docs/OSS_INVENTORY.md. Six missing license metadata records
  and existing MPL-2.0 Lightning CSS family need review; attribution, binary/OS
  inventory and new hosted CI verification remain open.
- [ ] M2: Close security/database/contract/recovery gaps with regression tests.
- [ ] M3: Independent company truthsets and normal-user rendered enrichment QA;
  reconcile all importer scope, weak records and resource measurements.
- [ ] M4: Privacy-safe diagnostic export; evaluate crash/trace/analytics tooling,
  activate nothing externally without a concrete configuration/privacy boundary.
- [ ] M5: Packaged runtime E2E, clean restart/update/restore proof, passing hosted
  CI and factual release handoff. Conditional cloud/device/WebView tasks stay
  explicitly conditional rather than being silently omitted or falsely completed.

## OSS composition directive intake (40 sections + phases A–K)

Added 2026-10-20; additive to every preceding requirement. Engineering strategy is
**compose proven OSS/platform capabilities with custom EdgeView domain logic**,
not "dependencies only as a last resort" and not "a package for everything".
Reuse good existing implementation first; evaluate maintained libraries/repos,
public APIs and legally adaptable implementations before substantial generic
infrastructure. Do not automatically install the named examples.

For EACH subsystem review below, record these eight fields before selection:
existing implementation; available OSS/platform options; selected approach; why;
license/attribution; integration plan; security consequences; test plan. Record
upstream version/commit and EdgeView modifications for adopted source. Prior master
directive acceptance rules, SBOM and copyleft review remain in force.

| New sections | Added or clarified task / acceptance gate |
|---|---|
| 1: resource monitoring | PLANNED unified bounded resource service using actual Node/Windows capabilities or a justified maintained adapter. Cover process/system CPU/RAM, uptime/status/children/threads/handles where supported, disk and useful I/O, job/queue/worker/provider/extraction/database timings, failures and cache hits. Unsupported values remain unknown. GPU only if local GPU work exists; no required NVIDIA hardware. Detailed diagnostics rather than a Task Manager clone. |
| 2: installation/device identity | PLANNED local random installation UUID plus mature crypto keypair and OS-protected private storage, update persistence and recovery/reset tests. Raw/HWID hashes are not authentication; hardware signals secondary and never sent raw to analytics. Cloud registration/signed credentials remain conditional on an actual cloud service. This explicitly adds local identity work; it is no longer entirely deferred merely because cloud registration is optional. |
| 3: one secret-store abstraction | PARTIAL existing Windows provider-credential codec; PLANNED assess reuse/extension for device keys and local tokens through one owner, no competing plaintext stores. Distributed client must not contain shared cloud service-role secrets. Preserve current configuration and recovery semantics. |
| 4, 5, 6: crash, analytics, replay | Carry forward Sentry/PostHog evaluations for actual React/Node stack, vendor adapters, correlation/breadcrumb/release IDs, central minimal event schemas and offline-safe delivery. Replay OFF unless separate masking/privacy verification succeeds. No direct vendor calls scattered through product code, no sensitive research payloads exported. |
| 7, 8: logging / tracing | Reuse existing bounded redacted logs and metrics; evaluate mature backing libraries and simplest adequate tracing (Sentry spans/OTel where justified). Add version/operation/job/provider/stage correlation and privacy-reviewed diagnostics export. Python-specific SDK examples do not require a Python backend. |
| 9: SQLite | Carry forward measured index/constraint/transaction/migration/corruption/backup/locking/concurrency/schema audit. WAL only where supported/appropriate to actual sql.js persistence; do not claim native SQLite features are automatically active. |
| 10: optional control plane | CONDITIONAL licensing/registration/update metadata/flags/shared configuration, separated from local research storage. No automatic private-data synchronization or unnecessary PostgreSQL/Supabase migration. |
| 11, 12: runtime / real automation | Current runtime is browser + loopback Node app. WebView2 detection/bootstrap/CDP tests conditional on a real host; do not add Chromium/Python merely to fit examples. Real interface testing must cover production integration, not a standalone dev page. Existing local-origin denial remains a hard visual-test blocker, not permission for raw-CDP/alternate-port workarounds. |
| 13, 14, 15: tests / schemas | Evaluate existing TS test stack plus Vitest/RTL/Playwright/MSW where useful; no homemade test engine. Python/pytest/Pydantic conditional on actual Python code. Validate privileged API contracts, payloads, responses, errors, versioning, cancellation and timeouts using existing or justified mature schema tooling. |
| 16, 17: networking / retries | Retain mature HTTP client/platform fetch and SSRF wrapper. Audit shared TLS, pooling, cancellation, size bounds, telemetry, safe retry classification, attempt cap/backoff/jitter and total deadline. Never indefinite retries or unsafe replay of paid/non-idempotent operations. |
| 18: background work | Audit actual concurrency across parsing, database-heavy work, exports and research; keep UI responsive with appropriate supported workers/task primitives. No distributed queue added without need. |
| 19: safe updates | PLANNED evaluate mature Windows update/distribution compatible with current launcher/package. Require HTTPS, verified metadata/hashes/signatures where possible, versions, atomic replacement, rollback and clear UX. Never execute arbitrary server-returned binaries; preserve active jobs and user state. Existing build-on-launch is not a verified automatic update system. |
| 20, 21, 22, 23: packaging / native / UI / reuse | Inspect actual packaging first, evaluate installer/bundled runtime rather than choose by popularity. Reuse OS capabilities and accessible UI primitives without replacing visual identity. Legally reuse maintained repositories with attribution and acceptance records. No unrelated UI/theme rewrite. |
| 24: security toolchain | Mandatory release dependency audit plus appropriate mature static/secret scanners and update tooling evaluation. Names-only env template, honest severity/reachability triage and unresolved findings; do not disable legitimate failing checks. |
| 25: leak/stress tests | PLANNED long repeated representative cycles with bounded fixtures and trend measurements: memory, CPU, child/process count, threads, handles, connections, listeners, DB state and crashes. Include worker/renderer leaks only where actual runtime uses them. Single idle/RSS snapshot is not a leak test. |
| 26, 27, 28: startup / unified health / doctor | Reuse one canonical health-check set for startup, UI, diagnostics bundles, doctor and tests. Cover runtime, storage/config/permissions/disk, DB/migrations, secrets, providers, jobs/resources/logs/build and identity. Explicitly SKIP nonexistent bridge/WebView/Python features. Human PASS/WARN/FAIL/SKIPPED + machine JSON; nonzero release-blocking failures. Cloud telemetry never required for startup. |
| 29: advanced diagnostics | Extend existing diagnostics with real version/build/schema/runtime/resources/process/provider/cache/worker/error/health information and Copy/Export/Run Health Check. Clear Safe Cache only for explicitly identified recreatable cache, never evidence/DB/secrets; normal destructive-action rules apply. No fabricated registered/healthy state. |
| 30: performance budgets | Measure startup/idle/company/detail/directory/research/database/UI baseline first; then set practical regression thresholds and warn/fail as appropriate. No arbitrary hardware promises or invented budgets. |
| 31, 32: offline / provider resilience | Explicitly distinguish offline, provider outage, auth, quota/rate limit, timeout, server and local failure. Stored intelligence remains browsable where possible. Maintain provider adapters, real timing/success/error/quota/usage states, NVIDIA/Groq routing preferences and no fabricated fallback results. |
| 33, 34: privacy / telemetry boundary | PLANNED data-egress inventory and SAFE TELEMETRY/PSEUDONYMOUS/SENSITIVE/NEVER TRANSMIT classifications, vendor-independent narrow services. Never transmit credentials, private documents/DB rows/full research/prompts/auth material by default. Centralization must not become a giant duplicate telemetry platform. |
| 35: flags | CONDITIONAL mature remote rollout/kill-switch system only if justified. Client-controlled flags must never disable mandatory security protections. |
| 36, 37, 38: backup / crash / shutdown | PLANNED schema-aware backups, integrity/restore validation, interrupted-write/job recovery and stale-lock handling without erasing evidence or marking interrupted work complete. Coordinated bounded shutdown flushes durable state/logs, cancels workers and closes owned children/resources; telemetry cannot stall it forever. |
| 39: lifecycle gate | PLANNED isolated first-start → DB/local identity → representative real workflow → normal close/restart/persistence → controlled crash/recovery → app/schema upgrade/data-preservation test. Use real supported runtime plus controlled providers, never destructive production fixtures. |
| 40: full completion | REQUIRED dedicated phases A–K below AFTER feature milestones, then re-run blocking regression gates following all fixes. "Works", one passing test run, healthy counters or an attractive UI are not completion. |

### Dedicated full-product completion phase (not started / not passed)

- [ ] A — Whole-repository audit: major subsystems, duplicates/dead code, unused
  dependencies, temporary code, TODO/FIXME/debug bypasses, defaults and errors.
- [ ] B — Complete applicable static/unit/component/integration/contract/E2E/
  packaged/migration/recovery/provider/offline/stress/leak/security test execution;
  legitimate failures fixed, not disabled. Explicitly identify irrelevant runtimes.
- [ ] C — Security pass across dependencies, static/secret checks, API/bridge,
  URLs/network, filesystem, device/secret storage, runtime and database; classify
  severity with evidence and resolve release blockers.
- [ ] D — Measured startup/idle/navigation/large-data/research/export/shutdown
  CPU, memory, disk/network, provider and DB profile; regressions/leaks addressed.
- [ ] E — Failure UX: internet loss, DB failure, outage/quota, malformed data,
  renderer/runtime failure, permission denial, disk full, bad configuration and
  unexpected shutdown, all tested safely in isolation.
- [ ] F — Actual distributable install/run: first launch, dependencies, storage,
  identity, resources, optional telemetry, research, exports, updates and applicable
  uninstall behavior. Development checkout success is insufficient.
- [ ] G — Clean Windows/VM gate WITHOUT developer-installed Node/npm/Python,
  developer environment variables, repository, IDE or dev server. **Current ZIP
  requires Node/npm and does NOT satisfy this new gate.** Evaluate bundled runtime/
  installer with licenses/integrity/update/recovery tests; Docker QA and prior
  cold-package tests are different evidence, not clean-machine substitutes.
- [ ] H — Release observability: real logs/resources/diagnostics/build IDs and
  configured privacy-approved crash/analytics services; controlled test error
  reaches intended destination. Offline/unconfigured vendors clearly distinguished.
- [ ] I — Final regression: rerun every release-blocking test AFTER security,
  performance, recovery, packaging and UX fixes.
- [ ] J — Documentation: architecture/setup, dependency decisions/attribution,
  tests/diagnostics/release, identity/privacy, recovery and known limitations.
- [ ] K — Produce `EDGEVIEW_PRODUCTION_READINESS_REPORT.md` with architecture,
  OSS/custom decisions, exact tests/scans/results, measured performance, monitoring,
  actual identity design, exact packaged build, clean-machine result, limitations
  and evidence-backed READY / READY WITH WARNINGS / NOT READY recommendation.
  Do not issue a favorable report prematurely.

M0–M5 execution order remains; these requirements expand the appropriate milestones
and add final completion gates. Earlier real-company accuracy, full importer scope,
UI state/visibility, provider evidence and key-rotation requirements remain open.

### 2026-10-21 independent source audit and retrieval fix

Standard offline scan `fd56c873-d8dd-4055-b090-9b89a81e19ac` reviewed 221/226
tracked source/context paths at `a58f3fe`. Three branding binaries were excluded;
two lockfiles received metadata/pattern review, not dependency implementation
review. Seven validated findings: four medium, three low. The sealed report is
in the local Codex Security workbench; source review is not visual acceptance.

- [x] Source fix: pin each retrieval connection to the single validated DNS
  answer set; reject mixed private/public answers. Share this GET transport with
  NVIDIA model discovery, preserving credential-origin checks and no redirects.
- [x] Source fix: one absolute deadline covers DNS, redirects and body capture;
  late DNS cannot start a connection. Preserve exact response bytes for strict
  provider decoding. Synthetic transport tests and actual NVIDIA catalog passed.
  This does not implement immediate batch-stop cancellation or a global run SLA.
- [ ] Fix parser header-by-row cell amplification and bound document resources.
- [ ] Fix/retire unsafe legacy HTML block export and stats CSV quote handling.
- [ ] Prevent nonloopback HOST exposure and export filename path traversal.
- [ ] Resolve backup effective-path overrides and previous-config completeness.
- [x] Batch dashboard: adapt summary/full job before rendering company_states;
  remove Firecrawl/obsolete-model labels and unknown-limit arithmetic.
- [ ] Enable metadata-only paginated dataset export controls without requiring
  empty local row arrays to be populated.
- [x] Preserve usageScope when the runtime hook publishes validated state.
- [ ] Diagnose occasional saved-config DPAPI open failure. One standalone read
  failed; synthetic DPAPI roundtrip and subsequent actual config read succeeded.
  Configuration was not replaced; do not fall back to plaintext or reset keys.

Verified for retrieval patch: typecheck, lint, test:v1, synthetic outbound suite,
model-origin and diagnostic payload contracts, production build/release smoke,
Windows package verification (130 files) and staged/ZIP unchanged-launch checks.
Actual NVIDIA model catalog: HTTP 200, 83 models, selected model available,
257 ms. Catalog access does not prove generation or real-company accuracy.

Live port 3901 still belongs to old PID 36216. No policy-denied restart bypass
was attempted. Supported browser documentation retry failed before navigation:
`failed to write kernel assets: The system cannot find the path specified.
(os error 3)`. No permission dialog or visual QA occurred. Full UI/research,
clean-machine, current hosted CI and remaining A–K gates are still open.

### 2026-10-23 batch dashboard/runtime contract follow-up

Batch summary restoration now provides safe empty collections until the bounded
progress poll arrives. Polling starts immediately, coalesces overlapping polls,
aborts on close/reselection, and cannot restart from an obsolete restoration.
Closing the dashboard does not stop the persisted backend job. Retired-provider
labels, fixed model names, invented account limits and guessed ETAs were removed.
Backend job-list/summary/progress/usage responses share a four-provider projection;
historical stored counters are not deleted. Per-company progress now carries its
actual resource counts; absent values remain unknown. The runtime hook retains
the backend's usageScope.

Passed after these changes: npm run check; batch_snapshot (including static React
markup, not visual QA); runtime_capability_recovery; production build;
telemetry-runtime against an isolated compiled backend (including job creation,
summary/progress/stop and no guessed quota); production release smoke.
The first extended runtime test correctly failed on leaked legacy counters, which
were fixed at the shared API projection rather than hidden in the test.

Verification setup initially lacked development dependencies. Clean npm ci hit a
Windows-locked Rollup native file; in-place npm install restored the locked tree
with scripts disabled and no package-lock change. It reported a leftover locked
cleanup directory; no forced deletion or unrelated process termination was used.

Port 3901 now belongs to PID 30112, not the previously observed PID. Its loaded
build and new UI behavior are not certified by these isolated checks. Supported
browser retry on this date still failed with the kernel-assets os error 3 before
navigation. Visual QA and the remaining security/product gates stay open.

### Owner resume and live launch attempt — 2026-10-28

Owner resumed and explicitly requested bringing EdgeView live. Port3901 had no
listener. Integration HEAD89be98e was clean; original project HEADb6db239 was clean
and retained the actual existing configuration/dataset. Original saved build
identifies b6db239 /6b5783d5f807695a1f243c8c16621d132d8ab55ebbd75619e66b391562cb4486;
it is distinct from newer integration fixes. A normal background Node launch
request was rejected by automatic execution policy before launch: blocked by
policy. No alternate execution bypass, runtime replacement or customer-state
operation was attempted. Live startup is NOT VERIFIED. Owner can run the original
EdgeView.bat normally. The retained fresh Slim acceptance summary was re-read and
its exact scoped HTTP/export/restart evidence added to the existing verification
report; no provider request was repeated merely to update documentation.

### START01 — stale PID reuse startup failure — 2026-10-28

Observed original lock contained20892. CIM identified that live PID as Windows
RuntimeBroker.exe, not Node/EdgeView; no3901 listener and no matching Node backend
existed. Rechecked all conditions immediately before removing only the exact
stale edgeview.db.lock. No process killed or database/configuration file edited.
Owner must retry normal launcher; live readiness has not yet been observed.

Integration fix adds process-birth sidecar metadata while preserving the numeric
lock for older versions. Windows uses bounded hidden OS process inspection;
Linux uses boot ID plus proc start ticks. Only a matching recorded PID with a
provably different birth permits recovery of an otherwise-live PID. Legacy locks,
missing metadata and failed inspection remain conservative. EPERM inspection does
not imply a dead owner. Sidecar replacement failure cannot retain stale ownership
metadata while starting the backend. Metadata is local operational state, never
hardware identity or monitoring content.

Focused tests include actual host birth lookup and production compiled-backend
startup: live legacy numeric lock refuses before DB initialization; synthetic
prior birth for an actually live unrelated PID is recovered; second actual
backend refuses without changing first owner's files/health; normal close removes
both lock files. Existing upload/restart/identity/backup assertions remain intact.
Typecheck/lint, full V1 suite and release smoke passed. Production build passed
with the existing bundle-size warning. A final rebuild and focused repeat cover
the tightened sidecar-removal error handling. No customer installer/package,
original-source integration or rendered UI acceptance is claimed here.

### EXP01 — complete saved-contact HTML blocks — implementing (2026-10-28)

A new actual-route regression failed before the change because country and saved
secondary contacts/leadership were omitted. HTML blocks now retain the saved
country/role/status, email/phone arrays, multiple addresses, contact people,
WhatsApp, social profiles and published source links. Scalar-only legacy values
remain supported; scalar/list email duplicates render once. No new admission or
country inference is performed. Selection stays by company ID; an identically
named foreign company and unknown-country evidence are excluded from the local
selected fixture. Every nested value is escaped and every added link passes the
existing HTTP(S)/control-character guard with noopener noreferrer. Source quotes,
raw provider payloads and unscoped facts are not promoted into contact fields.

Endpoint/helper adversarial tests cover nested hostile people, quote-breaking
source URLs, multiple values, same-name foreign selection and unscoped exclusion.
Production build completed with existing bundle warning. Final targeted checks
are running; rendered downloaded-document and real-company complete export remain
NOT VERIFIED. No live build restart or customer records changed.

EXP01 scoped checks completed: helper and actual HTTP endpoint regressions, typecheck, lint, production build and release smoke all exit0. Existing hosted release run40685307541 at e699dd2 failed current-process birth inspection in test:v1; native launcher, browser E2E and Docker jobs succeeded. Treat that failure as open, not an export regression or green release gate.

### START01 hosted probe follow-up / current owner order — 2026-10-28

Hosted e699dd2 release verify failed because its current-process birth probe
returned null after about5.2seconds; the log did not classify the cause. Native
launcher/browser/Docker jobs passed, not the whole workflow. Cold shell timeout
is a plausible inference, not independently proven root cause. Increase the one
bounded Windows inspection deadline from5to15seconds and emit only TIMEOUT /
UNAVAILABLE / MALFORMED to assertion diagnostics when inspection fails. No retry
loop, raw errors, security bypass or unsafe ownership fallback. Local real-host
inspection passed. Ignore the local lock owner sidecar in Git as runtime state.
Hosted acceptance remains required; do not weaken the actual-host assertion.

Owner reiterated pre-release preparation includes a runnable MSIX candidate.
Microsoft Store setup/publication remains deferred. Native local execution is
still gated by trusted signing/Application Control; extracting a package is not
installed activation. Add screenshot regression infrastructure within existing
Playwright using synthetic deterministic states, review captures before approving
baselines, never auto-accept current images as known-correct. Final live rendered
QA remains separately open; pixel matching does not prove company-country facts.
START01 follow-up local checks: real process inspection, typecheck, lint, production build, actual compiled separate-data lock/restart/backup regression and release smoke exit0. Hosted verification of the longer bounded probe remains pending.

### QA02 — synthetic screenshot infrastructure — implementing (2026-10-29)

Reuses existing Playwright/backend fixture, no new SaaS/browser shell. Dedicated
capture and compare commands cover desktop/narrow empty storage, synthetic loaded
file and Settings. Backend paths are isolated, provider keys empty, external
traffic blocked; no live3901 or customer rows. Six review images retain source/
build identity. Capture artifacts are labelled UNREVIEWED and CI retention7days.
Compare uses updateSnapshots=none, zero pixel difference and a precondition for
existing reviewed platform-specific references. No baseline is approved yet.

Observed: E2E typecheck and test discovery exit0. First capture failed desktop
Settings during a5.6hour wall-clock interval; narrow passed. Failure screenshot/
trace retained privately. Unchanged repeat completed both cases in10seconds.
The long interval is not a normal performance measurement or diagnosed product
root cause. Final script repeat pending. Compare deliberately exited1 for both
missing reviewed baselines and created none: this is expected rejection, not a
visual comparison PASS. Final live/manual QA and broader screenshot states remain
open. Pixel equality never establishes country attribution or installation.
QA02 final local capture: both scenarios completed in15.2seconds, six unreviewed PNGs produced. No pixel comparison or final visual acceptance claimed.

### CC04 — reproduced Emerchemie official retrieval loss — 2026-10-29

Fresh real HTTP run-mvscdk97-099199092b at f7edda8 resolved the correct domain but
missed published contacts/leadership:1email/0phones/0addresses/0people, PARTIAL.
Official pages timed out; management guesses consumed priority before the real
CMS contact route. Independent source and subsequent guarded successful page
retrieval confirm this is not evidence of no internet presence. See the existing
verification folder's EMERCHEMIE_2026-10-29.md for exact trace/build/limitations.

Candidate: contact priority equals leadership, at most two publisher-observed CMS
suffixes, at most two extra transient retries per official crawl (10s each).
No retries of abort/security/body-limit/HTTP failures or arbitrary external pages.
Both failures/successes retained; successful retry resets failed-capture metadata.
Actual transport fixtures reproduced loss before fix and now pass bounded retry,
exhaustion, failures, immutable storage and local-country projection. Typecheck,
lint, full V1, production build and release smoke exit0. Fresh real repeat remains
required. No live3901/customer state changed. Other company and release gates stay.

START01: hosted f7edda8 still failed real process inspection with TIMEOUT at15s;
longer waiting alone did not close it. Inspect Windows cmdlet module discovery
rather than weakening the actual-host assertion. Browser17/18 passed; contact
export scenario could not find All exporters and requires separate investigation.
START01 framework probe correction (2026-10-29): actual hosted TIMEOUT persisted
at15seconds, so deadline increase was insufficient. Replace Get-Process cmdlet
with the loaded System.Diagnostics.Process API and dispose the handle, avoiding
module auto-discovery under the minimal child environment. No alternate host,
registry/security change or unsafe lock fallback. Real local identity test,
typecheck/lint, production build, compiled duplicate/reused-PID/restart/storage
regression and release smoke exit0. Hosted Windows result remains required.

### UI04 — late upload must not steal navigation — verified scoped (2026-10-29)

Hosted contact-export failure prompted a controlled real-browser reproduction:
actual backend parsed/persisted an upload, its response was held, user navigated
to Contacts, then completion forced Files. This test failed before source change.
Remove only upload completion's unconditional setActiveTab(files); explicit
file selection still navigates normally. New dataset selection and success toast
remain. Actual rendered delayed-response test now preserves Contacts through
completion and reload and shows newly uploaded rows. Existing contact scope/export
selection and full upload/paging/country/restart workflow also pass (3tests).
Typecheck, lint, E2E typecheck, build and release smoke exit0. This closes that
reproduced upload navigation race, not every asynchronous navigation scenario or
final live visual QA. No live3901 restart/customer-data mutation performed.

### CC04 compressed official capture / real repeat — 2026-10-29

7fc82f1 fresh Emerchemie run-mvtrc2gh-d3453b35b3 remains FAIL for required public
contacts: the real CMS route was attempted, but timeout persisted;2emails and
zero phones/addresses/people. Correct discovery/retry fixtures are not sufficient
acceptance. Instrumentation confirmed HTTP200 followed by only102,815bytes in20s
of a3.67MB page. The server currently ignores the gzip offer. Do not claim fixed.

Add opt-in gzip only inside the already-resolved official-domain capture scope.
Node streaming pipeline enforces both encoded and decoded byte caps and the same
absolute deadline, rejects corrupt/truncated/concatenated-member expansion, and
destroys streams on limit/cancellation. Generic/provider calls stay identity-only;
foreign redirects lose the allowance and private targets remain blocked. Decoded
Response headers are truthful; raw page evidence records wire headers/byte counts
separately. Full decoded HTML survives storage/projection. No partial HTML accepted.

Focused gzip/transport/provider-origin/schema tests, typecheck/lint, full V1,
production build and release smoke exit0. Actual guarded Slim contact capture
returned173,771decoded bytes from30,387gzip wire bytes in1,638ms (HTTP200).
This is observed wire reduction, not a target-device benchmark or Emerchemie fix.
No new provider, parser authority or dependency was introduced. Real-company,
installed-package, full UI and recovery gates remain open.

### PKG04 — repeatable internal MSIX factory — implemented, end-to-end pending

Replace manual-only packaging experiment steps with a reviewed factory. It
requires clean committed source and exact matching source/artifact/commit identity;
actual isolated Git fixtures prove dirty/stale/wrong-commit refusal. It stages an
explicit named build allowlist, locked production dependencies with scripts and
customer registry config disabled, vendor-signature-checked Node, official matched
Node license, native launcher and durable close bridge. SDK output streams to a
file, preserving the earlier buffer-overflow lesson. Explicit mapping excludes
only the previously reproduced invalid Mammoth test path. Output is a unique
private temporary unsigned internal candidate, not Desktop final source/installer.
Payload hashes and candidacy blockers are retained; no install/sign/trust/security
change/live restart/publication occurs. Prototype monitoring remains disabled.

node --check and actual Git/build preflight tests exit0. Full SDK/dependency
factory run has not yet been attempted on this committed factory. Do not call
this a complete runtime payload, clean-Windows installation, signing, update or
rollback. Final artifact/source-snapshot criteria remain unchanged. Browser and
Windows-control initialization both failed with kernel-assets os error3, so
Serper playground verification/account actions were not performed or fabricated.
PKG04 first actual factory attempt failed before package creation: npm rejects a
single empty config file loaded as both user/global scope. Match the existing
bootstrap's distinct-file pattern and add an actual offline npm regression that
also proves lifecycle scripts do not run. Both offline npm and real Git/build
preflight tests now exit0. Failed private attempt retained; not an installer PASS.

### PKG04 actual MSIX / extracted-runtime evidence — 2026-10-29

Factory11c7caf produced EdgeView-1.0.0-rc.2-11c7caf-UNSIGNED.msix,
123,969,775bytes,27,411mapped files, SHA256
3c5e2b098ffa133c4207ddc4e3bd6af1bdbd15d7841b41f2d893f78259295afa,
build0b52634bbe7379796f778cbd277a31fc758ef837952df0c74153315501bf829d.
Private temporary folder edgeview-msix-candidate-F69bQM retains mapping, payload
hash manifest, SDK logs and Node24.19.0 vendor signature/license evidence. Locked
production npm install completed437packages; deprecation warnings retained.

Actual MakeAppx pack/unpack exit0. New verifier requires the independently recorded
factory package hash, re-extracts it into a new owned directory using the SDK,
verifies source/artifact and mapped-file hashes plus exact current vendor Node
bytes before executing. It uses bundled Node and actual packaged shutdown bridge,
PATH System32 only, empty NODE_PATH/NODE_OPTIONS and isolated synthetic state.
Observed empty first launch/new UUID, two same-name/different-country identities,
actual upload/scoped HTML export, missing-key503, no diagnostic private markers,
normal pipe close and restart UUID/data, no installed-root state writes: PASS.
Latest evidence: runtime-acceptance-Ki5SDQ/result.json inside that private folder.

Native GUI exe was NOT executed; package NOT installed/signed/customer accepted.
This host has developer tools, so it is not clean-Windows proof. Current Node
security selection, payload/test/source-map minimization, full OSS/security scan,
monitoring enabled delivery, migration/update/rollback and real company truthsets
remain open. No provider keys, original data, .env or old installation identity
were copied. Original live3901 remains b6db239/database OK; no restart performed.

### REL01 original/main verifier-test reconciliation — 2026-10-29

Independently reviewed main9713c8b (one189line test file). The actual product
verify-package.mjs is byte-identical between main and integration. Adopt only
that missing adversarial/CLI suite and wire it into CI; no wholesale merge or
original-tree write. Executed on Windows: PASS byte/length tampering, missing and
nonregular files, malformed/traversal manifest entries, strict unlisted entries,
real junction controls, simulated file-link flags and strict CLI relative paths.
Host allowed junctions but not file symlinks, reported explicitly. Test also
proves a rewritten self-consistent manifest passes: integrity is not authenticity.
Qoder's historical mutation claims were not re-executed or adopted as new proof.
Other main-only tar/test-debt/docs and upload-message differences remain under
review. This narrow test adoption does not reconcile main or deploy the live app.

### REL01 archive-tool reconciliation — 2026-10-29
Reviewed main commit3493912 and adopted only its six archive-tool files. Resolved the package-builder import conflict by retaining BOTH systemTar and withScanner; no credential gate removed. Added the helper regression to CI. Executed: system-tar test PASS; package-preservation test PASS; actual package-content-secrets test PASS (multilingual benign package, encoded/compressed credential canaries, scanner failures, previous-artifact preservation); typecheck PASS; lint PASS; four changed script syntax checks PASS; git diff check PASS. No live restart, customer-data modification, existing output replacement or final source export. Legacy package-safe-source exclusion copying is NOT accepted as the final explicit-allowlist snapshot procedure. Installed MSIX, clean Windows and full release gates remain unverified.

### QA01 credential-test false-green correction — 2026-10-29
Reviewed main64509f5 test-isolation work. Reimplemented only the ByteString regression cleanly: synthetic temporary config, exact stored-key/catalog-call/noncached-result assertions, unconditional unexpected-failure propagation, finally cleanup, no real provider calls or customer keys. Existing explicit live-provider acceptance remains separate. Added a runner executing the real regression plus failed-resolution and wrong-key mutants: normal PASS; both mutants rejected with the intended assertion/error (2/2). Direct regression PASS; typecheck PASS. Both tests wired into CI. This is settings-to-provider-boundary evidence, not real HTTP transport or live catalog delivery. The broader historical 29-file debt runner remains under review and is not claimed integrated.

### QA01 reviewed security/cache coverage reconciliation — 2026-10-30
Reviewed five existing suites from main64509f5 coverage inventory and wired the actual files directly into release CI: outbound_connection_binding, provider_transport_boundary, masked_key_resolution, contact_projection_country_isolation, ssrf_security_guard. Executed all five on this branch: exit0 each. Transport uses synthetic DNS/http/https with restored globals; SSRF uses synthetic config/keys and literal destinations; contact projection uses in-memory fixtures. No real-provider calls, live restart or customer-state changes. Evidence covers pinned connection authority, rejected credential redirects, deadlines/cancellation/body limits, header rejection, masked-key resolution and country-specific cache selection. It does NOT prove complete real-country attribution, live TLS/provider behavior, deployed safety or every historical test's safety. Remaining test inventory still under review; no historical 29-suite blanket acceptance.

### REL01 bounded evidence-file reading — 2026-10-30
Found verify-sbom-current read the whole file before its32MiB limit. Changed to opened-descriptor regular-file/size preflight,64KiB bounded reads, growth detection and finally close. Added real CLI oversized SBOM/lock/manifest, no-whole-file-allocation probe, growth-after-stat probe, nonregular input and bounded CLI termination checks. First new test exposed a Windows file-URL error in its preload; corrected, rerun PASS. Existing currency suite PASS; script syntax/diff checks PASS. Currency still explicitly does not prove SBOM completeness or trusted artifact provenance. Also reviewed/executed existing notices and isolated-package contract suites: PASS; junction available, file symlink unavailable on this host. Wired all three into release-evidence CI. No final package, actual dependency-license clearance or clean-Windows acceptance claim.

### REL01 full local checkpoint — 2026-10-30
Exact tested source da5ec5b59b55fe78720c96e020a917d97f21e69b, tree clean before checks. npm run test:v1 PASS (controlled failure logs are intentional); npm run build PASS with existing539.66kB frontend chunk warning; npm run test:release PASS. Build0b52634bbe7379796f778cbd277a31fc758ef837952df0c74153315501bf829d. node scripts/check-package-isolated.mjs PASS:140 manifest files, unchanged launch and prohibited-private-file checks PASS; disposable ZIP SHA256 d7ec9d50db1fa12d5f038022eb7003f5c364fc39cbeb6f8b19aa11dba976445a. Its109 development files and Node/npm requirement are explicit: customerRuntimeReady=false. Owned disposable output removed by checker; no final archive or installed MSIX created. Hosted a99ec02 release40922687811 SUCCESS; its inventory/read contracts SUCCESS; latest da5ec5b jobs were observed running/queued, not yet accepted. Full local logs retained in ignored .test-cache/release-reconciliation-*-20261030.log. Live original3901 not restarted or replaced. Remaining product/country/provider/recovery/installed-package gates stay open.

### DATA01 offline backup/startup coordination — 2026-10-30
Reproduced actual nested backup entry using synthetic storage: competing backup returned0 while the first was copying (regression red). Added shared runtime_maintenance gate: atomic directory acquisition, random operation token, ownership-checked release, no PID-only stale deletion. Backend holds it only while acquiring its existing lifetime DB lock; offline backup holds it through copying/publication and rechecks stopped state under the gate. Existing numeric DB lock stays authoritative. New unit/child-exit interruption tests PASS; nested competing backup now refused with RUNTIME_MAINTENANCE_BUSY; controlled backup failure and success both release gate. Compiled production separate-data test twice PASS: startup refused while gate held, no DB initialization or gate tampering, then upload/normal shutdown/restart UUID+data persistence, duplicate-backend refusal, backup and no app-root writes. Typecheck/lint/full V1/build/release-smoke/diff checks PASS; final compiled build cbae39c89d0a2839ea12d042520730b2f618b795b133393b85fcae68ffd726fc. Added gate test to CI; ignored runtime gate directories; documented support boundary. No live3901/customer-state operation. Important limitations: old binaries ignore gate; interrupted gate intentionally remains fail-closed; automated recovery, matched schema migration/restore/rollback and packaged acceptance remain OPEN. This is exclusion, not a completed transaction/recovery system.

### DATA01/DIAG01 maintenance package and support evidence — 2026-10-30
Clean exact83e13fed366bf7ca32b9575a8cfcb7e494795cf6 rebuilt; isolated package check PASS:141 files, launch/privacy checks PASS; disposable ZIP SHA256 a096238d83369180471c2fb18534c53d5ce01e2b51d50a1796770b1fc9cde931, build cbae39c89d0a2839ea12d042520730b2f618b795b133393b85fcae68ffd726fc. Removed only checker-owned temporary output. Still developer ZIP with109 development files and installed Node/npm requirement; not customer/installed-MSIX acceptance. Hosted research41032528286 and inventory41032528235 SUCCESS; release41032528315 observed in progress, no terminal claim.
Doctor previously omitted maintenance state (new regression red). Added runtime_maintenance: absence PASS limited to recorded gate absence; ordinary gate WARN active-versus-interrupted UNKNOWN; malformed/link/inaccessible FAIL. Reads no owner token/contents and reports no filesystem path/raw exception. Actual doctor suite PASS including ordinary/malformed gate, injected EACCES, real junction with unchanged target, and safe output; script syntax/diff checks PASS. This is local support-report behavior, not proof of a new rendered UI panel or remote dashboard receipt. Automated interruption recovery remains OPEN and no locks were cleared in real storage.

### REL01 actual staged-backup acceptance gate — 2026-10-30
Extended check-package-isolated to execute the existing backup-runtime regression against the staged package script and its staged relative imports, with sanitized environment and bounded child. A matching file/manifest or successful exit alone is insufficient. New adversarial fixture contains a present backup script that always exits0; real behavioral suite rejects it. Updated isolated-check unit PASS, syntax/diff checks PASS; positive harness run against source backup PASS. Actual committed staged-package run follows this commit; not yet claimed here. This adds backup-contract evidence only, not transactional restore or clean-Windows/customer-runtime acceptance.

### REL01 staged-backup gate exercised — 2026-10-30
Actual clean committed88b08eb89fcae58fae42f6d4822428e31f598621 rebuilt and isolated package checker PASS.141 manifest files; unchangedLaunchCheck, packagedBackupContract and privacyFileCheck all PASS. The staged backup script, its staged runtime-maintenance import and actual synthetic recovery/SQLite integrity/concurrent-refusal suite executed successfully. Disposable ZIP SHA2561aea980f4edf5ae83e65d711bcc62f95c17abb69c9400aec55163048555667d9; build cbae39c89d0a2839ea12d042520730b2f618b795b133393b85fcae68ffd726fc. Checker removed only its owned disposable output. Still109 development files and installed Node/npm requirement; customerRuntimeReady=false. No installed-MSIX, clean Windows, complete transactional restore or updater acceptance. Hosted83e13fe release41032528315 terminal CANCELLED after later push, not PASS; its inventory/read successes remain scoped. Logs .test-cache/staged-backup-*-20261030.log; live runtime untouched.

### CC01/CC03 abbreviated office-country correction — 2026-10-30
Reproduced three projection failures before editing detector: UAE and dotted U.K. office mailboxes inherited Kenyan page navigation; a valid local UAE mailbox was withheld. Added explicit uppercase UAE/UK/USA and dotted forms to the existing longest-country detector, preserving source order/canonical dedup and refusing generic ISO-code/prose interpretation. Additional USA foreign-office, dotted UAE email/phone scope, ordinary us/in/lowercase usa, UKulele/USAID/EUAE boundary controls PASS. Existing parent-domain local page, Pakistan/Kenya, Sudan/South Sudan, distributor, address/person and provenance cases remain PASS. Advanced contact-overlay policy27→28 (not a SQLite schema migration); real SQLite cached-overlay fixture now explicitly uses policy27: withholding, retained old bytes/run discovery, no startup evidence-body reads and current-cache reopen PASS. Offline batch revalidation PASS with zero network and controlled failed-write preservation. Typecheck/lint/full V1/build/release smoke/diff checks PASS. Build83de27be9b408391b900cf3aceacce21df1885d19df64d8c57f2bb73c1b1e0cb. Not blanket language/alias/relationship coverage, final rendered accuracy or actual company acceptance; no live/customer data revalidation performed. Wider CC01–CC04 gates remain OPEN.

### REL01/PERF01 country-policy package and repeated-workload harness — 2026-10-30
Clean exact9407aae76d5d94913e03b2ccebfb19b68e79116d rebuilt and isolated package PASS:141 files, launch, actual staged-backup contract and prohibited-private-file checks PASS. Disposable ZIP SHA2567059426736ac5b24af08d46e9cdc3e8466a539733cb616ba753b6553d70f34c8; build83de27be9b408391b900cf3aceacce21df1885d19df64d8c57f2bb73c1b1e0cb. Not customer-runtime or installed-MSIX acceptance.
Added opt-in --soak-cycles1..120 to existing separate-data production fixture (default CI behavior unchanged). Every30-second cycle uses actual health RSS/heap,100-row synthetic import, company read, HTML export, file enumeration and deletion; fixed empty provider config, isolated child/data root, bounded responses/requests/sample count, cancellation and normal child shutdown. Local report explicitly says NOT browser/large-data/leak-free acceptance. Actual1-cycle smoke PASS including subsequent original upload/restart/UUID/backup/no-app-root-write checks. First sample RSS152.5MiB-ish health MB, heap47.3MB, workflow612.66ms; not performance thresholds or trend evidence. Five CLI invalid bounds/options correctly rejected before fixture startup; syntax/diff checks PASS. Longer60-cycle run is next; not yet completed/accepted. Real provider, browser, CPU/disk/handles and target-machine soak gates remain open.

### QA01 portable export-contract reconciliation — 2026-10-30
Reviewed four existing previously-unwired contact-directory suites. Found developer-specific C:/Users/asimh temp output roots; replaced each with unique OS-owned mkdtemp, checked canonical cleanup boundary and finally cleanup. Executed completeness, DOCX, PDF-pagination and multi-format export tests: all PASS (actual PDF extracted text, DOCX XML, CSV/XLSX/ZIP; pagination fixture2pages). Typecheck and diff checks PASS. Wired all four directly into release CI. Corrected comments that implied extracted text proves visible absence of clipping; final document visual acceptance remains OPEN. These are synthetic content/serialization contracts, not provider truth or downloaded-viewer acceptance. No product/runtime source change. Long soak runner92715 remains live at latest poll, six cycles observed; report .test-cache/isolated-soak-23d1050d-d2b9-40cc-b731-0d44ed419cf9.json RUNNING, not yet accepted or a leak-free claim. Continued CI/test review does not modify that owned child's copied build or synthetic storage.

### DATA02 P0 RELEASE BLOCKER: same-name dataset history collision — 2026-10-30
State implementing / reproduced FAIL. New actual Express upload-route regression sends different CSV bodies under shared-name.csv. Both primary JSON datasets remain saved under different IDs, but SELECT history_data after second201 retains only Synthetic Second Buyer: first dataset's derived history was erased. Root cause: routes/upload.ts deletes history_data by originalName before insert and again during failure cleanup; server.ts and stats_router.ts deletion also scope by file_name. This contradicts dataset-ID ownership and can affect retained history. Added regression to CI deliberately RED until corrected; typecheck PASS, focused regression FAIL at exact first-history assertion on repeated runs. Future assertions also require delete-one/sibling preservation and SQL reopen; these have NOT been reached yet. No real files/customer data used or altered.
Required next implementation: stable per-dataset history ownership across upload, rollback and BOTH delete aliases; reviewed migration/legacy same-name reconciliation and integrity/downgrade/reopen/failure tests. Do not solve by rejecting ordinary same-name uploads, silently discarding legacy rows, or weakening regression. No product fix claimed yet. Existing green suites do not close this blocker. Long soak92715 still live at poll:20/60 cycles; unique filenames mean that run does not cover this collision.
Computer-use retry in this phase: both supported node_repl @oai/sky initialization and cua.getState failed before windows/tabs with failed to write kernel assets: system cannot find path (os error3). No permission UI, browser actions or account setting changes occurred. No unsupported fallback. Monitoring/dashboard verification remains open.

### DATA02 dataset-owned shipment history — 2026-10-30
State implementing / PARTIAL. New uploads now store history_data.file_id; upload idempotency/failed-upload cleanup and BOTH delete aliases target dataset ID, never display filename. Prepared insert statements finalize on success/failure. SQLite schema1→2 adds nullable ownership plus index through existing backup/atomic persistence machinery. Existing rows remain NULL, never guessed from filename. Affected legacy-name deletion returns structured409 LEGACY_HISTORY_RECONCILIATION_REQUIRED BEFORE primary JSON deletion; this conservative guard is not completed legacy reconciliation and remains a release blocker until reviewed recovery/reindexing/interruption acceptance exists.
Focused actual upload regression now PASS: two different same-name datasets/histories, hash duplicate, controlled insert failure rollback retaining siblings, pre-mutation legacy refusal, deletion and DB reopen. New explicit v1 DDL fixture PASS: original row unchanged/null ownership, byte-exact pre-v1 backup on success/failure, injected ENOSPC keeps old DB bytes, integrity/version2/idempotent reopen. Existing migration retention and initialization suites PASS; future-schema refusal fixture advanced to3 (not weakened). New compiled production runtime test PASS: real same-name uploads, main /api/files delete and stats delete alias preserve sibling rows on disk across restart, both refuse legacy deletion before primary mutation. Typecheck/lint/full V1/build/release smoke/diff checks PASS. Compiled build5f5d08b6ba4ab4e3c77c2b5f96bd533a6854c3ba27a72e67b995824398a0a879 before whitespace-only formatting; committed rebuild/package evidence follows. New tests wired into CI. No original/live schema migration, customer-state operation or installed-MSIX claim.
Long soak92715 remains the prior9407aae compiled build/schema1 with runnerfe7448e; latest observed36/60 cycles. Its eventual results are baseline evidence ONLY and cannot accept this new schema2 implementation. Existing unsigned MSIX candidate also predates schema2. Matched app/data rollback and final package acceptance remain OPEN.

### DATA02 exact committed build/package checkpoint — 2026-10-30
Exact2a3b8d7b3b4cf6e127712127f74e0c6e2c149dd2 rebuilt. Actual compiled production history-owner-runtime test PASS again (both delete aliases, same-name sibling persistence/restart, legacy pre-mutation refusal). Isolated package check PASS:142 files; unchanged launch, actual staged-backup contract and prohibited-private-file checks PASS. Build8c04cef6c82c98309a2084e524033dc07513fc2724cd0cf095a01364f40f5e0d; disposable ZIP SHA25604aa0b1a1ddd810a103b6a2e1f55af6ae83cf5d93b3d4e01aa499465c612e2dc. Checker-owned output removed. Still110 development files and installed Node/npm requirement; customerRuntimeReady=false. Source migration/rollback safety remains PARTIAL: null-owned legacy rows are retained and require reconciliation, no installed update/rollback/clean-Windows or live migration claim. Prior-build soak92715 remains live at41/60cycles; not acceptance of this schema2 build. Logs retained in .test-cache/history-owner-*-20261030.log.

### DATA02 bounded non-mutating reconciliation preflight — 2026-10-30
Added internal planHistoryReconciliation and shared historyInsertValues projection used by real uploads. This does NOT apply a repair or expose a new operator/API control. Given a validated saved-dataset snapshot and schema2 rows, preflight compares complete SQL-affinity shipment tuples, country/source, ownership and duplicate multiplicities. Detects a missing old index portion using canonical primary rows; blocks unknown/excess/wrong-owner/cross-country/value/provenance records. Identical copies can justify a replacement index from primary IDs, never a fabricated assignment of old row IDs. Requires original preimage backup and independently locked/validated durable source before future apply. Projection fingerprint is private, not a full JSON generation token or monitoring field. Budgets50k rows/32MiB with lower test limits; untrusted/incomplete metadata fails closed.
Adversarial preflight tests PASS including input immutability, source-order determinism, current index, missing history, surplus duplicate, wrong owner/country/value/real-test source, incomplete rows and bounds. Actual same-name upload/rollback/delete regression PASS after sharing projection. Typecheck/lint/full V1/build/compiled history-owner runtime/release smoke/diff checks PASS; final preflight naming-only clarification separately rerun PASS. Wired planner test into CI. Existing deletion refusal remains in place. Durable candidate construction, exclusive source/DB snapshot binding, interrupted apply/recovery and operator-safe acceptance remain OPEN; no legacy/customer history was modified.

### PERF01 completed baseline soak (not current-release acceptance) — 2026-10-30
Verified runner92715 terminal exit0;60/60 cycles completed over1818.785seconds, followed by actual normal shutdown, UUID/dataset restart and backup checks PASS. Baseline app9407aae/schema1, runnerfe7448e; NOT newer schema2 acceptance. RSS152.1→132.8MiB (range125.6–152.1), heap47.1→45.2MiB (42.9–52.3), complete workflow p50/p95 272.11/730.95ms.6000 cumulative synthetic rows in60 small imports, empty providers, no live/customer data. No leak-free claim or invented threshold; host had concurrent engineering work. Exact hashes, timestamps, method and unmeasured gates in docs/verification/LOCAL_SOAK_2026-10-30.md. CPU/disk/handles, large data/research, current-build long runs and clean-device acceptance remain OPEN. No live runner92715 remains; do not restart based on an old log or poll it as live.

### DATA02 committed preflight integration checkpoint — 2026-10-30
Exact32dc9145c1e7d471f290aacbf92c5a73a3191b60 rebuilt; compiled production same-name/both-delete/restart/legacy-refusal runtime PASS. Isolated developer package PASS:144 files, launch, actual staged-backup contract and privacy-file checks PASS; build6d0c34b52f3add9c6ee81d3af15a7c60973c0e2f750eb2aa96b2026fc28b5077, disposable ZIP SHA256cda2fe28980df9189b3db565660be15bec2cd1523e667f8068b89b2d255b1fd9.112 development files; installed Node/npm still required. Output removed by owner-bounded checker. No real history repair, installed-MSIX or clean-Windows claim. Next DATA02 step is a reviewable candidate built from a preserved SQL preimage and verified primary snapshot, followed by interruption-safe apply/recovery tests; the preflight result alone authorizes nothing.

### DATA03 P0 saved-authority read failure — 2026-10-30
Reproduced old reader renaming a malformed primary JSON authority and returning[], which could let a later save replace canonical state. Added sanitized DATASET_UNAVAILABLE, a canonical non-mutating UTF8/shape decoder and fail-closed reads: only missing paths use the established legacy fallback; existing empty/malformed/non-array/bad-row/incomplete-count/duplicate-ID/invalid-encoding/nonregular state cannot become fresh storage. Original bytes/path retained, no automatic quarantine/rename. Source disappeared after stat is also refusal (new negative regression red before fix). Startup aborts rather than serving an empty installation; runtime upload503 occurs before publishing a new file. Existing save/delete functions propagate refusal. Optional monitoring records fixed storage-failure enums, never raw parse/IO content; classifier no longer mislabels this as provider failure.
Observed checks: authority load/save/delete/privacy test PASS; dangling file-link probe SKIPPED because host refused creation. Controlled JSON write test now distinguishes read from write and requires exact DISK_FULL on injected ENOSPC with original readable bytes retained. Typecheck/lint/full V1/build/release smoke PASS. Actual compiled runtime PASS: malformed primary refuses startup despite valid legacy, post-start corruption upload503 retains original bytes and memory, repaired synthetic fixture restarts with original dataset. Same-name history compiled runtime also PASS earlier in this phase. Monitoring classification/privacy tests PASS. Read-only bounded stable-snapshot shape probe accepted the original project's current authority; no real file/config/data changed and this is not accuracy or deployment acceptance. Committed package verification still follows. This prerequisite preserves DATA02 repair-candidate work; candidate/apply/interruption recovery is still unfinished.

### Scope freeze and dated completion targets — owner request 2026-10-30
All earlier unfinished goals remain in this ledger. Basic product architecture/features already exist; remaining work prioritizes correctness, data safety, privacy/security, essential usability, distribution and acceptance. No new framework, broad redesign or optional feature expansion before V1. Newly found issues enter the V1 blocking list only when they demonstrably affect entity accuracy, durable data, secret/privacy safety, trusted installation/update or essential workflows; cosmetic/optional improvements are explicit follow-up patches, not silently deleted goals. Use one finite acceptance matrix and close its evidence gaps rather than reopening already verified work without new evidence.
Planning estimate:50–80 focused engineering hours (approximately7–10 full working days), plus unbounded external/account/signing/test-environment waits. These are estimates, not guaranteed ship timing. Target2026-11-02 18:00 Asia/Karachi: scope-frozen reviewable PRIVATE candidate with current data/research/security fixes and exact remaining gates. Target2026-11-06 18:00 Asia/Karachi: complete release-decision packet and passed controlled acceptance where prerequisites are available; any remaining blocker is reported as NOT READY, never bypassed to meet the date. Final installed acceptance depends on trusted signing/Application Control compatibility, clean Windows environment, supported browser/tool access and owner-required account/key steps. Microsoft Store/account setup and final manual visual QA remain deferred by owner; final publication/submission/public feeds remain forbidden until separate review approval. The target dates do not cancel those gates or promise background execution while tools/session are unavailable.
Execution order: DATA02/DATA03 plus MIG01/REC01 safe recovery; CC01–CC04/CORE01/DATA01/JOB01 real research/data reliability; original/integration reconciliation and SEC01/SEC02/CI01 exact evidence; MON/PRIV/DIAG/identity/support acceptance; DIST/UPD self-contained candidate and compatible update/recovery; QA/PERF/PILOT clean-device/visual acceptance; FINAL01 separate preserved artifacts/Desktop organization/readiness report. Do not start a final clean release copy or deploy to the uncle before dependent gates close.

## Provider transport checkpoint — 2026-10-31

Confirmed policy gap corrected through the existing helper, without another networking architecture. The independent candidate review found a genuine failure-path compatibility regression (401/403/429 suppression); an adversarial failing test reproduced it before correction. Dormant sibling provider calls share the bounded helper but are not enabled or claimed live-tested.

Executed: npm run check; npm run build; npm run test:release; provider_request_path, provider-fetch-policy, provider_diagnostic_payload, serper_link_resolution, provider_response, model_credential_origin, ssrf_security_guard, outbound_connection_binding, engine_ai_destination and official_page_body_budget regressions. All passed in the reviewed working patch. Actual Serper search/resolve and Hunter settings diagnostic passed without modifying protected configuration. Exact-commit package checks follow separately; no clean-Windows/MSIX or final live UI acceptance is implied.

### Exact provider-transport commit/package evidence

Commit8dfa90806bdb0b51ac18b61e617095414c4c576c was pushed to the private integration branch. Rebuilt that clean committed source and executed node scripts/check-package-isolated.mjs: PASS149 manifest files, unchanged launch, packaged backup contract and privacy file check. Build8df4a0c8557e6f12d63f072b3824dab2640f39035361475f754112e306e17bd8; disposable ZIP SHA2569491c67995f773575def9e3ca9612e262ae10b8bf31670dfa3c9de5706376a6e. The isolated output was removed by the checker. It contains117 development files and requires installed Node/npm: customerRuntimeReady=false. This is not MSIX, clean-Windows, final visual or update acceptance.

### Research feedback regression in progress

Actual isolated Playwright browser reproduced FAILED research feedback using green success styling after an HTTP200 structured captured run. Synthetic endpoint interception intentionally controls outcomes while the rendered production UI/store/toast are real; this is not real-provider accuracy acceptance. Correcting outcome mapping, then checking FAILED/PARTIAL/COMPLETED/unknown controls before marking UX02 verified.

Research feedback acceptance: Playwright research-feedback.spec.ts passed with5 controlled outcomes, visible wording/color and re-enabled action assertions. Inspected rendered screenshot personally. Typecheck, lint, E2E typecheck, production build and release smoke passed. These are isolated customer-feedback checks, not final live/manual QA, provider accuracy or clean-Windows acceptance. No unrelated runtime/data was touched.

## Directory refresh checkpoint — 2026-10-31

Before: browser revisiting the importer directory after controlled enrichment retained the old office snapshot. The focused browser regression failed on the missing new office, after test setup selectors were corrected. After: contact changes/view re-entry request the current derived projection; cleanup aborts obsolete requests, requests are bounded at15s, failed loads retain the existing visible Retry path. No persistence authority changed.

Executed successfully: typecheck; lint; full V1 suite; E2E typecheck; production build; release smoke; Playwright research-feedback, directory-refresh and contact-export. Controlled directory503 visibly exits loading and Retry succeeds. Synthetic endpoint outcomes test production rendered UI, not real enrichment truth or final live/manual QA. Forced out-of-order response and actual15s stall cases are not separately exercised.

Owner-away continuation: recurring thread follow-up created to continue approved local engineering every30minutes when available. It preserves this ledger, narrow commits, external blocker honesty and the stop-before-publication boundary; no owner-dependent account/credential/signing action is delegated.

## Unsupported UI remnants — 2026-10-31

Only src/store/appStore.ts and SourceEvidenceModal.tsx code changed: removed the unused sent-status action and unreachable objective/fixed-confidence computation. Searches found no consumers. Typecheck and lint passed after both edits; unscoped_contact_presentation.test.tsx and contact_scope_presentation.test.tsx passed. No new test merely mirrors deletion; existing actual presentation checks cover retained behavior.

Previous clean0178902 exact-source rebuild/isolated package passed149 files, launch/packaged backup/privacy checks; buildaad526c5c7e199b8af5eba43281c96ab4947f91ed9856f25fc7aff99366c819a and ZIP6872727340a52d131dd8a91d08ed9ce5609575f1623b44016ee4725aadb0a288. Output removed; still117 development files and installed Node/npm required, not customer MSIX/clean-Windows acceptance.

## Release publication safety — 2026-10-31

Confirmed current CI automatically ran a write-permission gh release create job for every v-prefixed tag after4verification jobs. Its artifact is explicitly the Node/npm-dependent developer ZIP, not a verified customer package; no evidence/owner gate existed. Removed only that publisher from ci.yml, preserving every verification/artifact-upload job and triggers. Locally parsed all3 workflows with PyYAML and asserted read-only contents permissions/no release-create step and the exact unchanged verification job set. YAML and whitespace checks passed; hosted execution still blocked by account billing, no tag/release created. Future authorized publication must be implemented against accepted customer artifact lineage and actual owner approval; this safety removal is not completed Store/update/release acceptance.

## Contact export authority — 2026-10-31

Reproduced against actual isolated compiled Express endpoint: a real stored contact ID with browser-forged company name/country/email produced a forged download. Added resolveStoredContactExport at the existing route boundary, retaining current selection UI and document generation. Supplied records carry IDs only for scope; facts come exclusively from the contact map. Selected object values cannot override authority. Missing/empty/duplicate/stale/mixed/out-of-scope IDs reject400 with structured INVALID_EXPORT_REQUEST. No global-record fallback is used.

Executed: typecheck/lint, E2E typecheck, production build, V1 suite and release smoke PASS; actual contact-export-authority HTTP test plus rendered contact-export workflow PASS; existing export_selection_validation and contact_directory_export renderer contract PASS. Added empty-selection guard then rebuilt/reran both affected browser/API tests successfully. Synthetic owned data/config, no provider requests, real customer data or live runtime touched. Other export datasets and HTML ID validation remain explicit EXP01 follow-up, not claimed fixed.

## HTML export selection boundary — 2026-10-31

Actual endpoint regression RED: company_ids string yielded200/all contacts. Added strict shape, unique string IDs, bounded ID length and complete stored-ID match. Now malformed/null/object/missing/mixed/duplicate selections yield400 INVALID_EXPORT_REQUEST before rendering. Omitted company_ids deliberately retains existing all-contacts behavior; [] deliberately exports no cards. No silent partial match or malformed-to-all fallback.

Executed export_blocks_endpoint.test.ts against its owned isolated actual server: PASS strict selection plus existing hostile markup, mixed-case/dangerous links, control characters, multilingual fields, complete local facts, country separation, headers and sanitized unexpected failure. Typecheck/lint, V1 suite, production build and release smoke PASS. Actual downloaded-document visual behavior remains NOT VERIFIED.

Exact previousad578ae build/package check passed149 files, launch/packaged backup/privacy checks. Build954fabadd9daed6917944df68abd6d9436b60bb49823b3afcd05050431b40382; disposable developer ZIP d5446f4a01c7a5e7bcd84d3a5348c35c011a75db409e29c81244eaf5838e15de removed. Still not customer-runtime/MSIX/clean-Windows acceptance. Next trace: FileViewer full export already uses stored sourceFileId; App header quick export and store shortcut still fetch all rows into browser and submit generic rows, and filtered file/derived exports need scoped authority. Do not replace working report semantics blindly.

## Saved checkpoint and fresh supply-chain observations — 2026-10-31

Current saved implementationed69ff898720998afff737e4e8f307c77a1757d7 was pushed privately, rebuilt, and checked with node scripts/check-package-isolated.mjs: PASS149 manifest files, unchanged launch, packaged backup and privacy file check; build5c1c6398ca344a43faf45ac0883f67bb4a4a12e5676336232a21f02ae5b39e13, disposable ZIP SHA256c1bd25ee50b3fe3b7eabf74c64f5552d26d7c2cd796fd1d487d863e54362f143. Checker removed its output. Still117 development files/installed Node/npm required; customerRuntimeReady=false. No customer installer, live runtime or original checkout was changed.

Fresh node scripts/audit-git-secrets.mjs: PASS306 commits/603 historical paths/0 prohibited paths/0 known credential-pattern file matches. Exact tool limits: known text patterns only, not entropy/ignored files/pre-baseline history. This cannot reverse previous credential exposure.

Fresh npm audit --omit=dev --json returned nonzero with a valid advisory report:10 moderate,0 high,0 critical. Reported package entries are transitive chains involving glob/minimatch, including @sentry/node11.9.0 -> @sentry/bundler-plugins11.9.0 -> glob13.0.6/minimatch10.2.6 and exceljs4.4.0 -> archiver/unzipper -> glob7.2.3/minimatch3.1.5 plus readdir-glob/minimatch5.1.9. Registry lists GHSA-3g3m-2fjr-6pw4 (glob abort cancellation) and GHSA-g3hv-75wg-m249 (minimatch globparts amplification). These are observed package-advisory results, not yet demonstrated EdgeView runtime exploits. Reachability/compatible remediation must be assessed; suggested major downgrade/force fixes were not applied. Raw reports remain local ignored test cache, no credentials printed. Older audit artifacts do not supersede this current result.

## Quick full-file export authority — 2026-10-31

Changed src/App.tsx and src/store/appStore.ts only for product code: header quick export reuses the existing store callback; callback uses sourceFileId/recordCount and no client rows. Existing FileViewer full export already used that backend boundary and was retained. No new endpoint, persistence authority or networking framework. React review checklist applied to touched code: event-only action, no new effect/state subscriptions, retained accessible button name, fewer client fetches/serialized rows.

Executed typecheck/lint, E2E typecheck, production build, release smoke and full V1 PASS. New quick-file-export browser test first failed on generic /api/export, then passed stored-file route, no records field, request below1KiB and complete60-row downloaded CSV. Existing browser workflows.spec.ts passed upload/paging/full export/country keyboard navigation/restart; stored_file_export.test.ts passed actual17,612-row >5MiB source, file isolation, override rejection and all-format routes. These are isolated synthetic checks, not final customer installation/live-data/visual acceptance.

Dependency assessment continued read-only: official GitHub advisory pages GHSA-g3hv-75wg-m249 and GHSA-3g3m-2fjr-6pw4 confirm the reported minimatch/glob advisories and patched major versions. Current latest Sentry11.10.0 metadata still requests glob^13.0.6; latest ExcelJS remains4.4.0. Therefore a routine compatible direct update is not proven to remove all findings. Installed Sentry disables automatic integrations and tracing; bundler source glob use and legacy archive patterns need scoped reachability assessment. No vulnerability is dismissed merely because a package is transitive, and no breaking override/downgrade/force fix was applied.

## Stored filtered/grouped export boundary — 2026-10-31

Actual rendered browser RED first confirmed the filtered button still posted browser rows to generic /api/export. Introduced no new data authority: moved the existing file-page view calculation to server/file_view.ts and reused it in paging and the existing stored-file export endpoint. Validated string-only bounded view keys, grouping flags and sort direction. Full-file behavior stays unchanged when view is absent; caller rows/selections/legacy filters remain rejected. FileViewer sends sourceFileId/sourceView only. Client builder and generic endpoint reject unanchored files with explicit setup/error rather than generating fabricated customer documents.

A second real artifact failure exposed grouped item/amount loss: stale raw aliases on the retained sample row won in the renderer. Export now passes the server-computed grouped six-column projection. Test requires MATCH_A and MATCH_B and30.00, not merely a successful HTTP status or file signature. Third RED demonstrated generic forged rows still exported200; corrected to400 STORED_FILE_REQUIRED.

Executed npm run check (typecheck/lint/V1), typecheck:e2e, production build, contact_export_scope.test.ts, stored_file_export.test.ts, browser filtered-file-export/quick-file-export/contact-export and release smoke: PASS. Earlier adjacent browser file-view-preference/workflows also PASS. Final expanded filtered fixture passed separate repeat: grouped search plus product/country/importer/date intersection, raw descending sort, no-match/date-outside/country-conflict refusal, invalid option shapes and repeated query keys. Existing17,612-row >5MiB/file isolation/override refusal/all-format contract passed. Smoke now checks all5formats from the actual synthetic uploaded Alpha/Niger slice, with unrelated importer/country rows excluded; it no longer treats client-invented rows as authority. No existing format/status/rate-limit checks removed. React touched-code review retained event handlers, button names, existing modal/error behavior and avoided new subscriptions/frameworks.

Scope limits: no final live/manual/document-visual/clean-Windows or current-device performance acceptance; standalone FileViewer fallback without the product modal is retained but not a separate customer API authority. Country/stats/summary/report exports remain next EXP01 acceptance, not silently included in this completed file-authority slice. No original checkout, live3901, real data, provider/configuration or account changes.

Previous clean56e912a exact-source package check PASS149 files; build414816e0e0f6b7065725b9a1340ce137dd8bc3891dc6dc3b7bb335cf00a472bb, ZIP855dd6b666da68676c137d68a0fd3bbef3e6a3b2e591e520093f05e4d999ed0c. Output removed, still a developer package needing installed Node/npm.

## Exact saved filtered-export package checkpoint — 2026-10-31

Committed/pushed dcc6c0938ab3370fb8ca6a8a9295e36e15da173c rebuilt with clean tracked source. node scripts/check-package-isolated.mjs PASS150 manifest files, unchanged launch, packaged backup contract and privacy file check. Build1967500e9b4319ff7a4f3510143d90eb05a077e5544e65fadebd4042eeb7afa8; disposable developer ZIP SHA25647b5288e4169203840abc4cbcc66865d1d06859b28861e87c661096c19964c09. Output removed by checker. Still118 development files and installed Node/npm required: not customer MSIX, native installed launch, update, clean-Windows or final visual acceptance. No published asset or accepted Desktop version snapshot created.

Next actual remaining export paths traced read-only: CountryView builds a client row union after paging source files; Summary fetches selected file rows; StatsTab submits the current shipment response with filters; Reports submits selected report rows/content. Current processExportRequest uses the full-dataset renderer for these4 datasets, so preserve actual six-column behavior while binding each to its demonstrated server/file/report/history source. Do not manufacture a new hierarchy or persistence authority. These are remaining EXP01 requirements, not an accepted implementation.

Primary dependency references inspected: https://github.com/advisories/GHSA-g3hv-75wg-m249 and https://github.com/advisories/GHSA-3g3m-2fjr-6pw4 . No blind major-version overrides/downgrades were applied. Current all-source dependency acceptance remains open despite locally verified export changes.

## Summary/country stored-scope export — 2026-10-31

Actual rendered browser RED showed Summary posted a client row union without source IDs. Both Summary and CountryView now send explicit sourceFileIds/recordCount through the existing modal and generic export route; server resolveStoredDerivedExport resolves those IDs from the existing dataset map. No new endpoint/database/networking layer. Only validated formatting metadata plus source_file_ids are accepted; no browser rows, selectedRows or arbitrary overrides. Empty/stale/mixed/duplicate/non-array scopes fail400 INVALID_EXPORT_REQUEST rather than exporting partial/global data. Summary scope is exactly one file; country explicitly selects one or many. Input cardinality bound10000 IDs is an admission bound, not a measured supported workload claim. Existing report six-column behavior retained.

Executed typecheck/lint/full V1 via npm run check, E2E typecheck, production build, release smoke: PASS. Derived browser/API suite plus filtered-export regression PASS3tests. Browser verifies60-row summary/country downloads with no records in request and no unrelated-file leakage. Actual two-file scope union and invalid/mixed/override probes pass. Separate actual API loop verifies the stored marker in CSV, XLSX shared strings, DOCX XML, inspected PDF text, and CSV inside the four-member all-format ZIP, for both summary/country. Adjacent upload/paging/country-keyboard/restart workflow also PASS. No final visual/install/provider/customer-data claims. React checklist applied: existing event-only controls/names preserved, large redundant row fetch removed, no new effects/state authority.

Next source assessment facts: stats_router.getAllDatasetRows currently reads db.files, normalizes through extractRowData and filters exact importer/country/date; do not assume a separate SQLite shipment authority from the History tab name. Reports UI has no active report-creation caller; POST reports/upload and in-memory report map require supported-flow assessment before adding/retiring anything. No archived AI report generation is authorized.

## Analytics country/failure scope correction — 2026-10-31

Two independent reproduced faults: actual browser changing Kenya/Pakistan for the same Shared Buyer left3 FOREIGNMED elements displayed under Kenya; actual unfiltered importer summary summed50+900 across2countries but labelled950 as Kenya. The first bounded UI correction exposed the second rather than changing the fixture expectation to agree with it. Backend now labels a genuinely mixed-country aggregate All Countries; this preserves intentional global analytics instead of falsely assigning it to the first country.

StatsTab reloads on importer+country+file changes, cancels superseded/unmounted requests and guards publication against obsolete controllers. Selected metric/product/exporter/shipment panels are withheld while loading or after failure. Four requests share a15s deadline; failures show a generic accessible alert and Retry analytics, never raw errors or stale foreign facts. Empty importer selection clears its old state. Manual date-range Apply semantics are preserved; other option-list/selection races and full date/file workflows remain broader QA, not claimed closed.

Executed typecheck/lint, full V1, E2E typecheck, production build/release smoke PASS. Actual stats-scope-refresh browser/API test PASS: aggregate label+950, same importer Kenya-only LOCALMED, forced Pakistan503 hides both old/new products, Retry yields Pakistan-only FOREIGNMED. Then4actual browser requests held without replies exercise the real15s timeout; visible timeout alert/Retry and absence of stale facts PASS (17.6s test). Adjacent Summary/CountryView all-format/content suite PASS as well. Forced late-reply ordering and separate file-picker transition are not individually exercised. Source change is server/stats_router.ts plus StatsTab.tsx and one focused E2E test. No claim Getz research admission or final real-world QA is complete.

Previous clean36ae438 exact-source package check PASS150 manifest files, launch/packaged backup/privacy checks; build844eb1b0b1d3c43d221259f8cdf04d83db088fc572ce8a64dc75f40264a39c79, disposable ZIP36543d1be407cfdd2b5be7d8770c08bd9ecd4a7370911d91e93d9c988f30fab7 removed. Still118 development files and installed Node/npm required, not customer installation acceptance.

## Exact analytics-scope package checkpoint — 2026-10-31

Clean committed f48e8f41125a6708cb3cb2d104ee92cb587b270a rebuilt and node scripts/check-package-isolated.mjs passed150 manifest files, unchanged launch, packaged backup contract and private-file exclusion. Build053f40ab0f35c477d3d2d33832a02f2769de2cc07a1ef54600e5a7ca547fb829; disposable developer ZIP SHA256883049736202fa05eabe773e5897b6ca241107b2d609feebbd58cbcf4c72b6b2 removed. Still118 development files/installed Node/npm required; this is not self-contained customer/MSIX/clean-Windows/update acceptance.

The saved Summary/CountryView authority change36ae438 and analytics country/failure correctionf48e8f4 are both pushed privately. No live3901 restart, historical/original checkout change, account action, real-data write or publication occurred. Current source remains NOT READY; next EXP01 work is Stats/report authority, and every earlier broader release requirement remains in this ledger.

## Stats download source/content correction — 2026-10-31

Actual browser download RED: page showed LOCALMED/50 but CSV contained N/A for both product and total. StatsTab no longer submits shipment records; it sends explicit stored source file IDs and validated applied importer/country/date filters. The generic route resolves those files and calls the same selectImporterShipments selector used by the existing shipment-read endpoint. Only server-normalized canonical date/importer/country/exporter/product/value fields reach the existing six-column renderer. This does not invent extra invoice columns or change the report template.

The successful loaded scope is retained for export, so editing a pending date range without Apply does not silently change the displayed results' artifact. Invalid filter keys/types, missing importer/country, impossible calendar dates, reversed ranges and no matches reject instead of broadening. File set admission remains bounded and exact. Independent API RED also confirmed unsupported outreach alias could still export invented rows200; it now returns410 RETIRED_EXPORT_DATASET before rendering, matching the V1 retirement rule.

Executed final npm run check (typecheck/lint/full V1), E2E typecheck, production build, release smoke: PASS. Affected actual browser/API suite PASS3tests: Summary/Country scopes, all5formats for summary/country/stats, Stats UI/content/scoping/adversarial input. The marker is checked inside actual XLSX/DOCX/PDF/CSV/ZIP artifacts, not only from HTTP success. Stats fixture verifies50.00/LOCALMED, excludes FOREIGNMED/OTHERFILEMED, explicit combined file set and ALL-country mode, stale/duplicate IDs/row overrides, invalid date and future no-match. Unapplied UI date edit retains applied empty range. Previous Stats refresh/failure/real15s deadline regression passed after the shared-selector extraction. No real providers, data, original checkout or live3901 touched.

Scope limits: this is existing six-column Stats content/authority, not full invoice raw-column/visual/large-data acceptance. The Reports renderer/source path still needs its own verification, and EXP01 remains open until that required sub-item closes.

## Exact Stats-export package checkpoint — 2026-10-31

Clean committed41e746a897b81b1049cecd6192406b9961d52be6 rebuilt and node scripts/check-package-isolated.mjs PASS150 manifest files, unchanged launch, packaged backup contract and private-file exclusion. Build6c23f3629e0d0286c586fa0e043981121c91e3c40a6b84e38578c22b2552b5fd; disposable developer ZIP SHA25646d0ca3eda4df63818d5cfbd374bc9ae48d478bacaf7d26594068746a0c4eedb removed. Still118 development files and installed Node/npm required; no customer-ready MSIX/update/clean-Windows acceptance inferred.

Next report-path facts rechecked read-only: Reports displays stored custom column tables or content_text, whereas the current generic export manager projects non-contact datasets onto fixed trade columns. Verify actual report download content before choosing a correction; do not add generation/persistence or treat an empty tab as an accepted report workflow. Only server.ts and the ledger mention reports/upload; no current frontend creation caller was found. Existing in-memory report map is not durable-data evidence. All prior goals remain intact.


## 2026-10-31 — saved Reports export correction in progress

EXP01: actual rendered synthetic table displayed Product/Amount and marker/42, while its CSV downloaded trade headers with N/A values (saved-report-red.log). After binding exports to the existing stored report ID/custom columns/text, a second actual HTTP artifact probe exposed long prose clipped from PDF (saved-report-content-probe.log). This is a confirmed supported-path Medium finding, not proof of an exploit.

Correction under verification: existing report map remains the source; browser records/columns/selection overrides and stale IDs are rejected. Table exports retain stored columns/scalars; text is kept in ordered continuation rows for spreadsheet cell capacity. Saved-report PDFs use existing PDFKit flowing text with automatic pagination in standalone PDF and ZIP, rather than the trade table's capped cell height. No report generation, new persistence authority, customer-data change or live runtime restart.

Acceptance pending: typecheck/lint/full V1, E2E typecheck, production build, rendered download + actual CSV/XLSX/DOCX/PDF/ZIP content and override rejection, release smoke, exact committed developer-package verification. Reports remain session-only in the existing map; there is no current UI creation caller. Durable report creation/restart, Unicode font coverage, final document visual QA and clean-Windows acceptance are NOT VERIFIED. Broad EXP01/customer-readiness is not closed by this sub-fix.

Verification checkpoint: npm run check (typecheck, lint, full V1), npm run typecheck:e2e, npm run build, scoped saved-report/derived-file Playwright (3 passed), npm run test:release all exit0. Actual downloaded custom table marker/42 and long-text end survived standalone formats and ZIP PDF; stale/forged content requests returned400 INVALID_EXPORT_REQUEST. Existing bundle-size warning remains. Exact-source developer-package check is next; no customer/installed/final visual acceptance inferred.

Exact-source package checkpoint: committed/pushed 0848752a823d07b26515541c1c8b283e35c1e628 rebuilt; isolated package checker PASS150manifest files, unchangedLaunchCheck/packagedBackupContract/privacyFileCheck PASS. Build662d73cd0262cbe7453e02f82931cdb7cfec895bba52516b1594773193dded55; disposable ZIP347a79b2c997bd47490f508e7c2f4d6ed318d9959f4d54035bdd976c1d3c9ddf, removed by owned checker. Still118 development files and installed Node/npm required; customerRuntimeReady=false. This is not self-contained/MSIX/clean-Windows/update acceptance.

Next JOB01 unit: directly reproduce interactive versus batch same-company completion ordering and cancellation/retry boundaries with synthetic isolated providers/storage before changing behavior. Read-only trace found activeJobs guards job IDs, while interactive and batch independently await enrichment then durable overlay publication; absence of a matching grep is not proof of a race. Require controlled out-of-order completion evidence before a fix; preserve immutable history and stronger prior results. No new issue is marked confirmed yet.


## 2026-10-31 — JOB01 overlapping contact publication

Observed RED: synthetic first interactive request captured contact1 then paused at durable publication; a second request captured/published contact2; releasing the first erased contact2 from the directory. This was real Express/projector/sql.js publication with test-only provider/barrier seams and outbound networking disabled, not a helper-only model. Original test failed the explicit newer-evidence preservation assertion.

Correction: one per-contact publication queue in existing job_manager protects historical projection, durable overlay save and visible Object.assign/index rebuild together. Interactive, SSE batch, background fresh batch and retained-evidence batch publication use it. Different contacts remain parallel; immutable retrieval/captures stay unchanged. Queued projection is recomputed after preceding publication, so a stale precomputed overlay cannot win later.

Focused GREEN: interactive/interactive and interactive/background-batch overlap both retain contact1/contact2 through directory API and actual process restart. Each scenario confirms the second immutable capture occurs while the first save is held. A test-only unserialized wrapper mutant fails the exact lost-newer-evidence assertion. Existing pending/failed-save HTTP durability contract also passed. Full checks/build/release and exact-source package acceptance pending. Cancellation/retry/shutdown/different-contact parallelism/failure-queue recovery and rendered controls are separate JOB01 sub-items, not claimed complete here.

Additional focused queue contract PASS: same-contact wait ordering, other-contact progress while held, exact PERSISTENCE_WRITE_FAILED propagation, queued success after failure and subsequent reuse. Wired both new regressions into test:v1. No cancellation/crash/real-provider acceptance inferred.

Executed final local checkpoint: npm run check exited0 (including the new overlap HTTP/restart test); final npm run typecheck/lint and queue contract separately exited0 after adding the queue contract to test:v1; npm run build and npm run test:release exited0. Unserialized test-only mutant exited1 on lost-newer-evidence assertion, not a startup error. No source-level claim of full cancellation/retry/crash closure.


## 2026-10-31 — JOB01 stopped worker drain ownership

Confirmed actual HTTP RED: first interactive save held the shared contact publication queue; background job captured evidence and waited behind it. POST stop returned200, but immediate POST start returned200 instead of409 while the old worker still existed. This can permit overlapping loops/counters and is a supported-path High issue.

Correction: distinguish whether workers should take more companies (activeJobs) from ownership of a starting/running/draining loop (ownedJobs). Acquire ownership before asynchronous startup, release it on every startup refusal/error or final worker drain. Stop requests preserve ownership until current work finishes. Start returns409 JOB_DRAINING with a truthful retry message while draining. No provider process is killed and no captured evidence discarded.

Focused checks: actual stop while publication held, early restart refusal, first save release, stopped job completion, safe resume after drain, one completed company without double counting, retained contact1/contact2 and restart persistence. Full check/build/release re-run pending. Stop of unstarted queue positions, force-retry, crash/shutdown and rendered controls remain separate acceptance requirements.

Prior exact-source package checkpoint f679bb57bd64b75eea6d0a3456f5b924553e467a: initial build failed ENOSPC, no package acceptance claimed. Inspection later observed1.1GB free; no files were deleted. Rebuild retry and isolated package checker then exited0:150manifest files, launch/backup/privacy checks PASS, build90e22bb79e3978509ad0c8f858e4299ac7c2f8356bb6a98fb4ebd5352c132197, disposable ZIPb2234bf58e0d9c3676eb9007055138ef7ed0cf5c203d8630ffaf65455a722098 removed. Still118 development files/requires Node/npm/customerRuntimeReady=false. This checkpoint does not cover subsequent stop/drain source edits.

Stop/drain final local checkpoint: npm run check (typecheck/lint/full V1 including all3 overlap/stop scenarios and queue contract), npm run build, npm run test:release exited0. Exact-source packaging follows. Read-only UI trace: handleResumeJob currently ignores non-OK responses; next verify and correct rendered draining/failure feedback rather than claiming the new409 alone completes the user workflow. No native browser/live/customer change.


## 2026-10-31 — JOB01 rendered Resume failure feedback

Actual isolated browser RED: existing Resume from Checkpoint button received synthetic409 JOB_DRAINING but displayed no explanation (job-resume-feedback-red.log). Current change adds an accessible local error, disables Resume while pending, imposes15second abort deadline, cancels on modal close, maps only recognized draining code to a trusted message, and never displays server exception text. A subsequent successful response restores polling. Browser test covers409,503/private-text omission, held request/real deadline and successful retry; results pending. This test uses synthetic job responses and owned backend, not final real-provider/live/manual QA.

Stop/drain exact-source package863a5e42e4598a57576608c24c087d9a67093ff3 passed:150manifest files, launch/backup/privacy PASS; buildba77b8677ec157c3cc0ebd687489409c41ab3340712435087aba778893944053; disposable ZIP69ae1c0c48480f8412c82a51582e586291065978e40c9001656b1381c7eeba81 removed. Still118 development files/Node+npm/customerRuntimeReady=false; no self-contained, installed-MSIX or clean-Windows claim. Subsequent modal changes are not covered by that package.

Resume feedback final checks: typecheck, lint, E2E typecheck, production build, actual browser test (1 passed24.4s; test18.4s includes real15s held-request deadline), full test:v1 and release smoke all exited0. Known bundle warning retained. Synthetic recognized409 message and generic503 errors remain safe; no raw server text rendered. Existing Playwright testDir automatically includes the new regression; no new framework or production endpoint. Exact committed package verification follows.

## 2026-10-31 — exact Resume correction package checkpoint

Committed/pushed5f6960287ac391dd4a65fe7a9c332656f1011ca4 rebuilt; isolated package runner terminal exit0.150manifest files, unchangedLaunchCheck/packagedBackupContract/privacyFileCheck PASS. Buildf6f9dd3ec89568aa6819f4664e455f84353965dbde460b77db5c4dea3946d7ef; disposable ZIPd1752fd43a82feeb0920f1484f6497b9ab1f82e0bcc1444b503df2949de73358 removed.118 development files and installed Node/npm requirement remain; customerRuntimeReady=false. Not self-contained installer/MSIX/clean-Windows/update acceptance.

Current JOB01 evidence closes the reproduced stale-publication loss, stopped-loop duplicate ownership and silent/unbounded Resume sub-path only. Next acceptance must show multi-company stop preserves queued work, then resume/retry/counters and interruption recovery without duplicate provider work or weaker projection replacement. Modal-close/late response, other job-action error paths and full rendered real-provider workflow remain unverified. No original tree/live3901/customer data/account/publication changes. NOT READY.


## 2026-10-31 — JOB01 eight-company queue / forced-interruption acceptance

Existing behavior verified, not reimplemented: new scripts/batch-lifecycle.test.mjs bundles the real Express routes, job loop, sql.js and immutable store with only a test-only provider barrier; egress disabled and synthetic CSV/config only.8 selected importers, existing5-worker bound. Actual stop after5 provider operations start leaves3 pending; released in-flight work reaches durable STOPPED5, restart preserves checkpoint, explicit resume finishes8 with exactly8 total fixture provider calls.

Separate forced-interruption scenario completes5 and holds3 in-flight. Test opens the actual on-disk sql.js database image until completed_companies=5 (API state alone is insufficient), SIGKILLs only its owned child, restarts and requires PAUSED5/3pending. Explicit resume finishes8, first5 completed companies are never called again; only3 interrupted in-flight attempts repeat (11 total fixture calls). Another restart preserves COMPLETED8 and starts no provider operations. This does not promise exactly-once external billing for an interrupted request.

Initial standalone runner exit0. Test-only mutation changes the real resume filter to include completed states; runner exits1 on explicit count-must-not-exceed-selection assertion. No startup/DNS/key failure substituted for mutation evidence. Added runner to existing test:v1, no new framework/production test endpoint. Full local/release checks pending.

Scope limits: deterministic fake provider behavior, single process/DB authority, no actual provider retry/auth/quota/timeouts, no rendered cancel/restart or target-device/clean-Windows acceptance. Graceful server shutdown, partial provider failures, force-retry, other error/control paths remain JOB01. No live3901/original project/customer changes. No new High/Medium defect was found by this lifecycle test.

Extended lifecycle acceptance: added a third scenario invoking the actual registered SIGTERM shutdown handler from a test-only preload marker. Windows child.kill(SIGTERM) is forcible and is NOT used as evidence of graceful OS delivery. Handler stops new work, drains the5 held operations, flushes and exits0; restart retains STOPPED5/3pending, explicit resume completes8 with8 fixture calls. No new production endpoint/hook. All3 scenarios passed standalone; full check/build/release passed the same unchanged product implementation before the additional graceful scenario. Final replay-completed mutant still exits1 on the intended count inflation assertion. This closes stated synthetic application-handler/queue/checkpoint acceptance, not installed Windows/real provider/final UI acceptance. Exact-source package follows.


## 2026-10-31 — exact lifecycle regression package checkpoint

4e307a28f4679efd4a21f6f679440d79de1c8022 rebuilt and isolated package runner exited0:150manifest files, launch/packaged backup/privacy PASS, build4ad5078a99904fb2a9261c02346b984a9e8d008059f051af3f79d8180fb20027; disposable ZIPdbe3de5d4f2212033da20a703400c6ec62b7f30549b6f652c9f754b3671a6565 removed.118 development files and installed Node/npm remain, customerRuntimeReady=false. Not installer/native launch/clean Windows/update acceptance.

Next reached JOB01 control: Pause currently ignores non-OK stop responses; successful stop stops local polling before its checkpoint refresh is confirmed. Trace this with rendered synthetic refusal/timeout/checkpoint failure before changing code. Current browser probe in progress; no new confirmed issue or acceptance tick yet.


## 2026-10-31 — JOB01 Pause refusal / checkpoint uncertainty

Actual browser RED: Pause / Halt Traversal received synthetic503 and displayed no error (job-pause-feedback-red.log, missing accessible alert assertion). Current correction shares existing control busy/error/abort ownership between Pause and Resume;15s total stop+checkpoint deadline, abort-on-close, no private server response text. Stop refusal remains distinct from acknowledged stop whose checkpoint is unavailable.

If stop is acknowledged but checkpoint read fails, keep polling and state explicitly that checkpoint is unconfirmed. If returned checkpoint is still active, display finishing-work message and continue polling. Only observed terminal checkpoint stops polling; subsequent terminal progress clears the uncertainty message. New browser test exercises503/private text omission, held stop/real15s abort, stop200+checkpoint503, continued progress requests and laterSTOPPED recovery. Focused browser/current checks pending; this is synthetic isolated feedback behavior, not final live/manual QA.

Pause final checks: typecheck, lint, E2E typecheck, production build, scoped Pause+Resume browser tests (2passed48.1s;23.6s Pause and17.2s Resume), full test:v1 including three-scenario lifecycle runner, release smoke all exited0. Private stop/checkpoint strings absent; actual15s timeout and post-ack polling recovery observed. A temporary disabled-navigation assertion was discarded because it imposed an unevidenced UI policy; no navigation-disable requirement or verification is claimed. Exact committed package check follows. No unsupported broad JOB01 completion claim.


## 2026-10-31 — current MSIX factory verification / asset disappearance

Developer ZIP exact6b21ac0a4065c6208bc2491380b423c04207e5b9 package checker exited0:150manifest files; launch/packaged backup/privacy PASS; builde898e332047b131affa370f1d940f61ea157938446c36488da315e388a1217e1; disposable ZIP485fd1eb35695c73184856b929418c5a28b1559e16cd7700d421c7ba9cf184b3 removed. Still118 development files/Node/npm required, not customer ready.

Existing package content-secret scanner is implemented in package-windows and its canary test; do not treat the stale older unfinished-scanner note as proof of missing code. MSIX factory remains an internal unsigned candidate, not the developer ZIP nor final customer acceptance. Existing factory tests PASS actual npm lifecycle suppression and exact Git/build refusal/positive controls.

Actual clean-source factory on6b21ac0: production dependency staging and native launcher compilation completed; MakeAppx failed MSIX_PROTOTYPE_MAKEAPPX_FAILED. SDK log: missing Assets/PrototypeLogo.png, mapping line3,0x80070003; package creation0x8007000b. Read-only mapping inspection:27410 files, exactly2 mapped source files absent (logo and dist browser logo). No Windows Application Control cause established. No matching Defender1116/1117 events found in the scoped time query; this does not prove no security product action. No settings changed or files restored around a security block.

Controlled three-file SDK probe using the same manifest/compiled launcher/logo passed validation and left all three source hashes unchanged. Not a runnable customer package, not signing/installation evidence. Official mapping contract checked: https://learn.microsoft.com/en-us/windows/uwp/packaging/create-app-package-with-makeappx-tool . Separate observational preload retry records PNG existence after copying and before/after dependency/compiler/SDK stages without altering factory results. Current trace: both copied PNGs exist immediately before npm. Retry still running; do not restart or claim pass/failure before its terminal result. All candidates remain private temporary internal probes, not Desktop release snapshots.


## 2026-10-31 — current unsigned MSIX / extracted bundled-runtime evidence

Observational factory retry terminal exit0. Core source6b21ac0a4065c6208bc2491380b423c04207e5b9, app1.0.0-rc.2/schema2, builde898e332047b131affa370f1d940f61ea157938446c36488da315e388a1217e1. Existing factory unchanged; read-only preload observed both PNGs present after copying, npm, compiler, before mapping/SDK and after SDK. First attempt's disappearance did not recur and remains unexplained; do not invent a fix/security diagnosis. Current prototype remains UNSIGNED_INTERNAL_NOT_RELEASE_READY, manifest0.0.0.2/development placeholder publisher.

Private temporary candidate edgeview-msix-candidate-7cCG0N / EdgeView-1.0.0-rc.2-6b21ac0-UNSIGNED.msix,27411mapped files. Exact archive SHA25664048a2ed405e7f16c5aacb7fdd520e4f72cfb25ea9b87e2f0296ba68deb2816. MakeAppx full validation passed; no /nv, signing, install, trust changes, Store operation or public upload.

node scripts/verify-msix-runtime.mjs with that independently observed hash exited0. It re-extracted the exact MSIX, checked all recorded files and build artifact, required bundled Node to be byte-identical to the already executing vendor runtime, then launched it with System32-only PATH/empty NODE_PATH and isolated empty storage. PASS: empty first launch, synthetic Kenya/Pakistan identity-separated CSV upload, scoped Kenya HTML export excluding Pakistan, missing-provider503, diagnostics omit private path/business markers, owner-pipe close durable shutdown, stable installation UUID/data across restart and no app-directory state writes. Evidence result.json retained privately under candidate runtime-acceptance-PPRxbk; raw test state not in MSIX. Native launcher NOT EXECUTED; installed activation/clean Windows/updates/rollback/real-company research NOT VERIFIED; monitoring disabled.

Additional independent checks: node scripts/package-content-secrets.test.mjs exited0 (benign payload, credential/encoding canaries, scanner offline/HTTP/integrity failures, prior artifact preservation and no synthetic secret disclosure); node scripts/release-license-inventory.test.mjs exited0 (safe inventory semantics, not actual legal clearance). These reuse existing implementations, no new scanner.

Next concrete payload evidence: production esbuild external graph contains12 backend packages plus developer-mode vite. Nine root production dependencies are not backend externals (@tailwindcss/vite, @vitejs/plugin-react, esbuild, lucide-react, motion, react, react-dom, recharts, tailwindcss). Current prototype carries them as Node packages in addition to compiled UI. Finish a reviewed runtime manifest/locked dependency boundary and preserve frontend bundled-component notices; do not simply delete canonical dependencies or lose license evidence.

Supported browser inventory and documented Windows computer-use initialization were explicitly retried; both failed before any app/account access: failed to write kernel assets, system cannot find path, os error3. No dashboard observed or settings changed. This applies to account verification only; local engineering continues. No raw CDP/profile access/alternate-browser/security bypass.


## 2026-10-31 — runtime dependency inputs / production-only startup in progress

Measured production server external graph:12 backend roots plus Vite. The Vite reference was actually a top-level static import, not lazy development loading. A reduced12-root npm install was generated with canonical override/version/integrity guards; running the existing compiled6b21ac0 backend against it failed actual startup with Cannot find module vite (runtime-dependencies-red.log). Do not call that a runtime exploit; it is a confirmed packaging prerequisite.

Current narrow correction moves only the Vite import into the existing EDGEVIEW_DEV_SERVER branch. Installed runtime bootstrap forces that flag0 before loading backend. Actual bootstrap fixture with inherited flag1 failed1-versus0 before the fence and passed all existing owner-pipe/shutdown/exit-code cases afterward. Canonical developer package.json/lock remain unchanged.

New runtime-package-inputs derives roots via esbuild metadata, permits only the reviewed dynamic Vite exception, pins direct versions from canonical lock, preserves security overrides, and rejects unknown modules, unconditional Vite, missing roots, links/dev entries, version/integrity/registry drift. Actual npm reconciliation uses empty user/global configs, ignore-scripts and public registry; canonical-byte verification follows. Fully offline reconciliation required uncached uuid metadata; test now permits build-time public metadata using prefer-offline, not customer-side installation.

Full check/build and actual reduced-runtime smoke in progress: static shell must return200 despite host developer flag, all5 export formats must work, state/UUID must survive owner-pipe close/restart and app-root state writes must be absent. Do not mark runtime payload/factory complete from helper assertions alone. Existing MSIX factory is not yet switched to these inputs; frontend license notices and exact reduced-payload MSIX acceptance still required.

Automatic approval review rejected cleanup of only the failed private temporary staging app/cache (blocked by policy). No deletion occurred and no alternate deletion method was used. Failed candidate/logs remain preserved. Available disk capacity limits additional large staging, not the locally verifiable code/guard work.


Runtime-input final local checkpoint: actual reduced dependency smoke exited0 with327 lock components/12 direct roots, all canonical versions/bytes, no installed vite/react/react-dom/lucide/build plugins. Corrected compiled backend starts, static shell200/no HMR despite inherited developer flag1, all5formats render, owner-pipe close/restart retains UUID/data, no app-root mutable state. Host Node executable was used explicitly; this is dependency closure evidence, not installed/bundled/clean-Windows acceptance.

Source changes are limited to lazy development Vite import, packaged static-mode fence, derived input/lock guards and regressions/CI wiring. Canonical package.json and package-lock.json untouched. Pure graph tests reject unconditional Vite/unregistered imports; lock guards reject missing roots/links/dev entries/version/registry/integrity drift. Existing bootstrap owner-pipe cases passed with mode fencing. Workflow YAML parsed with available Python; read-only permissions retained, two checks added to existing Windows verify job. Hosted jobs have not been proved runnable.

Initial full check hit an isolated readiness timeout; focused durability test passed unchanged deadline. Subsequent full check reached the crash-restart fixture but hit its readiness timeout. Added bounded2s health probes (same30s polling window) and bounded fixture/status diagnostics, not longer deadlines or ignored errors; focused lifecycle and final npm run check/full V1 then passed, as did npm run test:release. The intermittent cause is not claimed repaired in product code. Production build, typecheck/lint, graph/lock guards and actual reduced-runtime smoke all passed.

Next: activate these inputs in the factory only with source-lock-bound notices covering compiled frontend dependencies and a reviewed runtime-file allowlist. Existing MSIX6b21ac0 remains the previous full-manifest prototype; it does not contain the new source. Broad DIST01 and all owner/clean-Windows/recovery gates remain NOT READY.


## 2026-10-31 — runtime-input exact-source package checkpoint

Committed/pushed9c2e4318bdad06bb81dffb5d1ce37ff49423781f rebuilt; isolated developer package checker terminal exit0.150manifest files; launch/packaged backup/privacy checks PASS. Build1662624bf25e8f95288121d1c40ddfc0b8bf7215dbb49285cc5b6915a3d814c6; disposable ZIP36e84442d4a3d5cb83ca627b8aac200b30b72309940ed6c95e22c2e3909ad4ea removed by owned checker. Still118 development files and installed Node/npm requirement; this developer ZIP does not activate the derived customer-runtime manifest or bundled bootstrap. Existing retained MSIX6b21ac0 is a separate older-source prototype.

Next runtime-file audit must trace actual supported controls to needed resources before activating a minimal payload. Read-only observation: standalone scripts/doctor.mjs imports shared build/runtime helpers, checks source freshness and has a fixed3901 health URL; no runDoctor reference was found in the inspected backend modules. Do not copy/wrap that CLI as an alleged working customer Doctor control without implementing/verifying the actual boundary and respecting owned runtime ports. This is an existing DIAG01/DIST01 acceptance dependency, not a newly claimed product defect. Preserve source-locked frontend notices when changing the install manifest.

Current tree was checked for unexpected writer changes; only this unit's declared files changed. No historical tree, live3901, customer data, provider configuration, Windows security setting or public release modified. Automatic-review-blocked failed-scratch cleanup remains unapplied; no deletion workaround. Broad readiness remains NOT READY.


## 2026-10-31 — additional entity-alias / local-history assignment reconciled

The supplied add-on extends CC01/CC02/DATA01/JOB01/QA01 through CC05 and HIST01. It does not replace the remaining release gates. Finish the current narrowly authorized packaging unit, then perform the required architecture/design inspection before identity/history feature edits. No Python application/sqlite3 implementation, duplicate identity engine or giant-JSON history table is authorized. Existing no-main-merge/no-live3901/no-customer-data/no-publication boundaries remain.

Initial read-only facts: server/company_identity.ts normalizes Unicode/case/formatting punctuation while preserving every word, suffix and spelling; canonicalEntityIdentityKey adds normalized country when available. server/db.ts currently derives contact/source IDs from an entity-key hash. These are existing grouping/cache mechanisms, not evidence of a legal-entity alias registry. Do not weaken them by stripping suffixes or treating unknown country/global name as unique. No AUTOCT_INCREMENT or normalized_name occurrence found in the inspected active server/scripts search.

server/job_manager.ts reusableContactRun checks referenced retained run, COMPLETED/PARTIAL status and exact company+country. The inspected predicate does not gate age/objective/provider policy. Existing country-policy validation and immutable loader/schema behavior still need whole-path inspection before defining new reuse semantics. src/components/ResearchWorkspace.tsx already opens saved run lists/payloads via local API; its list uses limit1000. Do not rebuild a second History store or confuse refreshing this saved list with live research. Existing per-contact publication ownership and stopped-job drain fixes must be retained.

CC05 acceptance fixtures explicitly required: Global Pharma versus Global Pharma Ltd same country; case/punctuation; Pvt/Limited/Ltd variants; same name in different countries; Sudan versus South Sudan; similar distinct businesses; same domain/slightly different name; typo with corroboration; typo without corroboration; shared generic sector tokens; ambiguous stays separate; verified alias persists after restart; original raw names/provenance unchanged. Fuzzy algorithms are evaluation only until needed; similarity alone must never admit a merge. Backend owns decisions; no globally unique stripped-name key or name-only new entity ID.

HIST01 acceptance explicitly requires useful company/country/time/operation/state/provider/cache-mode/summary, reopen evidence, valid existing reuse and explicit live refresh. Old history remains visible when stale. Reuse must account for freshness, requested objective/profile/result type, canonical identity, schema/pipeline version, provider context, quality and partial/failed states. Reconcile the earlier quota-saving default by making stale/invalid reuse honest and live spending explicit, not silently making every history visit call providers or deleting old evidence. Reopen-history zero-provider and force-refresh-new-operation must be observed, including restart/concurrency.

Prior AI suggestion review scope: the attached document supplies a defect checklist, not the complete original Python example. Do not claim a line audit of unseen code. Reject AUTOCT_INCREMENT as invalid proposed syntax (not a found EdgeView migration bug), Python sqlite3 as a stack mismatch, global normalized-name/country-blind matching, name-only IDs and aggressive suffix stripping as unsafe identity assumptions. Preserve the current conservative baseline. Investigate rather than assume implemented: true evidence-backed alias model; any actual need for Levenshtein/Jaro/token candidates; stale-cache/TTL semantics; schema/result and provider/objective-aware keys; concurrent uniqueness/integrity; idempotent migration/backfill; history pagination/retention; reference-only storage and adversarial tests. No listed sample defect is automatically attributed to current EdgeView.

Feature implementation state: planned/architecture inspection partial, not verified complete. Files reached read-only: company_identity.ts, db.ts, v1_identity.ts, job_manager.ts, ResearchWorkspace.tsx; next inspect sqlite schema/init/migrations, immutable run/index contracts, API/frontend event flow and existing identity/cache/history regressions. No identity schema change or backfill chosen or applied yet. Acceptance is correctness over deduplication, with country/isolation/raw-provenance/security/durability/recovery preserved.

## 2026-10-31 — runtime-only MSIX factory integration checkpoint

DIST01.RUNTIME_PAYLOAD remains IN PROGRESS. The internal factory now derives the twelve backend dependency roots from the actual server graph, reconciles its separate runtime lock under the existing lifecycle-disabled npm policy, and rejects manifest/root/component/version/integrity/registry drift before and after installation. Canonical source dependency manifests are unchanged. The factory retains license texts from the canonical source-build tree, including compiled frontend React, rather than losing them when Node dependencies are pruned. Mechanical capture is explicitly NOT VERIFIED legal clearance.

Changed implementation: scripts/build-msix-prototype.mjs, scripts/runtime-package-inputs.mjs, scripts/runtime-package-inputs.test.mjs, scripts/verify-msix-runtime.mjs. The exact-archive runtime verifier now requires lock/notice evidence, checks omitted build packages, deliberately inherits developer mode to verify static-mode fencing, and exercises five synthetic stored-file export formats. This verifier change has NOT yet been exercised against a newly built MSIX; the prior 6b21ac0 prototype is not evidence for this factory revision.

Observed checks: runtime-package-inputs.test.mjs PASS (including actual React text capture, independent unique frontend notice body and manifest lifecycle/override canaries); build-msix-prototype.test.mjs PASS (offline lifecycle policy and exact-source/build preflight); generate-third-party-notices.test.mjs PASS; both changed CLI syntax checks PASS; git diff --check PASS; npm run check PASS (typecheck/lint/full V1 including eight-company forced-interruption/resume test); npm run build PASS; npm run test:release PASS; progress-workspace.test.mjs PASS. Logs: .test-cache/runtime-notices-test.log, runtime-factory-inputs-test.log, runtime-notices-existing.log, runtime-factory-check.log, runtime-factory-build.log, runtime-factory-release.log, runtime-factory-board-test.log. Existing frontend size warning remains.

Resource limitation: C: has approximately 0.49 GiB free. A new full staging plus exact-archive extraction cannot be responsibly claimed or completed from this space reading. No new MSIX, trusted install, native activation, clean-Windows, update/rollback, final monitoring or customer truthset acceptance is claimed. Previously auto-review-blocked cleanup of failed temporary staging remains unapplied; no deletion bypass. Other local architecture/test work continues. Public/customer packaging and final snapshots remain gated.

Add-on architecture inspection continued read-only: active operational overlays use v1_contact_enrichment(company_id PRIMARY KEY, run_id, overlay_json, updated_at), with durable save before visible publication. The legacy contact_cache has company_name UNIQUE, but this schema alone does not prove it is the active legal-entity authority; current cache selection already recognizes company+country+role keys. Research history GET reads existing run records; list uses bounded limit without offset, and frontend requests limit1000. These facts inform CC05/HIST01 design, not completed aliases/freshness/pagination. The observed reusableContactRun predicate has exact-country/status checks but no freshness gate. No schema/backfill or raw-record mutation was applied.

Exact-commit package follow-up: check-package-isolated.mjs exited0 for b7e142978a83d15c6643e0a1cae58374004737b1. It independently produced and verified the150-file disposable developer ZIP, executed its unchanged-launch and staged-backup contracts, and passed private/runtime-file exclusion checks. Build1662624bf25e8f95288121d1c40ddfc0b8bf7215dbb49285cc5b6915a3d814c6; disposable ZIP SHA25643e3f2715ef075b4d5e36658902c9da9338677f42293747869e82ffc802b1879. The helper removed only its own validated fixture as designed. This ZIP still has118 development files and requires installed Node/npm: customerRuntimeReady=false. This does not close runtime-only MSIX/native/install acceptance. b7e1429 was pushed to the private integration branch; remote default-branch alert banner still reports8 alerts, not a new integration audit result. Worktree clean after the implementation commit. Desktop board regenerated with35 owner acceptance items/9queues/103board entries.


## 2026-10-31 — HIST01 bounded saved-history browsing

Design before implementation: reuse server/v1_engine.ts immutable runs plus the existing derived identity index, server.ts existing GET history APIs, and src/components/ResearchWorkspace.tsx. Add a deterministic timestamp+ID cursor, bounded50-default/200-maximum pages, and Older/Newer controls to the existing saved-run selector. No schema migration, second history store, TTL guess, alias merge, evidence rewrite or provider operation belongs in this paging unit. Use existing latest-request cancellation/deadline and saved selection behavior. A new run arriving ahead of the current boundary must not shift/duplicate older pages. History remains readable regardless of age; browsing is separate from future freshness-aware reuse.

Before: Research requested limit1000 with no next-page control; older headers were not reachable through that selector. The new regression first failed because no saved-history paging function existed (.test-cache/history-page-red.log). After: local API returns runs/next_cursor/limit; malformed or oversized query parameters receive structured400 HISTORY_PAGE_INVALID, storage list failures receive safe503 HISTORY_UNAVAILABLE. Pages derive from existing headers and never load provider/evidence blobs. Equal timestamps use ID ordering. Internal listV1RunSummaries consumers are unchanged. The API now accepts at most200 per page; the inspected supported Research caller uses50 and follows cursors. Existing GET run reads are unchanged; manual evidence opening does not become live research.

UI now offers Older/Newer saved runs, keeps selected evidence available across page changes and restart, labels list reload as saved evidence rather than live refresh, and preserves bounded cancellation/error/retry behavior. The full HIST01 parent remains partial: provider/operation summaries, freshness/schema/objective/provider/quality policy, explicit valid reuse/live refresh, retention and aliases remain open. Current lightweight headers do not invent provider/result counts.

Files: server.ts, server/v1_engine.ts, src/components/ResearchWorkspace.tsx, src/utils/researchRunValidation.ts; server/tests/research_history_page.test.ts wired into test:v1; tests/e2e/research-history.spec.ts; test-only fixtures.ts/no-egress.cjs now support isolated synthetic history and count blocked outbound attempts. Customer runtime never imports the test guard. All records are generated in a validated disposable test root. No live3901, customer/history/original workspace modification.

Observed checks: npm run check PASS (typecheck/lint/full V1 including1005 immutable records, equal timestamps, arrival between pages, invalid cursor/limit, Sudan/South Sudan and fresh-process restart); npm run typecheck:e2e PASS; npm run build PASS (existing bundle warning); npm run test:release PASS; runtime-package-inputs.test.mjs PASS; initial Research markup/storage-denial check PASS. Actual Playwright research-history test PASS18.9s overall: real HTTP walks1005 records, malformed queries rejected, UI navigates all21 pages to oldest run, original evidence country retained, selection survives runtime restart, simulated503 retried, no mutation requests and zero recorded backend outbound attempts. Related privacy disclosure/research feedback browser tests PASS2tests14.6s. Logs .test-cache/history-page-check.log, history-page-build.log, history-page-release.log, history-page-e2e-typecheck.log, history-page-browser.log, history-related-browser.log, history-runtime-inputs.log. This is isolated synthetic browser acceptance, not final live visual QA or real-company correctness.

Known limitations: paging sorts existing lightweight headers in memory; no large-scale warehouse claim or deletion/retention introduced. Cached header integrity/rebuild remains existing behavior. Alias admission still requires independent evidence and durable controlled mappings; shared domains/suffix similarity do not authorize a merge. Runtime-only MSIX/native/clean-Windows/update/dashboard/owner credential gates remain unverified. Readiness NOT READY.

Exact-source HIST01 paging checkpoint: 1725b8acb5482b5fcc76fd4794f6ddad42d5587f; build c6a3bc2159b6c58ed71b204ce8fa47e5ddf7a30e798febb90116a336bab30e9f. check-package-isolated.mjs terminal0:150 files, unchanged launch PASS, staged backup PASS, private/runtime-file exclusion PASS; disposable developer ZIP SHA2562bdc5726d4ac69f7cbd5533eca5159c8aca4321a5c2ac66ca80aab8173fe2bde. Fixture removed only by its existing validated cleanup. Still118 development files/installed Node/npm dependency/customerRuntimeReady=false; not a new MSIX or installed/customer acceptance claim. Current source/full V1 and isolated Playwright history paging acceptance passed; remaining parent goals unchanged.


## 2026-10-31 — HIST01 recorded request context and honest retained feedback (implementing)

Architecture/design: keep metadata on existing immutable V1Run records and their derived identity headers. No new database, schema migration, cache table, second history authority or legacy-record rewrite. Add format1 research_context with fixed company-contact-research objective, interactive/bulk profile, pipeline_version1, current V1 contact result-schema version, and SHA256 of an explicit supported-provider configuration projection. Only enabled/configured booleans, model/base selection and AI ordering enter that projection; provider key VALUES never do. Do not hash all settings or credentials. This is a REQUEST-context snapshot, not proof of every actual provider attempted or settings consistency throughout a concurrent run; actual attempts remain raw records/timeline. Incompatible pipeline changes must advance the pipeline revision/result schema as appropriate.

Reuse reporting remains separate from freshness admission. Existing explicitly useful retained-source revalidation must still work offline and preserve stronger historical evidence. Existing automatic incremental-reuse behavior is preserved in this narrow foundation unit, NOT accepted as a complete freshness policy. No arbitrary TTL is invented and no provider quota spent by opening history. Old runs without context remain unverified; equal context only means recorded request compatibility, never current fact truth or live verification. TTL/quality/partial/provider/objective gating and user choice across every single/SSE/background path remain HIST01.POLICY/ACTIONS open.

Implementation files: server/v1_engine.ts stamps early metadata before large raw arrays, retains it in summaries/header scan/index append/restart, and describes compatibility/canonical UTC capture dates. server.ts adds evidence_origin and reuse_assessment to the single-company response. src/store/appStore.ts says captured date (or unknown) and not checked live for reused results. No telemetry event/property added, no raw model/settings/credentials exported by this metadata. Operational schema2, evidence blob storage format2 and contact projection schema30 remain distinct and unchanged. Research-context format1 is not an operational database version.

Regression first failed for absent context API (.test-cache/research-context-red.log). New research_context.test.ts exercises actual engine executions with providers disabled, honest FAILED status, distinct sequential operation IDs, interactive/bulk metadata, initial prefix scan, live index append and fresh-process restart; strict metadata equality rejects changed profile/pipeline/result/provider selection. Key-rotation invariance and synthetic marker checks guard against credential-value fingerprinting or raw emission. Invalid/non-ISO/impossible capture dates stay unknown. Test is wired in test:v1. scripts/cached-revalidation-runtime.test.mjs adds actual HTTP/browser retained-mode assertions: legacy context/capture unknown; matching context with January capture still not_live_verified; changed synthetic model yields different_context; all preserve country identity, durable export/restart and zero egress. Final full checks in progress; broad readiness NOT READY.


HIST01.CONTEXT foundation verified: final typecheck/lint PASS, final full test:v1 PASS including context/history/country/evidence/persistence/batch recovery, build PASS, release smoke PASS. Final cached-revalidation-runtime.test.mjs --browser PASS after capture-date validation change: actual retained offline HTTP/browser feedback, matching-but-old metadata remains not_live_verified, changed owned synthetic model shows different_context, legacy metadata/date unknown, country/force refusal, durable export/restart, zero egress; screenshots captured but not manually reviewed. Related research-history/research-feedback Playwright2tests PASS20.7s; no final live visual gate claimed. New context test actual engine/profile/IDs/header scan/index append/restart/key-rotation/unknown-date canaries PASS. Logs .test-cache/research-context-final-types.log, research-context-final-lint.log, research-context-final-v1.log, research-context-build.log, research-context-release.log, research-context-green.log, research-context-retained-browser.log, research-context-browser.log. Desktop projection test PASS9queues/35acceptance/105board entries. No provider keys/customer state/historical tree/live3901 touched. Metadata/configuration matching does not authorize an alias merge or certify factual freshness. Remaining policy/alias/release gates unchanged, NOT READY.

Exact-source request-context checkpoint: 69bfe6230bc01b5332f217a86f9901b7d3178688, build dd9548219e7af48d7cda09bd5796dc433d345040c8157688d6f00738695cafd0. Disposable isolated developer-package check terminal0:150files, unchanged launch/staged backup/private-file exclusion PASS, ZIP SHA256c1827c6706cb7d82eeff879f2c810dc0218e6460924f1496e80c18bb491cbfde;118 development files/customerRuntimeReady=false/installed Node required. Fixture removed by its validated helper; no MSIX/native/customer acceptance inferred. Existing monitoring_privacy.test.ts and actual local SDK-wire monitoring_transport_privacy.test.ts terminal0 after this change; no real dashboard delivery claimed. Runtime roots/lock/notice guards still PASS12direct roots with frontend notice retention and no new dependencies. Logs .test-cache/research-context-exact-package.log, research-context-monitoring-privacy.log, research-context-monitoring-transport.log, research-context-runtime-inputs.log. Disk remains about0.49GiB; full runtime-only MSIX staging/extraction pending headroom. Next local work remains freshness-aware request policy and conservative alias design/admission; context reporting alone is not cache validity. NOT READY.


## 2026-11-01 — HIST01 recent/saved/live reuse policy checkpoint

Inspected current authoritative source before edits; only declared in-progress files changed. Stack and authorities remain TypeScript/React/Express, sql.js/JSON datasets/immutable V1 runs. This extends CC05/HIST01, never replaces older goals. No Python/sqlite3 application, alias stripping/merge, schema migration, raw-data rewrite or second history store introduced.

Policy design: automatic current-result eligibility requires an exact company+known nonempty country key, COMPLETED capture, matching recorded profile/objective/pipeline/result/provider context, valid UTC start/completion ordering, no future completion and capture no older than seven days. The seven-day constant is shared between backend and UI and is an operational limit, not proof that facts remain true. PARTIAL/FAILED/RUNNING, legacy/changed context and unknown/invalid timestamps cannot be silently treated as current. Opening any old run remains local; explicit saved-source revalidation can still inspect/reproject old or partial successful evidence without provider quota. Force Fetch/live mode explicitly requests a new operation. Existing offline retained-evidence fallback remains historical and labelled not checked live; no auto refresh spending to rescue a stale cache.

Single-company and SSE requests with online providers now return structured409 SAVED_EVIDENCE_NEEDS_CHOICE for old/partial/incompatible saved references before a provider operation. Mixed batch selection is checked through lightweight identity headers, not thousands of hydrated raw payloads. New jobs persist reuse_policy_version1 plus saved-only/live intent in the existing company-state JSON (no schema change). Explicit live permission survives restart; unavailable live capability refuses resume rather than reusing historical data under a live label. Saved-only jobs cannot be forced live. Start preflight rechecks pending references after context changes, and worker checks again before operation. Legacy jobs preserve their prior historical semantics and are labelled as legacy/historical rather than upgraded into fresh-cache evidence. Durability barrier precedes acknowledged job intent; existing contact publication queue/stop-drain/checkpoints retained.

Controls: Contacts has explicit Recheck Saved in addition to Fetch Details/Force Fetch. Batch offers recent-compatible, saved-only and live/quota choices; mode changes clear the selection, and reopening a new job resets live selection. A restored job derives a visible mode notice from persisted queued state; live resumption states it may use quota. Offline evidence review stays available. React review skill applied to derived mode state, accessible labels/buttons and effects; no unrelated decomposition/framework adoption.

Files: server/v1_engine.ts, server/job_manager.ts, server.ts, shared/v1_contact_contract.ts, src/components/Contacts.tsx, src/components/BatchEnrichmentModal.tsx, src/utils/batchSnapshot.ts; server/tests/research_reuse_policy.test.ts; scripts/research-reuse-runtime.test.mjs; tests/e2e/research-reuse-choice.spec.ts; package.json wires pure and real-route policy regressions into test:v1.

Observed checks: pure policy first RED for absent gate, then PASS age boundary (+1ms refuses), future/invalid clocks, unknown/Sudan-South Sudan/name identity, profile/objective/schema/pipeline/provider/quality changes. Actual route/job fixture PASS recent versus old/partial/legacy/profile mismatch; no fallback operation; explicit historical/live; live intent restored after restart; offline-live refusal; saved-only protection; pending context changed before start refusal; old immutable bytes/history unchanged; zero actual network attempts. Only the live engine operation body is synthetic in that routing fixture, so it does not prove provider transport/live truthsets. Full npm run check PASS including final runtime policy fixture; typecheck:e2e PASS; build/release smoke PASS. Browser history+choice+restored-intent tests PASS3tests30.8s; related old contact-export/resume cases PASS2tests33.6s. Logs .test-cache/research-reuse-policy-red.log, research-reuse-policy-green.log, reuse-policy-runtime.log, reuse-policy-final-check.log, reuse-policy-types.log, reuse-policy-lint.log, reuse-policy-e2e-types.log, reuse-policy-build.log, reuse-policy-release.log, reuse-policy-browser.log, ci-historical-browser-recheck.log. Initial fixture compilation/root setup failures were corrected before this PASS; not counted as product defects. No customer package created in this unit.

Limits: request-context capture still describes configuration at request start; per-stage settings consistency remains JOB01/HIST01 work. Full History provider summaries/direct action integration/retention and CC05 canonical alias admission remain unfinished. Fresh eligible captures are NOT factually reverified by time/context equality; response continues not_live_verified for reuse. Real company truthsets and final live visual QA remain open. No main merge, original/historical tree modification, live3901 restart, customer data or privileged credentials touched. NOT READY.

## 2026-11-01 — hosted CI recovery and failure triage

The owner reported the monthly reset. Authoritative GitHub inspection initially counted581 historical runs/187 failures. Latest three workflows at a3bdcbb had six jobs and zero executed steps; all carried the account billing/spending refusal annotation. This classifies those recent failures, not all historical failures. No spending limit or account plan changed.

Retried only evidence job124614751017 from run41227550977. Attempt2 executed as job124753003633 and finished SUCCESS, including license, notices, SBOM, release-evidence, telemetry privacy, read contract, lock inventory, bounded history scan and private evidence upload. Exact source a3bdcbbd9d8eae57610dc563108a0055383e93dd; https://github.com/MuhammadAsim8528/edgeview-v1/actions/runs/41227550977 . It proves hosted execution resumed, not complete checks for new policy commit7753043.

After that success, all186 remaining failed runs were enumerated: integration release64/read53/evidence42; coordinator release1; earlier chatgpt release15; main release11. Keep their historical conclusions. Latest old coordinator/chatgpt browser logs failed waiting for All exporters in contact-export.spec.ts. Current source already exposes that control; the unchanged current test passed5.4s, with resume feedback also passing18.1s (two tests33.6s). Do not rewrite a passing current selector merely to erase an old failure. The inspected older main run314ee32 failed production dependency audit. Fresh current integration audit:0high/0critical/10moderate. Moderate findings and default-branch alerts remain unresolved; no main merge authorized.

Private GitHub connector access returned404 and gh was unavailable. Existing authorized Git sign-in supported repository-scoped REST inspection. No credential value was printed or saved. Safe reports/local logs remain ignored under .test-cache: github-actions-current.json, github-actions-latest-jobs.json, github-evidence-retry.json, github-failure-inventory.json, github-actions-older-branches.json, ci-reaudit.json, ci-historical-browser-recheck.log. No raw log or customer record enters the progress board.

A combined documentation/commit/push command was rejected by automatic approval review with blocked by policy; it did not execute. Tree inspection confirmed the code commit remained7753043. Documentation was then edited separately through structured patches; no deletion, security-setting bypass, historical workspace or live runtime change. Complete exact-new-source CI is still pending.
