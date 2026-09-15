# Panduan Deployment Step-by-Step (Azure) — untuk Pemula

> Dokumen ini adalah versi "tinggal ikuti" dari [deployment-topology.md](deployment-topology.md).
> Baca berurutan dari atas; setiap bagian punya checklist dan perintah yang bisa langsung
> di-copy-paste ke PowerShell. Placeholder ditulis dalam kurung siku seperti `<nama-resource>`
> — ganti dengan nilai environment Anda.
>
> **Deploy ke server internal (Windows/IIS) untuk testing?** Ikuti dokumen terpisah:
> [deployment-iis-internal.md](deployment-iis-internal.md).
>
> **Deploy langsung ke Azure dari Visual Studio Code (extension Azure)?** Ikuti:
> [deployment-vscode.md](deployment-vscode.md).
>
> **Deploy lewat GitHub (disarankan):**  
> - Internal AppHost → [deployment-github.md](deployment-github.md) (push `master` → staging otomatis; production manual **Deploy Internal**)  
> - Vendor portal → [deployment-github-vendor.md](deployment-github-vendor.md) (push `master` → staging otomatis; production manual **Deploy Vendor**)

---

## 1. Gambaran Besar — apa yang dideploy ke mana

Aplikasi ini terdiri dari **DUA deployment terpisah**:

```
┌─────────────────────────────────────┐    ┌──────────────────────────────────────┐
│ DEPLOYMENT 1: INTERNAL              │    │ DEPLOYMENT 2: VENDOR PORTAL (PUBLIK) │
│                                     │    │                                      │
│ Azure App Service                   │    │ Azure App Service                    │
│ ┌─────────────────────────────┐     │    │ ┌──────────────────────────────┐     │
│ │ Backend API (ASP.NET)       │     │    │ │ SPA vendor + YARP allowlist  │     │
│ │ + SPA internal di wwwroot   │◄────┼────┼─│ /api allowlist → AppHost     │     │
│ └─────────────────────────────┘     │    │ └──────────────────────────────┘     │
│                                     │    │                                      │
│ Pengguna: staf Alamtri              │    │ Pengguna: vendor (internet publik)   │
│ Login: SISWarrior SSO               │    │ Login: email + password vendor       │
└─────────────────────────────────────┘    └──────────────────────────────────────┘
                 │                                          
                 ▼                                          
   Azure SQL Database (PROCUREMENT_DB) + Azure Blob Storage (dokumen)
```

Poin penting yang harus dipahami:

- **Backend hanya satu** (di App Service `contractone`). SPA internal ikut di dalamnya (satu artifact),
  jadi tidak ada masalah CORS untuk internal.
- **Vendor portal terpisah** di App Service `vendor-workspace`. VendorGateway mem-proxy hanya
  endpoint vendor ke AppHost, jadi dari sisi browser vendor tetap satu origin.
- Allowlist ada di [`VendorGateway/Program.cs`](../backend/src/VendorGateway/Program.cs):
  hanya `/api/v1/vendor/auth/*`, `/api/v1/public/vendor-registration/*`, `/api/v1/vendor-portal/*`;
  `/api/*` lain dibalas 404.
- **Database & Blob dipakai bersama** oleh kedua deployment (lewat backend yang sama).

---

## 2. Prasyarat — siapkan sekali di laptop Anda

### 2.1 Tools yang harus terinstall

| Tool | Cek dengan | Install jika belum |
|---|---|---|
| .NET 10 SDK | `dotnet --version` | https://dotnet.microsoft.com/download |
| Node.js 20+ | `node --version` | https://nodejs.org |
| dotnet-ef | `dotnet ef --version` | `dotnet tool install --global dotnet-ef` |
| Azure CLI | `az --version` | `winget install Microsoft.AzureCLI` |

### 2.2 Akses yang harus Anda punya

