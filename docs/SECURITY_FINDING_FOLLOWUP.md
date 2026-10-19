# Independent report follow-up — 2026-10-19

The local untracked `EDGEVIEW_SECURITY_AUDIT_FULL.md` contained plaintext
credentials. A mechanical redaction removed credential-shaped values without
reading or changing active configuration. That report is now ignored by Git.
Because its original content was exposed in a local report/tool output, affected
provider keys should be rotated by the account owner. No credentials were revoked
or transmitted by the corrective tests. Redaction cannot revoke an exposed key or
erase previously retained copies of an output.

The report is untrusted review input. Its CVE-style labels are not evidence of
registered CVE identifiers or verified severity.

## Confirmed and corrected

- Saved NVIDIA keys could be reused with a request-controlled public origin.
  Private-address rejection already occurred before network transmission, so
  merely resolving a key in memory did not establish the report's loopback proof.
  The separate public-origin risk was real. Saved keys are now origin-bound in
  both model discovery and the underlying connection-test transport.
- Model fetches followed redirects and lacked a timeout. They now reject redirects
  and use a 20-second abort signal. NVIDIA transport performs DNS safety validation.
- Model cache entries used a six-character credential suffix. They now use SHA-256
  of the full credential, and the cache retains at most 32 entries.
- GET model discovery lacked a request budget; it now shares a 12/minute bucket
  across methods. Mutation limiting covers non-API upload aliases as well, with a
  fixed bucket name that cannot grow with arbitrary request paths.

## Claims requiring care

- JSON body parsing already applies globally with a 5 MB limit.
- Host/origin checks and security headers already apply globally, including static
  responses. API-only rate limiting was a separate issue corrected above.
- Plaintext local configuration is a real at-rest limitation; DPAPI migration is
  not implemented in this patch. Same-user compromise is outside the current
  isolation boundary and encryption alone would not isolate that account.
- Dynamic imports of local bundled code do not require browser subresource
  integrity. A compromised application file requires a broader integrity model.
- Process environment synchronization and launcher/path trust still require
  separate evaluation; this document does not mark the whole report resolved.

## Verification

`server/tests/model_credential_origin.test.ts` uses a temporary configuration,
synthetic keys and mocked transport. It proves cross-origin saved-key rejection,
masked-key rejection, connection-test rejection, distinct cache entries for keys
with matching suffixes, identical-key cache reuse, and redirect/timeout options.
The release smoke test exercises model-discovery GET rate limiting in an isolated
server with test storage. No production credentials or evidence are modified.
