# Dual deploy — Suite + Vendor, and module portals

One repo, one AppHost API. Dual topology is **build-time composition** (many artifacts), not a split backend.

| Host | Artifact | Role |
|---|---|---|
| `contractone.azurewebsites.net` | AppHost + `frontend/dist/internal` | Suite (all internal modules + Administration) |
| `vendor-workspace.azurewebsites.net` | VendorGateway + `frontend/dist/external` | Vendor Workspace |
| `vendor-onboarding.azurewebsites.net` | ModuleGateway + `frontend/dist/vendor-onboarding` | Vendor Onboarding + Administration |
| `proposal-tracker.azurewebsites.net` | ModuleGateway + `frontend/dist/proposal-tracker` | Proposal Tracker + Term Sheet / Contract + Administration |
| `contract-monitoring.azurewebsites.net` | ModuleGateway + `frontend/dist/contract-monitoring` | Contract Monitoring + Administration |

The CIP Azure host (`contract-initiation-platform.azurewebsites.net`) is **retired**. Term Sheet, templates, repository, and authorization live in Proposal Tracker (Suite path `/proposal-tracker/…` or the Tracker module portal). Delete the leftover App Service (production + `staging` slot) in `rg-appservices-dev-001` when convenient; this workflow no longer deploys it.

The three module App Services (and `staging` slots) live in `rg-appservices-dev-001` on plan `asp-cc`, same as `contractone` / `vendor-workspace`. GitHub variables + publish-profile secrets are already set. SCM Basic Auth is **On** on each app and slot — `azure/webapps-deploy` publish profiles do not work without it (new App Services default it Off).

## MP-0 — Auth / cookies (PIC Auth)

`*.azurewebsites.net` is on the Public Suffix List. Browsers will **not** share a cookie across those hostnames.

**Option B (active):** per-host SISWarrior SSO. PIC Auth registers each portal origin as `redirectUrl`. `/sso/login` sends `redirectUrl` for the incoming host when that host is on `SSO:AllowedApplicationUrls` (otherwise `SSO:ApplicationUrl`). The session cookie is host-only, so each portal logs in separately. ModuleGateway rewrites `/?token=` to `/api/v1/internal/sso/callback` and stamps `X-Forwarded-Host` from the real `Host` (never a client-supplied value).

**Option A (not started):** a custom parent domain so one cookie can be shared. Do not invent that domain in code.

Vendor Workspace is password login, not internal SSO.

## MP-1 — ModuleGateway

One parameterized host (`backend/src/ModuleGateway`). Runtime settings:

| App setting | Example | Sticky |
|---|---|---|
| `Backend__BaseUrl` | `https://contractone.azurewebsites.net` (prod) / `https://contractone-staging.azurewebsites.net` (staging) | **yes** |
| `Module__Key` | `vendor-onboarding` / `proposal-tracker` / `contract-monitoring` | **yes** |

Allowlist = platform (`/api/v1/internal`, `/administration`, `/super-admin`, `/master-data`, `/documents`, `/notifications`, `/frontend-state`, `/dashboard`, `/platform`, `/about`, `/api/health`) **plus that host's business prefix**. Tracker also proxies `/api/v1/contract-initiation-platform` because Term Sheet APIs still use that prefix. Other modules and the vendor portal return **404**.

A leftover `X-App-Module: contract-initiation-platform` header is aliased to Proposal Tracker on AppHost login so an undeleted CIP App Service cannot become an open Suite login.

## MP-2 — Frontend artifacts

```bash
cd frontend
npm run build:internal          # suite
npm run build:external          # vendor workspace
npm run build:vendor-onboarding
npm run build:proposal-tracker
npm run build:contract-monitoring
```

Each module build runs a leak-gate (`scripts/finalize-portal.mjs`) so another module's screens cannot ship in that artifact.

Local suite: `npm run dev` → `http://localhost:8008/` (kebab URLs, e.g. `/proposal-tracker/proposals`).
Local portal preview: `npm run build:proposal-tracker` then `npx vite preview --outDir dist/proposal-tracker`.

## MP-3 — GitHub Actions

Workflow: [`.github/workflows/deploy-module-portals.yml`](../.github/workflows/deploy-module-portals.yml).

| Portal | Variable (app name) | Secrets |
|---|---|---|
| vendor-onboarding | `AZURE_VO_WEBAPP_NAME` | `VOWEBAPP_PUBLISHPROFILE_STAGING` / `_PRODUCTION` |
| proposal-tracker | `AZURE_TRACKER_WEBAPP_NAME` | `TRACKERWEBAPP_PUBLISHPROFILE_STAGING` / `_PRODUCTION` |
| contract-monitoring | `AZURE_CM_WEBAPP_NAME` | `CMWEBAPP_PUBLISHPROFILE_STAGING` / `_PRODUCTION` |

Push to `master` (frontend / ModuleGateway) deploys **all three** portals to staging. Production is `workflow_dispatch` per portal. `workflow_dispatch` for one portal runs that matrix row only.

Production / staging hosts:

- https://vendor-onboarding.azurewebsites.net / https://vendor-onboarding-staging.azurewebsites.net
- https://proposal-tracker.azurewebsites.net / https://proposal-tracker-staging.azurewebsites.net
- https://contract-monitoring.azurewebsites.net / https://contract-monitoring-staging.azurewebsites.net

CLI publish example:

```powershell
cd frontend
npm run build:proposal-tracker

cd ..\backend
dotnet publish src\ModuleGateway -c Release -o ..\publish\proposal-tracker -p:FrontendPortal=proposal-tracker
```

App Service must have `Module__Key=proposal-tracker` and `Backend__BaseUrl` pointing at AppHost.
