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
