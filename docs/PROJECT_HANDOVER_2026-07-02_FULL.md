# Project Handover (FULL) — Integrated Procurement

**Date:** 2026-07-02 (UTC+7) — comprehensive snapshot
**Prepared by:** Claude (Claude Code) — perspektif Senior Software Architect & Senior Fullstack Developer
**Supersedes/extends:**
- `Code/docs/PROJECT_HANDOVER_2026-06-24_FULL.md` (baseline lengkap sebelumnya)
- Handover 2026-06-23 / 2026-06-24 (konteks historis)

**Project root:** `D:\Projects\IntegratedProcurement`
**Active implementation root:** `D:\Projects\IntegratedProcurement\Code`

Dokumen ini adalah serah-terima **lengkap & terkini**. Perubahan terbesar sejak handover 06-24: **Vendor Onboarding + Vendor Workspace tidak lagi di-skip — sudah dibangun penuh** (Fase 0.5 s/d 6) dengan **paritas fungsional & skema terhadap aplikasi legacy VendorConnect**, termasuk migrasi data produksi. Baca dokumen ini lebih dulu; handover lama hanya untuk konteks historis.

---

## 1. Critical Working Rules (WAJIB — diperbarui)

1. Kerja **hanya** di `D:\Projects\IntegratedProcurement\Code`. Jangan modifikasi `Mockup`/`MockupVite` (referensi user).
2. **Frontend HARUS mereplikasi perilaku/alur aplikasi legacy**, bukan desain karangan sendiri. Ini feedback eksplisit user setelah wizard vendor pertama dibuat "sesuka sendiri". Untuk modul Vendor, sumber kebenaran = `D:\Projects\SaptaindraSejati\VendorConnect` (Views/`_VendorWizardPartial.cshtml`/`wizard.js`). Sebelum membangun layar apa pun yang punya padanan legacy, **audit dulu legacy-nya**.
3. **Edit data vendor HANYA oleh vendor sendiri** via portal eksternal (`/api/v1/vendor-portal`). Tim internal hanya melakukan **approval**. Endpoint tulis internal untuk data vendor sudah dihapus (commit `4c0221a`) — jangan dibuat lagi.
4. **Tidak boleh ada data mockup / konstanta tanggal beku.** Semua data dari database/Azure; tanggal dihitung dari hari nyata (sweep frozen constants: commit `654583d`).
5. **Dokumen disimpan di Azure Blob Storage** (metadata di DB: container + blobKey). Tidak ada varbinary/base64 di DB.
6. Modul = **Contract Monitoring** (schema `cm`), bukan Contract Management.
7. Port dev: Frontend **8008** (Vite, proxy `/api` → backend), Backend API **5055** (`https 7055`).
8. **Setelah mengubah backend, rebuild + kill proses `IntegratedProcurement.AppHost.Api.exe`** — proses lama menyajikan kode lama. Build incremental menyembunyikan warning; verifikasi dengan `--no-incremental`.
9. **Rahasia**: `appsettings.Development.json` **gitignored** (Azure Maps key, Blob connstr, SharePoint secret) — jangan pernah di-stage. Connection string produksi `VENDOR_CONNECT_DB` (legacy) = rahasia milik user, **read-only SELECT**, tidak boleh di-commit/echo. Connstr test DB di `appsettings.json` = pre-existing/diterima.
10. Commit kecil & sering, satu concern per commit. Arch test **harus tetap 6/6**.

---

## 2. Status Modul (ringkas)

| Modul | Status | Catatan |
|---|---|---|
| **Vendor Onboarding** (internal) | **SELESAI** | Registry, approval FSM bertingkat, e-certificate, invitation |
| **Vendor Workspace** (eksternal) | **SELESAI** | Login/OTP/reset, wizard registrasi 5 langkah paritas legacy |
| Migrasi data VendorConnect | **SELESAI kecuali file dokumen** | 679 vendor + child + identity termigrasi; transfer blob dokumen **deferred** (§10) |
| Tracker / CIP / Contract Monitoring | Berjalan (lihat handover 06-24) | Tidak berubah signifikan sejak 06-24, kecuali sweep tanggal beku |
| Administration / Settings / Master Data | Berjalan + diperluas | Settings Email dual-mode, master data vendor real 17 set |
| SharePoint (CM import → Blob) | Kredensial dev sudah ada | Lihat `SHAREPOINT_INTEGRATION_SETUP.md` |

