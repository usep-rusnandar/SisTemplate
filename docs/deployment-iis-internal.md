# Panduan Deploy ke Server Internal via IIS (Windows) — Step by Step

> Panduan ini khusus untuk men-deploy **Deployment 1 (Internal): Backend API + SPA Internal**
> ke server Windows on-premise menggunakan **IIS**, sebagai lingkungan **testing internal**.
> Ini alternatif dari Azure App Service ([deployment-guide.md](deployment-guide.md) bagian 6).
> Vendor portal (App Service `vendor-workspace`) tidak dibahas di sini — lihat
> [deployment-github-vendor.md](deployment-github-vendor.md).
>
> Ikuti berurutan. Placeholder `<...>` ganti dengan nilai server Anda.

---

## 0. Dua Jebakan Penting yang WAJIB Dibaca Duluan

Karena server ini **on-premise (bukan Azure)**, ada dua hal yang berbeda dari panduan Azure
dan kalau terlewat aplikasi akan gagal dengan cara yang membingungkan:

### ⚠️ Jebakan 1 — Session ada di SQL, bukan memori proses

Sesi internal (SSO JWT dan login lokal) disimpan di `core.SESSION_CACHE_T` lewat
`AddDistributedSqlServerCache`. Beberapa worker process / instance boleh berbagi
database yang sama. Pastikan migration yang membuat tabel itu sudah diterapkan
(langkah 7) — tanpa tabel itu login gagal saat session di-commit.

App Pool *Maximum Worker Processes* tetap boleh 1 (default) untuk testing sederhana.

### ⚠️ Jebakan 2 — Managed Identity tidak ada di server on-prem → pakai Connection String Blob

Di Azure, backend akses Blob Storage lewat Managed Identity (`AzureBlob:ServiceUri` tanpa
secret). **Di server IIS on-premise tidak ada Managed Identity**, jadi `DefaultAzureCredential`
akan gagal dan upload/preview dokumen error. **Solusi:** gunakan
`AzureBlob__ConnectionString` (berisi account key) — kode otomatis memilih connection string
kalau tersedia. Detail di langkah 6.

---

## 1. Prasyarat di Server

### 1.1 Software yang harus terpasang di server IIS

| Komponen | Kegunaan | Cara dapat |
|---|---|---|
| **IIS** (dengan fitur *Web Server*) | Host aplikasi | Windows Features / Server Manager |
| **.NET 10 Hosting Bundle** | Runtime ASP.NET Core + modul ANCM untuk IIS | https://dotnet.microsoft.com/download/dotnet/10.0 → "Hosting Bundle" |
| Akses jaringan ke **Azure SQL** | Database | Firewall SQL harus mengizinkan IP server |
| Akses jaringan ke **Azure Blob** | Dokumen | Outbound HTTPS 443 |

> **Hosting Bundle vs SDK:** server produksi cukup **Hosting Bundle** (bukan SDK penuh).
> Bundle inilah yang memasang modul *ASP.NET Core Module V2* (ANCM) yang membuat IIS bisa
> menjalankan aplikasi .NET. **Setelah instal Hosting Bundle, restart IIS:**
> ```powershell
> net stop was /y
> net start w3svc
> ```
> atau `iisreset`.

### 1.2 Cek instalasi

```powershell
# Cek .NET runtime terpasang
dotnet --list-runtimes    # harus ada Microsoft.AspNetCore.App 10.x

# Cek modul ANCM terpasang di IIS
Get-WebGlobalModule | Where-Object { $_.Name -like "*AspNetCore*" }
```

Kalau `Get-WebGlobalModule` tidak menampilkan `AspNetCoreModuleV2`, Hosting Bundle belum
ter-install dengan benar / IIS belum di-restart.

### 1.3 Tempat build (laptop developer)

Build tetap dilakukan di mesin yang punya **.NET 10 SDK + Node.js** (lihat
[deployment-guide.md](deployment-guide.md) bagian 2), lalu hasil publish disalin ke server.

---

## 2. Build & Publish Artifact (di laptop)

Dari folder `D:\Projects\IntegratedProcurement\Code`:

```powershell
# 1) Build SPA internal
cd frontend
npm ci
npm run build:internal

# 2) Publish backend — SPA internal otomatis masuk ke wwwroot
cd ..\backend
dotnet publish src\AppHost -c Release -o ..\publish\iis-internal
```

✅ **Cek hasil di `..\publish\iis-internal`:**
- [ ] `IntegratedProcurement.AppHost.Api.dll` ada
- [ ] `web.config` ada (dibuat otomatis oleh `dotnet publish` untuk project Web SDK — inilah
      yang memberi tahu IIS cara menjalankan app; jangan dihapus)
