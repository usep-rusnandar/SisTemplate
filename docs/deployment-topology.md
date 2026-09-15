# Deployment Topology

> Step-by-step runbook: [deployment-guide.md](deployment-guide.md).  
> GitHub: internal [deployment-github.md](deployment-github.md) · vendor [deployment-github-vendor.md](deployment-github-vendor.md).

Two deployments:

| Deployment | Contents | Audience |
|---|---|---|
| **Internal** | ASP.NET AppHost (API) + internal SPA served from `wwwroot` | Alamtri staff (internal network / SISWarrior SSO) |
| **Vendor portal** | Vendor SPA + YARP allowlist on App Service `vendor-workspace` (production + staging slot) | Public internet |

```
Vendor ──► https://vendor-workspace.azurewebsites.net
              ├─ SPA (frontend/dist/external)
              └─ /api/v1/{vendor/auth,public/vendor-registration,vendor-portal}/*
                     └── YARP → AppHost (contractone)
              (API lain → 404)

Staff  ──► https://contractone.azurewebsites.net
              └─ AppHost + internal SPA
```

Staging pairs: `vendor-workspace-staging` ↔ `contractone-staging`. `Backend__BaseUrl` on the gateway is **sticky** so slot swap does not mix backends.

## Build artifacts

`npm run build` in `frontend/` produces two self-contained artifacts:

- `dist/internal` — the backoffice app. `dotnet publish` of the AppHost copies it into `wwwroot`
  (`PublishInternalFrontend` in `IntegratedProcurement.AppHost.Api.csproj`).
- `dist/external` — the vendor portal. `scripts/finalize-external.mjs` renames
  `vendor.html → index.html` and **fails the build** if internal chunks or source markers leak.

## Internal deployment

```
cd frontend && npm run build:internal
cd ../backend && dotnet publish src/AppHost -c Release -o <out>
```

One artifact: API + UI. No CORS involved (same origin).

## Vendor portal on App Service

Day-to-day: **[deployment-github-vendor.md](deployment-github-vendor.md)** (Actions → **Deploy Vendor**).  
CLI / slots / CORS: **[deployment-vendor-gateway.md](deployment-vendor-gateway.md)**.

1. **Create** App Service `vendor-workspace` on the same plan as AppHost, plus slot `staging`.
2. **Gateway** serves the SPA at `/` and reverse-proxies only:

   | Route | Purpose |
   |---|---|
   | `/api/v1/vendor/auth/*` | Vendor login, OTP, logout, password reset/verify |
   | `/api/v1/public/vendor-registration/*` | Invitation validation + registration |
   | `/api/v1/vendor-portal/*` | Profile, documents, vendor master-data, map config |
   | `/api/*` (anything else) | **404** — internal endpoints are not reachable |

3. **Invitation URLs** on AppHost: `Frontend:VendorUrl` / `VendorRegistration:RegistrationUrl`
   → `https://vendor-workspace.azurewebsites.net` (production) and
   `https://vendor-workspace-staging.azurewebsites.net` (staging).
4. **Blob CORS** must include both vendor hostnames (direct SAS uploads).
5. Set `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` on the gateway.

## Hardening backlog

- ~~`/api/v1/frontend-state` is anonymous even on the internal deployment~~ — **done
  2026-07-08**: the group now requires an authenticated actor (internal SSO principal or
  vendor identity cookie) and bulk clear is internal-only. The gateway allowlist is the
  first fence on the public host.
