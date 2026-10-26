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