- [ ] `wwwroot\index.html` ada (SPA internal). Kalau tidak ada → langkah build SPA (poin 1)
      belum jalan; ulangi.
- [ ] folder `ContractTemplates\` ikut ter-copy

> Migration database TIDAK ikut dalam artifact dan TIDAK jalan otomatis. Diterapkan terpisah
> di langkah 7.

---

## 3. Salin Artifact ke Server

Salin seluruh isi `publish\iis-internal` ke folder di server, misalnya:

```
C:\inetpub\procurement-internal\
```

Cara apa pun boleh (RDP copy-paste, file share, atau kompres dulu):

```powershell
# di laptop
Compress-Archive -Path ..\publish\iis-internal\* -DestinationPath ..\publish\iis-internal.zip -Force
# lalu salin zip ke server dan extract ke C:\inetpub\procurement-internal
```

---

## 4. Buat Application Pool di IIS

Buka **IIS Manager** (`inetmgr`) → *Application Pools* → **Add Application Pool**:

| Setting | Nilai | Alasan |
|---|---|---|
| **Name** | `ProcurementInternalPool` | — |
| **.NET CLR version** | **No Managed Code** | ASP.NET Core jalan lewat ANCM, bukan CLR IIS |
| **Managed pipeline mode** | Integrated | default |

Setelah dibuat, klik pool → **Advanced Settings**:

| Setting | Nilai | Alasan |
|---|---|---|
| **Maximum Worker Processes** | **1** (boleh >1 jika DB session cache sudah ada) | session ada di SQL `core.SESSION_CACHE_T` |
| **Start Mode** | `AlwaysRunning` | app siap tanpa cold start |
| **Idle Time-out (minutes)** | `0` | jangan mati saat idle (session tidak hilang) |
| **Identity** | `ApplicationPoolIdentity` (default) | cukup untuk testing |

> Kalau nanti pakai **HTTPS + sertifikat** atau butuh identity domain untuk akses share,
> Identity bisa diganti ke akun domain. Untuk testing awal, default cukup.

---

## 5. Buat Site / Application di IIS

Pilihan A (paling sederhana untuk testing) — **Site baru**:

IIS Manager → *Sites* → **Add Website**:

| Field | Nilai contoh |
|---|---|
| **Site name** | `ProcurementInternal` |
| **Application pool** | `ProcurementInternalPool` |
| **Physical path** | `C:\inetpub\procurement-internal` |
| **Binding** | `http` port `8080` (atau `https` 443 jika sudah punya sertifikat) |
| **Host name** | kosongkan dulu, atau isi `<host-internal>` bila ada DNS |

Klik OK. Site langsung aktif.

> **Catatan HTTPS:** aplikasi memanggil `UseHttpsRedirection()` **hanya bila environment
> BUKAN Development**. Untuk testing di HTTP saja, set `ASPNETCORE_ENVIRONMENT=Development`
> (langkah 6) supaya tidak dipaksa redirect ke HTTPS. Untuk pra-production dengan sertifikat,
> pakai binding HTTPS dan environment `Production`.

### 5.1 Izin folder untuk App Pool

Beri App Pool identity izin baca ke folder aplikasi (dan tulis jika perlu log):

```powershell
icacls "C:\inetpub\procurement-internal" /grant "IIS AppPool\ProcurementInternalPool:(OI)(CI)RX" /T
```

---

## 6. Konfigurasi Environment Variables (per-site)

**Jangan edit `appsettings.json`.** Set konfigurasi lewat IIS supaya menimpa saat runtime.
Format nama: titik dua (`:`) → **dua underscore** (`__`).

Ada dua cara set environment variable per aplikasi di IIS:

**Cara 1 — lewat IIS Manager (GUI):** pilih Site → *Configuration Editor* → section
`system.webServer/aspNetCore` → properti `environmentVariables` → tambahkan tiap variabel.

**Cara 2 — edit `web.config`** hasil publish, tambahkan di dalam `<aspNetCore>`:

```xml
<aspNetCore processPath="dotnet" arguments=".\IntegratedProcurement.AppHost.Api.dll" hostingModel="inprocess">
  <environmentVariables>
    <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Development" />
    <environmentVariable name="ConnectionStrings__DefaultConnection" value="Server=...;Database=PROCUREMENT_DB;User Id=...;Password=...;MultipleActiveResultSets=true" />
    <environmentVariable name="AzureBlob__ConnectionString" value="DefaultEndpointsProtocol=https;AccountName=<storage>;AccountKey=<key>;EndpointSuffix=core.windows.net" />
    <environmentVariable name="SSO__Enabled" value="false" />
    <environmentVariable name="Frontend__InternalUrl" value="http://<host-internal>:8080" />
  </environmentVariables>
