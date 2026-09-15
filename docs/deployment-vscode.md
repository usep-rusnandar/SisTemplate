# Deploy ke Azure lewat Visual Studio Code — Step by Step

> Panduan ini men-deploy aplikasi ke **Azure langsung dari VS Code** memakai extension Azure.
> Fokus utama: **backend + SPA internal ke Azure App Service**. Vendor portal
> (`vendor-workspace`) ada di bagian akhir. Untuk konsep/topologi & tabel konfigurasi lengkap, rujuk
> [deployment-guide.md](deployment-guide.md); dokumen ini adalah jalur "klik-per-klik" versi VS Code.
>
> Placeholder `<...>` ganti dengan nilai Anda. Ikuti berurutan.

---

## Setup konkret proyek ini (dikonfirmasi tim)

Nilai nyata yang sudah ditetapkan tim — pakai ini menggantikan placeholder di seluruh dokumen:

| Item | Nilai |
|---|---|
| App Service | **`contractone`** |
| Deploy ke | **Deployment slot `test`** (bukan produksi langsung) — deploy ke slot, uji, lalu **Swap** |
| URL slot | `https://contractone-test.azurewebsites.net` |
| Database | **DB test yang sudah dipakai** (`sqlmisis-test…,3342;Database=PROCUREMENT_DB`) — migration terkini **sudah** teraplikasi |
| Env var slot | **belum ada** → kita set sendiri di slot `test` (langkah 4) |

Alur ringkas: build → **Deploy to Slot (`test`)** → set env var slot → verifikasi di URL slot → **Swap Deployment Slot** untuk mempromosikan ke produksi.

---

## 0. Extension & login (sekali saja)

Pastikan terpasang (Anda bilang extension Azure sudah ada — cek daftar ini):

| Extension | Untuk |
|---|---|
| **Azure Resources** (`ms-azuretools.vscode-azureresourcegroups`) | Login + browse semua resource |
| **Azure App Service** (`ms-azuretools.vscode-azureappservice`) | Deploy backend / vendor gateway |
| **C# Dev Kit** (`ms-dotnettools.csdevkit`) | Build/run .NET di VS Code |

Login: buka **Command Palette** (`Ctrl+Shift+P`) → ketik **`Azure: Sign In`** → selesaikan
di browser. Setelah login, ikon **Azure** muncul di Activity Bar (sidebar kiri) — klik untuk
melihat subscription & resource. Kalau ada banyak subscription: Command Palette →
**`Azure: Select Subscriptions`** → centang yang dipakai proyek.

---

## 1. Prasyarat build di mesin Anda

Sama seperti panduan lain — mesin butuh **.NET 10 SDK**, **Node.js 20+**, **dotnet-ef**.
Cek: `dotnet --version`, `node --version`, `dotnet ef --version` di terminal VS Code
(`Ctrl+ö` / menu Terminal → New Terminal).

> ⚠️ **Penting soal .NET 10 di App Service.** .NET 10 masih sangat baru. Buka App Service Anda
> di portal → *Settings → Configuration → General settings → Stack* dan lihat apakah **.NET 10**
> tersedia. **Jika belum tersedia**, deploy **self-contained** (runtime ikut dibungkus) — lihat
> catatan di langkah 3. Kalau .NET 10 tersedia sebagai stack, cukup framework-dependent (default).

---

## 2. Build artifact (di terminal VS Code)

SPA internal harus dibuild DULU agar ikut masuk ke `wwwroot` backend saat publish.

```powershell
# dari folder Code/
cd frontend
npm ci
npm run build:internal

cd ..\backend
# Framework-dependent (jika App Service punya stack .NET 10):
dotnet publish src\AppHost -c Release -o ..\publish\azure
```

**Jika .NET 10 belum ada di App Service → self-contained** (pilih runtime sesuai OS App Service):

```powershell
# App Service Windows:
dotnet publish src\AppHost -c Release -r win-x64 --self-contained true -o ..\publish\azure
# App Service Linux:
dotnet publish src\AppHost -c Release -r linux-x64 --self-contained true -o ..\publish\azure
```

✅ **Cek:** `..\publish\azure\wwwroot\index.html` ada (SPA internal ikut) dan
`IntegratedProcurement.AppHost.Api.dll` ada.

---

## 3. Deploy backend ke slot `test` (dari VS Code)

