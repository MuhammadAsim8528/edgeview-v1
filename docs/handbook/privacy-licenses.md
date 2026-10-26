# Privacy and third-party software

Working guide — describes the current implementation, not legal advice or a
claim of completed publisher/legal review.

Imported records, operational state and immutable research captures are local.
This does not protect them from someone with access to the Windows account.
Windows provider credentials use the existing protected store; do not distribute
that configuration or treat a copied protected key as portable recovery.

Research and monitoring are separate external flows. Research sends company and
country, generated queries, and selected fetched page content to configured
search/AI providers. Hunter may receive a resolved domain. Websites and providers
see connection information and apply their own policies. Enrichment needs network
access and valid provider access; local-first does not mean offline research.

Optional Sentry error reports and PostHog allowed usage events use the strict
outgoing allowlist. They must exclude customer rows, company/contact details,
prompts, evidence, credentials, raw exception text and private paths. A random
installation UUID is not HWID licensing. Session replay is off. Monitoring
preferences separately control error and usage reporting; installation-level
disablement cannot be overridden by those controls.

Support diagnostics are previewed before download. Download does not upload
anything. Private backups are not diagnostic exports. No automatic local-history
deletion period is promised. Actual dashboard receipt and account privacy controls
need release-specific evidence; successful SDK flushing alone is insufficient.

EdgeView includes third-party software. The engineering OSS inventory and actual
dependency license evidence must accompany the accepted runtime distribution.
This guide does not substitute for the final license texts/notices. Publisher
identity, public support/privacy URLs and distribution obligations remain subject
to owner confirmation; do not invent them.
