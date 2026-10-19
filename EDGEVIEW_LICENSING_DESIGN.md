# EdgeView local licensing design (deferred)

EdgeView V1 remains a local-first React/Vite/Node Windows application. It does not require a user account, public application server, cloud database, RLS, CDN, WAF, or mobile-app submission.

## Proposed activation model

- The UI asks for a signed license file, not an email/password.
- The device identifier is derived locally from stable Windows installation attributes, salted with an EdgeView product identifier, then hashed. Raw hardware identifiers never leave the laptop and are never written into support logs.
- A license issuer signs a compact payload containing the hashed device identifier, product edition, issue/expiry dates, and schema version with an offline public-key signature.
- EdgeView ships only the verification public key. It verifies the signature and device binding locally at startup and keeps the last valid decision in an integrity-protected local record.
- License failure never deletes datasets, provider captures, settings, or exports. The app enters a read-only recovery mode so the operator can export or back up existing work.
- Hardware replacement and disaster recovery use a separately signed rebind license. No silent fingerprint expansion or tracking is permitted.

## Why implementation is deferred

Licensing is not part of the frozen enrichment critical path. Implementing an unissued key hierarchy or ad-hoc HWID lock now would create a support and data-access risk. The release should add the gate only after the issuer keys, recovery policy, privacy notice, and acceptance tests are approved.

