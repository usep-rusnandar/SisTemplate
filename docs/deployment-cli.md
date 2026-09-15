# Deployment via Azure CLI — Panduan Step-by-Step (Testing / Staging)

> **Untuk siapa:** siapa saja yang akan men-deploy Integrated Procurement ke Azure **Testing/Staging**
> lewat **PowerShell + Azure CLI**, termasuk yang belum pernah deploy aplikasi .NET sebelumnya.
>
> **Apa yang Anda kerjakan:** membangun aplikasi di laptop → mengunggah ke **deployment slot**
> `staging` → memverifikasi → (opsional) swap ke production.
>
> **Lingkungan default dokumen ini:**
> | Item | Nilai |
> |---|---|
> | Environment | **Staging** (`ASPNETCORE_ENVIRONMENT=Staging`) |
> | File config yang dibaca | `appsettings.Staging.json` |
> | Database | **PROCUREMENT_DB** (Testing) |
> | SSO | **OFF** (login via *dev-login* / halaman login lokal) |
> | App Service internal | biasanya `contractone` |
> | Slot | biasanya `staging` → URL `https://contractone-staging.azurewebsites.net` |
>
> Dokumen terkait:
> - [deployment-github.md](deployment-github.md) — **deploy AppHost internal** dari GitHub (`staging` / `production`)
> - [deployment-github-vendor.md](deployment-github-vendor.md) — **deploy Vendor** (App Service `vendor-workspace`) dari GitHub Actions
> - [deployment-guide.md](deployment-guide.md) — gambaran umum / Portal Azure
> - [deployment-vendor-gateway.md](deployment-vendor-gateway.md) — slot, CORS, CLI vendor
> - [deployment-topology.md](deployment-topology.md) — arsitektur jaringan
> - [SECURITY.md](../SECURITY.md) — aturan secret (jangan commit password)
>
> **Revisi 2026-08-13.** Vendor edge = App Service `vendor-workspace` (production + staging slot).

---

## Daftar isi

