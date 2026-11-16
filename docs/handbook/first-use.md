# First use and provider setup

Working guide — development candidate, not a customer installer.

EdgeView imports trade files and researches the exact company and country.
The current developer package requires a supported Node/npm installation.
Double-click EdgeView.bat in a writable developer installation. The normal
browser address is http://127.0.0.1:3901/. A bundled-runtime customer installation
is not yet accepted. Keep the application loopback-only.

In Settings, configure the providers you own. Serper supplies search; NVIDIA NIM
or Groq supplies bounded query generation and evidence extraction. Hunter can
look up contacts for the resolved domain. Missing keys, disabled providers and
exhausted quota are distinct states. Connection tests make external requests.
Do not copy the developer's provider access into a customer package.

Upload a supported trade file, inspect the parsed country/name identities, then
open Contacts. Choose importers, exporters or an explicit company selection.
Review the scope before starting enrichment: provider calls can consume quota.
Pakistan exporters should not silently become foreign importer research targets.

A researched row is not proof of complete contact coverage. Review each fact's
source and scope. A parent website may contain several countries' offices; a
Kenyan record must not inherit Pakistan contacts. Unknown means not established
from the captured evidence, not that no public information exists anywhere.

Research retains captured responses and failures for inspection. Exports must
reflect the selected scope. Keep exported business information private. Do not
send operational files or keys as a bug report; use reviewed diagnostics.

Fetch Details rechecks retained evidence when available for the exact company and
country. Force Fetch requests fresh research and needs configured providers and
network access. Without those providers, eligible records can still use Recheck
Saved Evidence. This does not discover new information from the Internet.

Some Google search links now require Serper's separate zero-credit resolution
step, which can add about30seconds. EdgeView bounds that wait. Unresolved links
are recorded as incomplete; they do not prove that a company has no public data.


## Choose rows and headings after upload

1. Open the uploaded file and turn **Group Shipments** off to see individual rows.
2. Open **Display columns**. Tick the detected headers you want to see and edit their display names. Clear the column selection to return to the standard view.
3. Tick individual rows, then choose **Export selected**. The selection can span pages and filters within the current file view. The limit is 1,000 selected rows. Use **Clear selection** to start again.
4. To download all rows matching the current filters, use **Export Filtered**. For the whole file, use the full dataset export. In the export dialog, review the format and headings before proceeding.

Choose up to 64 source columns. Give each export heading a unique name of up to 120 characters. Renaming a heading affects presentation. The stored upload keeps its original column names and values.