---

## 3. Stack & Arsitektur

- **Backend:** ASP.NET Core 10, **Clean Architecture modular monolith**, EF Core 10, Azure SQL, Azure Blob.
- **Frontend:** React shell (Vite + TS) yang memuat **legacy global-script JSX** via Babel (`legacyRuntime.ts`, classic scripts `sourceType:"script"`, global `window.React` — **tanpa import/export**; ekspor komponen via `Object.assign(window, {...})`).
- **PDF/QR:** QuestPDF (Community licence, di-set di `DocumentsModule`) + QRCoder.

### Layering (ditegakkan 6 arch test)
```
Domain  ←  Application  ←  Infrastructure  ←  AppHost (API host, endpoints, DI)
BuildingBlocks (Domain/Application/Infrastructure) = shared kernel
Platform/* = layanan lintas modul (Persistence, Administration, Settings, Audit,
             Notifications, InternalIdentity, VendorIdentity, Documents)
Modules/*  = domain bisnis (VendorOnboarding, Tracker, CIP, ContractMonitoring)
```
- Solution: `backend/IntegratedProcurement.slnx`. Endpoint API = minimal API per file di `src/AppHost/Endpoints/`.
- Read model dirakit di service Application (EF LINQ), **bukan SQL view** — lihat §14.3.

### Build & Run (dev)
```bash
# Backend (dari Code/backend)
dotnet build IntegratedProcurement.slnx          # 0 warning wajib
dotnet run --project src/AppHost/...Api.csproj   # http://localhost:5055
# Frontend (dari Code/frontend)
npm run dev                                      # http://localhost:8008
npm run build                                    # tsc -b && vite build (gate CI lokal)
# Tests
dotnet test tests/Architecture                   # 6/6 wajib
dotnet test tests/AppHost                        # integration (butuh DB test)
```
- **EF migrations:** design-time factory default LocalDB — set env **`INTEGRATED_PROCUREMENT_CONNECTION`** = connstr target sebelum `dotnet ef database update`. Project = `src/Platform/Persistence/...csproj`, startup = `src/AppHost/...csproj`.

---

## 4. Database & Konvensi

### Schema ownership
```
core = platform (master data, settings, audit, notification, communication, frontend-state)
iam  = internal identity (NRP-keyed)
vdr  = vendor: VENDOR_* + identity vendor (USERS_T/ROLES_T/USER_ROLES_T ~ legacy APP_*)
trk / cip / cm = modul lain
```

### Legacy-parity keys (KEPUTUSAN FINAL, commit `b800cd7` + `250065e`)
User mewajibkan struktur PK **sama dengan legacy VendorConnect**:
- `VENDOR_T` PK = **`VendorId varchar(10)`** — vendor baru: `Vendor.NewVendorId()` = 10 karakter hex uppercase.
- Child tables PK = **int identity legacy** (`VendorKbliId`, `VendorBrandId`, `VendorSertifikatId`, `VendorPortfolioId`, `VendorStatusId`, `VendorDocumentId`). Properti entity tetap `Id`, dipetakan via `HasColumnName`.
- `VENDOR_SPECIAL_REQUIREMENT_T` & `VENDOR_SUBCLASSIFICATION_T` = **composite PK (VendorId, code)** — plain class yang implement `IAuditable`.
- `VENDOR_USER_T` / `VENDOR_CERTIFICATE_T` / `INVITATION_T` / `INVITATION_ATTEMPT_T` = **int identity**.
- Identity vendor: `VendorIdentityUser : IdentityUser<string>` (Id nvarchar(10), + CompleteName/IsActive/HasLogin/Photo/PhotoDate), `VendorIdentityRole : IdentityRole<string>` (Id nvarchar(5)); seed role **`VNDOR`**. **Konvensi: UserId akun utama vendor == VendorId.** Password hash legacy **dibawa apa adanya** (kedua app pakai ASP.NET Core Identity) — vendor login dengan password lama.

