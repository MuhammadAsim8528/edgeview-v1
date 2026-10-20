# Production dependency inventory

`node scripts/generate-sbom.mjs` invokes npm's supported offline, lock-derived
CycloneDX generator. No new inventory library, schema or cryptographic algorithm
is introduced. The output is `outputs/EdgeView-V1-Windows.zip.sbom.cdx.json` beside
the package (outside the checkout). CI uploads it with the ZIP/checksum and the
version-tag workflow attaches it to a release.

The adapter validates canonical package URL/version rather than display name:
npm can label the root with the checkout directory name. It preserves the original
standard tool output. Invalid output/command failure does not replace an existing
inventory. Tests cover those failures and a legitimate differing display name.

## Scope and limitations

This is a pre-build npm production-lock inventory, including platform-optional
dependencies. It is not a byte-exact list of bundled JavaScript, a Windows-only
installed dependency list, a vulnerability scan, a complete attribution bundle,
or an inventory of Node/npm/Windows/container base images. No secrets, local
research documents, database rows or provider payloads are inputs. npm is invoked
offline with bounded output/deadline and credential-named env values removed.

Local generation on 2026-10-20 produced 437 components. License metadata counts:
372 MIT, 29 ISC, five BSD-3-Clause, five BSD-2-Clause, four Apache-2.0, one each
0BSD/Unlicense/BlueOak-1.0.0/MIT AND ISC, twelve MPL-2.0 and six unknown.

Existing Lightning CSS 1.32.0 and its platform packages carry MPL-2.0 metadata;
flag these for distribution/license review. This work did not newly adopt them.
Missing metadata: buffers 0.1.1, busboy 1.6.0, chainsaw 0.1.0, duck 0.1.12,
png-js 1.1.0 and streamsearch 1.1.0. Missing npm metadata does not establish that
these packages have no license: inspect upstream/installed license files and
record evidence before final attribution approval. No legal clearance is claimed.

Keep adoption decisions separate: upstream repository, version/commit, license,
purpose, integration choice, local modifications, security and test consequences.
Generating an SBOM does not complete that per-subsystem review or the clean-machine
Windows packaging gate.

Production audit on 2026-10-20: `npm audit --omit=dev --audit-level=high`
completed with five moderate findings, no reported high/critical findings. The
workflow now runs that gate; moderate findings remain visible, not marked fixed.
They involve sprintf-js via argparse/mammoth and uuid via ExcelJS. npm's suggested
forced downgrades are breaking changes and were not applied. Prior reachability
assessments do not patch these dependencies; reassess before final release.
