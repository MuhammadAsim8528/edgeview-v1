# Delivery pipeline

## Windows application

The supported interactive deployment is the Windows package with `EdgeView.bat`.
It binds loopback only, keeps data on the laptop, and protects saved credentials
with Windows CurrentUser DPAPI. No cloud server or public inbound port is required.
An existing running backend must be stopped normally before relaunching updated
code; the launcher deliberately reuses a healthy same-root instance.

## Continuous integration and delivery

`.github/workflows/ci.yml` runs Windows static checks, Git history secret scanning,
focused regression suites, build/release/isolation checks, and cold package launch.
A separate Linux Docker job runs the portable build/test contract. Successful
Windows runs retain a downloadable workflow artifact for 14 days. Version tags
currently run the same verification workflow; this repository has no automated
GitHub Release publication job. Any future publication route requires a separate
owner-authorized change and exact-artifact/release-evidence review. Pull requests
have read-only repository permissions and receive no provider credentials.

A future publishing route would be delivery, not permission to silently overwrite laptop
data or interrupt active enrichment. Download/extract a verified package separately,
stop the prior application normally, and launch the new copy. Configure credentials
locally; never put keys, datasets, databases, evidence or runtime logs in GitHub.
Do not copy a DPAPI-protected config across Windows users or machines.

## Docker QA

```
docker build --target qa --tag edgeview-qa .
docker run --rm --network none --memory 2g --cpus 2 edgeview-qa
```

Docker is an isolated QA environment here, not a Linux production app. It exposes
no ports, mounts no laptop data, and contains no real provider secrets. The build
needs network access for the base image and locked npm dependencies. The final
release smoke check runs without network/provider calls. `.dockerignore` uses an
allowlist to exclude runtime files and Git history from the build context.

Do not deploy this local application as a public multi-user service: authentication,
tenant isolation and public HTTPS deployment require a separate approved design.

## Status

Workflow definitions are not evidence of a successful GitHub run. Inspect the
commit's Actions results before shipping. Local Docker and Windows results should
be recorded separately from hosted CI results and actual browser-visible QA.