### Audit & generic entity
- `BuildingBlocks.Domain.Entities`: `Entity<TId>` / `AuditableEntity<TId>` / `SoftDeleteEntity<TId>` + interface `IAuditable`.
- Stamping di `ProcurementDbContext.ApplyAuditFields` (via `ChangeTracker.Entries<IAuditable>()`). **Menghormati `CreatedAt`/`CreatedBy` yang sudah di-preset** (dipakai untuk backdating riwayat status & aktor eksplisit).
- **`CreatedBy` selalu berisi ID** (aturan user, commit `9696fa4`): aksi vendor → **VendorId**; aksi internal → **NRP** (`PersonnelNo` claim). `HttpContextCurrentActor` me-resolve ini. **Jangan menulis display name ke kolom audit.**
- Konvensi kolom otomatis menghormati `HasColumnName` eksplisit.

### `VENDOR_STATUS_T` (aturan penting)
- **Historis** — satu baris per transisi. Kolom `ChangedBy` **sudah dihapus** (migration `DropVendorStatusChangedBy`; data lama disalin ke `CreatedBy` dulu). Aktor dicatat di `CreatedBy`.
- Saat vendor set password pertama kali (login by Code), tertulis **2 baris**: `INVTD` (backdate ke attempt sukses terakhir `INVITATION_ATTEMPT_T`, aktor = officer pengirim) lalu `RSPND` (aktor = VendorId).

### Teknik migration "snapshot surgery"
Untuk perombakan skema besar: hapus blok entity dari `ProcurementDbContextModelSnapshot.cs` → `dotnet ef migrations add` menghasilkan CreateTable otomatis → prepend DropTable manual di `Up()`. Sudah dipakai 2× (ReshapeVendorToLegacySchema, LegacyParityVendorSchema).

---

## 5. Identity & Authorization

| Domain | Mekanisme | Key | Catatan |
|---|---|---|---|
| Internal | SISWarrior SSO (`SsoMiddleware`; dev: dev-login stub) | **NRP** (`PersonnelNo`) | `ClaimTypes.Name` = display name — **bukan** untuk audit |
| Vendor | ASP.NET Identity string-key (`vdr.USERS_T`) | **VendorId** (UserId == VendorId) | Cookie scheme vendor; policy `VendorUser` |

### Permission & tiered approval (commit `be3d965`)
Permission key modul vendor (module key `vendor-onboarding`, total sekarang **13 grup / 36 permission** — angka ini di-assert test):
- `vendor.approve1` → aksi pada status **SBMIT** (default: Section Head Vendor)
- `vendor.approve2` → status **APPR1** (Dept Head 1)
- `vendor.approve.final` → **APPR2/APPR3** (Division Head)
- `vendor.manage` → blacklist/unblacklist/issue-certificate (Administrator Vendor punya semua)
Gate per-step di `VendorRegistryEndpoints` (403 `vendor_step_forbidden`). Mapping role dapat diubah via layar Permissions.

### Login vendor + OTP (commit `d0f9ed7`)
- `/api/v1/vendor/auth/login` → jika Settings ▸ Security **"emailConfirm"** aktif → response `otp_required`, kirim ET-02 (kode 2FA provider Email, ±5 menit) → `/login/otp`.
- Reset password: ET-03, link `{VendorUrl}?email=..&reset=..` — frontend mem-parse query param.
- `/me` → `VendorMePayload { identityUserId, vendorUserId, vendorId, vendorName, name, email, roles }`.

---

## 6. Modul Vendor — Alur Bisnis Lengkap

### 6.1 Status FSM (di aggregate `Vendor`, bukan master NextId)
```
INVTD → RSPND → DRFT → SBMIT → APPR1 → APPR2 → APPRV → RGSTD
                 ↑        ↕ (REPIR: revisi → vendor submit ulang)
RJCTD (terminal dari review)     APPRV/RGSTD → BLCK → (unblacklist) → DRFT
```
Transisi tidak valid melempar `VendorWorkflowException` → 409. Kode legacy `DRAFT/BLACK` dsb. dipetakan ke enum kanonik kita (`VendorStatuses`); master set `vendor-status` hanya untuk label tampilan.

