# Windows launcher work — not an accepted distribution

runtime-bootstrap.cjs is the tested owner-pipe bridge. Stage it at the application
root beside dist. It routes only a fixed shutdown command or owner disconnect
through the existing backend shutdown controller, retaining its exit status.
It is not a public shutdown API and does not interpret shell commands.

EdgeViewLauncher.cs is an **unverified native launcher candidate**. It is a small
Windows launcher, not another product/backend architecture. It starts a bundled
runtime/node.exe, waits for its own PID and matching build over bounded loopback
health requests, opens the system browser, and requests durable close via stdin.
It drains raw backend output without displaying it. Prototype state is separate
from installed code and monitoring is disabled for this candidate. Final channel,
storage migration, monitoring distribution configuration and UX are not adopted.

Compilation with the installed .NET Framework64 C# compiler succeeded. Execution
did not: Windows explicitly reported **An Application Control policy has blocked
this file**. The headless regression scripts/windows-launcher.test.mjs therefore
failed at executable spawn before exercising controller behavior. These tests must
not be reported as passing. No security protection was disabled and no alternative
code host was used to bypass the denial.

An approved signing/trust route is an external prerequisite for executing this
native candidate on this machine. Account setup remains deferred by the owner.
Do not install a test certificate, weaken Application Control, wire this candidate
into a customer package, or mark GUI/clean-Windows acceptance from compilation.
The normal application and the older internal MSIX prototype do not use this
candidate yet. Keep it reviewable until trust and runtime acceptance are possible.
