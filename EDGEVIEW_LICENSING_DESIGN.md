# EdgeView local licensing design (deferred)

EdgeView V1 remains a local-first React/Vite/Node Windows application. It does not require a user account, public application server, cloud database, RLS, CDN, WAF, or mobile-app submission.

## Proposed activation model

- The UI asks for a signed license file, not an email/password.
- The device identifier is derived locally from stable Windows installation attributes, salted with an EdgeView product identifier, then hashed. Raw hardware identifiers never leave the laptop and are never written into support logs.
- A license issuer signs a compact payload containing the hashed device identifier, product edition, issue/expiry dates, and schema version with an offline public-key signature.
- EdgeView ships only the verification public key. It verifies the signature and device binding locally at startup and keeps the last valid decision in an integrity-protected local record.
- License failure never deletes datasets, provider captures, settings, or exports. The app enters a read-only recovery mode so the operator can export or back up existing work.
- Hardware replacement and disaster recovery use a separately signed rebind license. No silent fingerprint expansion or tracking is permitted.

## Privacy, key lifecycle and recovery requirements

- Specify the minimal device inputs before implementation. Prefer a local random
  installation secret protected by Windows DPAPI combined with a small stable
  device component. Do not inventory serial numbers, network interfaces or user
  activity. A public product salt alone is not a secret or an anonymity guarantee.
- Derive a purpose-specific device digest locally. The license request contains
  that digest, edition and random request identifier; it contains no raw hardware
  identifiers, email address, dataset, contact list or provider credentials.
- The signed payload includes a key ID and schema version. Keep issuer private
  keys offline; ship a versioned public-key set supporting overlap during rotation.
  Never distribute a signing key or rely on a client-side shared signing secret.
- Offline revocation cannot be instantaneous. A signed revocation list delivered
  with an update can revoke an issuer key/license. Document its freshness limit;
  do not invent a hidden phone-home service.
- Compare wall-clock expiry against the latest valid local observation and grant
  a documented recovery grace period after a clock anomaly. A local administrator
  can replace the clock, records or program; do not claim tamper-proof enforcement.
- Lost installation secrets, hardware repair and OS reinstall require a documented
  rebind/recovery process. Preserve read-only export and backup access throughout.
- License status logs contain only reason codes and a shortened random request ID.
  Do not log the full device digest or upload it as error telemetry by default.

## Acceptance criteria before activation

Exercise valid/expired/invalid signatures, unknown signing key, rotation overlap,
corrupt local state, offline use, clock rollback, recovery grace, reinstall/rebind,
and license removal. Verify each failure retains dataset and evidence hashes and
allows read-only export. Review the privacy notice and recovery policy alongside
these tests. None of this enforcement is enabled in the current V1 build.

## Why implementation is deferred

Licensing is not part of the frozen enrichment critical path. Implementing an unissued key hierarchy or ad-hoc HWID lock now would create a support and data-access risk. The release should add the gate only after the issuer keys, recovery policy, privacy notice, and acceptance tests are approved.