Tim mengarahkan deploy ke **deployment slot** `test`, bukan ke produksi langsung. Slot = salinan
app hidup terpisah (URL sendiri) yang berbagi App Service Plan; kamu deploy + uji di sana, lalu
**Swap** untuk menaikkannya jadi produksi (near zero-downtime, bisa di-swap balik = rollback).

1. Buka panel **Azure** (Activity Bar) → **Resources** → subscription → **App Services** →
   **`contractone`** → expand → **Deployment Slots** → **`test`**.
2. **Klik kanan slot `test`** → **Deploy to Slot…**
   *(Persis seperti menu di screenshot tim.)* Saat diminta folder, pilih **`publish/azure`**.
   *(Alternatif: klik kanan folder `publish/azure` di Explorer → "Deploy to Slot…" → pilih
   `contractone/test`.)*
3. Konfirmasi "Are you sure you want to deploy…" → **Deploy**. VS Code mem-zip + unggah
   (zip deploy). Tunggu **"Deployment to … completed"**.
4. Klik **"Browse Website"** → membuka URL slot `https://contractone-test.azurewebsites.net`.
   *(Verifikasi lengkap di langkah 7 — set env var dulu di langkah 4.)*
5. **Setelah slot lolos verifikasi → Swap ke produksi:** panel Azure → klik kanan slot `test`
   (atau App Service `contractone`) → **Swap Deployment Slot…** → source `test`, target
   `production` → konfirmasi. Swap bersifat reversible (swap balik bila ada masalah).

> **⚠️ Sebelum swap pertama, baca peringatan sticky-settings di langkah 4** — kalau tidak,
> connection string / URL SSO milik slot `test` bisa ikut "naik" ke produksi saat swap.

> **Plan App Service:** aplikasi menyimpan sesi login di memori proses, jadi butuh **Always On**
> (Configuration → General settings → **Always On = On**). Slot mewarisi plan `contractone`;
> pastikan bukan Free/F1.

---

## 4. Set Environment Variables di slot `test`

> **Model config (per 2026-07-09):** `appsettings.json` **kosong**; config dipecah per environment:
> `appsettings.Development.json` (lokal, berisi rahasia dev — gitignored),
> `appsettings.Staging.json` (slot `test`), `appsettings.Production.json` (slot produksi).
> File Staging/Production **tidak** berisi rahasia (connection string / key) — itu diisi lewat
> App Service settings di bawah. Agar slot `test` memuat `appsettings.Staging.json`, set
> **`ASPNETCORE_ENVIRONMENT=Staging`** (tandai **sticky**); slot produksi biarkan default
> (`Production`). Urutan menang: App Service setting > appsettings.{env}.json > appsettings.json.

Env var di slot `test` **belum ada** → kita set. Di panel **Azure** → `contractone` →
**Deployment Slots** → **`test`** → node **Application Settings** → klik kanan →
**Add New Setting…** (ulangi per variabel). Format nama: `:` diganti `__`.

Wajib set (karena rahasia & tak ada di file Staging): `ASPNETCORE_ENVIRONMENT=Staging`,
`ConnectionStrings__DefaultConnection`, `AzureBlob__ConnectionString` (atau Managed Identity),
plus rahasia lain bila dipakai (`AzureMaps__SubscriptionKey`, `SharePoint__ClientSecret`).
Setting non-rahasia (SSO flag/URL, Frontend URL, dst.) sudah dari `appsettings.Staging.json`,
jadi tidak perlu diduplikasi sebagai env var (kalau ada, env var yang menang).

Nilai untuk slot `test` (detail lengkap: [deployment-guide.md](deployment-guide.md) §4):

| Setting | Nilai untuk slot `test` |
|---|---|
| `ConnectionStrings__DefaultConnection` | `Server=sqlmisis-test.public.ca87cd4bc197.database.windows.net,3342;Database=PROCUREMENT_DB;User Id=…;Password=…;Encrypt=True;TrustServerCertificate=True` |
| `SSO__Enabled` | **`false`** — uji dulu pakai dev-login (USER_T masih data demo; SSO penuh menyusul saat data NRP asli siap) |
| `AzureBlob__ServiceUri` | `https://<storage-account>.blob.core.windows.net` (Managed Identity — lihat §6) |
| `Frontend__InternalUrl` | `https://contractone-test.azurewebsites.net` |
| `ASPNETCORE_FORWARDEDHEADERS_ENABLED` | `true` |
| `DataSeeding__SeedInitialIam` | `false` |
| `DataSeeding__SeedInitialPlatformData` | `false` |

