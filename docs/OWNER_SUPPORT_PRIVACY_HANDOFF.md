# Owner remote-support privacy acceptance — FAIL, 2026-10-23

This is a read-only execution probe of Qoder's uncommitted telemetry adapter,
not a change to its worktree, not a sealed security scan, and not a customer
incident. All inputs were synthetic. No SDK initialization, network operation,
account event, configuration read or production record was involved.

## Reproduction and evidence

Node24.19.0 command, run from the exclusive ChatGPT worktree:

`node scripts/probe-telemetry-privacy.mjs <Qoder-root>/server/telemetry.ts`

Observed adapter SHA256:
`1c6ed5e7eef5f83213b7c7efc35e9036ebd3dabee6c2822b417aab2b31dcd15b`.
Source bytes were reread after probe to reject concurrent modification. The
actual pure TOKEN_PATTERNS/deepScrub/scrubSentryEvent code was extracted, Node
type-stripped and evaluated in a bounded VM without imports or initTelemetry.
This is narrower than full SDK integration; the preserved source hash binds it
to one candidate. Exit1 is an expected demonstrated privacy failure, not a test
runner malfunction. Node stripTypeScriptTypes emitted its experimental warning.

All nine probes FAIL (marker survives returned event):

| Surface | Required boundary |
|---|---|
| Message containing company text | No business identities in free-form messages |
| Context with email | No contacts, even without a credential-shaped key |
| Extra with raw evidence | No provider/research bodies |
| Breadcrumb containing prompt | No prompt/user payload |
| Exception value | Error message may itself include private content |
| Stack frame filename | No unnecessary user/local paths |
| Request URL query | Removing query_string does not remove query embedded in url |
| NVIDIA-shaped credential in message | nvapi pattern absent from candidate TOKEN_PATTERNS |
| Groq-shaped credential in message | gsk pattern absent from candidate TOKEN_PATTERNS |

No sensitive marker value is printed by the probe. Its own regression verifies
leak detection, unsupported-source refusal and no vendor initialization. A
scrubber returning an empty object receives NOT VERIFIED, not useful monitoring
or delivery PASS. This is an adversarial test, not an implementation-mirroring
assertion that current output is correct.

## Additional source-backed gaps (not runtime proof)

captureProductEvent accepts arbitrary event names and properties and forwards
them to PostHog. No business-data allowlist exists there in this candidate.
Sentry beforeSend scrubbing does not cover every SDK envelope/event type, and
exception values/stack data remain outside the scrubbed fields. The configured
status text claims “no headers” while nonsensitive-named headers survive.
Transactions are dropped/tracing sampled0; the requested tracing is unfinished.
Configured initialization is not successful delivery or current online status.
Current tests reward preservation of arbitrary extra/context values, so green
tests do not establish the user's stricter privacy boundary.

## Qoder-owned fix contract

Keep telemetry disabled for customer/private-data use until accepted. Do not
enable an account merely to check whether this candidate's unsafe event arrives.
Use a strict vendor-independent allowlist projection rather than trying to find
every secret/business pattern in arbitrary content. Accept bounded numeric
resource/timing values, enumerated provider/stage/error codes, release/build
metadata, channel and protected pseudonymous installation ID. Untrusted arbitrary
messages, requests, exception values, breadcrumbs, tags and context strings are
not safe telemetry just because they lack a recognizable token prefix.

Map errors to approved error classes/codes and product-relative safe frames
where demonstrably needed; never ship filesystem usernames, request URLs or raw
exception messages by default. Validate PostHog event names/properties centrally.
Apply the boundary to errors, logs, traces, metrics and integrations, not just
beforeSend. Replay remains OFF. Security controls cannot be disabled by flags.

Regression must invoke actual adapter capture/SDK transport with a recording
offline transport and assert final outbound envelopes contain none of the
synthetic sensitive classes. Exercise SDK-generated exceptions, request headers/
URLs, breadcrumbs, spans and unhandled errors. Measure bounded queues/flush and
prove disabled/offline/bad-config startup doesn't fail or hang. Then controlled
safe real account events must be observed in the intended Sentry/PostHog projects,
with exact build and delivery status. That stage remains NOT VERIFIED.

This branch deliberately does not add a competing telemetry service or modify
Qoder's server/telemetry.ts, identity, dependencies or main CI workflow.
