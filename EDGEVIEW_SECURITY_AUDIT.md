# EdgeView V1 security release gate

Date: 2026-10-19

## Deployment boundary

EdgeView binds to `127.0.0.1` by default. The API rejects unexpected `Host` values and cross-origin browser requests, sets a restrictive content-security policy, disables framing and browser permissions, bounds request bodies and uploads, and rate-limits local mutations. This is a local application boundary, not multi-user authentication or Internet-facing authorization.

## Verified controls

- The production frontend is static by default. Vite/HMR is enabled only by explicit `EDGEVIEW_DEV_SERVER=1`; release tests reject Vite client or React-refresh code in the served shell.
- Provider keys are never returned by `/api/settings`. Blank or masked updates preserve stored keys.
- Runtime logs redact authorization headers, credential fields, credential query parameters, and known key prefixes. A live secret-marker probe did not appear in the log.
- Runtime logs rotate at 10 MB with three archives. The log API exposes only a bounded approved tail and accepts no filesystem path.
- Uploads are held in memory with a 50 MB limit and an extension allowlist. Invalid XLSX/DOCX parser results are rejected with HTTP 422 and no stack trace.
- Unhandled production 5xx responses use a generic error body; detailed exceptions remain in the local redacted log.
- Sample-data reseeding is hidden from the production UI and disabled unless `EDGEVIEW_ENABLE_SAMPLE_DATA=1` is explicitly set.
- The Windows package uses an allowlist, excludes runtime databases/configuration/logs/backups/tests and retired Settings UI, and contains a SHA-256 file manifest verified by `npm run verify:package`.
- Six credential-pattern groups produced zero matches in the staged Windows package.
- SQLite `PRAGMA integrity_check` returned `ok`; schema version is 1 and a pre-migration backup was created.

## Dependency advisories

`npm audit` reports zero critical, zero high, and five moderate advisories. They are transitive through `mammoth`/`argparse`/`sprintf-js` and `exceljs`/`uuid`. The suggested npm fixes require downgrading direct parsers across major historical versions and were not applied without compatibility evidence. Risk is constrained by local-only access, the 50 MB upload limit, parser rejection, and bounded request handling, but it is not claimed eliminated.

## Secret and history limitations

The runtime `config.json`, `.env*`, `*.db`, `edgeview_db.json`, imported data, backups, snapshots, and logs are excluded by `.gitignore` and by the package allowlist. Git was initialized locally on 2026-10-19 after confirming the source directory had no prior Git metadata. No historical commits were supplied, so a historical commit scan cannot be performed or claimed. The managed Codex Security workbench also failed before returning a scan ID; no canonical plugin report was fabricated as a substitute.

## Remaining security assumptions

- Any local process running as the same Windows user can generally access EdgeView's local files and may be able to call the loopback API. EdgeView does not claim to sandbox a compromised user account.
- The product is not approved for direct Internet exposure. HTTPS, WAF, OAuth/RBAC, cloud database isolation, and multi-tenant controls are intentionally outside the current local-first deployment.
- Provider availability, quota and upstream security remain external dependencies.
- A complete rendered click audit remains blocked by the saved browser-control permission for the localhost origin.