</aspNetCore>
```

> Kalau menaruh `<environmentVariables>` langsung di web.config, hati-hati: `dotnet publish`
> berikutnya akan menimpa web.config. Untuk itu lebih aman pakai **Cara 1** atau simpan
> variabel sensitif di tempat lain. Untuk testing, Cara 2 paling cepat.

### 6.1 Variabel yang perlu diset untuk server internal

| Variabel | Nilai untuk testing internal | Catatan |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Development` (HTTP) atau `Production` (HTTPS) | `dev-login` hanya hidup di Development **dan** `Auth:AllowPasswordlessDevLogin=true` |
| `Auth__AllowPasswordlessDevLogin` | `false` di Staging/Production | jangan nyalakan di server testing yang mirip Production |
| `ConnectionStrings__DefaultConnection` | connection string SQL testing | wajib; juga dipakai session cache `core.SESSION_CACHE_T` |
| `AzureBlob__ConnectionString` | connection string Blob (**dengan AccountKey**) | ⚠️ Jebakan 2 — JANGAN pakai `AzureBlob__ServiceUri` di on-prem |
| `SSO__Enabled` | `false` untuk uji login lokal; `true` untuk uji alur SSO penuh | lihat langkah 8 |
| `Frontend__InternalUrl` | `http://<host-internal>:8080` | dipakai untuk CORS/URL |
| `DataSeeding__SeedInitialIam` | `false` (DB sudah berisi user asli) | hindari seed demo menimpa |
| `DataSeeding__SeedInitialPlatformData` | `false` | — |

> **Penting soal Blob:** hapus / jangan set `AzureBlob__ServiceUri` di server on-prem.
> Kalau `ServiceUri` terisi tapi `ConnectionString` kosong, aplikasi mencoba Managed Identity
> dan akan error saat akses dokumen. Kode mengutamakan `ConnectionString` bila keduanya ada,
> tapi lebih bersih hanya set salah satu.

---

## 7. Terapkan Migration Database

Migration tidak jalan otomatis. Jalankan dari **laptop** (yang punya SDK + dotnet-ef),
diarahkan ke database server testing:

```powershell
cd D:\Projects\IntegratedProcurement\Code\backend
dotnet ef database update `
  --project src\Platform\Persistence `
  --startup-project src\AppHost `
  --connection "<connection-string-database-testing>"
```

✅ Output diakhiri `Done.` Aman dijalankan berulang (hanya migration baru yang diterapkan).

> Alternatif tanpa SDK di laptop: buat SQL script migrasi
> (`dotnet ef migrations script --idempotent -o migrate.sql`) lalu jalankan `migrate.sql`
> di SQL Server Management Studio. Idempotent = aman dijalankan berkali-kali.

---

## 8. Pilih Mode Login untuk Testing

### Opsi cepat — login lokal (NRP/email + password)

SSO boleh Off. Super Admin set password di Administration ▸ Users, lalu staf
masuk dari halaman login. `dev-login` tanpa sandi **jangan** dipakai sebagai
fallback Production — hanya Development dengan `Auth:AllowPasswordlessDevLogin=true`.

### Opsi lengkap — `SSO__Enabled=true`

Untuk menguji alur SSO sungguhan. **Sebelum mengaktifkan, penuhi checklist SSO**
di [sso-siswarrior.md](sso-siswarrior.md) dan [deployment-guide.md](deployment-guide.md) bagian 5:
- [ ] `iam.USER_T` sudah berisi user internal asli dengan `PersonnelNo` = NRP **8-digit**
      sungguhan (NRP = PersonnelNo). **Per 9 Juli 2026 data masih demo `P-0000N`** → user
      NRP asli belum ada, login SSO mereka 403 "not mapped". ⚠️ Simpan PersonnelNo sebagai
      teks — nol depan (`00109610`) jangan hilang; pencocokan exact-string.
- [ ] Fungsi `dbo.CEK_USER_ACCESS_FN` terpasang (via migration langkah 7) — cek `USER_T`
      langsung, tanpa tabel mapping.
- [ ] `SSO__ApplicationUrl` = URL yang persis didaftarkan ke portal, mis.
      `http://<host-internal>:8080/`. Set juga `SSO__SsoUrl` dan `SSO__Application`.
- [ ] Portal SISWarrior dapat menjangkau server internal ini (jaringan/DNS).

---

## 9. Start & Verifikasi

Restart pool agar konfigurasi terbaca:

```powershell
Restart-WebAppPool -Name "ProcurementInternalPool"
```

Lalu verifikasi berurutan:

- [ ] `http://<host-internal>:8080/api/health/ready` → `{"status":"Ready", ...}`
      (kalau gagal → cek connection string SQL & firewall SQL).
