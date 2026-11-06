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
3. Use Microsoft Store distribution when Partner Center eligibility, package
   identity and certification are confirmed. Use a signed internal MSIX for
   clean Windows testing under approved device trust.
4. If the owner chooses off-Store distribution, validate an owned HTTPS App
   Installer feed separately. A bare MSIX can exercise installation, while the
   feed requires its own update and trust tests.
5. First launch initializes his own writable state and installation identity.
   Configure provider access locally. Never copy another Windows user's DPAPI
   credentials or a developer database into the installer.

For Store-distributed MSIX, Microsoft signs the certified package during
publishing. A separately purchased signing certificate is unnecessary for that
route. MSI and EXE submissions have different signing requirements. For an
approved off-Store test, SignTool can sign MSIX using a certificate whose subject
matches the package manifest publisher. Match the block map digest, normally
SHA-256, use the signer provider's RFC 3161 timestamp endpoint, and verify the
signature and actual installation under the target Windows trust policy. Keep
private keys and passwords out of shell arguments, logs and source control.

[Microsoft Store signing requirements](https://learn.microsoft.com/en-us/windows/apps/publish/faq/get-started-with-the-microsoft-store)
and [SignTool for MSIX](https://learn.microsoft.com/en-us/windows/msix/package/sign-app-package-using-signtool).

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

For Store delivery, reserve a monotonically increasing numeric package version
per package identity and record it alongside app SemVer and the exact Git commit.
Keep the last accepted package, checksums and schema compatibility record. The
internal prototype version `0.0.0.2` is a test identifier. Obtain the production
manifest identity from Partner Center and check the version rules for the actual
submission type before generating the production manifest.

The patch pipeline goes from reviewed commit and checks to an immutable signed
package, then clean-target install, upgrade and health tests. Promote the approved
bytes through Partner Center or, for the separate off-Store route, publish the
versioned artifacts before changing the feed. Keep release notes and previous
signed packages. Give any changed artifact a new version.
Updates are deferred while research/export/persistence work is active; close normally
before applying. Verify installed build, identity and durable data after restart.

## Recovery policy

Windows package deployment and application-data rollback are separate concerns.
App Installer can allow downgrade; it does not prove old code can read new schemas.
Do not globally enable arbitrary downgrades as a substitute for health acceptance.

Microsoft Store delivers certified updates. Partner Center can halt a gradual
rollout, and the earlier package can serve eligible new acquisitions. Devices
already on the affected version need a corrected package with a higher applicable
version. Keep Git review, artifact retention and data recovery in the EdgeView
release process. App Installer downgrade settings apply to a separate off-Store
route. Installing older binaries preserves application data as it exists at the
time of downgrade, including changes made by the newer version.

Microsoft references: [Store updates](https://learn.microsoft.com/windows/apps/publish/publish-your-app/msix/publish-update-to-your-app-on-store),
[gradual rollout](https://learn.microsoft.com/windows/apps/publish/gradual-package-rollout),
[package version rules](https://learn.microsoft.com/windows/apps/publish/publish-your-app/msix/app-package-requirements),
[MSIX downgrade and data](https://learn.microsoft.com/windows/msix/desktop/managing-your-msix-deployment-downgrading).

Before upgrade: check disk and idle state, stop normally, create/verify a coherent
state backup and record previous package/schema/build identity in a local journal.
When an interrupted shutdown leaves a numeric backend lock, first verify the
backend is stopped and independently identify the recorded PID. The operator
can run `node scripts/backup-runtime.mjs --expect-stale-lock <pid>`. The backup
requires a missing process and the same ordinary lock file through publication.
It preserves the lock and refuses an active owner, a changed lock, or a busy
maintenance gate.
Run `node scripts/verify-runtime-backup.mjs <snapshot-directory>` to verify the
snapshot inventory and file hashes. Record the returned manifest SHA-256 in the
upgrade journal and supply it as the second argument before a recovery rehearsal.
Keep that recorded hash with the approved journal. A matching digest checks the
snapshot bytes. The rehearsal must separately prove schema compatibility and a
successful application restart.

For a local recovery rehearsal, run `node --import tsx scripts/prepare-runtime-recovery.ts <snapshot> <new-data-directory> <manifest-sha256> <expected-schema>`
from the reviewed source checkout with locked development dependencies. Use
absolute paths and a fresh, disjoint destination. The command binds the copied
files to the verified snapshot and records its digest and schema in the readiness
receipt. It prepares a private copy for a separate app launch and keeps the active
data directory available. Validate the intended app build against the prepared
copy before changing the actual launcher or installed application.
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

For the later clean Windows acceptance run, use a fresh Windows 11 VMware guest
or a spare PC. Use normal Windows trust policy, a standard user, synthetic data
and the exact package intended for the test. Start with a pre-install VM snapshot
and record install, native launch, update, data recovery and uninstall separately.
A VM checkpoint makes the rehearsal repeatable. EdgeView's backup and restore
must also work inside the running guest. The VM needs a local volume with room
for Windows and snapshots. [Windows 11 virtual machine requirements](https://learn.microsoft.com/en-us/windows/whats-new/windows-11-requirements)

## Implementation order and release blockers

1. Complete monitoring privacy, failure/deadline delivery truth and diagnostics export.
2. Canonical writable storage plus isolated legacy migration/recovery tests.
3. Runtime-only staging and Windows bootstrap/process-lifetime behavior.
4. Schema-safe upgrade, health acceptance and executable rollback journal.
5. Signed MSIX, explicit version mapping and validation of the selected delivery route.
6. Clean Windows pilot lifecycle and stress/resource-leak acceptance.
7. Publish only with explicit owner authorization after evidence review.

External prerequisites: trusted signing identity, controlled HTTPS distribution
endpoint, target Windows baseline and actual clean Windows test machine/VM.

Microsoft references:
https://learn.microsoft.com/en-us/windows/msix/app-installer/how-to-create-appinstaller-file
https://learn.microsoft.com/en-us/windows/msix/app-installer/update-settings
https://learn.microsoft.com/en-us/windows/msix/desktop/managing-your-msix-deployment-downgrading
https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-prepare
