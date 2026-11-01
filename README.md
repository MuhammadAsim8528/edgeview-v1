# EdgeView V1

EdgeView turns an exact company name and country into a bounded, inspectable research run.

## Frozen V1 architecture

1. EdgeView supplies the exact company name and country.
2. AI generates a compact set of identity-anchored search queries; selected captured content can also undergo bounded evidence extraction.
3. Deterministic code calls configured search and retrieval providers.
4. Every attempted provider request stores its complete raw response or a structured failure record.
5. Results are normalized without deleting the immutable raw evidence.
6. The Research UI exposes queries, provider, rank, title, URL, snippet, captured content, links, metadata, latency, status, errors, raw records, and timeline.

Bulk enrichment is resumable. Importers, exporters, all companies, or a manual selection can be started immediately; there is no 25-company pilot or second approval gate.

## Windows launch

Requirements for the current developer package: Windows, npm and Node.js 20.20+ on 20.x, 22.22+ on 22.x, or 24+. A self-contained customer installer is not yet accepted.

1. Extract the package to a writable folder.
2. Double-click `EdgeView.bat`.
3. The launcher installs dependencies only when missing, uses the included production build, starts the loopback-only server, and opens `http://127.0.0.1:3901`.
4. Enter API keys in Settings. Live keys and user datasets are deliberately excluded from distributable packages.
5. Upload an NVL/DBF/CSV/Excel file, open Contacts, select a scope, and click **Enrich Selection**.

To stop EdgeView, close the launcher window or press `Ctrl+C` in it.

## Development verification

```powershell
npm ci
npm run lint
npm run test:v1
npm run build
```

The packaged build is not claimed to work offline: provider enrichment requires working API credentials, provider quota, and network access.

## Status and documentation

This is a development candidate, not an accepted self-contained customer release.
Start with the [documentation index](docs/README.md) and
[authoritative acceptance ledger](docs/OUTSTANDING_WORK.md).
The permanent Pharma-AI development checkout now uses `development/edgeview-v1`.
Reviewed integration source was brought across at `3ac6c39`; the older `main`
history remains recoverable. `edgeview-integration` is retained as a reference
checkout, not a second active writer. Git remains authoritative. Updating source
does not replace a running backend: verify dependency/build identity and perform
a controlled restart before expecting browser-visible changes.
Microsoft account setup/publication and final visual QA are deferred by the owner
until the preceding implementation and package work. No final installer is claimed.