Saat nanti mengaktifkan SSO (`SSO__Enabled=true`), tambahkan `SSO__ApplicationUrl`
(= `https://contractone-test.azurewebsites.net/` untuk slot, atau URL produksi setelah swap),
`SSO__SsoUrl`, `SSO__Application` — lihat [sso-siswarrior.md](sso-siswarrior.md).

Setelah menambah setting, slot **restart otomatis**.

> 🔴 **JANGAN pakai `AzureBlob__ConnectionString` di Azure** — pakai Managed Identity via
> `AzureBlob__ServiceUri`. (Connection string berkey hanya untuk on-prem/IIS.)

> ⚠️ **STICKY SETTING (krusial untuk slot).** Secara default, saat **Swap**, semua app setting
> ikut bertukar — artinya `ConnectionStrings__DefaultConnection` dan `SSO__*` milik slot `test`
> bisa naik ke produksi. Untuk setting yang harus **beda antara test vs produksi**, tandai
> sebagai **"Deployment slot setting"** (sticky) supaya tidak ikut swap. UI VS Code terbatas
> untuk ini → set di **Portal → `contractone` → (slot) → Configuration → centang
> "Deployment slot setting"** pada `ConnectionStrings__DefaultConnection` dan semua `SSO__*`.
> Lakukan sebelum swap pertama. (Selama masih uji di slot saja, belum wajib; wajib begitu mulai
> swap ke produksi.)

---

## 5. Migration Database

Slot `test` memakai **DB test yang sama** dengan yang kita pakai selama ini, dan **migration
terkini sudah teraplikasi** (termasuk penyederhanaan `CEK_USER_ACCESS_FN` + drop
`SSO_NRP_MAPPING_T`). Jadi **untuk deploy pertama ini tidak ada yang perlu dijalankan.**

Untuk rilis berikutnya yang membawa migration baru, jalankan dari terminal VS Code —
**wajib `--connection` ke DB test**, tanpa itu EF menarget LocalDB dan Azure tak berubah
(jebakan yang sudah terbukti menyesatkan):

```powershell
cd D:\Projects\IntegratedProcurement\Code\backend
dotnet ef database update `
  --project src\Platform\Persistence `
  --startup-project src\AppHost `
  --connection "Server=sqlmisis-test.public.ca87cd4bc197.database.windows.net,3342;Database=PROCUREMENT_DB;User Id=<user>;Password=<pwd>;Encrypt=True;TrustServerCertificate=True"
```

✅ Output diakhiri `Done.` Aman dijalankan berulang.

> Karena slot `test` dan (nanti) produksi berbagi DB test yang sama, migration cukup dijalankan
> **sekali** — tidak per-slot.

---

## 6. Managed Identity untuk Blob (per slot!)

Agar backend akses Blob tanpa secret:

1. Portal Azure → `contractone` → **pilih slot `test`** (dropdown/daftar slot di atas) →
   **Identity → System assigned → On → Save**. Catat *Object (principal) ID*.
   > ⚠️ **Identity beda per slot.** Slot `test` punya identity sendiri, terpisah dari produksi.
   > Aktifkan + beri role untuk **slot `test`** sekarang; slot produksi butuh langkah yang sama
   > sendiri nanti. (VS Code belum punya UI role-assignment → pakai portal/CLI.)
2. Beri peran di Storage Account (Azure CLI, terminal VS Code):
   ```powershell
   az role assignment create --assignee <principalId-slot-test> `
     --role "Storage Blob Data Contributor" `
     --scope $(az storage account show -g <rg> -n <storage-account> --query id -o tsv)
   ```
   (Perlu `az login` sekali; propagasi ±5 menit.)

---

## 7. Verifikasi di slot `test`

Buka URL slot **`https://contractone-test.azurewebsites.net`**:

- [ ] `…/api/health/ready` → `{"status":"Ready", …}`
- [ ] `…/api/v1/platform/blob-check` → `configured:true, reachable:true` (kalau false → cek §6:
      role Blob untuk identity **slot test**)
- [ ] Buka `/` → SPA internal tampil → login **dev-login** (mis. `P-00001`, karena `SSO__Enabled=false`)

Setelah semua hijau → lanjut **Swap Deployment Slot** (langkah 3 poin 5) untuk menaikkan ke produksi.

**Melihat log real-time di VS Code:** panel Azure → `contractone` → slot `test` → klik kanan →
**Start Streaming Logs** (diagnosa kalau start gagal). Aktifkan logging bila diminta.

