# Windows credential storage

The new backend serializes all ten provider key fields as one Windows DPAPI
CurrentUser envelope. Other settings remain ordinary JSON. Providers continue to
receive plaintext keys in process memory; this is at-rest protection, not a defense
against malicious code running as the same Windows user.

Legacy plaintext files remain readable without mutation. Startup migrates the
active config and the single `config.prev.json` only after acquiring the backend
lock, before loading data or listening. Credential protection errors abort startup.
Mixed protected/plaintext representations and unknown envelopes are rejected.
Settings saves protect before atomic replacement; reset protects its recovery
snapshot before clearing keys. Test-mode persistence fixtures deliberately remain
plaintext and must never contain real credentials.

DPAPI uses the fixed Windows PowerShell executable, fixed code, redirected pipes,
an allowlisted child environment, a ten-second deadline and bounded output. Keys
are not command arguments or environment variables. Decryption cache holds at most
four bundles identified by the complete ciphertext SHA-256 digest.

## Recovery and limitations

- Keep the same Windows user/profile for recovery. Moving the encrypted config to
  another account or computer requires re-entering keys.
- Old backend builds cannot read this format. Rollback requires the new credential
  reader or deliberate key re-entry; do not restore an old binary blindly.
- `.env`, exported environment variables, previously copied backups, and earlier
  audit reports are separate sources. This change does not encrypt or delete them.
- Rotate keys exposed in any historical report. Encryption does not revoke keys.
- Do not migrate settings while an old backend still runs. The launcher can reuse
  an existing healthy instance; a real backend restart is required for deployment.
- Non-Windows saves containing secrets fail explicitly rather than falling back to
  plaintext. This release targets Windows.

## Verified 2026-10-20

Synthetic real-Windows DPAPI round trip for all ten fields; plaintext exclusion;
malformed/corrupted/mixed envelope rejection; explicit empty preservation; existing
settings preservation suite; production-mode disposable installation migration of
active and previous snapshots plus dataset persistence across restart. No real
provider requests or real credential migration were part of these checks.

Live deployment and browser-visible verification remain separate release gates.
