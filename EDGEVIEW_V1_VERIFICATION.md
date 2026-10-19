# EdgeView V1 deployment verification

Verified on 2026-10-11 in the real installation:

`C:\Users\asimh\antigravity\Pharma-AI-File-Viewer-2026-08-13-3b80f`

## Result

- The frozen V1 search, capture, normalization, persistence, and research UI implementation is active in this installation.
- The production server starts on `http://127.0.0.1:3901` from this exact project root.
- A stop/start cycle rehydrated 2,092 persisted V1 research overlays.
- Dataset summary after the completed recovery run: 2,724 companies, 2,092 importer-scope companies researched, 1,176 with retained public profile data, 916 researched without a public contact/profile result, 0 unresearched in scope, and 632 excluded Pakistan exporters.
- Obsolete Outreach routes and generated reports are absent (`/api/outreach/summary` returns 404; `/api/reports` returns an empty list).
- Active tab, selected file, Contacts search/filter/view/page/selection, selected research run, sidebar state, and per-tab scroll position use persistent browser storage.
- Enrichment completion does not force navigation to the Research tab.
- Contacts now opens on all researched importers rather than the trusted-only subset. The Intelligence modal exposes every retained normalized result and structured provider failure under **All Captured Results**.
- Full/force enrichment now retains up to eight results per identity query and crawls up to eight official-site pages, prioritizing discovered CMS pages, contact, management, leadership, team, and board routes.
- The production provider path is restricted to Serper search, Hunter domain enrichment, Groq query/extraction work, and NVIDIA fallback. The completed 1,316-company recovery run used 5,092 Serper, 23 Hunter, 162 Groq, and 292 NVIDIA requests; every removed provider remained at zero.
- A five-worker bounded pool completed 1,316/1,316 target companies with zero failed job items and preserved restart checkpoints.

## Representative data checks

- Emerchemie NB Ceylon Limited: official site `https://emerchemie.lk`, `interact@emerchemie.lk`, Colombo address, and evidence-linked leadership.
- SLIM PHARMACEUTICALS PVT LTD: official site `https://slimpharma.com`, `info@slimpharma.com`, four phone variants, Colombo address, and eight named management records.

## Automated verification

- `npm run lint`: passed.
- `npm run test:v1`: passed requirement, identity-quality, and dataset-provenance suites.
- `npm run build`: passed; production client and server bundles generated with the new brand assets and conditional rebuild launcher.
- HTTP health, summary, removed-route, and persistence checks: passed.

## Browser-control limitation

Chrome displayed the running EdgeView tab, but its saved browser-control permission explicitly rejected automated access to `http://127.0.0.1:3901`. The computer-use security policy forbids bypassing that preference or switching to an alternate browser surface. Therefore no claim is made that automated human-style clicking was completed in this deployment run.

## Launch

Double-click the **EdgeView** desktop shortcut or `EdgeView.bat`. Keep its window open while using EdgeView. Close it or press Ctrl+C to stop the server. The launcher rebuilds only when source files are newer than the current production bundle.