0. [Alternatif: deploy dari GitHub](#0-alternatif-deploy-dari-github)
1. [Baca dulu — apa yang dideploy](#1-baca-dulu--apa-yang-dideploy)
2. [Istilah penting (glossary)](#2-istilah-penting-glossary)
3. [Prasyarat di laptop Anda](#3-prasyarat-di-laptop-anda)
4. [Login Azure & pilih subscription](#4-login-azure--pilih-subscription)
5. [Isi variabel PowerShell](#5-isi-variabel-powershell)
6. [Pastikan deployment slot ada](#6-pastikan-deployment-slot-ada)
7. [Konfigurasi Environment Variables (sekali / saat berubah)](#7-konfigurasi-environment-variables)
8. [Build & publish di laptop](#8-build--publish-di-laptop)
9. [Deploy zip ke slot staging](#9-deploy-zip-ke-slot-staging)
10. [Database: migrasi, seeding, patch data](#10-database-migrasi-seeding-patch-data)
11. [Verifikasi setelah deploy](#11-verifikasi-setelah-deploy)
12. [Swap ke production (opsional)](#12-swap-ke-production-opsional)
13. [Vendor portal (jika SPA vendor berubah)](#13-vendor-portal-jika-spa-vendor-berubah)
14. [Troubleshooting](#14-troubleshooting)
15. [Checklist rilis rutin (copy-paste cepat)](#15-checklist-rilis-rutin-copy-paste-cepat)
16. [Angka acuan verifikasi](#16-angka-acuan-verifikasi)

---

## 0. Alternatif: deploy dari GitHub (disarankan)

Jika kode sudah di GitHub dan Anda tidak ingin build di laptop:

| Apa | Dokumen | Actions workflow |
|---|---|---|
| **Internal** (AppHost + SPA) | [deployment-github.md](deployment-github.md) | **Deploy Internal** → target `staging` / `production` |
| **Vendor** (App Service) | [deployment-github-vendor.md](deployment-github-vendor.md) | **Deploy Vendor** (`deploy-vendor.yml` + `VENDORWEBAPP_PUBLISHPROFILE_*`) |

Dokumen CLI di bawah tetap relevan untuk: isi App Service settings pertama kali, patch SQL, slot swap, dan troubleshooting lokal.

---

## 1. Baca dulu — apa yang dideploy

Ada **dua** deployable terpisah:

| # | Nama | Isi | Azure resource tipikal |
|---|---|---|---|
| **1** | **Internal** | Backend API (.NET) **+** SPA internal (React) dalam **satu** paket zip | App Service `contractone` (slot `staging`) |
| **2** | **Vendor portal** | SPA vendor (`dist/external`) + YARP allowlist `/api` | App Service `vendor-workspace` (+ slot `staging`) — [deployment-vendor-gateway.md](deployment-vendor-gateway.md) |

```
Laptop Anda
    │
    │  npm run build:internal  →  frontend/dist/internal
    │  dotnet publish AppHost  →  publish/internal  (+ SPA masuk wwwroot)
    │  zip  →  az webapp deploy --slot staging
    ▼
┌─────────────────────────────────────────────┐
│ App Service: contractone  /  slot staging   │
│  https://contractone-staging.azurewebsites.net
│  • API  /api/...                            │
│  • SPA internal di /                        │
└──────────────────┬──────────────────────────┘
                   │ connection string
                   ▼
         Azure SQL: PROCUREMENT_DB
         Azure Blob: dokumen vendor / kontrak
```

**Yang TIDAK Anda kerjakan di dokumen ini:**
- Membuat resource Azure dari nol (App Service, SQL, Storage) — diasumsikan sudah ada.
- Menyimpan password di git — secret **hanya** di App Service Configuration / Key Vault.

### 1.1 Perubahan penting sejak dokumen lama

| Hal | Dulu | Sekarang | Risiko jika diabaikan |
|---|---|---|---|
| Jumlah migration | 15 | **18** (+ `AddUserManagerReporting`, `RenameTrackerContractTypes`, `RenameContractTypeFields`) | Skema ketinggalan |
| `DataSeeding__*=false` | Sempat disarankan | **Berbahaya** — `MigrateAsync()` hanya dipanggil **di dalam** seeder | App jalan di skema lama → error SQL |
| Approval vendor | Mesin workflow berversi | Master data `vendor-status` (`approverRoleCode` / `nextId`) | Vendor tidak bisa diajukan approval |
| About Application | Belum ada / di appsettings | Tabel `core.APPLICATION_ABOUT_T` + seed bilingual | Modal About kosong / 404 |
| Settings seed | Nilai lama (pwdLen 6, dll.) | Diselaraskan dengan Settings Testing (lihat `SeedData/settings.json`) | Install baru dapat nilai usang |

---

## 2. Istilah penting (glossary)

| Istilah | Arti sederhana |
|---|---|
| **App Service** | “Komputer virtual” di Azure yang menjalankan aplikasi web Anda |
| **Deployment slot** | Salinan App Service untuk uji coba (mis. `staging`) sebelum ditukar ke production |
| **Swap** | Menukar isi slot staging ↔ production tanpa downtime (setting *sticky* tidak ikut pindah) |
| **Sticky setting** (`--slot-settings`) | Setting yang **tetap di slot itu** saat swap (contoh: `ASPNETCORE_ENVIRONMENT`) |
| **Environment variable / App Setting** | Konfigurasi di Azure yang **menimpa** `appsettings.*.json` saat runtime |
| **`__` (dua underscore)** | Cara menulis nested config di Azure: `ConnectionStrings:DefaultConnection` → `ConnectionStrings__DefaultConnection` |
| **Migration** | Perubahan skema database yang dikelola EF Core |
| **Seeding** | Mengisi data awal (role, permission, master data, About, settings key baru) saat aplikasi start |
| **Zip deploy** | Mengunggah folder hasil publish yang sudah di-zip ke App Service |

---

## 3. Prasyarat di laptop Anda

Buka **PowerShell** (bukan CMD klasik). Jalankan satu per satu. Output contoh ada di kolom kanan.

### 3.1 Tools

| Tool | Perintah cek | Harapan | Install jika belum |
|---|---|---|---|
| Azure CLI | `az --version` | ada baris `azure-cli` | `winget install Microsoft.AzureCLI` lalu **tutup & buka ulang** PowerShell |
| .NET 10 SDK | `dotnet --version` | dimulai `10.` | https://dotnet.microsoft.com/download |
| Node.js 20+ | `node --version` | `v20…` atau lebih baru | https://nodejs.org (LTS) |
| npm | `npm --version` | angka versi | ikut Node.js |
| EF tools | `dotnet ef --version` | angka versi | `dotnet tool install --global dotnet-ef` |

Kalau `az` / `dotnet` / `node` “tidak dikenali” setelah install → **tutup semua jendela PowerShell**, buka baru, coba lagi.

### 3.2 Akses yang harus Anda punya

Cetak checklist ini dan centang sebelum mulai:

- [ ] Akun Azure yang boleh mengubah App Service & Configuration di resource group Testing
- [ ] Nama **subscription**, **resource group**, **App Service**, **slot** (tanya tim / lihat Portal)
- [ ] **Connection string** database `PROCUREMENT_DB` (User Id + Password) — simpan di password manager, **jangan** commit ke git
- [ ] (Jika pakai Blob connection string) Account Key storage, **atau** izin assign Managed Identity
- [ ] (Opsional) Azure Maps key / SharePoint client secret — jika fitur peta / import SharePoint dipakai
- [ ] Kode sumber di folder `D:\Projects\IntegratedProcurement\Code` (atau sesuaikan path di §5)
- [ ] Koneksi internet stabil (upload zip ~40 MB)

### 3.3 Repo & branch

```powershell
cd D:\Projects\IntegratedProcurement\Code
git status
git pull origin master     # pastikan kode terbaru (jika Anda punya akses remote)
```

---

## 4. Login Azure & pilih subscription

```powershell
az login
```

- Browser akan terbuka. Login dengan akun Azure perusahaan.
- Jika browser diblokir di mesin Anda: `az login --use-device-code` lalu ikuti kode di layar.

Pilih subscription yang benar:

```powershell
az account list -o table
az account set --subscription "<nama-atau-id-subscription>"
az account show -o table
```

Pastikan kolom `Name` / `IsDefault` sesuai environment Testing.

Tidak tahu nama resource? Cari:

```powershell
az webapp list -o table
az group list -o table
```

Catat **Name** (App Service) dan **ResourceGroup**.

---

## 5. Isi variabel PowerShell

**Jalankan blok ini sekali di setiap sesi PowerShell baru** (variabel hilang jika jendela ditutup).

```powershell
# === SESUAIKAN NILAI DI BAWAH ===
$ROOT = "D:\Projects\IntegratedProcurement\Code"   # folder git root (ada backend/ + frontend/)
$RG   = "rg-appservices-dev-001"                    # mis. rg-procurement-test
$APP  = "contractone"                               # App Service INTERNAL
$SLOT = "staging"                                   # nama slot
$VAPP = "vendor-workspace"                          # App Service vendor portal (lihat §13)
$SA   = "stsisdevidc001"                            # storage account Blob
$RGSA = $RG                                         # ganti jika storage di RG lain

# URL yang akan dipakai verifikasi
$H = "https://$APP-$SLOT.azurewebsites.net"
Write-Host "Target slot URL: $H"
Write-Host "Publish folder:  $ROOT\publish\internal"
```

> ⚠️ **Slot butuh App Service Plan Standard (S1) ke atas.** Plan Basic (B1/B2) **tidak** mendukung slot.
>
> Cek plan:
> ```powershell
> az appservice plan list -g $RG -o table
> ```
> Scale naik (butuh persetujuan biaya):
> ```powershell
> az appservice plan update -g $RG -n <nama-plan> --sku S1
> ```

### 5.1 Cara menemukan connection string (Portal)

1. Buka [Azure Portal](https://portal.azure.com) → SQL server / database **PROCUREMENT_DB**.
2. Menu **Connection strings** → salin string **ADO.NET**.
3. Pastikan berisi `Database=PROCUREMENT_DB`, User Id, Password, dan (untuk Azure SQL sering) port publik jika ada.
4. Simpan di variabel sesi (jangan commit):

```powershell
# Hanya di memori PowerShell ini — jangan commit / jangan paste ke chat publik
$DB = "Server=sqlmisis-test.public.ca87cd4bc197.database.windows.net,3342;Database=PROCUREMENT_DB;User Id=procurementdbtes;Password=<PWD>;MultipleActiveResultSets=true;Encrypt=True"
```

---

## 6. Pastikan deployment slot ada

```powershell
az webapp deployment slot list -g $RG -n $APP -o table
```

Kalau `staging` **belum ada**:

```powershell
az webapp deployment slot create -g $RG -n $APP --slot $SLOT
```

Tunggu sampai status Ready. URL tipikal: `https://contractone-staging.azurewebsites.net`.

---

## 7. Konfigurasi Environment Variables

### 7.1 Konsep (wajib dipahami)

- **Jangan** mengedit `appsettings.json` / `appsettings.Staging.json` di server untuk memasukkan password.
- File `appsettings.Staging.json` di repo sudah memuat hal non-secret (SSO off, URL frontend, Blob ServiceUri, SharePoint TenantId/ClientId, dll.).
- **Secret + connection string** wajib lewat **App Service → Configuration → Application settings** (atau perintah `az` di bawah).
- Nama nested: ganti `:` menjadi `__`  
  Contoh: `ConnectionStrings:DefaultConnection` → `ConnectionStrings__DefaultConnection`.

### 7.2 Setting sticky (tidak ikut swap)

Jalankan **sekali** per slot (atau saat URL berubah):

```powershell
az webapp config appsettings set -g $RG -n $APP --slot $SLOT --slot-settings `
  "ASPNETCORE_ENVIRONMENT=Staging" `
  "Frontend__InternalUrl=$H"
```

- `ASPNETCORE_ENVIRONMENT=Staging` → aplikasi membaca **`appsettings.Staging.json`**.
- Harus **sticky** (`--slot-settings`). Kalau tidak, nilai bisa tertukar saat swap.

### 7.3 Setting non-sticky (ikut swap) — connection string & seeding

```powershell
az webapp config appsettings set -g $RG -n $APP --slot $SLOT --settings `
  "ConnectionStrings__DefaultConnection=$DB" `
  "ASPNETCORE_FORWARDEDHEADERS_ENABLED=true" `
  "DataSeeding__SeedInitialIam=true" `
  "DataSeeding__SeedInitialPlatformData=true"
```

| Key | Wajib? | Keterangan |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | **YA** | Tanpa ini app crash saat start |
| `ConnectionStrings__EproposalConnection` | Tracker | Sync E-Proposal / live material. Sticky. Jangan commit. |
| `DataSeeding__SeedInitialIam` | **YA = true** untuk Testing | Juga menjalankan **migrasi** (lihat §10) |
| `DataSeeding__SeedInitialPlatformData` | **YA = true** untuk Testing | Seed master data, settings key baru, **About Application**, email templates |

> ❌ **Jangan** set kedua `DataSeeding__*` ke `false` “agar aman”.  
> Migrasi **hanya** dipanggil di dalam seeder. Mematikan seeding = mematikan migrasi.

### 7.4 Secrets (HANYA di App Service / Key Vault)

Paling aman lewat **Portal** (Configuration → Application settings → New) agar nilai tidak masuk history shell.

Atau via CLI (hati-hati: muncul di history PowerShell):

```powershell
az webapp config appsettings set -g $RG -n $APP --slot $SLOT --settings `
  "AzureMaps__SubscriptionKey=<azure-maps-key>" `
  "SharePoint__ClientSecret=<sharepoint-client-secret>"
```

**SharePoint Go Live (CM-SP-1, sementara):** overlay App Registration di `contractone`
staging + production, tanpa commit secret.

| Aksi | GitHub Action | Confirm | GitHub secret |
|---|---|---|---|
| Pasang overlay (App Registration) | **Set SharePoint Client Secret** | `SET-BOTH` | `SHAREPOINT_CLIENT_SECRET` harus sama dengan secret App Registration yang sudah lolos uji Graph |
| Cabut overlay (kembali ke MI) | **Clear SharePoint App Settings** | `CLEAR-BOTH` | tidak menulis secret |

TenantId / ClientId / timeout=90 sudah ada di `appsettings.Staging.json` dan
`appsettings.Production.json`. Module portals **tidak** perlu setting ini — mereka proxy ke Suite.

Lebih baik lagi: **Key Vault reference**  
`@Microsoft.KeyVault(SecretUri=https://....vault.azure.net/secrets/...)` setelah Managed Identity slot punya akses Key Vault.

### 7.5 Blob Storage — pilih **satu** opsi

`appsettings.Staging.json` memakai `AzureBlob:ServiceUri` (Managed Identity). Setiap **slot** punya identity sendiri.

**Opsi A — Managed Identity (disarankan, tanpa Account Key):**

```powershell
# 1) Nyalakan identity di SLOT
az webapp identity assign -g $RG -n $APP --slot $SLOT
# Catat "principalId" dari output JSON

# 2) Beri role ke storage
$saId = az storage account show -g $RGSA -n $SA --query id -o tsv
az role assignment create `
  --assignee <principalId> `
  --role "Storage Blob Data Contributor" `
  --scope $saId
# User Delegation SAS (browser download) also needs Delegator. Data Contributor
# alone can list/upload/download via the app, but CreateReadSasUriAsync fails
# with AuthorizationPermissionMismatch and the SPA shows an empty preview.
az role assignment create `
  --assignee <principalId> `
  --role "Storage Blob Delegator" `
  --scope $saId

# 3) Tunggu ~5 menit propagasi AAD, lalu restart slot (§14)
```

**Opsi B — Connection string + Account Key (cepat untuk uji):**

```powershell
az webapp config appsettings set -g $RG -n $APP --slot $SLOT --settings `
  "AzureBlob__ConnectionString=DefaultEndpointsProtocol=https;AccountName=$SA;AccountKey=<KEY>;EndpointSuffix=core.windows.net"
```

Container yang dipakai (sudah di appsettings, tidak perlu di-set lagi):

| Modul | Container |
|---|---|
| Proposal Tracker | `app-proposaltracker` |
| CIP / Contract Monitoring | `app-contractmanagement` |
| Vendor Onboarding | `app-vendormanagement` |
| Platform users (avatar, dll.) | `app-platform-users` |

### 7.6 SSO

Untuk Testing/Staging dokumen ini: **SSO OFF** (`SSO:Enabled=false` di `appsettings.Staging.json`).

Menyalakan nanti tanpa rebuild:

```powershell
az webapp config appsettings set -g $RG -n $APP --slot $SLOT --settings `
  "SSO__Enabled=true"
# Pastikan SSO__ApplicationUrl = URL redirect yang terdaftar di portal SISWarrior (persis)
az webapp restart -g $RG -n $APP --slot $SLOT
```

---

## 8. Build & publish di laptop

### 8.1 Urutan WAJIB: Frontend dulu, baru Backend

Target MSBuild `PublishInternalFrontend` hanya menyalin SPA ke `wwwroot` **jika** folder
`frontend/dist/internal` sudah ada. Kalau terbalik → website `/` blank / 404.

### 8.2 Build frontend (SPA internal)

```powershell
cd $ROOT\frontend

# Install dependency (wajib setelah pull yang mengubah package-lock.json)
# HENTIKAN dulu `npm run dev` / Vite di folder frontend — kalau tidak, npm ci
# sering gagal EPERM unlink pada file .node (Rolldown/esbuild) yang sedang terkunci.
npm ci

# Build bundle internal saja
npm run build:internal
```

**Cek sukses:**

```powershell
Test-Path "$ROOT\frontend\dist\internal\index.html"   # harus True
Get-ChildItem "$ROOT\frontend\dist\internal" | Select-Object Name
```

Kalau `False` → jangan lanjut. Baca error `npm` di layar (sering karena Node terlalu lama / `npm ci` gagal).

**Jika `npm ci` gagal `EPERM` / `unlink ... rolldown-binding...node`:**

```powershell
# 1) Matikan proses yang mengunci (Vite/dev server)
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'vite|Code\\frontend' } |
  ForEach-Object { taskkill /F /PID $_.ProcessId /T }

# 2) (Opsional) bersihkan lalu coba lagi
# Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm ci
npm run build:internal
```

Penyebab paling umum: Anda masih menjalankan `npm run dev` di terminal lain, atau antivirus mengunci file native.

### 8.3 Publish backend (+ bundling SPA)

```powershell
cd $ROOT\backend
dotnet publish src\AppHost -c Release -o "$ROOT\publish\internal"
```

Tunggu sampai `Build succeeded` / `published`.

**Cek SPA ikut ter-bundle:**

```powershell
Test-Path "$ROOT\publish\internal\wwwroot\index.html"   # HARUS True
Test-Path "$ROOT\publish\internal\IntegratedProcurement.AppHost.Api.dll"  # HARUS True
```

Kalau `wwwroot\index.html` tidak ada → ulangi §8.2 lalu publish lagi.

### 8.4 Zip artifact

```powershell
# Hapus zip lama agar tidak tercampur
Remove-Item "$ROOT\publish\internal.zip" -ErrorAction SilentlyContinue

Compress-Archive -Path "$ROOT\publish\internal\*" `
  -DestinationPath "$ROOT\publish\internal.zip" -Force

# Cek ukuran (biasanya puluhan MB)
Get-Item "$ROOT\publish\internal.zip" | Select-Object FullName, Length, LastWriteTime
```

---

## 9. Deploy zip ke slot staging

```powershell
az webapp deploy -g $RG -n $APP --slot $SLOT `
  --src-path "$ROOT\publish\internal.zip" `
  --type zip `
  --track-status true `
  --verbose
```

| Tip | Detail |
|---|---|
| Lama | Zip ~40 MB biasanya **2–5 menit**. Jangan panik jika diam sebentar — `--track-status true` mencetak tahap. |
| Jangan Ctrl+C | Bisa meninggalkan deploy setengah jadi. |
| Koneksi lambat | Tambah `--timeout 600` |

**Pantau dari jendela PowerShell kedua** (opsional):

```powershell
az webapp log deployment show -g $RG -n $APP --slot $SLOT
# atau buka di browser:
# https://$APP-$SLOT.scm.azurewebsites.net/api/deployments/latest
```

Setelah deploy selesai, restart sekali agar seeder/migrasi jelas jalan di proses baru:

```powershell
az webapp restart -g $RG -n $APP --slot $SLOT
Start-Sleep -Seconds 20
```

---

## 10. Database: migrasi, seeding, patch data

### 10.1 Migrasi TIDAK berdiri sendiri — jebakan utama

Di kode saat ini, `MigrateAsync()` dipanggil **hanya di dalam**:

- `SeedInitialIamDataAsync` (`InitialIamDataSeeder`)
- `SeedInitialPlatformDataAsync` (`InitialPlatformDataSeeder`)

Keduanya hanya jalan jika flag `DataSeeding__*` = `true` (lihat `Program.cs`).

**Jalur yang disarankan untuk Testing (a):** biarkan kedua flag `true`. Seeder **idempoten**:
migrasi di-apply, data yang belum ada ditambah, yang sudah ada dibiarkan.

**Jalur kontrol penuh (b) — biasanya Production:** apply migrasi manual dulu, baru boleh matikan seeding:

```powershell
cd $ROOT\backend
dotnet ef database update `
  --project src\Platform\Persistence `
  --startup-project src\AppHost `
  --connection "$DB"
```

> Jika rilis menambah **permission baru**, setelah jalur (b) tetap jalankan **satu kali** startup
> dengan `DataSeeding__SeedInitialIam=true` agar grant role di-backfill.

### 10.2 Daftar migration saat ini (18)

1. `InitialBaseline`  
2. `AddProposalAwardResult`  
3. `RenameVendorManagementToVendorOnboarding`  
4. `RenameVendorEmailCategoryAndSettings`  
5. `RenameVendorBusinessLabels`  
6. `RenameCipIntelligentToInitiation`  
7. `BreakDownMasterDataPermissions`  
8. `AddContractMaterials`  
9. `AddVersionedVendorApprovalWorkflow`  
10. `AddVendorApprovalStepSla`  
11. `AddApprovalStepStatusCode`  
12. `WidenVendorStatusCodeTo10`  
13. `RemoveVendorApprovalWorkflowTables`  
14. `AddAribaVendorImport`  
15. `AddApplicationAbout` ← tabel `core.APPLICATION_ABOUT_T` (konten About Application bilingual)  
16. `AddUserManagerReporting`  
17. `RenameTrackerContractTypes`  
18. **`RenameContractTypeFields`** ← terbaru

Cek di DB (Azure Data Studio / SSMS / `sqlcmd`):

```sql
SELECT MigrationId FROM __EFMigrationsHistory ORDER BY MigrationId;
```

Harus ada baris terakhir mirip `%_RenameContractTypeFields`.

### 10.3 Seed otomatis yang relevan untuk rilis ini

Saat `SeedInitialPlatformData=true`, selain master data & settings **additive**, aplikasi juga:

| Objek | Perilaku seed |
|---|---|
| `core.SETTING_T` | **Additive** — key baru dari `SeedData/settings.json` ditambah; key yang sudah diedit admin **tidak** ditimpa |
| `core.APPLICATION_ABOUT_T` | Diisi **sekali** jika tabel kosong (payload bilingual EN/ID) |
| Master data set | Melewati set yang sudah punya record (tidak overwrite) |
| Email templates | Add / upgrade hati-hati (hanya jika masih = default lama) |

### 10.4 WAJIB untuk DB yang sudah pernah di-seed: patch master `vendor-status`

Seeder master data **melewati** set yang sudah berisi record. Jadi DB lama **tidak otomatis** mendapat
`approverRoleCode` / `nextId`. Tanpa itu, submit vendor gagal:

> *"No approval station is configured. Give a Vendor Status an approver role in Master Data."*

Jalankan **sekali** di DB target (idempoten). Tool: Azure Data Studio / SSMS → New Query → pilih database `PROCUREMENT_DB`.

```sql
SET QUOTED_IDENTIFIER ON;
BEGIN TRAN;

UPDATE core.MASTER_DATA_RECORD_T
   SET PayloadJson = N'{"description":"Waiting for Officer Review","nextId":"APPR1","order":4,"approverRoleCode":"OFFCR-VDR"}',
       UpdatedAt = SYSDATETIMEOFFSET()
 WHERE SetKey = 'vendor-status' AND Code = 'SBMIT';

UPDATE core.MASTER_DATA_RECORD_T
   SET Name = N'Department Head Review',
       PayloadJson = N'{"description":"Waiting for Department Head Approval","nextId":"APPR2","order":5,"approverRoleCode":"DEPHD-VDR"}',
       UpdatedAt = SYSDATETIMEOFFSET()
 WHERE SetKey = 'vendor-status' AND Code = 'APPR1';

UPDATE core.MASTER_DATA_RECORD_T
   SET Name = N'Division Head Review',
       PayloadJson = N'{"description":"Waiting for Division Head Approval","nextId":"APPRV","order":6,"approverRoleCode":"DIV-HD"}',
       UpdatedAt = SYSDATETIMEOFFSET()
 WHERE SetKey = 'vendor-status' AND Code = 'APPR2';

COMMIT;

-- Verifikasi
SELECT Code, Name, PayloadJson
FROM core.MASTER_DATA_RECORD_T
WHERE SetKey = 'vendor-status' AND Code IN ('SBMIT','APPR1','APPR2');
```

Alternatif tanpa SQL: di aplikasi → **Master Data ▸ Vendor Status** → isi **Approver Role** + **Next Id** untuk tiga baris itu.

`slaDays` sengaja kosong — diisi bisnis lewat UI (kosong = tanpa target SLA).

### 10.5 WAJIB jika masih ada vendor dengan kode status lama

Baris lama memakai `DRFT` / `BLCK` / `APPR3`. Pemetaan lengkap: [vendor-status-mapping.md](vendor-status-mapping.md).

Jalankan **setelah** migrasi `WidenVendorStatusCodeTo10` (kolom sudah `nvarchar(10)`):

```sql
SET QUOTED_IDENTIFIER ON;
BEGIN TRAN;
UPDATE vdr.VENDOR_T        SET Status     = 'DRAFT' WHERE Status     = 'DRFT';
UPDATE vdr.VENDOR_T        SET Status     = 'BLACK' WHERE Status     = 'BLCK';
UPDATE vdr.VENDOR_T        SET Status     = 'APPR2' WHERE Status     = 'APPR3';
UPDATE vdr.VENDOR_STATUS_T SET StatusCode = 'DRAFT' WHERE StatusCode = 'DRFT';
UPDATE vdr.VENDOR_STATUS_T SET StatusCode = 'BLACK' WHERE StatusCode = 'BLCK';
UPDATE vdr.VENDOR_STATUS_T SET StatusCode = 'APPR2' WHERE StatusCode = 'APPR3';
COMMIT;

SELECT Status, COUNT(*) AS Cnt FROM vdr.VENDOR_T GROUP BY Status ORDER BY Status;
```

### 10.6 Cek About Application ter-seed

```sql
SELECT Id, CreatedAt, UpdatedAt,
       LEFT(PayloadJson, 80) AS PayloadPreview
FROM core.APPLICATION_ABOUT_T;
```

Harus ada **minimal 1 baris**. Kalau kosong padahal seeding `true`, lihat log App Service (seeder gagal / migrasi belum jalan).

---

## 11. Verifikasi setelah deploy

### 11.1 Health & integrasi (tanpa login)

```powershell
curl.exe -s "$H/api/health/live"
# harapan: {"status":"Live"}

curl.exe -s "$H/api/health/ready"
# harapan: "status":"Ready" dan database Ready

curl.exe -s "$H/api/v1/platform/blob-check"
# harapan: configured:true, reachable:true  (kalau false → §7.5)

curl.exe -s "$H/api/v1/about"
# harapan: JSON berisi "version":"1.0.0" dan "name":{"en":...,"id":...}
```

Kalau `live` gagal → App belum start. Cek Log stream di Portal atau:

```powershell
az webapp log tail -g $RG -n $APP --slot $SLOT
```

### 11.2 Buka aplikasi di browser

1. Buka `$H` (contoh: https://contractone-staging.azurewebsites.net).
2. Harapan: halaman login / shell aplikasi muncul — **bukan** halaman kosong Azure / 404.
3. Karena SSO OFF di Staging, login internal memakai alur yang tersedia di UI, atau uji API:

```powershell
# Contoh dev-login (hanya jika endpoint diizinkan di Staging)
curl.exe -s -X POST "$H/api/v1/internal/auth/dev-login" `
  -H "Content-Type: application/json" `
  -d "{\"identifier\":\"00109610\"}" `
  -c cookies.txt

curl.exe -s "$H/api/v1/internal/auth/me" -b cookies.txt
```

> Jika `dev-login` dinonaktifkan di Staging, gunakan mekanisme login yang disediakan tim (atau nyalakan SSO).

### 11.3 Checklist fungsional (setelah login)

| # | Cek | Cara | Harapan |
|---|---|---|---|
| 1 | SPA ter-bundle | Buka `$H/` | UI muncul, menu kiri ada |
| 2 | About Application | Klik chip **Version x.y.z** di footer sidebar kiri | Modal About terbuka; ganti bahasa EN/ID → teks berubah |
| 3 | Rute approval | **Master Data ▸ Vendor Status** | `SBMIT` / `APPR1` / `APPR2` punya Approver Role + Next Id |
| 4 | Approval jalan | Ajukan 1 vendor uji | Status jadi `SBMIT`, badge di menu Approval (Officer) |
| 5 | Permission | Login sebagai Officer Vendor, buka vendor `APPRV` | Tombol terkait permission baru muncul (mis. Register) |
| 6 | Settings | Super Admin ▸ Settings | Nilai email/security terisi (bukan form kosong total) |
| 7 | Blob | Unggah 1 dokumen uji / `blob-check` | Berhasil / `reachable:true` |

### 11.4 Catatan bug yang sudah diketahui (bukan gagal deploy)

- **Proposal Tracker** bisa menampilkan kartu error (BUG-1 di `WORK.md`) tanpa mematikan seluruh app. Itu bug produk yang diketahui, bukan indikasi zip deploy rusak — kecuali `/` benar-benar blank.

---

## 12. Swap ke production (opsional)

Hanya setelah §11 lulus di slot staging:

```powershell
az webapp deployment slot swap -g $RG -n $APP --slot $SLOT --target-slot production
```

**Ingat:**

| Jenis setting | Saat swap |
|---|---|
| Sticky (`--slot-settings`) mis. `ASPNETCORE_ENVIRONMENT` | **Tidak** ikut pindah |
| Non-sticky (connection string, DataSeeding, secrets non-slot) | **Ikut** swap |

- Production punya identity Blob sendiri jika pakai Managed Identity → ulangi §7.5 di slot production.
- Kalau kedua slot pakai **database yang sama**, patch §10.4 / §10.5 cukup sekali.

**Rollback cepat:**

```powershell
# Tukar balik
az webapp deployment slot swap -g $RG -n $APP --slot $SLOT --target-slot production

# Atau matikan SSO darurat
az webapp config appsettings set -g $RG -n $APP --settings "SSO__Enabled=false"
az webapp restart -g $RG -n $APP
```

> Rollback **kode** tidak membalikkan **migrasi database**. Skema tetap versi baru.

---

## 13. Vendor portal (jika SPA vendor atau gateway berubah)

Deploy harian: **[deployment-github-vendor.md](deployment-github-vendor.md)** (Actions → **Deploy Vendor**).

CLI darurat: [deployment-vendor-gateway.md](deployment-vendor-gateway.md).

```powershell
cd $ROOT\frontend
npm run build:external
cd $ROOT\backend
dotnet publish src\VendorGateway -c Release -o "$ROOT\publish\vendor"
Compress-Archive -Path "$ROOT\publish\vendor\*" -DestinationPath "$ROOT\publish\vendor.zip" -Force
az webapp deploy -g $RG -n vendor-workspace --slot staging --src-path "$ROOT\publish\vendor.zip" --type zip --track-status true
```

URL undangan: `Frontend:VendorUrl` / `VendorRegistration:RegistrationUrl` mengarah ke
`https://vendor-workspace.azurewebsites.net` (production) atau
`https://vendor-workspace-staging.azurewebsites.net` (staging).

---

## 14. Troubleshooting

| Gejala | Penyebab umum | Perbaikan |
|---|---|---|
| `az` / `dotnet` / `node` tidak dikenali | PATH belum refresh | Tutup PowerShell, buka baru; cek install |
| Submit vendor: *"No approval station…"* | `vendor-status` tanpa `approverRoleCode` | §10.4 |
| Error SQL “invalid column” / tabel tidak ada | Migrasi tak jalan (`DataSeeding` false) | Set seeding `true`, restart; atau `dotnet ef database update` |
| `/api/v1/about` → 404 | `APPLICATION_ABOUT_T` kosong | Pastikan migrasi + `SeedInitialPlatformData=true`, restart |
| About tidak ganti bahasa | Cache browser / FE lama | Hard refresh (Ctrl+F5); pastikan zip FE terbaru |
| Tombol Register vendor tidak muncul | Permission belum di-grant ke role | Startup sekali dengan `SeedInitialIam=true` |
| Vendor label kode mentah `DRFT` | Data status lama | §10.5 |
| `blob-check` `reachable:false` | MI/role/connstr Blob | §7.5 |
| Halaman `/` blank / 404 aset | FE tidak di-build sebelum publish | §8 — urutan FE → BE |
| App crash saat start | Connection string kosong / salah | §7.3 |
| Config Staging tidak kebaca | `ASPNETCORE_ENVIRONMENT` salah / tidak sticky | §7.2 |
| Setting diubah tidak berefek | Pakai `:` bukan `__` | Ganti ke `__` |
| Deploy terlihat diam | Zip besar | `--track-status true --verbose` |
| Import kontrak nyangkut Fetching | Worker putus di tengah | `az webapp restart` slot |
| `npm ci` → `EPERM unlink ...rolldown-binding...node` | File native terkunci (Vite/`npm run dev` masih jalan, atau antivirus) | Stop Vite (§8.2 tip), lalu `npm ci` lagi; jika perlu hapus `node_modules` dulu |

**Restart slot (sering menyembuhkan proses / job nyangkut):**

```powershell
az webapp restart -g $RG -n $APP --slot $SLOT
```

**Lihat log langsung:**

```powershell
az webapp log tail -g $RG -n $APP --slot $SLOT
```

---

## 15. Checklist rilis rutin (copy-paste cepat)

Gunakan ini jika resource & app settings **sudah** pernah dikonfigurasi (§6–7 selesai di masa lalu).

```powershell
# 0) Variabel + login
az account show -o table
# (set ulang $ROOT $RG $APP $SLOT $H seperti §5)

# 1) Build FE
cd $ROOT\frontend
npm ci
npm run build:internal
Test-Path "$ROOT\frontend\dist\internal\index.html"

# 2) Publish BE
cd $ROOT\backend
dotnet publish src\AppHost -c Release -o "$ROOT\publish\internal"
Test-Path "$ROOT\publish\internal\wwwroot\index.html"

# 3) Zip
Remove-Item "$ROOT\publish\internal.zip" -ErrorAction SilentlyContinue
Compress-Archive -Path "$ROOT\publish\internal\*" -DestinationPath "$ROOT\publish\internal.zip" -Force

# 4) Deploy + restart
az webapp deploy -g $RG -n $APP --slot $SLOT `
  --src-path "$ROOT\publish\internal.zip" --type zip --track-status true --verbose
az webapp restart -g $RG -n $APP --slot $SLOT
Start-Sleep -Seconds 25

# 5) Verifikasi cepat
curl.exe -s "$H/api/health/live"
curl.exe -s "$H/api/health/ready"
curl.exe -s "$H/api/v1/about"
curl.exe -s "$H/api/v1/platform/blob-check"

# 6) Browser: buka $H → login → About badge → smoke test modul kritis
# 7) (Opsional) swap §12 ; (Opsional) vendor portal §13
```

**Sekali per database (bukan setiap rilis):** §10.4 vendor-status + §10.5 rewrite kode status lama.

---

## 16. Angka acuan verifikasi

Isi katalog yang di-seed kode saat revisi dokumen ini (berguna membandingkan DB setelah deploy):

| Objek | Jumlah (kira-kira) | Sumber |
|---|---|---|
| Permission | **77** = 47 tetap + 15 layar Master Data × 2 | `PermissionKeys.All` |
| Role | ~20 | `InitialIamDataSeeder.Roles` |
| Internal user (seed) | **27** | `InitialIamDataSeeder.Users` |
| Master-data set | ~21 | `InitialPlatformDataSeeder` |
| About Application | 1 baris | `core.APPLICATION_ABOUT_T` |
| EF migrations | **18** | folder `Platform/Persistence/Migrations` |

```sql
SELECT COUNT(*) AS Permissions FROM iam.PERMISSION_T;
SELECT COUNT(*) AS Roles       FROM iam.ROLE_T;
SELECT COUNT(*) AS Users       FROM iam.USER_T;
SELECT COUNT(DISTINCT SetKey) AS MasterSets FROM core.MASTER_DATA_RECORD_T;
SELECT COUNT(*) AS AboutRows FROM core.APPLICATION_ABOUT_T;
SELECT COUNT(*) AS Migrations FROM __EFMigrationsHistory;
```

> Catatan yang diketahui: grant Super Admin dibangun dari daftar permission tetap (bukan seluruh kunci per-layar Master Data). Tidak berdampak fungsional karena Super Admin punya kunci modul `masterData.*.view|manage` yang membuka semua layar itu.

---

## Lampiran A — Nilai Settings seed saat ini (referensi)

Seed file: `backend/src/Platform/Persistence/Seeding/SeedData/settings.json`.  
Perilaku: **additive only** (key baru ditambah; nilai yang sudah diubah di UI Settings tidak ditimpa).

Highlight yang diselaraskan dengan Settings Testing (2026-08-05):

| Key | Nilai seed |
|---|---|
| `baseUrl` | `https://app-saptaindra.msappproxy.net/ServiceGateway` |
| `toTest` | `it.saptaindra@gmail.com` |
| `bcc` | *(kosong)* |
| `pwdLen` | `12` |
| `reqUpper` | `true` |
| `emailMode` | `api` |

---

## Lampiran B — Perintah “emergency kit”

```powershell
# Status app
az webapp show -g $RG -n $APP --slot $SLOT --query "state" -o tsv

# List app settings (nilai sensitif ikut tampil — hati-hati)
az webapp config appsettings list -g $RG -n $APP --slot $SLOT -o table

# Restart
az webapp restart -g $RG -n $APP --slot $SLOT

# Log
az webapp log tail -g $RG -n $APP --slot $SLOT
```

---

*Selesai. Jika langkah mana pun gagal, salin **perintah + pesan error lengkap** ke tim — itu jauh lebih cepat ditolong daripada “tidak jalan”.*