- [ ] Akun Azure dengan akses ke subscription & resource group yang dipakai proyek.
- [ ] Kredensial database target (Testing / Production).
- [ ] Publish profile App Service internal + vendor (lihat [deployment-github.md](deployment-github.md) dan [deployment-github-vendor.md](deployment-github-vendor.md)).
- [ ] Registrasi aplikasi ke tim SISWarrior (key `application` + `redirectUrl`) — untuk SSO.

Login Azure CLI sekali:

```powershell
az login
az account set --subscription "<nama-atau-id-subscription>"
```

---

## 3. Persiapan Resource Azure (SEKALI SAJA per environment)

> Kalau resource sudah dibuatkan tim infra, lewati bagian ini — cukup catat namanya.

| # | Resource | Catatan |
|---|---|---|
| 1 | **Resource Group** | Wadah semua resource, mis. `rg-procurement-test` |
| 2 | **Azure SQL Database** | Testing sudah ada: `PROCUREMENT_DB` di `sqlmisis-test...` |
| 3 | **Storage Account** (Blob) | Testing sudah ada: `stsisdevidc001`. Container per modul: `app-proposaltracker`, `app-contractmanagement`, `app-vendormanagement` |
| 4 | **App Service** (Windows, .NET 10) | Host backend + SPA internal (`contractone`) |
| 5 | **App Service vendor** | Host portal vendor (`vendor-workspace` + slot `staging`) |

Contoh pembuatan App Service via CLI (sesuaikan nama/lokasi):

```powershell
az appservice plan create -g <rg> -n plan-procurement --sku P0v3
az webapp create -g <rg> -p plan-procurement -n <nama-appservice> --runtime "dotnet:10"
az webapp create -g <rg> -p plan-procurement -n vendor-workspace --runtime "dotnet:10"
az webapp deployment slot create -g <rg> -n vendor-workspace --slot staging
```

### 3.1 Managed Identity untuk Blob & SharePoint (tanpa secret)

Di production, backend mengakses Blob Storage memakai **Managed Identity**
(`AzureBlob:ServiceUri` + `ManagedIdentityCredential`), bukan connection string berisi key.
Jangan mengandalkan `DefaultAzureCredential` di App Service — chain itu sering gagal di slot
staging karena `AZURE_CLIENT_ID` parsial.

1. Aktifkan identity di App Service:
   ```powershell
   az webapp identity assign -g <rg> -n <nama-appservice>
   ```
   Catat `principalId` yang muncul.
2. Beri role di Storage Account:
   ```powershell
   az role assignment create `
     --assignee <principalId> `
     --role "Storage Blob Data Contributor" `
     --scope $(az storage account show -g <rg> -n <storage-account> --query id -o tsv)
   ```

---

## 4. Konfigurasi Backend per Environment

**Konsep penting untuk pemula:** JANGAN mengubah `appsettings.json` untuk tiap environment.
App Service punya menu **Environment variables** (dulu: Configuration → App settings) yang
**menimpa** nilai `appsettings.json` saat runtime. Format penamaannya: titik dua (`:`)
diganti **dua underscore** (`__`).

Setel semua ini di App Service → **Settings → Environment variables**:

| Nama variabel | Nilai (contoh Production Internal) | Wajib? |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | connection string SQL production | ✅ |
| `SSO__Enabled` | `true` | ✅ |
| `SSO__SsoUrl` | `https://app-saptaindra.msappproxy.net/SISwarrior/auth/redirect` | ✅ jika SSO on |
| `SSO__ApplicationUrl` | `https://<host-internal>/` (persis yang didaftarkan ke portal) | ✅ jika SSO on |
| `SSO__Application` | `IntegratedProcurement` (key dari tim SISWarrior) | ✅ jika SSO on |
| `AzureBlob__ServiceUri` | `https://<storage-account>.blob.core.windows.net` | ✅ |
| `Frontend__InternalUrl` | `https://<host-internal>` | ✅ |
| `Frontend__VendorUrl` | `https://vendor-workspace.azurewebsites.net` | ✅ |
| `VendorRegistration__RegistrationUrl` | `https://vendor-workspace.azurewebsites.net/` | ✅ |
| `ASPNETCORE_FORWARDEDHEADERS_ENABLED` | `true` (cookie Secure & redirect di belakang proxy) | ✅ |
| `SharePoint__TenantId` | tenant id (sudah ada default di appsettings) | opsional |
| `SharePoint__ClientId` | App Registration `IntegratedProcurement-SharePoint` (sudah ada default) | opsional |
| `SharePoint__ClientSecret` | secret App Registration; **wajib di slot yang tidak punya MI**, dan cara tercepat memperbaiki Graph 401 | opsional |
| `SharePoint__ManagedIdentityClientId` | client id user-assigned MI (kosongkan jika system-assigned) | opsional |
| `DataSeeding__SeedInitialIam` | Testing: `true`. Production: hati-hati — `MigrateAsync()` hanya dipanggil **di dalam** seeder; jika `false`, jalankan `dotnet ef database update` manual (lihat 6.3) | ⚠️ cek |
| `DataSeeding__SeedInitialPlatformData` | Sama seperti di atas (seed additive; jangan matikan tanpa jalur migrasi terpisah) | ⚠️ cek |

