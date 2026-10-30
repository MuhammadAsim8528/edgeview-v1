# Normal shutdown and recovery boundary

The former production signal handler removed the lock and called process.exit
without flushing the sql.js write debounce. Normal SIGINT/SIGTERM handling now
stops HTTP intake, stops scheduling new research companies, waits for HTTP and
tracked job tasks for up to 10 seconds, flushes the initialized operational DB,
closes development Vite if present, and exits. No DB is created solely to close.
The lock stays owned until the exit handler and release is idempotent.

Current in-flight companies may finish during the drain. A drain timeout does not
declare them completed: the process flushes available checkpoints and exits with
failure so startup recovery can handle unfinished work. Flush failure also exits
with failure. A 15-second watchdog bounds asynchronous hangs; a blocked event loop
or synchronous filesystem call cannot be preempted by a JavaScript timer.
No new shutdown API, shell execution interface or production IPC bridge exists.

Fatal uncaught errors retain the separate fail-fast path; they must not export
potentially corrupted in-memory state. Task Manager termination, Windows terminal
close, power loss and OS crash can bypass normal handlers. Durable write barriers,
immutable evidence and startup interruption recovery remain necessary, and these
changes do not guarantee zero loss of uncommitted in-flight work.

Verification: unit tests exercise ordering, repeated calls, drain timeout, flush
failure, no initialization on close, refusal of new jobs, and pending SQL write
reopen/integrity. The compiled production upload/history test invokes the real
registered SIGTERM listener through a test-only imported IPC fixture, checks zero
exit and owned lock removal, and reopens preserved data. This avoids incorrectly
calling Windows child.kill(SIGTERM) graceful: that API forcibly terminates there.
Actual console Ctrl+C/terminal-close delivery and active live-provider shutdown
are NOT VERIFIED. Production PID 36216 was not stopped or replaced by these tests.

## Database startup safety

Invalid, unreadable or zero-byte existing operational databases are retained at
their original path and initialization fails with DATABASE_UNAVAILABLE. They are
not silently renamed and replaced by an empty working database. This refusal is
the operational DB boundary, not a claim that every application route becomes
read-only. The targeted mutation guard below covers dependent writes; unrelated
surfaces and rendered failure UX still need separate audit.
Restore a verified stopped-state backup and restart after investigating storage.

Schema initialization runs against the in-memory sql.js image, suppressing disk
publication until all DDL/version steps succeed. One existing atomic writer then
publishes the completed image. Earlier-schema bytes receive the existing
pre-migration backup first; newer schema versions refuse downgrade. Column
existence is checked explicitly rather than swallowing all ALTER failures.
Legacy tables/data are retained; this does not remove archived work or migrate to
a new storage engine. An initialization failure remains failed until restart.

Disposable tests retain exact original bytes for corrupt/empty/future-version and
mid-schema failures, and verify successful legacy row retention, matching backup,
integrity/version and idempotent reopen. No production database migration or
restore was run. Power interruption, filesystem-specific atomicity and a complete
historical-schema upgrade matrix remain separate acceptance gates.

Health includes a read-only operational lifecycle snapshot (unknown/initializing/
ok/degraded) from that same DB owner, not a fresh database open per request.
Overall database health is degraded unless initialization succeeded. A failed
runtime write marks it degraded; a successful durable retry restores ok.
The compiled disposable production fixture checks corrupt bytes are retained,
health is degraded, normal shutdown returns failure rather than claim a clean
flush, and a fresh fixture restart reports healthy before upload/history tests.

## Storage-dependent mutation guard

Before upload parsing/provider access, mutating /api/enrich and /api/files actions
and the supported upload/history-save aliases require operational state ok.
Unavailable storage returns structured 503 OPERATIONAL_DATABASE_UNAVAILABLE with
recovery guidance; company/batch capability reports are also unavailable.
This prevents primary JSON deletion or new paid research being started while
their operational checkpoints cannot be saved. It is not a distributed
transaction across the JSON and SQLite stores.

Job stop remains callable so it can clear scheduling even if its final DB write
fails. Read requests, evidence, settings, diagnostics and export endpoints are
not blocked by this guard; a particular read/export can still fail if its own
implementation needs unavailable storage. No claim that every recovery export
works on a corrupt DB is made. In-flight requests that began before a runtime
failure retain their existing write-error handling; this is not rollback of
already-running work. Restart/repair guidance remains explicit.

Route-classification fixtures cover casing/trailing slash, upload aliases,
history/deletion and stop/recovery exceptions. The compiled corrupt-DB fixture
checks unavailable capabilities, structured refusal of research/upload/history
mutations before provider calls, and continued settings access. Real UI behavior
and physical disk-full/power-loss scenarios remain unverified.

## Offline backup and startup exclusion

Compatible builds acquire an atomic maintenance directory beside the database
lock before inspecting/acquiring backend ownership. Startup releases this gate
after the ordinary lifetime database lock is established. Offline backup holds
the same gate for its entire copy and publication, and checks that the backend
is stopped after acquiring it. A competing startup/backup fails promptly with
`RUNTIME_MAINTENANCE_BUSY`; it must not remove the active operation's marker.
The existing numeric database lock remains the backend ownership authority.

Normal success and controlled failure release the maintenance gate. A process
terminated before release leaves it in place. This is intentional fail-closed
behavior: PID death alone does not establish whether an interrupted operation
is safe to resume. Automatic interruption recovery is still a release blocker.
The end user should contact support; do not ask them to delete locks or inspect
files. Owner recovery must first establish that all relevant processes stopped,
preserve the incomplete snapshot and determine the interrupted operation's state.
There is currently no accepted one-click recovery procedure for this condition.

Older builds do not honor the new gate. Do not run a mixed-version backup/startup
workflow or claim this protocol protects against older binaries, arbitrary
external file writers, power loss, or a compromised Windows user account. This
change does not implement transactional restore, migration, or schema rollback.

## Shipment-history ownership upgrade (SQLite schema 2)

New uploads store their dataset ID beside the display filename in shipment
history. Upload retry cleanup and both delete routes target the dataset ID;
two different files may retain the same display name. The existing migration
mechanism retains a byte-for-byte pre-upgrade backup before adding the nullable
ownership column and index. A failed write must preserve the original database.

Existing rows retain null ownership. A filename alone cannot prove which of
several datasets owns an older row. Deletion for an affected filename currently
returns `409 LEGACY_HISTORY_RECONCILIATION_REQUIRED` before deleting primary
data. This is a temporary safety guard, not completed legacy reconciliation.
Do not assign old rows by filename, discard them, or ask an end user to edit SQL.
Reviewed owner recovery/reindexing and its interruption tests are still required.

This is a physical schema upgrade, separate from contact-overlay policy versions.
Installed-package downgrade and database rollback remain separate acceptance
gates. No accepted automatic rollback procedure is provided by this change;
the original operational installation has not been migrated during these tests.
