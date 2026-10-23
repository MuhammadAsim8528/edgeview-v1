# Windows distribution decision record — evaluation, not adoption

Date2026-10-23, base ef1c074. MSIX remains preferred for evaluation; no native-host
rewrite. No installer/update/customer readiness is claimed by this document.

## Existing implementation and concrete incompatibilities

Existing: browser + loopback Node server, EdgeView.bat, npm recovery/build-on-
launch, source-containing Windows ZIP with no bundled runtime. Reuse React,
Express, esbuild, DPAPI and current data authorities. No Electron/Tauri/Python.

Source-backed blockers:
- server/db_paths.ts uses application-root edgeview.db and edgeview_db.json in
  production. Settings default to root/config.json; evidence defaults beside
  source. Installed code and mutable user state need separate authorities.
- Current launcher may install npm dependencies and rebuild dist. A runtime-only
  immutable installation must not depend on global Node/npm, network install or
  write access to its package directory.
- Existing customer ZIP includes source/docs and requires Node/npm. It cannot
  satisfy the requested runtime-only or clean Windows gate merely by being
  wrapped in MSIX.

MSIX installed files are read-only. Microsoft explicitly calls out applications
writing into their installation directory during packaging preparation:
https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-prepare
https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-behind-the-scenes

Local read-only probe: MakeAppx/SignTool were not found on PATH; Windows Kits
version directories exist including10.0.26100.0. This does not prove tools absent,
usable, licensed, installed packaging support or trusted signing availability.
No developer mode, certificate trust or OS security setting was changed.

## Options / selected next experiment

1. MSIX full-trust desktop package with bundled supported Node runtime and a
   launchable bootstrap executable, opening the existing browser UI. Preferred
   prototype AFTER writable-user-storage migration and runtime bundle exist.
2. Mature signed conventional per-user installer if a demonstrated MSIX blocker
   remains. Compare update/data/uninstall guarantees before selecting a product;
   do not add an installer library merely to create another architecture.
3. Existing ZIP: preserve as developer/recovery artifact only, not final customer
   acceptance. Docker remains QA, not Windows installation evidence.

OSS/license: inventory bundled Node and redistributed production packages with
actual license texts/notices. MSIX SDK and signing-service terms require review.
No external source/library adopted by this evaluation.

Integration plan: Qoder-owned canonical writable-storage boundary must cover DB,
JSON, evidence, logs, secrets/identity, locks, backups and updates. Migration must
preserve legacy state, fail closed on ambiguity, maintain DPAPI user binding and
be tested for interruption/restart. Do not implement a second path authority in
packaging scripts to work around runtime's existing owner.

## App Installer and channels

Official settings support launch/background checks and update/downgrade options:
https://learn.microsoft.com/en-us/windows/msix/app-installer/update-settings
https://learn.microsoft.com/en-us/windows/msix/app-installer/how-to-create-appinstaller-file

The reviewed settings pages differ in minimum-version/schema details for some
features. Select an explicit target Windows baseline/schema and verify it in the
clean target instead of guessing universal compatibility. A generated XML file
does not demonstrate an installed update.

Stable/Beta/Canary need separate promotion policy and verified metadata; do not
point Stable at a moving Beta URL. Decide package identity/channel coexistence
and storage sharing deliberately before producing manifests. Publisher identity
must match a trusted production signer. HTTPS/SHA256 alone do not authenticate
an attacker-controlled update manifest. Signing private keys never enter Git.

App Installer version-decrement permission is NOT automatic application-health
rollback. Do not enable unrestricted downgrade to simulate last-known-good:
database migrations may be irreversible. Health acceptance needs exact package/
build/version/channel, API readiness, DB integrity/schema compatibility and
restart proof. Preserve schema-safe recovery data before upgrading; only promote
after health passes. Record failure safely via optional owner telemetry.

## Security and test plan / unresolved prerequisites

Before install: reproducible runtime-only staging; no secrets/customer data/dev
tools; pinned package digest/trusted signer; writable state migration; loopback
binding; process lifetime/shutdown; signed distribution metadata; SDK validation.
Then clean Windows: install/first launch/config/import/research/export/close/
restart/upgrade/repair/failure recovery/uninstall/reinstall. Record exact hashes,
versions, schema/data preservation and supported screenshots. Development
self-signing cannot be called public/customer signing.

External prerequisites remain: clean Windows target, trusted signing path,
distribution endpoint/channel ownership and actual monitoring projects. No
installer, certificate, update, downgrade or destructive production-data test
was executed. This is an evidence-backed decision gate, not implementation.
