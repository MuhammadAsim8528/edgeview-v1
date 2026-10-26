# Installation, versions and updates

Working guide — no accepted self-contained installer or update service yet.

The present ZIP is a developer distribution. It needs Node/npm and can install
dependencies or rebuild. This does not meet the non-technical customer gate.
MSIX is the preferred packaging evaluation, preserving the existing browser and
Node architecture. No Electron, Tauri or separate Chromium runtime is assumed.

Version, source commit and build identity are different. Build metadata is
created after a complete production build and captured when the backend starts.
Changing files does not change an already-running process. The contact projection
policy version is also distinct from the database schema and application version.

A patch must have a reviewed commit, relevant regression checks, a complete
build, package verification, release notes and immutable checksums. Never replace
different bytes under an accepted version. Promote an accepted artifact lineage;
do not quietly rebuild different code for Stable.

Stable customer distribution, prerelease channels and installed update recovery
still require acceptance. Microsoft account setup and final visual QA are deferred
until the preceding implementation/package work by the owner's current order.
Nothing may be submitted or publicly uploaded before the owner review checkpoint.

An update is not accepted merely because an installer exits successfully. It must
preserve data and pass runtime, build and database/schema health checks. A Git
revert, package downgrade and data recovery are separate operations. No automatic
schema-safe rollback is promised by this candidate.
