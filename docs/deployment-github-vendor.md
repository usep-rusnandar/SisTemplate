# Deployment Vendor Portal dari GitHub Actions — App Service `vendor-workspace`

> Deploy SPA vendor + VendorGateway (YARP) ke Azure App Service dari GitHub **tanpa** Microsoft Entra ID.
> Workflow: [`.github/workflows/deploy-vendor.yml`](../.github/workflows/deploy-vendor.yml) — Actions: **Deploy Vendor**.
>
> Auth: **Publish Profile** (bukan OIDC).
>
> Trigger:
> - **otomatis:** push ke `master` (path `frontend/**`, `backend/src/VendorGateway/**`, atau workflow ini) → **staging**
> - **manual:** `workflow_dispatch` — pilih `staging` atau `production`
>
> Internal AppHost: [deployment-github.md](deployment-github.md).  
> CLI / slot / CORS: [deployment-vendor-gateway.md](deployment-vendor-gateway.md).

---

## 0. Peta singkat

| | Internal | Vendor |
|---|---|---|
| Azure resource | App Service `contractone` + slot `staging` | App Service `vendor-workspace` + slot `staging` |
| Workflow | **Deploy Internal** | **Deploy Vendor** |
| Auth | Publish profile `AZUREWEBAPP_PUBLISHPROFILE_*` | Publish profile `VENDORWEBAPP_PUBLISHPROFILE_*` |
| Variable nama app | `AZURE_WEBAPP_NAME` | `AZURE_VENDOR_WEBAPP_NAME` |
| Build | `npm run build:internal` + `dotnet publish` AppHost | `npm run build:external` + `dotnet publish` VendorGateway |
| URL production | https://contractone.azurewebsites.net | https://vendor-workspace.azurewebsites.net |
| URL staging | https://contractone-staging.azurewebsites.net | https://vendor-workspace-staging.azurewebsites.net |

Jangan pakai App Service **Deployment Center → GitHub** (Oryx) — SPA harus di-build dulu di Actions.

---

## 1. Apa yang dilakukan workflow

1. Checkout kode.
2. `npm ci` + `npm run build:external` (leak gate di `finalize-external.mjs`).
3. `dotnet publish` VendorGateway (SPA masuk `wwwroot`).
4. Zip + `azure/webapps-deploy` ke slot staging atau site production.
5. Cek `GET /healthz`, `GET /` (200), `GET /api/v1/proposal-tracker/proposals` (404).

App settings (`Backend__BaseUrl`, dll.) **tidak** diubah workflow — tetap sticky di App Service.

| Input `target` | Tujuan Azure | Secret | URL |
|---|---|---|---|
| `staging` | Slot `staging` | `VENDORWEBAPP_PUBLISHPROFILE_STAGING` | https://vendor-workspace-staging.azurewebsites.net |
| `production` | Site production | `VENDORWEBAPP_PUBLISHPROFILE_PRODUCTION` | https://vendor-workspace.azurewebsites.net |

`Backend__BaseUrl` **wajib sticky**: staging → `contractone-staging`, production → `contractone`. Lihat [deployment-vendor-gateway.md](deployment-vendor-gateway.md).

---

## 2. Prasyarat (sekali saja)

### 2.1 App Service siap

- App Service `vendor-workspace` + slot `staging`.
- `Backend__BaseUrl` sticky per slot.
- Izin Portal untuk **Download publish profile**.

### 2.2 Unduh Publish Profile

**Staging** (dari slot, bukan site production):

1. Portal → App Service `vendor-workspace` → **Deployment slots** → **staging**.
2. Overview slot → **Download publish profile**.

**Production:** Overview site `vendor-workspace` (bukan slot) → **Download publish profile**.

Profile staging dan production **berbeda**. Tertukar = deploy ke lingkungan salah.

Atau CLI:

```powershell
az webapp deployment list-publishing-profiles -g rg-appservices-dev-001 -n vendor-workspace --slot staging --xml
az webapp deployment list-publishing-profiles -g rg-appservices-dev-001 -n vendor-workspace --xml
```

### 2.3 GitHub Variable + Secrets

Repo → **Settings → Secrets and variables → Actions**:

| Jenis | Nama | Nilai |
|---|---|---|
| Variable | `AZURE_VENDOR_WEBAPP_NAME` | `vendor-workspace` |
| Secret | `VENDORWEBAPP_PUBLISHPROFILE_STAGING` | isi XML profile slot staging |
| Secret | `VENDORWEBAPP_PUBLISHPROFILE_PRODUCTION` | isi XML profile production |

Environment GitHub `staging` / `production` sama dengan workflow internal (required reviewers di production tetap berlaku).

---

## 3. Cara menjalankan

**Otomatis:** push ke `master` yang menyentuh `frontend/**` atau `backend/src/VendorGateway/**` → staging.

**Manual:** Actions → **Deploy Vendor** → Run workflow → pilih `staging` atau `production`.

Production **jangan** di-trigger otomatis.

---

## 4. Verifikasi

```powershell
$V = "https://vendor-workspace-staging.azurewebsites.net"   # atau production tanpa -staging
curl.exe -s "$V/healthz"                                   # {"status":"Ready"}
curl.exe -s -o NUL -w "%{http_code}" "$V/"                 # 200
curl.exe -s -o NUL -w "%{http_code}" "$V/api/v1/proposal-tracker/proposals"  # 404
```

Browser: buka host → login vendor. Undangan email memakai `Frontend:VendorUrl` di AppHost.

---

## 5. Troubleshooting

| Gejala | Perbaikan |
|---|---|
| `VENDORWEBAPP_PUBLISHPROFILE_… is not set` | Isi secret §2.3 |
| `AZURE_VENDOR_WEBAPP_NAME` not set | Variable §2.3 |
| Deploy 401 | Profile salah / kedaluwarsa — unduh ulang dari slot/site yang benar |
| `/healthz` gagal | Log App Service; cek `Backend__BaseUrl` |
| `/` blank | `dist/external` tidak ikut publish |
| Job menunggu approval | Environment `production` protection — approve di halaman run |

---

## 6. Keamanan (ringkas)

- Publish profile = credential publishing — hanya di GitHub Secrets.
- Jangan commit `.PublishSettings`.
- Jika bocor: Reset publish profile di Portal + ganti secret GitHub.