### 6.2 Alur registrasi (KOREKSI USER — commit `a6c2eec`, wajib dipertahankan)
1. Officer kirim **invitation** → status `INVTD`, email **ET-12** (kode + expiry, dihitung dari hari nyata). Duplikat email → 409 → toast kanan-atas *"This email already has an active invitation or is registered."* Tombol Send menampilkan spinner saat proses kirim.
2. Vendor buka portal dengan **Code** → welcome text (PIC + perusahaan) → **hanya set password** (aturan: 12 char + upper + lower + digit + symbol) → Save → status `RSPND` + email ET-13. (2 baris VENDOR_STATUS_T seperti §4.)
3. Vendor login dengan password → lengkapi data via **wizard 5 langkah**; Save as Draft → `DRFT`; Submit → `SBMIT`.

### 6.3 Wizard registrasi — paritas legacy (commit `609f0c7`)
File: `frontend/src/modules/vendor-workspace/legacy/VendorProfileWizard.jsx`. Struktur = persis legacy `_VendorWizardPartial.cshtml` + `wizard.js`:

| # | Langkah | Isi | Validasi kunci |
|---|---|---|---|
| 1 | **Agreement** | 2 checkbox pernyataan (teks legacy), upload Pakta Integritas + Company Profile | kedua checkbox + pakta wajib (pdf ≤5MB) |
| 2 | **Bio Data** | Vendor Name (editable — backend `SaveVendorProfileCommand.Name` + `Vendor.Rename`), PIC & Email readonly dari `/me`, telepon (dropdown kode negara), logo (≤200KB) & struktur organisasi, 3 blok alamat (negara + cascade wilayah [hanya Indonesia] + map picker Azure Maps), **grid Commodity** + **grid Brand** (opsi `---Other---`) | nama wajib; alamat terisi ⇒ negara + koordinat wajib; ≥1 commodity |
| 3 | **Persyaratan Umum** | NPWP + file, NIB + file, Akta Pendirian (no+tgl+file), Akta Perubahan/Penyesuaian (trio opsional), SPPKP + file, **grid KBLI** + panel referensi KBLI per commodity | **NPWP tepat 16 digit**; file wajib npwp/nib/akta-pendirian/sppkp; trio harus lengkap bersama; **≥1 KBLI per commodity** dari mapping `commodity-subclassification-kbli` |
| 4 | **Persyaratan Khusus** | **Diturunkan otomatis** dari commodity terpilih (mapping `commodity-subclassification-special-requirement`), No/Desc/Expiry/File; grid **Sertifikat** (no ≤50, desc ≤255) | No wajib per requirement; file ≤1MB |
| 5 | **Portfolio of Project** | klien/scope/nilai IDR/durasi **per bulan** (disimpan tgl 1) + lampiran → **Submit** dengan confirm legacy *"Are you sure to submit vendor data?"* | validasi semua langkah dijalankan ulang saat submit |

Aturan file per docType di `VW_FILE_RULES` (ekstensi + ukuran, validasi client-side). Sidebar hanya bisa ke langkah yang sudah dicapai; **Save as Draft** tersedia di semua langkah.

### 6.4 Dokumen terpadu (`VENDOR_DOCUMENT_T` → Blob)
- Satu tabel untuk SEMUA file vendor: key **(VendorId, DocumentType, OwnerKey)**; `OwnerKey` = **natural key** child row (kbliCode / brandName / `client|startDate` / cert number / reqCode; `''` untuk level vendor) agar link selamat dari replace-all children.
- Container `app-vendormanagement`; upload/download eksternal via `/vendor-portal/documents` (SAS 15 menit, ownership dari principal); internal read-only via registry.
- DocTypes level vendor: `pakta-integritas`, `company-profile`, `logo`, `org-structure`, `npwp`, `nib`, `akta-pendirian`, `akta-perubahan`, `akta-penyesuaian`, `sppkp`, `e-certificate`.

