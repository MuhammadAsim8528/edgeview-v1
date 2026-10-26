# Bundled runtime and MSIX experiment — 2026-10-26

Status: extracted-runtime checks PASS; customer release NOT READY.

## Input lineage

Core source 01a9ed71ba479172b87a6502445fdd763c9c60a3, version 1.0.0-rc.2,
build e58583edf5e0803f40e7ec31725d7abc9cd7419d4baeb04008606b761b70b571.
The isolated factory copied only dist and package/lock, then installed production
dependencies from that lock. Source state/config/records/evidence were not copied.
Node24.19.0's installed executable had a valid OpenJS Foundation Authenticode
signature and was copied as an exploratory runtime, not chosen as the current
production runtime. Final runtime patch selection and bundled license notices
remain open. The copied executable is 92,825,416 bytes.

Prototype-only manifest/bootstrap inputs are preserved in packaging/prototype-msix.
They were experimental additions, not part of the compiled application's original
commit/digest. Package identity EdgeView.InternalPrototype, version 0.0.0.1 and
UNCONFIGURED-DEVELOPMENT-ONLY publisher are explicit placeholders, not account
ownership or signing evidence. Windows11-targeted manifest acceptance is not a
product-wide minimum-Windows decision.

## Runtime before packaging

An owned process used the staged runtime/node.exe, local production dependencies,
empty NODE_PATH and a PATH containing System32 rather than Node/npm. In production
mode, separate empty state yielded zero companies/files. Synthetic upload/export,
missing-provider 503, restart installation UUID/data, and no code-root state writes
passed. An external owned test preload coordinated shutdown; this is not completed
customer lifecycle UX. The host still has development tools installed.

## Actual MakeAppx failures and correction

Windows SDK MakeAppx10.0.26100.8249 is present. The initial per-file output exceeded
the harness capture budget; later attempts streamed logs instead. A wrong package
macro was corrected to the official package.effectivePath; that alone did not fix
the 0x8007007b payload rejection. A minimal manifest-only format control passed.
Explicit-mapping bisection isolated the failing Mammoth developer fixture:
node_modules/mammoth/test/test-data/hyperlinks/word/_rels/document.xml.rels.

Omitting the Mammoth test directory from the runtime-only mapping produced a
successful SDK-validated package; canonical tests were preserved. The final pack
used /no (no overwrite) and /ml536870912 (512MiB memory budget), without /nv.
A prior unrestricted attempt had a sampled working set218.9MiB/private207.8MiB;
that is one SDK-process sample, not an application baseline or leak test.

Unsigned prototype package: EdgeView-UNSIGNED-RUNTIME-PROTOTYPE-4.msix.
SHA256: 65aba1d3fda461ff969dfc72231e60fd31d72d1dc74659d4e6c5b940635cc5d5.
27,409 mapped files. It remains private in the owned temporary experiment directory
edgeview-bundled-runtime-I4Rfy7, not Desktop Installers or a public release/feed.

## Exact extracted payload check

MakeAppx unpack exited0. A premature launch while extraction was still running
failed EBUSY and is discarded. The rerun started only after terminal extraction
success, with fresh separate storage and an owned-PID health check before writes.

PASS: extracted bundled executable/local modules; matching core source/build;
empty initial companies; synthetic CSV upload; HTML export; missing-provider503;
normal owned shutdown/restart; preserved UUID/company; no app-root config/DB/data/
log/upload state. The excluded Mammoth test directory is absent. No real providers
or customer rows were used. No 3901 restart or original project/data mutation.

## Not established

No installation, package-identity activation, customer launcher UX, trusted signing,
WACK/certification, updater, interruption recovery, compatible rollback, uninstall
retention or clean-Windows acceptance. Existing1254x1254 logo was copied unchanged;
Store-sized assets are unverified. Production-declared build/frontend dependencies
and source maps remain in this exploratory payload. Runtime-only minimization,
complete licensing/SBOM/content scan and repeatable reviewed production builder are
still required. This package must not be shipped or labelled accepted V1.

Microsoft account setup and final visual QA remain deferred by the owner.
Official schema references:
https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-f-application
https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/macros
