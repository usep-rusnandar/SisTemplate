# Vendor Gateway — `vendor-workspace.azurewebsites.net`

Public URL vendor adalah hostname App Service. SPA + API allowlist di satu origin (cookie Lax).

```
Vendor ──► https://vendor-workspace.azurewebsites.net
              ├─ SPA (frontend/dist/external)
              └─ /api/v1/{vendor/auth,public/vendor-registration,vendor-portal}/*
                     └── YARP → AppHost /api/v1/...
              (API lain → 404)
```

Gateway **tidak** butuh database, secret, SSO, atau seeding. Hanya `Backend:BaseUrl`.

Deploy harian dari GitHub: [deployment-github-vendor.md](deployment-github-vendor.md).

| Environment | Gateway host | `Backend__BaseUrl` (sticky) | Backend | Undangan (`Frontend:VendorUrl`) |
|---|---|---|---|---|
| **Production** | https://vendor-workspace.azurewebsites.net | https://contractone.azurewebsites.net | contractone | https://vendor-workspace.azurewebsites.net |
| **Staging** | https://vendor-workspace-staging.azurewebsites.net | https://contractone-staging.azurewebsites.net | contractone slot `staging` | https://vendor-workspace-staging.azurewebsites.net |

`Backend__BaseUrl` **wajib sticky** (`--slot-settings`) agar swap tidak menukar backend production ↔ staging.

---

## Redeploy (CLI, darurat)

Dari root repo:

```powershell
$RG   = "rg-appservices-dev-001"
$VAPP = "vendor-workspace"

cd frontend
npm ci
npm run build:external   # → frontend/dist/external

cd ..\backend
dotnet publish src\VendorGateway -c Release -o ..\publish\vendor

Compress-Archive -Path ..\publish\vendor\* -DestinationPath ..\publish\vendor.zip -Force

az webapp deploy -g $RG -n $VAPP --slot staging --src-path ..\publish\vendor.zip --type zip --track-status true
az webapp deploy -g $RG -n $VAPP --src-path ..\publish\vendor.zip --type zip --track-status true
```

Swap zero-downtime setelah staging OK:

```powershell
az webapp deployment slot swap -g $RG -n $VAPP --slot staging --target-slot production
```

## Verifikasi

```powershell
curl.exe -s https://vendor-workspace.azurewebsites.net/healthz
curl.exe -s -o NUL -w "%{http_code}" https://vendor-workspace.azurewebsites.net/
curl.exe -s -o NUL -w "%{http_code}" https://vendor-workspace.azurewebsites.net/api/v1/proposal-tracker/proposals
# expect: Ready, 200, 404
```

Uji yang sama di `https://vendor-workspace-staging.azurewebsites.net`.

## Blob CORS (upload SAS)

Origin yang harus ada di `stsisdevidc001`:

- `https://vendor-workspace.azurewebsites.net`
- `https://vendor-workspace-staging.azurewebsites.net`
- `http://localhost:8008` (dev)