### 6.5 Registry internal + approval (commits `b862792`, `7a1a306`)
`/api/v1/vendors` (InternalUser): list (filter status/search), detail profil penuh, dokumen, riwayat status, aksi POST `approve|reject|request-revision|blacklist|unblacklist` (reason wajib untuk reject/revision/blacklist; aktor = NRP). Aksi review mengirim email vendor (ET-17/18/19) via template tersimpan yang bisa diedit admin (`VendorReviewNotifier` — fallback copy built-in).

### 6.6 E-Certificate (commits `b598b5f`, `3e05f31`)
`POST vendors/{id}/issue-certificate` (guard APPRV, permission `vendor.manage`) → generate PDF A4 (QuestPDF) + QR (QRCoder) → Blob `certificates/{vendorId}/{certNo}.pdf` → catat sebagai VendorDocument → status `RGSTD`. Verifikasi publik: `GET /api/v1/public/vendor-certificate/verify?no=` (anonymous). QR = URL verifikasi.

### 6.7 Sistem email (commits `d0f9ed7`, `cc75ba9`)
`SmtpEmailSender` membaca **Settings ▸ Email** (Super Admin):
- **Delivery mode**: `api` (default; POST `{BaseURL}/api/Email`, payload gateway legacy: from/to/cc/bcc/subject/bodyMessage/emailPort/emailHost/judul/attachment*) atau `smtp` (hanya sukses dari server; MailAddress + mailbox display name).
- **Sender split per kategori**: kategori berawalan `"Vendor"` → `fromVendor`/`mailboxVendor` (**vendor-workspace@saptaindra.co.id** / *SIS – Vendor Workspace Application*); lainnya → `fromProc`/`mailboxProc` (**procurement@saptaindra.co.id** / *Procurement Application*). Fallback ke key lama `from`/`mailbox`.
- **`toTest` = redirect global** (perilaku legacy): jika terisi, SEMUA email dialihkan ke alamat itu (penerima asli tercatat di log Email Sent).
- Template editable: ET-02 (OTP), ET-03 (reset), ET-12 (invitation), ET-13 (received), ET-17/18/19 (approve/reject/revision). Tombol **Send test** nyata: global di Settings dan per-template di Email Templates (`POST /super-admin/settings/test-email`, prefix `[TEST]`).

---

## 7. Master Data

- Generic store `core.MASTER_DATA_RECORD_T` (set-key + code + name + `payloadJson` + `ParentCode` ter-index). API: `GET /api/v1/master-data/sets/{key}?parent=&search=&take=`.
- **17 set vendor REAL** diimpor dari prod (±92k record, termasuk 82.441 village): `commodity-category/-classification/-subclassification`, `commodity-subclassification-kbli` (code=`SUB|KBLI`), `commodity-subclassification-special-requirement` (code=`SUB|REQ`), `kbli`, `kbli-type`, `kbli-status`, `special-requirement`, `brand`, `distributor-type`, `country` (kode telepon), `province/city/district/village` (cascade via `?parent=`), `vendor-status`.
- Referensi domain vendor ke master = **by code (string)**, bukan FK — desain permanen (store generik).

---

## 8. Tool Migrasi Data — `backend/tools/vendor-migration/vc_vendor_migrate.py`

- Env: `VC_LEGACY_CONNECTION` (prod legacy, **read-only**), `INTEGRATED_PROCUREMENT_CONNECTION` (target), `VC_BLOB_CONNECTION` (Blob).
- Flags: `--apply` (tanpa ini = dry-run), `--skip-docs`, `--docs-only`, `--doc-scope=registered|all`, `--doc-limit=N`.
- Idempotent: baris migrasi ditandai `CreatedBy='vc-migration'` (MARK); khusus `VENDOR_STATUS_T` (yang kini menyimpan aktor legacy asli di CreatedBy) dibersihkan via subquery vendor termigrasi. Natural id via `IDENTITY_INSERT`.
- **Sudah dijalankan (v2, --skip-docs):** 679 vendor / 4098 status / 1350 kbli / 704 brand / 520 cert / 906 portfolio / 62 special-req / 2050 subclass / 679 users (+password hash) / 679 user-roles / 679 VENDOR_USER_T.
- **BELUM: transfer file dokumen** (user: "nanti saja"). Jalankan nanti: `py -3 vc_vendor_migrate.py --apply --docs-only` (test = 49 vendor Registered; produksi = `--doc-scope=all`). Blob path `migrated/{VendorId}/{docType}`. Client blob sudah resilient (chunk 1MB + retry + reconnect pymssql per-blob).

