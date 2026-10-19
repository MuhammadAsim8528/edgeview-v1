# EdgeView credential retention policy

EdgeView stores the active local provider configuration in `config.json`, which is ignored by Git and excluded from release packages.

Policy as of 2026-10-19:

- Ordinary settings saves use atomic temp-write + fsync + rename and do **not** create historical credential copies.
- A deliberate settings reset may retain at most one rolling recovery file, `config.prev.json`, beside the active config.
- Test configurations never create credential backups.
- Test-mode settings do not automatically load a repository `.env` file.
- `config.prev.json`, `config.json`, `.env*`, and agent-local state are ignored by Git and excluded from distributable packages.
- Historical timestamped `.agent/backups/config.backup.*.json` files are not part of the supported recovery model.
- Saving or resetting settings does not copy credentials into `process.env`.
  Runtime consumers read canonical settings. Startup environment variables remain
  a fallback only when the relevant configuration value is absent; an explicit
  empty configuration value remains empty after reset.
- Runtime file logs and console outputs both redact credential fields, provider
  key prefixes, authorization headers and cookies. Console entries are capped at
  16,000 characters, matching the structured log message boundary.

Migration performed 2026-10-19:

- 260 legacy plaintext config backup files were removed from `.agent/backups`.
- The active `config.json` SHA-256 was checked before and after cleanup and remained unchanged.
- No secret values were printed, committed, or copied into this document.

Recovery intent:

`config.prev.json` exists only to reverse an intentional reset. It is not an audit history and must not grow into a credential archive.
