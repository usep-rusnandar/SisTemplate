# Deployment Internal (AppHost) dari GitHub Actions — Publish Profile

> Deploy **backend + SPA internal** ke Azure App Service dari GitHub **tanpa** akses Microsoft Entra ID.
> Workflow: [`.github/workflows/deploy-internal.yml`](../.github/workflows/deploy-internal.yml) — Actions: **Deploy Internal**.
>
> Auth: **Publish Profile** (bukan OIDC / App Registration).
>
> Trigger:
> - **otomatis:** push ke `master` (path `backend/**`, `frontend/**`, atau workflow ini) → **staging**
> - **manual:** `workflow_dispatch` — pilih `staging` atau `production`
>
> **Vendor portal:** [deployment-github-vendor.md](deployment-github-vendor.md) (App Service `vendor-workspace`, Publish Profile).  
> Deploy lokal (Azure CLI): [deployment-cli.md](deployment-cli.md).

---

## 0. Peta singkat — Internal vs Vendor

| | Internal (dokumen ini) | Vendor |
|---|---|---|
| Azure resource | App Service (`contractone`) + slot | App Service (`vendor-workspace`) + slot |
| Workflow Actions | **Deploy Internal** | **Deploy Vendor** (`deploy-vendor.yml`) |
| Auth ke Azure | **Publish Profile** (secret XML) | **Publish Profile** (`VENDORWEBAPP_PUBLISHPROFILE_*`) |
| Butuh Entra ID? | **Tidak** | **Tidak** |
| Build | `npm run build:internal` + `dotnet publish` | `npm run build:external` + `dotnet publish` VendorGateway |
| Jangan pakai | App Service **Deployment Center → GitHub** (Oryx) | sama |

---

## 1. Apa yang dilakukan workflow

1. Checkout kode (branch/tag/SHA).
2. `npm ci` + `npm run build:internal`.
3. `dotnet publish` AppHost Release (SPA masuk `wwwroot`).
4. Zip artifact.
5. Deploy zip dengan `azure/webapps-deploy` + **publish profile** (staging atau production).
6. Cek `GET /api/health/live` (+ cuplikan `/api/v1/about`).

**Tidak** diubah workflow: connection string, Blob/Maps/SharePoint, `ASPNETCORE_ENVIRONMENT` — tetap di App Service Configuration ([deployment-cli.md §7](deployment-cli.md)).

| Input `target` | Tujuan Azure | Secret publish profile | GitHub Environment | URL tipikal |
|---|---|---|---|---|
| `staging` | Slot `staging` | `AZUREWEBAPP_PUBLISHPROFILE_STAGING` | `staging` | `https://contractone-staging.azurewebsites.net` |
| `production` | Site production | `AZUREWEBAPP_PUBLISHPROFILE_PRODUCTION` | `production` | `https://contractone.azurewebsites.net` |

> **Swap slot** (staging ↔ production tanpa redeploy) tetap lewat Portal/CLI — §5.  
> Deploy `production` = upload zip langsung ke site production.

---

## 2. Prasyarat (sekali saja)

### 2.1 Di Azure — App Service siap

- App Service internal ada (contoh: `contractone`).
- Slot **`staging`** sudah dibuat.
- App settings per slot/site sudah diisi.
- Anda punya izin di Portal untuk membuka App Service / slot dan **Download publish profile** (tidak perlu Entra admin).

### 2.2 Unduh Publish Profile

**Staging (wajib dari slot, bukan dari site production):**

1. Portal Azure → App Service `contractone`.
2. **Deployment** → **Deployment slots** → klik slot **`staging`**.
3. Di Overview slot staging → **Get publish profile** / **Download publish profile**.
4. File `.PublishSettings` (XML) tersimpan di laptop — **jangan** commit ke git.

**Production:**

1. Portal → App Service `contractone` (site utama, bukan slot).
2. Overview → **Download publish profile**.
3. Simpan terpisah dari file staging.

> Profile staging dan production **berbeda**. Tertukar = deploy ke lingkungan salah.

### 2.3 Di GitHub — Environments (disarankan)

Repo → **Settings** → **Environments**:

| Nama | Disarankan |
|---|---|
| `staging` | Optional reviewers |
| `production` | **Required reviewers** |

### 2.4 Di GitHub — Variables

**Settings** → **Secrets and variables** → **Actions** → **Variables**:

| Name | Contoh | Keterangan |
|---|---|---|
| `AZURE_WEBAPP_NAME` | `contractone` | Nama App Service |
| `AZURE_SLOT_NAME` | `staging` | Slot untuk target `staging` (default `staging`) |

`AZURE_RESOURCE_GROUP` **tidak wajib** untuk jalur publish profile (tidak dipakai `az` login).

### 2.5 Di GitHub — Secrets (isi XML publish profile)

**Settings** → **Secrets** → **New repository secret** (atau Environment secret):

| Secret | Isi |
|---|---|
| `AZUREWEBAPP_PUBLISHPROFILE_STAGING` | **Seluruh** isi file publish profile **slot staging** (copy-paste XML) |
| `AZUREWEBAPP_PUBLISHPROFILE_PRODUCTION` | **Seluruh** isi file publish profile **production** |

Cara isi: buka file `.PublishSettings` di Notepad → Ctrl+A → Ctrl+C → paste ke value secret.

**Jangan** commit file itu; **jangan** share di chat/ticket tanpa perlu.

### 2.6 Jika publish credentials di-reset

Portal → App Service → **Reset publish profile** / ganti publishing password → unduh profile **baru** → update secret di GitHub. Deploy akan gagal sampai secret diganti.

---

## 3. Cara menjalankan deploy

