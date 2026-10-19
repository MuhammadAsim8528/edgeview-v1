# EdgeView V1 operations guide

## Supported workstation launch

1. Double-click the **EdgeView** desktop shortcut.
2. Keep the launcher window open while EdgeView is running.
3. The launcher opens `http://127.0.0.1:3901` only after the health endpoint responds.
4. Close the launcher window or press `Ctrl+C` to stop EdgeView.

The first launch may install Node dependencies. Normal launches are fast: the launcher skips the build when sources have not changed. If application source changed, it rebuilds before starting so the desktop shortcut always serves the current local code.

If EdgeView is already healthy on port 3901, a second shortcut click opens the existing instance and exits immediately instead of attempting a conflicting second server.

## Normal workflow

1. Open or upload the trade file.
2. Review the parsed row count and importer/exporter classification.
3. Open Contacts and choose importer scope or a selected subset.
4. Start enrichment. No pilot approval gate is required.
5. The browser can be refreshed or closed; the persistent job continues in the backend.
6. Reopen EdgeView to reattach to the active job and view its exact checkpoint.
7. Use **View Intelligence** to review the profile, evidence links, raw captured results, failures, and timeline.

## Evidence interpretation

- An empty contact field means no usable public value was extracted from retained evidence; it does not prove the information does not exist.
- Directory and trade-platform results remain visible as captured evidence but should not be presented as the company's official site without identity support.
- Multiple emails, phones, addresses, and leaders may be retained. The UI should not collapse the evidence set to only one value.
- Job completion means every in-scope company reached a terminal research state. It does not mean every company has a public email or telephone.

## Provider configuration

The production V1 allowlist is Serper, Hunter, Groq, and NVIDIA NIM. All other configured providers are disabled. Keep secrets in the local `config.json`; the Windows source package intentionally excludes it, the database, uploaded files, logs, and raw run data.

Never paste API keys into documentation, screenshots, bug reports, or source control.

## Monitoring

Watch these values in the Research view and `/api/enrich/job/:id`:

- completed / total / failed companies;
- current stage and company;
- per-provider request counters;
- structured error messages;
- free disk space;
- server memory and responsiveness.

The disabled-provider counters must remain zero. A rising Hunter count is expected only for companies with a credible official domain.

## Recovery runbook

### Browser closed or refreshed

No intervention is required. Reopen EdgeView; the backend job continues and the UI reattaches.

### Server or laptop restarted

Launch EdgeView again, open Research, and resume the interrupted job. Completed companies remain complete; interrupted items return to pending.

### Provider quota or rate limit

Stop the job, inspect provider health and the structured failures, then resume after quota recovery. Do not enable unrelated providers merely to hide the failure.

### Disk nearly full

Stop the job before SQLite persistence fails. Free unrelated cache/build space without deleting `edgeview.db`, uploads, or `data/v1-runs`. Resume only after confirming adequate free space.

### Port 3901 already in use

Close the older EdgeView launcher/server and start the desktop shortcut once. Do not run two writers against the same database.

The launcher checks the running server's installation path. It reuses a healthy server only when that path matches its own folder; another EdgeView installation produces a clear conflict message and exit code 2.

The Windows ZIP requires Node.js and npm. First launch installs dependencies if missing and therefore requires Internet access. It is not a standalone executable. Source changes are rebuilt on the next launch when no instance is already running; an existing running production instance must be stopped and relaunched to apply changes.

## Backup and restore

For a complete local operational backup, copy these while EdgeView is stopped:

- `edgeview.db`;
- `data/v1-runs/`;
- `uploads/`;
- `config.json` through a secure secret-storage process.

The distributable ZIP is not a data backup because sensitive configuration and runtime data are excluded intentionally.

Run `npm run backup` from the installed source folder for a non-overwriting snapshot with a SHA-256 manifest. Large evidence histories can make this operation take several minutes; it streams hashes and does not load entire evidence files into memory. A folder prefixed `INCOMPLETE-` is not a valid backup and must not be used for restore.

### Evidence audit and quarantine

From the source checkout, `node --max-old-space-size=384 --import tsx scripts/maintain-v1-evidence.ts`
performs a read-only JSON/identity audit, one run file at a time. It does not verify
every referenced compressed blob and does not move or rewrite evidence.

After stopping EdgeView, append `--quarantine` to move zero-byte, invalid-JSON or
invalid-identity runs into a unique `data/v1-runs/quarantine/` folder. A manifest
records each source filename, byte size, SHA-256, reason and move state; damaged
files remain recoverable there. The operation rebuilds the derived identity index
only from readable runs. It refuses apply mode while the backend lock exists.
If interrupted, inspect the planned manifest mappings and source/destination
files before recovery. Never delete quarantine material as part of routine cleanup.

## Diagnostics and logs

The Settings diagnostics panel is intentionally passive until the user selects the provider test action. Merely opening Settings does not spend search credits. `UNKNOWN` means a provider is configured but has not been verified in this process; it is not an error and is not reported as healthy. `RATE_LIMITED` is distinct from `AUTH_FAILED`.

The Activity Logs panel renders a bounded tail of `logs/edgeview_runtime.log` and immutable enrichment timelines. Logs rotate at 10 MB with three archives. API keys, authorization headers, cookies, passwords, access tokens, and credential query parameters are redacted before writing. The log API accepts only a bounded `tail` count and cannot read arbitrary paths.

## Release checklist

- `npm run lint`
- `npm run test:v1`
- `npm run build`
- health endpoint returns 200 on port 3901
- provider health shows only the approved four enabled
- representative known-company results are checked against their cited public pages
- single Enrich retains the current tab
- refresh retains current UI state
- persistent batch stop/restart/resume is verified
- Windows package contains no secrets/database/raw evidence
- desktop shortcut uses the project ICO and real installation path