> **Checklist SSO sebelum `SSO__Enabled=true`** (detail: [sso-siswarrior.md](sso-siswarrior.md)):
> `iam.USER_T` harus berisi user asli ber-`PersonnelNo` **8-digit** (= NRP; data sekarang
> masih demo `P-0000N`). Simpan PersonnelNo sebagai teks (nol depan jangan hilang). `CEK_USER_ACCESS_FN`
> ikut terpasang lewat migration §5.

---

## 8. Vendor Portal → App Service `vendor-workspace`

Dari VS Code, jalur yang disarankan tetap **GitHub Actions** ([deployment-github-vendor.md](deployment-github-vendor.md)).

Darurat dari terminal:

```powershell
cd D:\Projects\IntegratedProcurement\Code\frontend
npm run build:external
cd ..\backend
dotnet publish src\VendorGateway -c Release -o ..\publish\vendor
```

Lalu zip-deploy ke slot staging atau production — perintah di [deployment-vendor-gateway.md](deployment-vendor-gateway.md).

Verifikasi: buka https://vendor-workspace.azurewebsites.net → login vendor;
`…/api/v1/proposal-tracker/proposals` harus **404**.

---

## 9. Redeploy (rilis berikutnya)

1. Build ulang (langkah 2).
2. Terapkan migration baru bila ada (langkah 5) — **sebelum** kode baru live.
3. Klik kanan slot `test` → **Deploy to Slot…** → folder `publish/azure` → konfirmasi overwrite.
4. Verifikasi di URL slot (langkah 7) → **Swap Deployment Slot** ke produksi.
5. Vendor portal: Actions **Deploy Vendor**, atau CLI di langkah 8.

---

## 10. Troubleshooting (VS Code / App Service)

| Gejala | Penyebab | Solusi |
|---|---|---|
| Deploy sukses tapi situs **error 500.30** | runtime .NET 10 tidak ada di App Service | Deploy **self-contained** (langkah 2) atau set stack .NET 10 |
| Halaman utama **blank/404** | `wwwroot` tak ikut | Build SPA internal DULU, baru `dotnet publish` |
| **Blob unreachable** (`blob-check false`) | Managed Identity belum diberi role | Ulangi §6, tunggu propagasi |
| Login SSO **403 "not mapped"** | `USER_T` belum berisi user NRP asli | Impor data user 8-digit |
| Login SSO **redirect loop** | `SSO__ApplicationUrl` beda dengan yang didaftarkan portal | Samakan persis (skema/host/slash) |
| **500** setelah deploy dengan migration | migration belum diterapkan ke DB test | Jalankan §5 dengan `--connection`, restart slot |
| `dotnet ef` "Applying…Done" tapi DB tak berubah | lupa `--connection` (kena LocalDB) | Selalu `--connection "<db-test>;Encrypt=True"` |
| **Blob unreachable padahal produksi OK** | role Blob hanya diberi ke identity produksi, bukan slot `test` | §6 untuk identity slot `test` (identity beda per slot) |
| **Produksi rusak setelah swap** (nunjuk DB/URL salah) | setting slot ikut ter-swap | Tandai `ConnectionStrings__*` + `SSO__*` sebagai **Deployment slot setting** (sticky), lihat §4 |
| Konfigurasi diubah tak berefek | format nama salah | Pakai `__` bukan `:`; slot restart |
| Vendor login gagal / cookie hilang | forwarded headers off | `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` |
| Cara lihat error start | — | Azure panel → slot `test` → klik kanan → **Start Streaming Logs** |

---

## 11. Ringkas alur VS Code

```
Azure: Sign In
   └─ (backend → contractone / slot "test")
      1. npm run build:internal                         (terminal)
      2. dotnet publish -o publish/azure                (terminal)
      3. klik kanan slot "test" → Deploy to Slot
      4. slot "test" → Application Settings → Add New Setting (env var, SSO__Enabled=false)
      5. migration: TIDAK perlu (DB test sudah up-to-date; hanya untuk migration baru, pakai --connection)
      6. Managed Identity slot "test" + role Blob        (portal/az cli)
      7. buka https://contractone-test.azurewebsites.net → verifikasi health/blob/dev-login
      8. Swap Deployment Slot (test → production)  [+ sticky settings sebelum swap]
   └─ (vendor portal)
      9. Actions → Deploy Vendor, atau npm run build:external + publish VendorGateway
```
