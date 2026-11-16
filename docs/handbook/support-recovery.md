# Support, backup and recovery

Working guide — unattended owner support and installed recovery are not fully
accepted. The end user should not normally debug with terminals or developer tools.

Use Settings support diagnostics to preview the bounded safe JSON, then download
it if support needs it. Review before sharing with the application owner. It
contains build/runtime/resource and health context, not raw records, provider
bodies, keys or research histories. No verified public support address is supplied
by this guide. Do not invent one or upload a private backup to telemetry.

For an operator backup, stop EdgeView normally. The existing developer backup
command creates a new snapshot with file hashes and refuses a backend lock.
INCOMPLETE-prefixed folders are failed attempts, not usable completed backups.
Keep the app stopped throughout; this is not a filesystem shadow copy or protection
against unrelated concurrent writers.

The supported fixed layout includes the operational SQLite database, dataset JSON,
legacy dataset when present, active and previous configuration, data/evidence and
uploads. Noncanonical path overrides are now refused before staging, rather than
silently omitted. Do not unset an override to make backup appear successful; that
would protect different state. Backups contain private information and must stay
separate from source snapshots and installers.

## Before uninstalling or repairing the Windows package

The Windows Sandbox prototype lost its local state on uninstall. Stop EdgeView
normally and ask the operator to make and verify a backup **outside the package
storage area** before uninstalling. Keep it in a private location. Support can
start with the diagnostics preview described above.

## Preparing a recovery copy (operator)

Use the matching development checkout and its installed dependencies. Confirm
the stopped instance's data root first. Retain the manifest SHA-256 recorded
when the backup was verified, the checkpoint database schema, and the matching
application version. The following PowerShell commands assume these values
and a fresh destination path have already been assigned to the named variables.

```powershell
node scripts/verify-runtime-backup.mjs "$snapshot" "$expectedManifestSha256"
if ($LASTEXITCODE -ne 0) { throw "Backup verification failed" }
node --import tsx scripts/prepare-runtime-recovery.ts "$snapshot" "$freshDestination" "$expectedManifestSha256" "$expectedSchema"
```

Proceed only if the second command exits successfully and returns
`COPIED_NOT_ACTIVATED`. This prepares files for a separate recovery rehearsal.
A refusal requires checking the original digest, schema, destination and free
space. Preserve the active data and the snapshot. In particular, keep any
records created after the snapshot available for reconciliation.

The compiled-runtime rehearsal verified two restarts with the checkpoint
dataset and original installation identity. Installed application downgrade,
activation of a recovered directory by the customer installer, and recovery
after an interrupted package update still require Windows acceptance.

## Retention and interrupted operations

Full operational snapshots have no automatic expiry or deletion policy in the
current backup command. Keep the verified pre-change snapshot and the last
accepted application package together until a replacement backup has passed
independent manifest/hash checks and a recovery/restart rehearsal. Keeping those
files does not itself prove that the older application can open newer data.
Application/schema compatibility must be checked separately. Space pressure is
not a reason to delete the only verified recovery copy.

The operational snapshots above are separate from SQLite's small pre-migration
database images. Only after a migration succeeds durably and the database passes
an on-disk reopen check does the database retention helper keep its immediate
recovery image and the newest two other exactly named migration backups. Failed
migrations do not invoke that pruning. Unrelated files and links are excluded.

An interrupted private migration may leave maintenance gates, a migration journal
and a token-named partial-copy folder. Preserve all of them and the unchanged
source. Do not remove a lock, overlay the partial copy or select it as active data.
The internal retry accepts only a fully recorded journal with an inactive owner
and unchanged source hashes; it retains the interrupted copy and creates a fresh
destination. Missing, partial or inconsistent ownership/journal records require
support review. That internal function is not a customer restore button or a
completed installer recovery feature.

Backups contain customer data and may contain Windows-protected credentials.
They are private operational material, not support diagnostics or release assets.
Protected credentials are tied to their Windows user context; copying a backup
to another user's laptop does not establish usable or authorized provider access.
Never distribute the developer's credentials with the uncle's installation.

The live acceptance state is recorded in the [completion ledger](../OUTSTANDING_WORK.md).
This guide does not close its migration, installed rollback or clean-Windows gates.
