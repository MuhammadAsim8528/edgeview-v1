# Research read selection and recovery — 2026-10-23

Scope: ResearchWorkspace and its UI-read helpers only, on the exclusive
ChatGPT branch. No provider routing, immutable evidence, backend state, Qoder
file, dependency manifest or live installation was changed.

## Source defects and change

The prior details effect accepted any successful late response after selection
changed and did not cancel unmount/reselection. Failed list/detail reads had no
explicit error state. Refresh treated absence from the newest1000summaries as
proof that a saved selection was unavailable and silently picked another run.

Separate replaceable list/detail readers now abort obsolete work, suppress late
publication even when abort is ignored, settle a stalled read with a15second
timeout, and clear timers on completion/cancel. This is a read/network await
deadline, not a guarantee against blocked browser JavaScript or huge JSON parse
CPU. Each reader retains only its current cancellation handle, not a run history.

Rendering is bound to loadedRun.id===selectedId. A response for another identity
or malformed display collection is rejected without editing stored evidence.
Existing valid data for the SAME selected run survives failed refresh; another
company's previous details are hidden. Alert/retry, accessible refresh/selector,
busy/loading and truthful empty/unavailable states remain available. The saved
ID survives a bounded recent index and can use the existing direct lookup API;
invalid/deleted selection reports an error instead of silently substituting data.
Browser storage denial no longer prevents initial rendering; persistence is then
best-effort in memory, not falsely reported durable.

React skill review: stable per-component request owners; effect cleanup on
unmount/reselection; no polling or render-triggered provider calls; native select
and aria-labelled refresh; role alert/status; no app redesign or new framework.

## Executed checks

Node24.19.0, separate worktree npm ci --ignore-scripts installed542packages;
package.json/lock unchanged. First typecheck caught deferred test Promise type
inference failures; explicit fixture types corrected, then rerun passed.

- latest_research_request.test.ts via both Node type stripping and tsx: PASS.
  Tests reversed completion order, deliberately abort-ignoring late response,
  unmount/cancel, pre-dispatch cancel, thrown transport error, HTTP404 forwarding,
  deadline/late body, successful retry,200repeated reads, wrong/malformed run
  identities/collections and retained selection outside1000recent summaries.
- research_workspace_presentation.test.tsx: PASS initial React static markup
  with denied storage, labelled refresh/loading. It does NOT execute effects,
  click controls or certify rendered browser behavior.
- npm run check: PASS typecheck, lint, V1 requirement/identity/contracts/blob/
  persistence/failure-order/provenance/Excel suites. Expected synthetic write
  failures were asserted by their tests, not ignored production errors.
- npm run build: PASS. Latest candidate build ID
  7512a60c58edeb797f97b0add33811dab42a8b89b7dd7db47f4573156716ff05.
  Built against uncommitted candidate content, not a frozen release tag.
  Vite warns about a512.06kBclient chunk. No performance clearance inferred.
- npm run test:release: PASS isolated compiled backend/static shell/HTTP gate.
  This does not exercise the changed component in a browser.
- Workflow YAML parsing and git diff whitespace checks: PASS.

## Missing evidence / release constraints

Supported Computer Use still fails before app enumeration; actual selector,
loading/retry/refresh and rapid navigation must be exercised after integration.
No real-company result, full importer coverage, accessibility, sustained leak
trend, current paid provider or clean Windows result is claimed.200repeated
controller reads are NOT a memory-leak or browser stress test.

Windows package generation/verification was NOT rerun: the existing packager
targets the shared output also owned by the main/Qoder workflow. Do not overwrite
it from a parallel branch or confuse old package proof with this candidate.
Live PID30112 remains unchanged. A separately isolated research-contract CI
workflow was added; main CI and its known high dependency-audit failure remain
untouched. Exact hosted result is not inferred from workflow presence.