- [ ] `http://<host-internal>:8080/api/v1/platform/blob-check` →
      `configured: true, reachable: true` (kalau `reachable:false` → cek Jebakan 2:
      pastikan pakai `AzureBlob__ConnectionString`, bukan ServiceUri).
- [ ] `http://<host-internal>:8080/` → SPA internal tampil.
- [ ] Login (password lokal atau SSO sesuai langkah 8) → menu sesuai role muncul, dan tetap login
      setelah pindah halaman (kalau login "lepas" → cek `core.SESSION_CACHE_T` sudah ter-migrate).
- [ ] Buka satu dokumen (mis. di CIP/Vendor) → preview muncul (menguji akses Blob).

---

## 10. Update Versi Berikutnya (redeploy)

1. Build & publish ulang di laptop (langkah 2).
2. **Stop pool** agar file tidak terkunci:
   ```powershell
   Stop-WebAppPool -Name "ProcurementInternalPool"
   ```
   > Alternatif tanpa stop: taruh file bernama `app_offline.htm` di root folder aplikasi —
   > ANCM akan mematikan app dengan rapi. Hapus file itu setelah copy selesai.
3. Terapkan migration baru bila ada (langkah 7) — **sebelum** file baru dijalankan.
4. Salin isi publish terbaru menimpa folder aplikasi.
5. **Start pool** kembali:
   ```powershell
   Start-WebAppPool -Name "ProcurementInternalPool"
   ```
6. Jalankan verifikasi langkah 9.

> Simpan zip artifact tiap rilis dengan nama berversi (mis. `iis-internal-2026-07-08.zip`)
> untuk rollback cepat.

---

## 11. Troubleshooting IIS

| Gejala | Penyebab | Solusi |
|---|---|---|
| **HTTP 500.19** | web.config rusak / modul ANCM belum ada | Pastikan Hosting Bundle ter-install & IIS di-restart |
| **HTTP 500.30 / 500.31** (gagal start) | Runtime .NET tidak cocok / connection string salah | Cek Event Viewer → Windows Logs → Application; cek `dotnet --list-runtimes` |
| **HTTP 502.5 (ANCM out-of-process)** | proses app crash saat start | Set `stdoutLogEnabled="true"` di web.config, lihat log di `.\logs\` |
| Halaman utama **404 / blank** | `wwwroot` tidak ikut ter-publish | Build SPA dulu baru `dotnet publish` (langkah 2) |
| **Login "lepas" / minta login lagi** | `core.SESSION_CACHE_T` belum ada / DB beda antar instance | ⚠️ Jebakan 1 — jalankan migration langkah 7 |
| **Dokumen gagal upload/preview**, `blob-check reachable:false` | Managed Identity dipakai di on-prem | ⚠️ Jebakan 2 — set `AzureBlob__ConnectionString` |
| Dipaksa **redirect ke https** padahal hanya HTTP | environment = Production | Set `ASPNETCORE_ENVIRONMENT=Development` untuk testing HTTP |
| Login SSO **403 "SSO user is not mapped"** | `SSO_NRP_MAPPING_T` kosong | Impor mapping NRP↔PersonnelNo |
| Error **500** setelah update dengan migration baru | Migration belum diterapkan | Jalankan langkah 7, restart pool |
| Konfigurasi diubah **tidak berefek** | Salah format nama / pool belum restart | Pakai `__` (bukan `:`); `Restart-WebAppPool` |
| File **terkunci** saat copy update | App masih jalan | Stop pool atau pakai `app_offline.htm` (langkah 10) |

### Mengaktifkan log stdout (untuk diagnosa start gagal)

Edit `web.config`, ubah bagian `<aspNetCore ...>`:

```xml
<aspNetCore ... stdoutLogEnabled="true" stdoutLogFile=".\logs\stdout">
```

Buat folder `logs` dan beri izin tulis ke App Pool identity, restart, reproduksi error,
lalu baca file di `logs\`. **Matikan lagi** (`stdoutLogEnabled="false"`) setelah selesai —
jangan biarkan menyala di production.

---

## 12. Ringkasan Perbedaan vs Deploy Azure App Service

| Aspek | Azure App Service | IIS On-Premise (dok ini) |
|---|---|---|
| Runtime | dikelola Azure | pasang .NET 10 Hosting Bundle sendiri |
| Akses Blob | Managed Identity (`ServiceUri`) | **Connection String** (`ConnectionString`) |
| Session multi-instance | SQL `core.SESSION_CACHE_T` | sama (shared SQL cache) |
| Konfigurasi | Environment variables (portal) | web.config / Configuration Editor |
| HTTPS/proxy | `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` | binding sertifikat di IIS |
| Deploy | zip deploy / CLI | copy folder + restart pool |
| Migration | manual (`dotnet ef` / script) | sama (manual) |
