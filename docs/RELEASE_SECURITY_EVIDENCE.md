# Release security evidence, 2026-10-23

This branch adds an independent workflow without modifying Qoder's ci.yml or
package manifests. It needs only Node24 and Git: no install scripts, provider
credentials, private datasets or telemetry configuration. CI artifact records
the exact commit and production-lock license metadata. Existing history-pattern
gate is reused, NOT relabeled a comprehensive secret scan. A failed gate remains
failed; always-upload preserves evidence rather than overriding the conclusion.

Run locally: `node scripts/release-license-inventory.test.mjs`, then
`node scripts/release-license-inventory.mjs`. The latter emits JSON to stdout,
including lock SHA256. It does not write into customer/runtime output paths.
Unknown license metadata and copyleft are WARN. Other strings are NOT VERIFIED,
not legal clearance. Review actual license texts and create notices separately.
This supplements existing standard npm CycloneDX SBOM; it does not replace it.

Dependabot configuration covers npm, Actions and Docker weekly, without auto
merge. Activation requires landing in the default branch and observed service
execution. A branch file is not evidence that updates/alerts are enabled.

## Hosted security availability

Later authenticated REST read succeeded through the existing Git credential
manager; see CI_EVIDENCE_2026-10-23.md. Inventory hosted success is now observed
for275fc01, but main release checks fail the dependency audit. Security feature
availability remains unproven because the metadata field returned null.

Git access succeeded, but connector get_repo returned404 for this private repo.
CodeQL entitlement, secret-scanning/push-protection and repository enabled state
are NOT VERIFIED. Do not silently add a failing CodeQL upload or mark an absent
feature PASS. GitHub's current docs require the appropriate Team/Enterprise and
Code Security enablement for private code scanning. Confirm on the owner account
before selection. Existing ESLint/static gates, npm audit and history-pattern gate
remain useful but are not equivalent to CodeQL/entropy scanning.

Official references checked (Firecrawl developer search failed402; official web
search fallback used):
- https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-version-updates
- https://docs.github.com/en/code-security/reference/code-scanning/troubleshoot-analysis-errors/private-repository-enablement

Current CI execution for this branch is NOT VERIFIED until an actual run tied to
its commit is inspected. Workflow presence, a local test and artifact creation
do not prove production security or license compliance. Existing moderate npm
advisories and missing license metadata remain open in OSS_INVENTORY.md.

## Local execution evidence

At parent b6b8cdc, Node24.19.0/npm11.17.0: focused inventory test PASS;
`node --check` PASS; both YAML files parsed with installed PyYAML (validation
tool only, not a Python product runtime); diff whitespace check PASS. Real lock
digest fff0dccfa11c16798b5f6f56bd02c58a6571ddf31d24b9d8d502db5084d90a82:
514 production lock entries, four missing license strings, 13 copyleft-review
entries. Counts are not deduplicated package identities or legal determinations.
Existing Git pattern gate scanned53commits/383historicalpaths, no prohibited path
or known-pattern matches. No entropy/full-scope guarantee. No app build/provider
request/customer package was run: these additive Node-only inventory files do
not change runtime source or dependencies; full release gates remain open.
