# Internal MSIX format prototype — not customer packaging

These are the exact manifest/bootstrap inputs used by the 2026-10-26 isolated
format experiment. They are NOT selected production publisher identity, version,
minimum Windows policy, monitoring configuration, lifecycle or update design.
Never publish or install this unsigned experiment as the customer release.

The application remains browser + Node, without Electron/Tauri/WebView rewrite.
The manifest uses a bundled runtime/node.exe with the documented package-effective
path macro. The bootstrap selects separate EdgeViewPrototype local state and
disables monitoring; no existing data is migrated. It does not yet provide an
accepted non-technical launcher, browser-opening/close UI or update acceptance.

Observed factory steps: copy the committed production dist plus package/lock,
stage a verified signed Node executable, install locked production dependencies
using npm ci --ignore-scripts --omit=dev, copy the existing unchanged logo, and
pack with the Windows SDK MakeAppx tool using an explicit file mapping.
The factory needs development tools; the extracted runtime launch did not use
global Node/npm or NODE_PATH. This distinction is not clean-machine acceptance.

Exclude node_modules/mammoth/test from that runtime mapping. Its
test-data/hyperlinks/word/_rels/document.xml.rels fixture independently reproduces
MakeAppx 0x8007007b. Canonical source/dependency tests are not deleted. The existing
Mammoth package entry is lib/index.js, with no test-directory imports found in lib.
This one exclusion is not a completed general runtime payload/license allowlist.

MakeAppx pack uses /f for the mapping, /p for a unique output, /no to refuse an
overwrite, and /ml 536870912 to bound its parallel-memory budget. Stream output
to a file; a small in-memory capture buffer failed in the initial experiment.
Do not disable validation with /nv to turn a rejected package green.

See docs/verification/BUNDLED_RUNTIME_MSIX_2026-10-26.md and the authoritative
docs/OUTSTANDING_WORK.md. The normal developer ZIP builder is unchanged and
remains separate. No production MSIX builder/update mechanism is accepted yet.