---

## 9. Frontend — Konvensi Teknis

- File legacy JSX = **classic script** (tanpa import). Validasi cepat: parse dengan `@babel/parser` `{sourceType:"script", plugins:["jsx"]}`. Build gate: `npm run build`.
- **Patch file besar via script Python** yang ditulis ke scratchpad lalu `py -3 script.py` — heredoc bash dengan kutip kompleks sering gagal di Git Bash Windows.
- Struktur modul vendor:
  - `src/modules/vendor-workspace/legacy/` — portal eksternal: `VendorApp.jsx` (login/OTP/reset), `VendorRegister.jsx` (code gate → set password), `VendorProfileWizard.jsx` (wizard 5 langkah), `VendorWorkspaceScreens.jsx` (profil), `VendorOnboardingData.jsx` (helper `VwApi*`, `VwTodayStr`, dsb.)
  - `src/modules/vendor-onboarding/legacy/` — internal: `VendorScreen.jsx` (registry+detail), `VendorData.jsx` (`VmApi*`, `VM_STATUS`), `ScreensVendorMore.jsx` (invitation)
  - `src/platform/settings/legacy/` — Settings (email dual-mode, security); `src/platform/administration/legacy/ScreensEmail.jsx` — template + test send.
- **Dilarang konstanta tanggal beku** — selalu hitung dari `new Date()` (helper `VwTodayStr`, `emailNowStamp`, IIFE dinamis untuk CM/CIP/Holiday).

---

## 10. Testing & Quality Gates

| Gate | Perintah | Ekspektasi |
|---|---|---|
| Arch tests | `dotnet test tests/Architecture` | **6/6** — layering Clean Architecture |
| Integration | `dotnet test tests/AppHost` | 53/53 (termasuk vendor auth, IAM seeding — angka 13 grup/36 permission di-assert) |
| Backend build | `dotnet build IntegratedProcurement.slnx --no-incremental` | 0 warning 0 error |
| Frontend | `npm run build` | tsc + vite hijau |

Semua pekerjaan diverifikasi per langkah dengan keempat gate ini sebelum commit.

---

## 11. Keputusan Arsitektural Penting ("mengapa")

1. **Mengapa tidak ada VIEW seperti `VENDOR_V`?** Peran view legacy (proyeksi untuk grid Kendo + join status terakhir) digantikan: status terkini didenormalisasi ke `VENDOR_T.Status`, dan proyeksi dirakit EF di read service (ter-versi git, teruji). Jika ada konsumen eksternal (Power BI/ERP) yang butuh view, buat padanan via `migrationBuilder.Sql` dengan bentuk kolom legacy. View `evt.*` (ERP/Ariba) di luar scope.
2. **Kolom `VENDOR_T` lama vs baru** (dibandingkan langsung ke prod, tanpa blob): semua data legacy punya rumah. Beda yang disengaja: `VendorName`→`Name`; `VendorRegId`(nvarchar10)→`RegistrantVendorUserId`(int); wilayah nama→`*Code` (kode master); `*AddressLatitude/Longitude`→`*Latitude/Longitude`; 10 kolom `*FileName`+blob → `VENDOR_DOCUMENT_T`; tambahan `Status` + kolom audit. Tipe `varchar`→`nvarchar`, beberapa panjang dilonggarkan (melebar semua, aman).
3. **FSM di aggregate, bukan master NextId** — domain memiliki aturan transisi; menghindari drift master data.
4. **OwnerKey natural (bukan child PK)** untuk link dokumen — selamat dari semantik replace-all children.
5. **Master by-code tanpa FK** — konsekuensi store master generik; permanen.
6. **Password vendor dibawa dari legacy** — hash kompatibel ASP.NET Core Identity.

---

## 12. Pekerjaan Tersisa / Next Steps

