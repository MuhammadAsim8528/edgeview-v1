# Source, build and running identity

The npm build now finishes with scripts/build-metadata.mjs. It uses Node crypto
and filesystem APIs to record version, build time, checkout HEAD when Git exists,
source digest, artifact digest and a content-derived build ID in dist/build-info.json.
No new dependency, network call, credential read or telemetry service is involved.
Git is optional; a package rebuilt without Git records an unknown commit.

One shared implementation (shared/build_identity.mjs) is used by the generator,
launcher and doctor. Source inputs are src/server/shared/public, the package and
lock manifests, TS/Vite configuration, index.html, server.ts and the metadata
generator. Server test fixtures and env files are excluded. Runtime databases,
evidence, configuration, logs, uploads and documentation are not fingerprint inputs.
Artifact hashing covers dist except the identity file, its temporary files and
the two explicitly excluded development proof/metafile outputs. File names and
bytes, not modification times, determine digests. Symbolic links are refused.

The launcher rebuilds if metadata is absent, source/artifact digests differ or
version differs. Failed/incomplete builds restore the previous dist, including
its original metadata. The generator writes metadata only after both main build
artifacts exist. The Windows ZIP includes the generator/shared helper, so an
extracted package can verify or rebuild using the same rules.

Backend health captures identity once at process startup; rebuilding files does
not relabel an old running process. Doctor compares local source/artifact digests
and the running backend's captured ID separately. Known mismatches are FAIL;
missing/invalid identity is explicitly WARN/unknown, not current. Default doctor
remains read-only. Full mode's initial observations precede its rebuild command;
rerun read-only doctor after any rebuild/restart for a current deployment check.

Settings health contains a Build identity disclosure with recorded version,
build ID, time and checkout commit. Commit is not a clean-working-tree guarantee:
the source digest also captures uncommitted production input changes. SHA256
identity is not a signature, tamper-proof attestation or secure update mechanism.
Dependency installation identity, packaged licenses, signing and update safety
remain separate gates. Hashing does not establish company-data accuracy or UI QA.

Tests cover missing/corrupt/oversized metadata, deterministic content identity,
timestamp independence, changed source/artifacts, safe field projection, launcher
reuse/rebuild/recovery and doctor source/live mismatches. An isolated compiled
backend test proves on-disk rebuild does not change the running ID, restart adopts
the new ID and invalid metadata stays unknown. Static React rendering tests are
not interactive browser evidence; visual QA remains separately required.

Extracted Windows ZIP check (2026-10-20): SHA256
5b32f08d6c661b640381d68ddaf892ff4d3f842f69328e814a396361cfdcac7c
passed locked dependency installation (90,540 ms), isolated API smoke (7,503 ms),
production rebuild (14,016 ms), rebuilt identity reuse and smoke (5,083 ms).
The original distribution manifest was verified before rebuild, not after the
rebuild changed generated files. This is not a clean-machine/no-Node test,
fixed-port launcher test, visual test or evidence of live deployment.