Via CLI (contoh beberapa):

```powershell
az webapp config appsettings set -g <rg> -n <nama-appservice> --settings `
  "SSO__Enabled=true" `
  "SSO__ApplicationUrl=https://<host-internal>/" `
  "ASPNETCORE_FORWARDEDHEADERS_ENABLED=true"
```

> 🔒 **Catatan keamanan:** connection string + password sebaiknya hanya ada di App Service
> settings (atau Azure Key Vault), bukan di file yang di-commit.

---

## 5. Checklist Khusus SSO — WAJIB sebelum `SSO__Enabled=true`

Ini daftar hal yang membuat SSO gagal total kalau terlewat (detail:
[sso-siswarrior.md](sso-siswarrior.md)):

- [ ] **`iam.USER_T` sudah berisi user internal asli** dengan `PersonnelNo` = NRP
      **8-digit** sungguhan (mis. `00109610`). NRP dan PersonnelNo adalah nilai yang sama
      (lookup langsung — **tidak ada** tabel `SSO_NRP_MAPPING_T`). User NRP yang belum ada di
      `USER_T` mendapat 403 `"SSO user is not mapped"`. Impor data user asli dulu.
      ⚠️ **Simpan PersonnelNo sebagai teks** — nol depan (`00109610`) tak boleh hilang;
      pencocokan exact-string, `00109610` ≠ `109610`.
- [ ] **`dbo.CEK_USER_ACCESS_FN` terpasang** — ikut migration `InitialBaseline`
      (`20260713050715_InitialBaseline`). Cek `USER_T` langsung by PersonnelNo. Portal
      memanggilnya untuk menentukan user boleh melihat aplikasi.
- [ ] **`SSO__ApplicationUrl` = URL yang persis didaftarkan** sebagai `redirectUrl` di
      portal SISWarrior. Beda satu karakter pun (http vs https, trailing slash) bisa
      membuat redirect ditolak.
- [ ] Uji cepat setelah deploy: `SELECT dbo.CEK_USER_ACCESS_FN(N'<NRP-valid>')` → harus `true`.

---

## 6. DEPLOY — Deployment 1: Internal (Backend + SPA Internal)

Kerjakan berurutan dari folder `D:\Projects\IntegratedProcurement\Code`.

### 6.1 Build SPA internal

```powershell
cd frontend
npm ci            # install dependency persis sesuai package-lock (sekali per update repo)
npm run build:internal
```

✅ **Cek hasil:** folder `frontend/dist/internal` berisi `index.html` + `assets/`.

### 6.2 Publish backend (SPA internal otomatis ikut)

```powershell
cd ..\backend
dotnet publish src\AppHost -c Release -o ..\publish\internal
```

Target MSBuild `PublishInternalFrontend` otomatis menyalin `frontend/dist/internal` ke
`publish\internal\wwwroot`.

✅ **Cek hasil:** `..\publish\internal\wwwroot\index.html` ada. Kalau tidak ada, berarti
langkah 6.1 belum jalan / gagal.

### 6.3 Terapkan migration database

> **Dua jalur (pilih satu yang konsisten dengan App Settings):**
>
> 1. **Startup seeder** — jika `DataSeeding__SeedInitialIam` / `SeedInitialPlatformData` = `true`,
>    seeder memanggil `MigrateAsync()` saat app start (jalur Testing/Staging yang umum).
> 2. **Manual/CI** — jika seeding di production dimatikan (`false`), **wajib** jalankan
>    `dotnet ef database update` di bawah sebelum/bersamaan dengan rilis yang membawa migration baru.
>    Kalau tidak, app bisa jalan di skema lama.

```powershell
dotnet ef database update `
  --project src\Platform\Persistence `
  --startup-project src\AppHost `
  --connection "<connection-string-database-target>"
```

