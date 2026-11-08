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

Protected credentials remain bound to their Windows protection context. Tests
prove isolated file/hash/database reconstruction, not a complete customer restore
workflow. Transactional legacy migration, interrupted restore, matched app/schema
rollback and installed restart acceptance remain open. Previously rejected restore
tooling must not be used as though those gates passed. Preserve the original state
and seek an owner-reviewed recovery procedure rather than overlaying directories.

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
