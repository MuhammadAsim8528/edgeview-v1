# Isolated developer package check

Run `node scripts/check-package-isolated.test.mjs`, then after building the current
clean tracked commit run `node scripts/check-package-isolated.mjs`.

The runner copies only tracked native working-tree bytes and the fingerprinted
build into an owned temporary directory. Git LF/CRLF normalization is not used
to reconstruct byte-sensitive build inputs. Tracked changes and build/source
fingerprint mismatches fail closed. The existing packager and staged/extracted
unchanged-launch checks run unchanged. Generated output is removed afterwards;
shared release outputs and operational data are not modified.

2026-10-23 evidence: source commit
`9a8f8bb7d5a3c586dd06a01171cfd39f8d15f2bf`, build ID
`7512a60c58edeb797f97b0add33811dab42a8b89b7dd7db47f4573156716ff05`.
Path/refusal regression PASS; actual manifest verification PASS (143 files);
staged and extracted unchanged-launch regression PASS; private-state filename
exclusion check PASS. Disposable ZIP SHA256:
`c84e48ded9eb5a84957b379eea182188d64d5a681b3a81960de95653c5776bba`.

This is NOT customer distribution acceptance: 113 development/source files remain
in this developer package; installed Node/npm are required. No browser, installer,
clean Windows, update/rollback, or malware/secret-content clearance is implied.
The filename exclusion check is not a content secret scanner. No final release
artifact was retained or frozen.
