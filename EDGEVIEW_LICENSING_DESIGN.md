# EdgeView local licensing design (deferred)

EdgeView V1 remains a local-first React/Vite/Node Windows application. It does not require a user account, public application server, cloud database, RLS, CDN, WAF, or mobile-app submission.

## Proposed activation model

- The UI asks for a signed license file, not an email/password.
- Primary identity is a locally generated random installation UUID and an asymmetric keypair created with mature platform cryptography. The private key must use the existing OS-protected secret-store owner (extended and tested first), not a new plaintext file or competing credential implementation. The public key can bind an issued license; the UUID alone is not authentication.
- Optional hardware signals are secondary recovery/abuse indicators only, not the primary identity or proof of device possession. No raw hardware inventory is required. A hash with a public product salt is neither anonymous nor a credential.
- A license issuer signs a compact payload containing the installation public-key fingerprint, product edition, issue/expiry dates, key ID and schema version with an offline public-key signature. A license request is explicitly initiated by the operator; no automatic registration service or data synchronization is introduced.
- EdgeView ships only the verification public key. It verifies the signature and device binding locally at startup and keeps the last valid decision in an integrity-protected local record.
- License failure never deletes datasets, provider captures, settings, or exports. The app enters a read-only recovery mode so the operator can export or back up existing work.
- Hardware replacement and disaster recovery use a separately signed rebind license. No silent fingerprint expansion or tracking is permitted.

## Privacy, key lifecycle and recovery requirements

- The random installation UUID/keypair persist through application updates, not
  by deriving them again from hardware. Specify any optional hardware signal and
  its concrete purpose before collection. Do not inventory serial numbers,
  network interfaces or user activity. Use one OS-protected storage authority;
  the existing provider-key codec is not proof device-key storage is implemented.
- The license request contains the installation public key/fingerprint, edition
  and random request identifier; it contains no raw hardware
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
  Do not log the installation key fingerprint, UUID or optional hardware signals,
  or upload them as error telemetry by default. Public keys and stable random IDs
  are pseudonymous identifiers, not automatically safe analytics fields.

## Acceptance criteria before activation

Exercise valid/expired/invalid signatures, unknown signing key, rotation overlap,
corrupt local state, offline use, clock rollback, recovery grace, reinstall/rebind,
license removal, update persistence, key-loss/reset and copied-installation
behavior. Any online challenge protocol must prove private-key possession rather
than trust a reported UUID/HWID. Do not claim a local administrator cannot copy or
patch an offline client. Verify each failure retains dataset and evidence hashes and
allows read-only export. Review the privacy notice and recovery policy alongside
these tests. None of this enforcement is enabled in the current V1 build.

## Why implementation is deferred

Licensing is not part of the frozen enrichment critical path. Implementing an unissued key hierarchy or ad-hoc HWID lock now would create a support and data-access risk. The release should add the gate only after the issuer keys, recovery policy, privacy notice, and acceptance tests are approved.

