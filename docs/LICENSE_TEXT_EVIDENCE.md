# Production license-text evidence — 2026-10-23

Collector: `node scripts/collect-license-texts.mjs <installed-root>`.
Metadata/digests only by default; `--texts` additionally emits complete selected
legal text. Output goes to stdout, never silently into the live app or customer
package. Final legal notices are not generated/approved by this collection.

Inputs: this branch's npm v3 production lock entries and an explicitly named
installed root. Only exact name/version-matching package directories are read.
Only root LICENSE/LICENCE/COPYING/NOTICE names are considered; source, READMEs,
configuration, environment, datasets and provider records are not collected.
Unknown/missing license metadata remains unknown even if a text is captured.
The same name/version does not attest tarball integrity or legal compatibility.

Paths reject traversal, alternate separators/ADS and links in ancestors/entries.
Per-file bound1MiB; total legal content8MiB. Package manifest is hashed and reread
to reject concurrent change. Files are read-only. This is not a transactional
filesystem snapshot against a malicious writer; collect the frozen installed
runtime/package again at final release, not an actively changing dependency tree.

## Actual local observation

Lock SHA256:
`fff0dccfa11c16798b5f6f56bd02c58a6571ddf31d24b9d8d502db5084d90a82`.
Target: existing main installation's node_modules, read-only. Collection found:

| Lock entries | Root legal text captured | Not installed | Name/version mismatch | No root legal text | Legal bytes |
|---:|---:|---:|---:|---:|---:|
|514|397|101|0|16|733601|

Not-installed includes platform/optional entries and is not automatically a
missing customer dependency. Determine the exact customer runtime dependency
closure before excluding or accepting them. This inventory is not deduplicated
package identities, nor an installed/bundled-byte SBOM.

Of the four entries missing lock metadata, busboy1.6.0, png-js1.1.0 and
streamsearch1.1.0 each have a LICENSE file in the installed package. buffers0.1.1
has no recognized root legal file. These observations resolve file existence,
NOT license grant/attribution interpretation. Review actual upstream/license
text and the remaining16entries, MPL/copyleft obligations, Node runtime and OS/
binary notices before creating THIRD_PARTY_NOTICES.txt. No legal approval given.

## Verification

Focused Node24 test passed: exact-version match, optional absence, mismatching
version, source/README exclusion, hash-only default, path traversal and actual
Windows directory-junction rejection. Syntax/whitespace checks passed. No runtime
dependency, application source, Qoder file, private data or installed package was
modified. Hosted collector-test execution still requires its exact commit run.

Rerun at freeze with intended customer files and preserve digests alongside
SBOM/checksums. Full source/archive engineering evidence stays private and
separate from runtime notices/customer resources. Overall license gate PARTIAL.