### 3.0 Staging otomatis (push `master`)

1. Pastikan secret/variable §2 sudah terisi (`AZUREWEBAPP_PUBLISHPROFILE_STAGING`, `AZURE_WEBAPP_NAME`).
2. Merge / push ke **`master`** dengan perubahan di `backend/` atau `frontend/` (atau file workflow).
3. Repo → **Actions** → **Deploy Internal** jalan sendiri → target **staging**.
4. Approve Environment `staging` jika diminta → tunggu hijau (~5–15 menit).
5. Smoke test staging ([deployment-cli.md §11](deployment-cli.md)).

Push yang hanya mengubah `docs/` (dll.) **tidak** memicu deploy (filter `paths`).

### 3.1 Production / deploy manual

1. Repo → **Actions** → **Deploy Internal** → **Run workflow**.
2. **target:** `staging` atau `production`; **ref** / **skip_health_check** opsional.
3. Approve Environment jika diminta → tunggu hijau.
4. Setelah staging OK → Run dengan **target** = `production` (atau slot swap — §5).

### 3.2 Urutan rilis penuh (Suite + module portals)

When the user says deploy staging/production, ship **all four internal hosts**, not Suite alone.

1. Push/`merge` ke `master` → **Deploy Internal** staging **and** **Deploy Module Portals** staging (otomatis on `frontend/**`)
2. Uji Suite + vendor-onboarding + proposal-tracker + contract-monitoring staging
3. **Deploy Internal** → `production` *(manual)*
4. **Deploy Module Portals** → `production` for **vendor-onboarding**, **proposal-tracker**, and **contract-monitoring** *(manual, all three)*
5. Vendor Workspace production only when asked (`deploy-vendor.yml`)

Staging hosts: `https://contractone-staging.azurewebsites.net`, `https://vendor-onboarding-staging.azurewebsites.net`, `https://proposal-tracker-staging.azurewebsites.net`, `https://contract-monitoring-staging.azurewebsites.net`.

Production hosts: `https://contractone.azurewebsites.net`, `https://vendor-onboarding.azurewebsites.net`, `https://proposal-tracker.azurewebsites.net`, `https://contract-monitoring.azurewebsites.net`.

### 3.3 DB / patch

Workflow tidak menjalankan SQL patch. Migrasi/seed: `DataSeeding__*` di App Service. Patch lama: [deployment-cli.md §10](deployment-cli.md).

---

## 4. Verifikasi cepat

```powershell
$H = "https://contractone-staging.azurewebsites.net"
curl.exe -s "$H/api/health/live"
curl.exe -s "$H/api/v1/about"
```

---

## 5. Alternatif production: slot swap

Setelah staging slot hijau:

```powershell
az webapp deployment slot swap `
  -g <resource-group> -n contractone `
  --slot staging --target-slot production
```

Atau Portal → Deployment slots → Swap. Sticky settings: [deployment-cli.md §12](deployment-cli.md).

---

## 6. Jangan pakai Deployment Center GitHub di App Service

**Deployment Center → GitHub** memakai Oryx di Azure — **tidak** menjalankan `build:internal` → `dotnet publish` dengan benar untuk monorepo ini. Pakai workflow **Deploy Internal** saja.

---

## 7. Troubleshooting

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| `AZUREWEBAPP_PUBLISHPROFILE_… is not set` | Secret belum diisi / typo nama | §2.5 |
| `AZURE_WEBAPP_NAME` not set | Variable belum diisi | §2.4 |
| Deploy 401 / auth failed | Profile salah, kedaluwarsa, atau tertukar stg/prod | Unduh ulang dari **slot/site yang benar** → update secret |
| Deploy sukses tapi salah lingkungan | Profile staging dipakai untuk production (atau sebaliknya) | §2.2 — unduh dari slot staging vs site production |
| Health check gagal | App crash / connstr / dingin | Log App Service; `skip_health_check` sementara |
| `/` blank | FE tidak masuk publish | Cek log Build frontend / Publish backend |
| Job menunggu approval | Environment protection | Approve di halaman run |

---

## 8. Keamanan (ringkas)

- Publish profile = credential publishing — hanya di GitHub Secrets.
- Environment `production` + required reviewers = gate manusia.
- Connection string / secret aplikasi tetap di App Service, bukan di profile (profile hanya untuk deploy file).
- Jangan commit `.PublishSettings` ([SECURITY.md](../SECURITY.md)).
- Jika bocor: Reset publish profile di Portal + ganti secret GitHub.

---

## 9. Ringkas untuk orang awam

1. Portal → slot **staging** → **Download publish profile** → tempel ke secret `AZUREWEBAPP_PUBLISHPROFILE_STAGING`.  
2. Portal → App Service production → download profile → secret `AZUREWEBAPP_PUBLISHPROFILE_PRODUCTION`.  
3. Variable `AZURE_WEBAPP_NAME` = `contractone`.  
4. Push ke `master` → staging otomatis; production tetap **Run workflow** manual.  
5. **Tidak perlu** Microsoft Entra ID.  
6. Vendor portal: [deployment-github-vendor.md](deployment-github-vendor.md) (juga tanpa Entra).

---

## 10. Catatan: OIDC (jika nanti ada akses Entra)

Jalur OIDC (App Registration + federated credential) lebih “modern”, tetapi **membutuhkan** akses Microsoft Entra ID. Tim ini memakai **Publish Profile** karena Entra tidak tersedia. Jangan campur kedua jalur di satu workflow tanpa koordinasi.

---

*Setup §2 sekali. Setelah itu: push `master` → staging; production → Actions → **Deploy Internal** → target `production`.*