✅ **Cek hasil:** output diakhiri `Done.` Idempotent. Di DB, baris terakhir
`__EFMigrationsHistory` harus `%_RenameContractTypeFields` (saat ini **18** migrations —
lihat [deployment-cli.md §10.2](deployment-cli.md)).

### 6.4 Deploy ke App Service (zip deploy)

```powershell
Compress-Archive -Path ..\publish\internal\* -DestinationPath ..\publish\internal.zip -Force
az webapp deploy -g <rg> -n <nama-appservice> --src-path ..\publish\internal.zip --type zip
```

### 6.5 Verifikasi internal

- [ ] `https://<host-internal>/api/health/ready` → `{"status":"Ready", ...}` (cek database reachable).
- [ ] `https://<host-internal>/api/v1/platform/blob-check` → `configured: true, reachable: true`
      (cek Managed Identity → Blob beres; kalau `reachable: false`, cek role assignment langkah 3.1).
- [ ] Buka `https://<host-internal>/` → di-redirect ke SISWarrior (jika SSO on) → login →
      kembali ke aplikasi dengan URL bersih → menu sesuai role muncul.
- [ ] `GET /api/v1/internal/auth/me` → `actorType: "Internal"`, `personnelNo` terisi.

---

## 7. DEPLOY — Deployment 2: Vendor Portal (App Service)

### 7.1 Build SPA vendor + gateway

```powershell
cd frontend
npm run build:external
```

Script `finalize-external.mjs` otomatis: rename `vendor.html → index.html` dan **menggagalkan
build kalau ada kode internal bocor** ke artifact publik (leak gate). Kalau build gagal dengan
pesan leak, JANGAN diakali — laporkan/perbaiki dulu.

✅ **Cek hasil:** `frontend/dist/external` berisi `index.html` + `assets/`.

Lalu publish gateway (menyalin SPA ke `wwwroot`):

```powershell
cd ..\backend
dotnet publish src\VendorGateway -c Release -o ..\publish\vendor
```

### 7.2 Deploy (disarankan: GitHub Actions)

Repo → **Actions** → **Deploy Vendor** → pilih `staging` atau `production` → Run.
Lihat [deployment-github-vendor.md](deployment-github-vendor.md).

Darurat dari laptop: [deployment-vendor-gateway.md](deployment-vendor-gateway.md).

### 7.3 Verifikasi vendor portal

- [ ] Buka `https://vendor-workspace.azurewebsites.net/` → halaman login vendor muncul.
- [ ] Login dengan akun vendor → berhasil (cookie same-origin via gateway).
- [ ] Endpoint internal terblokir: `…/api/v1/proposal-tracker/proposals` → **404**.
- [ ] `…/api/v1/frontend-state` → **404** dari gateway.
- [ ] Registrasi via undangan: link email mengarah ke hostname App Service vendor.

---

