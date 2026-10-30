# Pilot installation, patches, diagnostics and recovery

Status: implementation plan, not an available MSIX release. 2026-10-25.

## Implemented storage prerequisites as of October 30

`shared/runtime_paths.mjs` now supports the opt-in, disjoint writable data root.
`server/legacy_data_migration.ts` provides an internal same-user private copy
operation. It does not select a root in the launcher or ship an installer.
It copies only the existing SQLite/JSON/configuration/evidence/upload authorities
into a new destination, keeps the source intact, and refuses existing destinations,
links, active backends, noncanonical overrides, plaintext provider credentials and
legacy `.env` files. Protected credentials are copied opaquely for the same Windows
user; this does not prove DPAPI access after an account change.

Copy preparation retains a private hash manifest and original storage. Interrupted
copies retain startup exclusion. Explicit retry requires the exact unchanged
source, bound owner markers and a definitely absent prior process; partial copies
are archived rather than overlaid. New root startup refuses missing or invalid
preparation markers and verifies the bounded completion-manifest hash.
The return state is `COPIED_NOT_ACTIVATED`, never installed-update success.
No source is deleted and no automatic launcher pointer is changed.

Tests use synthetic temporary storage only. Final installer activation, pre-update
independent backup, matched application/data rollback, account/ACL acceptance,
power-loss durability and clean-Windows installation remain open. An incomplete
owner/journal initialization is preserved for support review rather than reclaimed
from a PID alone. Recovery snapshots/manifests are private business data and must
never enter telemetry, diagnostic exports or customer distribution assets.

The dated planning sections below remain useful context; their statement that
all production paths are necessarily under the project root is superseded by the
explicit opt-in implementation. The live original installation has not been moved.

## Current facts

EdgeView runs React in the browser with a loopback Node/Express backend. Current
Windows delivery is a ZIP/EdgeView.bat requiring a developer Node/npm environment.
Production SQLite and dataset paths remain under the project root in db_paths.ts.
This is incompatible with treating an MSIX installation directory as writable.
Sentry/PostHog operational events have real-account connection evidence in
MONITORING_ACCEPTANCE_2026-10-25.md. Render-crash implementation and limits are in
FRONTEND_CRASH_REPORTING.md. No customer MSIX, updater, production signer, clean
Windows installation or proven application-health rollback exists yet.

## Intended pilot flow

1. Produce an immutable runtime-only package containing the compiled app, supported
   Node runtime, launcher and third-party notices; no npm install/build on his PC.
2. Use one trusted publisher/package identity and a signed MSIX for the pilot.
   Do not ask the operator to disable Windows security. A private pilot certificate
   requires an explicitly managed trust step and is not a public production signer.
3. Host immutable versioned packages and an App Installer feed on an owned HTTPS
   endpoint. Do not invent a working download URL before deployment exists.
4. Uncle downloads the .appinstaller file from the supplied link, opens it with
   Windows App Installer and installs. The feed points to the signed MSIX; install
   from a bare MSIX/USB is possible but does not by itself establish a feed.
5. First launch initializes his own writable state and installation identity.
   Configure provider access locally. Never copy another Windows user's DPAPI
   credentials or a developer database into the installer.

## Storage boundary required before packaging

Implement one canonical writable-user root outside installed binaries for SQLite,
JSON, evidence, settings, identity, locks, local logs, backups and migration journals.
Choose and test packaged-app data semantics, uninstall/reinstall preservation,
ACLs and link/junction refusal explicitly. Cover interruption-safe legacy migration;
no automatic overwrite when multiple old roots contain data. Backups must remain
recoverable without sharing credentials or copying machine-bound DPAPI blobs.
No second path authority hidden inside packaging/backup scripts.

## Diagnostics/support contract

Sentry: fixed-class error/operation/build information. PostHog: approved usage and
resource events. These are outbound signals, not remote desktop or a full log reader.
No open inbound port or remote shell is required. Do not upload raw research logs,
company names, contacts, datasets, evidence, requests, prompts or provider secrets.
Network-derived IP retention remains a separate privacy acceptance gate.

Add Settings > Export Diagnostics with a preview of fields and a local downloadable
bundle. Include version/build/channel, pseudonymous installation/support ID, bounded
resource/health summary and fixed diagnostic error codes. Include local logs only
through a reviewed safe projection. No config.json, .env, DB, evidence or absolute
user paths. Operator chooses whether/where to share the bundle. Offline export works.
Automatic telemetry is bounded and optional; an offline queue cannot grow forever.
A support receipt references build and installation ID, not a person's name.

## Version control versus distribution

Git commits/PRs track engineering source and review. Users install signed builds,
not Git branches. Keep app SemVer, numeric four-part MSIX version, source commit,
content build ID, package SHA256, signer and database schema compatibility together
in each release record. Define/test the SemVer-to-MSIX mapping before generating
manifests; do not put rc/beta text in a numeric package version.
Pilot/Beta and Stable use separate promotion rules. Avoid concurrent channel
installations sharing writable state. Uncle receives only accepted pilot builds.

Patch pipeline: narrow commit -> checks -> runtime build -> immutable package ->
signing -> clean-target install/upgrade/health tests -> publish versioned artifacts ->
update feed last. Nothing publishes merely because code was committed. Keep release
notes and previous signed packages. Never overwrite a version's existing artifact.
Updates are deferred while research/export/persistence work is active; close normally
before applying. Verify installed build, identity and durable data after restart.

## Recovery policy

Windows package deployment and application-data rollback are separate concerns.
App Installer can allow downgrade; it does not prove old code can read new schemas.
Do not globally enable arbitrary downgrades as a substitute for health acceptance.

Before upgrade: check disk and idle state, stop normally, create/verify a coherent
state backup and record previous package/schema/build identity in a local journal.
After upgrade: readiness + DB integrity/schema + stored-data read + restart checks.
Only then mark the candidate accepted. Preserve the last accepted package and backup.

On failure: stop candidate intake/writes, preserve failed-state evidence, and show a
recoverable message. Revert binaries only when schema compatibility is established.
Otherwise use the matched pre-upgrade data snapshot after explicit impact review:
restoring it can discard work done after the snapshot. Never silently roll back new
user work. Recovery must resume safely if interrupted. Do not restore raw provider
keys from another machine/user. Existing unaccepted restore code is not release-ready.

Test: wrong publisher, tampered package/feed, offline check, disk full, active job,
interrupted install/migration/restore, corrupt DB/backup, failed first launch, stale
files, schema mismatch, repeated restart, rollback failure and uninstall/reinstall.

## Implementation order and release blockers

1. Complete monitoring privacy, failure/deadline delivery truth and diagnostics export.
2. Canonical writable storage plus isolated legacy migration/recovery tests.
3. Runtime-only staging and Windows bootstrap/process-lifetime behavior.
4. Signed MSIX + explicit version mapping + feed generation/validation.
5. Schema-safe upgrade/health acceptance and executable rollback journal.
6. Clean Windows pilot lifecycle and stress/resource-leak acceptance.
7. Publish only with explicit owner authorization after evidence review.

External prerequisites: trusted signing identity, controlled HTTPS distribution
endpoint, target Windows baseline and actual clean Windows test machine/VM.

Microsoft references:
https://learn.microsoft.com/en-us/windows/msix/app-installer/how-to-create-appinstaller-file
https://learn.microsoft.com/en-us/windows/msix/app-installer/update-settings
https://learn.microsoft.com/en-us/windows/msix/desktop/managing-your-msix-deployment-downgrading
https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-prepare
