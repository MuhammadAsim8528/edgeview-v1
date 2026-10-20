# EdgeView doctor (baseline)

From the installation folder, run `npm run doctor`. For pure machine-readable
output use `node scripts/doctor.mjs --json` (or npm with `--silent`). Exit code 1
means a checked blocking failure; exit 0 can still contain WARN/SKIPPED and is NOT
a production-readiness certification. Invalid CLI options return 2.

Default mode is read-only: manifest/lock/direct production dependencies, artifact
presence and the existing same-installation loopback health API. It does not start
or stop processes, read config secrets, probe providers, spend API credits or
modify databases. Health response capture is bounded to 256 KiB/five seconds.
Only selected status fields become output; raw responses, paths and errors are
not forwarded. Configured keys are explicitly not proof of provider health.

Developer checkout only: `npm run doctor -- --full` reuses npm check/build/release
smoke commands. It rebuilds dist and runs existing isolated fixtures. Each command
has a three-minute bound and bounded captured output, which is not printed; inspect
the named check directly for detailed sanitized failure investigation. Child env
does not forward credential-named or EDGEVIEW override variables. Full mode needs
developer dependencies/tests; the end-user ZIP provides default doctor, not a full
developer test checkout. A running local backend is required for the live-health
portion; no process is silently started to make that check pass.

Still explicit SKIPPED: build freshness/commit identity, independent secret-store
probe, cryptographic device identity, rendered UI tests and full security audits.
Python/WebView checks are inapplicable to this browser/Node release. Resource,
disk/permissions, Git-state, build metadata and diagnostics integration remain
backlog work. No new health authority or telemetry vendor was introduced.
