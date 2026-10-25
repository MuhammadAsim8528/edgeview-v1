# Writable state boundary — opt-in preparation

A launcher may set EDGEVIEW_DATA_DIR to an absolute directory disjoint from the
application directory. shared/runtime_paths.mjs is the common resolver used by the
runtime, doctor and backup command. It rejects relative paths, application/data
ancestor overlap and existing symlink/junction/file ancestors. Resolution performs
no copying or directory creation. Runtime owners create their own needed directories.

Without the opt-in, legacy application-root paths are retained. No real data has
been moved and the live runtime has not been restarted. Test mode ignores this new
production-root choice and keeps existing isolated paths. Existing explicit
per-file overrides retain their prior semantics; an installed launcher must supply
a clean environment, not contradictory overrides. EDGEVIEW_DATA_DIR is launcher
configuration and must be set before startup, not introduced by a dotenv file.

Default SQLite/JSON, legacy JSON lookup, configuration/dotenv, installation identity,
V1 evidence, runtime logs and backup destination use the selected root. Uploads use
memoryStorage; an unused cwd/uploads mkdir was removed. Temporary exports already
use unique OS temporary directories. Build metadata/static files stay with code.
Resource disk measurements use the writable-state volume. Local health reports both
code and data roots; the downloadable support snapshot excludes these paths.
Doctor checks whether the responding process uses the selected data root.

Verification: root-resolution tests cover legacy default, disjoint opt-in, rejected
relative/overlap/link/file ancestors and no auto-migration. A temporary production
installation uses separate state, uploads synthetic data, normal shutdown through a
test-only IPC preload, restart with stable identity/data, no checked state writes in
code directory, and backup from the correct state root. The initial Windows kill
harness left a lock and correctly failed backup; replacing it with invocation of the
real shutdown handler fixed the harness rather than weakening lock refusal. The
preload is test-only, not a product API or package launcher feature.

Still required: transactional legacy migration with interruption recovery; existing
state ambiguity and override policy; immutable runtime-only bundle/launcher; signing;
MSIX install/update and uninstall/reinstall semantics; clean Windows acceptance;
schema-aware rollback. An opted-in directory alone does not complete these gates.
Existing same-user filesystem race/compromise threats are not solved by path checks.

SDK availability recheck: MakeAppx 10.0.26100.8249 and SignTool launch successfully
from Windows Kits 10.0.26100.0/x64. Earlier absence from PATH was not tool absence.
No package or certificate was created and no trust/security setting was changed.