## 8. Urutan Deploy yang Disarankan (rilis rutin)

1. Pastikan gates hijau di lokal: `dotnet build --no-incremental` (0 warning),
   architecture tests, integration tests.
2. Terapkan migration DB (6.3) — **sebelum** kode baru naik.
3. Deploy internal (6.1 → 6.4).
4. Deploy vendor portal (7.1 → 7.2) — hanya jika ada perubahan frontend vendor atau gateway.
5. Jalankan checklist verifikasi 6.5 dan 7.3.

> Untuk Testing vs Production: langkahnya identik, yang berbeda hanya nama resource,
> connection string, dan nilai `SSO__*`. Simpan dua catatan nilai environment terpisah.

## 9. Rollback — kalau ada masalah setelah deploy

- **Kode backend/SPA internal:** deploy ulang zip artifact rilis sebelumnya
  (simpan `publish\internal.zip` tiap rilis dengan nama berversi, mis. `internal-2026-07-08.zip`).
- **Vendor portal:** deploy ulang zip `publish\vendor.zip` rilis sebelumnya, atau swap slot balik.
- **Database:** migration turun (`dotnet ef database update <NamaMigrationSebelumnya> ...`)
  hanya untuk kasus darurat — koordinasikan dulu, karena bisa membuang kolom/data baru.
- **SSO bermasalah tapi harus buka akses cepat:** set `SSO__Enabled=false` di App Service
  (aplikasi restart otomatis) — internal kembali ke mode standalone. Ini saklar darurat.

## 10. Troubleshooting Umum

| Gejala | Kemungkinan penyebab | Solusi |
|---|---|---|
| Redirect loop ke SISWarrior terus-menerus | `SSO__ApplicationUrl` tidak persis sama dengan yang terdaftar di portal | Samakan persis (skema/host/path/slash) |
| Login SSO → 403 "SSO user is not mapped" | NRP belum ada di `iam.USER_T.PersonnelNo` (lookup langsung; tanpa tabel mapping) | Seed/impor user dengan PersonnelNo = NRP 8-digit |
| Portal tidak menampilkan aplikasi untuk user | `CEK_USER_ACCESS_FN` menjawab `false` | Cek `USER_T.Status='Active'`; uji `SELECT dbo.CEK_USER_ACCESS_FN(N'<NRP>')` |
| `blob-check` → `reachable: false` | Managed Identity belum diberi role di storage | Ulangi langkah 3.1 (tunggu ±5 menit propagasi) |
| Halaman internal blank / 404 asset | `dist/internal` tidak ikut ter-publish | Pastikan urutan: build frontend DULU, baru `dotnet publish` |
| Vendor login gagal / cookie hilang | Forwarded headers belum aktif | Set `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` di gateway |
| `/api/*` dari host vendor semua 404 | `Backend__BaseUrl` salah / AppHost down | Cek setting sticky + `/api/health/ready` AppHost |
| Error 500 setelah deploy dengan migration baru | Migration belum diterapkan ke DB | Jalankan 6.3, restart App Service |
| Konfigurasi diubah tapi tidak berefek | Salah format nama variabel | Pakai `__` (dua underscore), bukan `:` |

## 11. Kamus Istilah Singkat

- **App Service** — "server web" terkelola di Azure tempat backend / gateway jalan.
- **VendorGateway** — App Service publik yang menyajikan SPA vendor dan mem-proxy allowlist `/api` ke AppHost.
- **Zip deploy** — cara deploy paling sederhana: kirim satu file zip berisi hasil publish.
- **Migration (EF Core)** — perubahan skema database yang tercatat dan dijalankan berurutan.
- **Managed Identity** — "akun" otomatis milik App Service untuk akses resource Azure lain
  tanpa menyimpan password/key.
- **Publish profile** — XML credential untuk zip-deploy dari GitHub Actions.
- **Leak gate** — pemeriksaan otomatis agar kode internal tidak terbawa ke artifact publik.
