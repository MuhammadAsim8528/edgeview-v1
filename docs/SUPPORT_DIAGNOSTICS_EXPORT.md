# Local support diagnostics export

Settings > Support diagnostics provides Preview diagnostics, then Download diagnostics.
The user reviews and shares the JSON separately; no support upload is performed.
The endpoint /api/diagnostics/support returns no-store bounded allowlisted metadata:
version/build/commit, pseudonymous installation ID, runtime version/platform,
operational DB status, resource measurements and monitoring state. Unknown schema
version is explicitly null. This is a support snapshot, not a full raw-log archive.
Credentials, configs, datasets, research evidence, raw log/exception text, usernames,
paths and hardware identifiers are excluded. Unsupported measurements stay unknown.
Requests have an eight-second UI deadline, coalescing, unmount abort and retry.

The projection regression includes injected private markers and malformed values.
Isolated Chromium verifies failure/retry, actual backend preview, safe fields,
and a downloaded file byte-equal to the preview. No real local data is used.

Monitoring delivery also now observes Sentry transport HTTP status rather than
assuming a completed SDK flush means acceptance. Rejected/offline endpoints report
failure and recover after repair in the actual-SDK regression. PostHog has a 3s
request timeout and zero automatic request retries. Both queues remain bounded by
SDK settings; this does not establish long-run resource-leak acceptance.
Sentry default integrations and default PII are explicitly disabled. beforeSend
reprojects message/tags/extra and deletes fields outside the final envelope allowlist.
The transport privacy regression now includes accidental direct SDK exceptions and
private logger/transaction/request/tag/extra fields as well as adapter inputs.

Existing real-account receipt evidence predates these changes. New source-level
and local HTTP proofs are separate from new real-dashboard receipt. Hosted CI,
MSIX install/update, production signing, data migration and rollback remain open.
No packaging/publication or live runtime restart is part of this change.