1. **Transfer dokumen legacy → Blob** (deferred atas permintaan user): `--docs-only` (lihat §8). Jalankan saat user minta.
2. **User sedang UAT alur invitation→wizard** (pernyataan terakhir user: "Saya coba dulu"). Antisipasi perbaikan hasil temuan — patokan selalu perilaku legacy.
3. **Konfigurasi produksi** (bukan kode): Settings SMTP/gateway (BaseURL API email), Azure Maps key restricted, `VendorUrl`.
4. Opsional/polish: layar admin master district/village masih load-all (perlu cascade `?parent=`); notifikasi in-app untuk reviewer; view SQL kompatibilitas jika ada konsumen eksternal.
5. Modul non-vendor: lanjutkan roadmap Bridge-to-Domain (lihat handover 06-24).

---

## 13. Riwayat Commit Kunci (kronologis, terbaru di bawah)

| Commit | Isi |
|---|---|
| `027411e`/`93d9b69` | Master data: ParentCode + filter parent/search/take |
| `1c03796` | Fase 1: skema vendor mengikuti legacy VENDOR_T |
| `5c333d8`/`58a8774`/`ebc2e10` | Fase 3.1–3.3: dokumen→Blob, full profile save, portal eksternal |
| `1701be3`/`7dcac26`/`8a29c54`/`d6a32d5` | Fase 3.4: profil GET + wizard + per-row docs + download SAS |
| `b862792`/`7a1a306` | Fase 4: approval FSM + registry internal |
| `d0bf6fd` | Notifikasi email review + resolve region names |
| `b598b5f`/`3e05f31` | Fase 5: e-certificate QR PDF + verifikasi publik |
| `fe1d7a6` | Fase 6: tool migrasi data |
| `b800cd7`/`250065e` | Legacy-parity keys (APP_* identity, PK legacy, int identity) |
| `d0f9ed7` | OTP login + dispatch email via Settings |
| `be3d965` | Tiered approver permissions |
| `4c0221a` | Hapus endpoint tulis internal (vendor-only edit) |
| `3f2b40f`/`0c5ce84` | NU1903 (OpenApi 2.9.0) + CS8604 |
| `cc75ba9` | Email dual-mode + sender split + toast duplikat invitation |
| `a6c2eec` | Alur registrasi: set-password-only (koreksi user) |
| `2e97fb7`/`654583d`/`07a2ad1` | Hapus field kategori, sweep tanggal beku, email templates real |
| `38ca1cc` | Status trail INVTD (backdate) sebelum RSPND |
| `7755327` | Spinner tombol Send invitation |
| `609f0c7` | **Wizard dirombak ke struktur legacy 5 langkah** + Name editable |
| `9696fa4` | **Drop ChangedBy; CreatedBy = ID (VendorId/NRP)** |

---

## 14. Lampiran — Referensi Cepat

- **Endpoint vendor eksternal:** `/api/v1/vendor/auth/*` (login/otp/me/logout/reset), `/api/v1/vendor/invitations/register` (set password by code), `/api/v1/vendor-portal/*` (profile GET/PUT, documents CRUD+download, map-config).
- **Endpoint vendor internal:** `/api/v1/vendors*` (list/detail/documents/history/aksi review/issue-certificate), `/api/v1/vendor/invitations*` (create/resend/list).
- **Endpoint publik:** `/api/v1/public/vendor-certificate/verify?no=`.
- **Super Admin:** `/api/v1/super-admin/settings*` (+`/test-email`), `/super-admin/permissions`.
- **Master data:** `/api/v1/master-data/sets/{key}`.
- **OpenAPI:** `/openapi/v1.json` (±128 path).
- Dokumen arsitektur lama yang masih relevan: `database-conventions.md`, `REFACTORING_PLAN_CLEAN_ARCHITECTURE.md`, `phase-*.md`, `SHAREPOINT_INTEGRATION_SETUP.md`, `PROJECT_HANDOVER_2026-06-24_FULL.md` (modul non-vendor).

> **Prinsip kerja yang menjaga proyek ini tetap sehat:** audit legacy dulu sebelum membangun, paritas di atas kreativitas, satu concern per commit, empat quality gate sebelum commit, rahasia tidak pernah menyentuh git.
