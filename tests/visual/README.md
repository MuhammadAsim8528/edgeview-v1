# Synthetic screenshot review

This extends the existing Playwright infrastructure. It does not inspect the
owner's live3901 instance, real records or authenticated accounts. Each case owns
an empty isolated backend, uploads synthetic CSV and blocks external traffic.
Session replay and new visual SaaS integrations are not used.

After building, run `npm run test:visual:capture`. Six desktop/narrow screenshots,
source/build metadata and test results go to `.test-cache/visual-artifacts`.
Capture success means the screens were exercised, **not** that their appearance
is approved. Hosted CI uploads these explicitly unreviewed artifacts for7days.

Review each full image against intended behavior, including responsive overflow,
readable tables, focus and loading/error states. Do not bless a broken current
screen merely because the screenshot exists. These first three screen states are
not complete UI coverage. Dynamic diagnostics require deliberate narrow masking
before references are accepted; do not mask entire meaningful panels.

Only after review, copy accepted synthetic PNGs to
`tests/visual/baselines/<platform>/<scenario>.png` in a narrow reviewed commit.
Record the review, exact build, browser/OS/viewport and remaining limitations in
the existing OUTSTANDING_WORK ledger. No baselines are approved yet.

`npm run test:visual` compares with zero differing pixels and snapshot updates
disabled. A missing baseline fails; no reference is automatically created or
updated. Keep the browser/OS/font environment consistent. Pixel equality does not
prove factual company-country correctness, installation or live visual QA.

Reference: https://playwright.dev/docs/test-snapshots
