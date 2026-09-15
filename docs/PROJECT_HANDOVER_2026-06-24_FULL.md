# Project Handover (FULL) — Integrated Procurement

**Date:** 2026-06-24 (UTC+7) — comprehensive snapshot
**Prepared by:** Claude (Claude Code, Opus 4.8)
**Supersedes/extends:**
- `Code/docs/PROJECT_HANDOVER_2026-06-23.md` (architecture baseline)
- `Code/docs/PROJECT_HANDOVER_2026-06-23 205254.md` (Phase 1 app support)
- `Code/docs/PROJECT_HANDOVER_2026-06-24.md` (authz/audit/notification)

**Project root:** `D:\Projects\IntegratedProcurement`
**Active implementation root:** `D:\Projects\IntegratedProcurement\Code`

Dokumen ini adalah serah-terima **lengkap & terkini**. Baca dokumen ini lebih dulu; handover lama hanya untuk konteks historis. Tujuan: melanjutkan membangun aplikasi enterprise **real** (backend + DB + Azure), bukan mockup.

---

## 1. Critical Working Rules (WAJIB)

1. Kerja **hanya** di `D:\Projects\IntegratedProcurement\Code`.
2. **Jangan** modifikasi `Mockup` / `MockupVite` (folder referensi user).
3. **Jangan redesign frontend.** Mockup = locked visual contract. Perubahan FE hanya wiring data / RBAC / dokumen — bukan tampilan.
4. Modul = **Contract Monitoring** (schema `cm`), bukan Contract Management.
5. **Tidak boleh ada data mockup.** Semua data dari **database/Azure**. Frontend tidak boleh memfabrikasi data (seed) lagi.
6. **Dokumen disimpan di Azure Blob Storage**, bukan base64 di DB. DB hanya simpan metadata (container + blobKey).
7. Audit & Notification **tidak di-seed dummy** — diisi dari aktivitas sistem nyata.
8. **Vendor Workspace & Vendor Onboarding DI-SKIP** (atas permintaan user). Login eksternal/vendor tidak dikerjakan dulu. Fokus user internal.
9. Port: Frontend `8008`, Backend API `5055`.
10. **Setelah mengubah endpoint backend, WAJIB rebuild + restart proses DLL** — proses lama yang masih jalan menyajikan kode lama (pernah menyebabkan bug "unable to view document").

---

## 2. Technical Stack & Architecture

- **Backend:** ASP.NET Core 10 **modular monolith**, EF Core 10, **Azure SQL** (sebelumnya LocalDB).
- **Frontend:** React + Vite + TypeScript shell yang memuat **legacy mockup JSX** (global-script via Babel di `legacyRuntime.ts`). File legacy memakai global `window.React`, `window.XLSX`, dll. (tanpa `import`).
- **Dokumen:** **Azure Blob Storage** (Managed Identity di prod, connection string di dev).

### Arsitektur transisi: Bridge-to-Domain (masih berlaku)
```
Frontend legacy (UI locked)
  ↓ window.__procurementStorage  (apiBackedStorage.ts)
Backend bridge: FrontendState / ModuleState (JSON, DB-backed)
  ↓ projection (ModuleStateStore)
Normalized domain tables (trk.*, cip.*, cm.*, iam.*, core.*)
  ↓ (target jangka panjang)
Dedicated domain command/query APIs
```
**Penting:** storage bridge **sudah tersimpan di database** (tabel `core`/ModuleState). Jadi "dari DB" terpenuhi via bridge. Yang dilarang adalah **fabrikasi seed mockup**, bukan bridge-nya.

### Identity
| Domain | Mekanisme | Key |
|---|---|---|
| Internal | SISWarrior SSO (dev: session stub via dev-login) | `PersonnelNo` |
| Vendor | ASP.NET Core Identity | Email (DI-SKIP sekarang) |

Jangan campur: internal ≠ Identity tables; vendor ≠ PersonnelNo.

### Schema ownership
```
core = platform (audit, menu, settings, master data, communication, NOTIFICATION, frontend state)
iam  = internal identity (users, roles, permissions)
vdr  = vendor identity (skip)
trk  = Proposal Tracker
cip  = Contract Intelligent Platform
cm   = Contract Monitoring
```

---

## 3. Environment & Configuration

### Connection string (Azure SQL — PUBLIC endpoint + port)
`Code/backend/src/AppHost/appsettings.json`:
```
Server=sqlmisis-test.public.ca87cd4bc197.database.windows.net,3342;Database=PROCUREMENT_DB;User Id=procurementdbtes;Password=...;MultipleActiveResultSets=true
```
- **Gunakan endpoint `.public...,3342`** — endpoint non-public (`sqlmisis-test.ca87cd4bc197...`) tidak terjangkau dari dev (timeout).
- Bila konek gagal/timeout: cek **firewall Azure SQL** (IP publik mesin dev harus di-allow) — bukan bug kode.
- Migrasi ke Azure: `dotnet ef database update --connection '<connstring>;Encrypt=True' --project src/Platform/Persistence/... --startup-project src/AppHost/... --context ProcurementDbContext`.
- **`dotnet ef` tanpa `--connection` salah resolve ke LocalDB** (kuirk design-time) — selalu pakai `--connection` untuk Azure.

### Azure Blob Storage
`appsettings.json` (prod, Managed Identity, tanpa secret):
```jsonc
"AzureBlob": {
  "ServiceUri": "https://stsisdevidc001.blob.core.windows.net",
  "Containers": { "tracker": "app-proposaltracker", "cip": "app-contractmanagement", "contract-monitoring": "app-contractmanagement" }
}
```
`appsettings.Development.json` (dev, connection string + AccountKey):
```jsonc
"AzureBlob": { "ConnectionString": "DefaultEndpointsProtocol=https;AccountName=stsisdevidc001;AccountKey=...;EndpointSuffix=core.windows.net" }
```
- `BlobDocumentStorage` auto-detect: ConnectionString ada → shared-key + **Service SAS** (`blob.GenerateSasUri`); else ServiceUri → **DefaultAzureCredential** + **User Delegation SAS**.
- Diagnostik: `GET /api/v1/platform/blob-check` → `{configured, reachable, containers}`.
- **Local credential** untuk Managed Identity: dev memakai connection string (tak perlu az login). Bila pakai MI lokal, perlu `az login`/VS auth + role `Storage Blob Data Contributor`.

### Config flags
| Key | Default | Fungsi |
|---|---|---|
| `DataSeeding:SeedInitialIam` | true | Seed IAM dari mockup saat start |
| `DataSeeding:SeedInitialPlatformData` | true | Seed master data hierarki |
| `SSO:Enabled` | false (dev) | SISWarrior SSO |

---

## 4. What Has Been Done (kumulatif, terbaru di atas)

### 4.1 Authorization halus (per-permission) ✅
- `src/AppHost/Auth/`: `PermissionRequirement`, `PermissionAuthorizationHandler`, `PermissionPolicyProvider` (policy dinamis prefix `perm:`), `PermissionEndpointExtensions.RequirePermission(key)`. Terdaftar di `Program.cs`.
- Permission key modul ditambah ke seeder: `tracker.view/manage`, `cip.view/manage`, `contracts.view/manage`, `masterdata.view/manage` (+admin keys lama).
- **Pemetaan role→permission diperbaiki** dari posisional (salah) → **eksplisit per role-code** (Super Admin=semua 32; Officer/Section/Admin modul=permission modulnya).
- Enforcement: Tracker/CIP/CM grup=`*.view`, command=`*.manage`; AdminConsole per-endpoint (`users.*`, `roles.*`, `audit.view`, `settings.*`, dll). Master-data=`masterdata.*`.
- Terbukti: Super Admin tembus semua; Officer Tracker (3 perm) → tracker 200, lainnya 403; anonim 401.
- **Catatan koreksi data:** seeder add-only → `iam.ROLE_PERMISSION_T` dibersihkan sekali agar mapping benar ter-seed ulang.

### 4.2 Audit trail ✅
- Semua command Tracker/CIP/CM memanggil `IAdminConsoleAuditService.WriteAuditAsync` (`core.AUDIT_LOG_T`). Celah ditambal: CIP final-contract/recycle, CM imports.

### 4.3 Notification (event-driven, per-user, tanpa seed) ✅
- Skema: `core.NOTIFICATION_T` + `core.NOTIFICATION_RECIPIENT_STATE_T` (read/dismiss per user). Migration `AddNotificationTables`.
- `NotificationService` + `/api/v1/notifications` (GET, /{id}/read, /unread, /read-all, DELETE). Visibility difilter server-side (audience all/role/user; user = email local-part).
- Method: `NotifyModuleAsync` (role tim modul), `NotifyUserAsync`/`NotifyAssignedUserAsync` (Direct, resolve nama→username, fallback role), `NotifyPermissionHoldersAsync` (role pemegang permission), `NotifyAllAsync` (announcement).
- Event nyata terpasang:
  - Tracker: distribute (role), LOA generated (ke tim CIP), **reassign-officer → Direct ke officer**.
  - CIP: case from-loa, final-contract.
  - CM: reminder send, reminder scan.
  - Admin: user dibuat/status diubah (ke pemegang `users.view`), role permission diubah (`roles.view`), settings diubah (`settings.view`), languages diubah (**announcement `all`**).
- Frontend `Notifications.jsx` dibaca dari API (buang seed `NOTIF_FULL`); UI tidak berubah.

### 4.4 PURGE MOCKUP — 3 modul backend-driven ✅
Masalah: tiap modul memfabrikasi data dummy & menulisnya ke DB saat storage kosong; backend GET list mengembalikan sample statis saat tabel kosong.
- **Frontend seed dibuang** (kosong = kosong, tanpa write-back): Tracker `trkReadStore`/`trkResetStore` + loader aux (`trkLoadActivityNotes`/`trkLoadStepVendorDocs`/`trkLoadBidEvalState` — dulu mengarang notes/evidence on-the-fly); CIP `cipReadStore`/`cipResetStore`; CM `cmLoadContracts` + `cmGroups` default `[]`.
- **Hydration fix:** `App.jsx` memanggil `await window.__procurementStorage.hydrate()` **setelah login** (sebelum `setPhase("app")`) — root cause "40+ proposal saat first load, 3 setelah refresh" (dulu hydration pra-login → 401 → kosong → seed nyala).
- **Backend fallback statis dihapus** di list GET: Tracker proposals/loa-documents, CIP loa-inbox/cases/repository, CM list/expiry/reminders (kembalikan hasil DB apa adanya).
- **RBAC upload Tracker:** evidence/winner-proof upload+delete hanya Officer (handler guard + UI hide); Section Head view-only (`canUpload` → `canEdit`).
- Dashboard sudah dari DB (lihat 4.7).

### 4.5 Migrasi DB ke Azure SQL ✅
- Connection string → Azure SQL (`PROCUREMENT_DB`). 15 migration applied ke Azure. Data Tracker/CIP/CM tidak terbawa dari LocalDB lama; DB fresh seed IAM+master-data saat start, data modul lahir dari aksi/projection.

### 4.6 Dokumen → Azure Blob ✅
**Infra** (`src/AppHost/Services/DocumentStorage.cs`): `IDocumentStorage`/`BlobDocumentStorage` + `AzureBlobOptions`. Endpoint generik (`src/AppHost/Endpoints/DocumentEndpoints.cs`):
```
POST   /api/v1/documents/{module}/upload   (multipart; RBAC {module}.manage; DisableAntiforgery)
GET    /api/v1/documents/download?container=&key=   → { url: <SAS 15 menit> }  (SPA fetch lalu pakai URL)
DELETE /api/v1/documents/{module}?container=&key=   (RBAC {module}.manage)
```
Modul→container: tracker→`app-proposaltracker`, cip & contract-monitoring→`app-contractmanagement`. Diverifikasi upload/SAS-download/delete (blob 404 setelah delete).

**Tracker** (`TrackerProposals.jsx` + `TrackerData.jsx`): helper `trkUploadDocument`(file), `trkUploadDataUri`(generated PDF→File), `trkResolveDocumentUrl`(blobKey→SAS), `trkDeleteDocument`. Evidence vendor + winner-proof (upload) + **LOA generated** (`trkGenerateLoaDocument` async → upload generated PDF) semua ke Blob; simpan `{container, blobKey, fileName}` (no base64). `TrkPdfDocumentModal` resolve SAS (Spinner). Delete `await` hapus blob dulu. **Officer: View+Delete; Section Head: View-only.**

**CIP** (backend + `ContractCIPData/Workflow/Screens.jsx`): kolom `Container`/`BlobKey` di `cip.CASE_DOCUMENT_T` (migration `AddCipDocumentBlobColumns`); endpoint termsheet/draft/final terima `blobKey`/`container` (bukan `dataUri`). Frontend: `cipUploadDocument`/`cipUploadDataUri`/`cipResolveDocumentUrl`; termsheet+draft (generated) & final (upload) → Blob; case simpan `*BlobKey`/`*Container` (no base64); presence check pakai `*BlobKey`; `CIPDocumentPreviewModal` resolve SAS; recycle clear blob refs.

**LOA lintas-modul** ✅: LOA Tracker (container `app-proposaltracker`) mengalir ke CIP — `cipLoaInbox` item bawa `container`/`blobKey` → `cipBuildCaseFromLoaItem` simpan `loaContainer`/`loaBlobKey` → repository CIP & preview resolve via SAS (endpoint download menerima container apa pun).

### 4.7 Dashboard dari DB ✅
Dashboard Tracker (`trkDashboardMetrics(useTrackerStore().proposals)`) & CIP (`useCipStore`) menghitung **semua KPI dari store frontend** (= data DB via bridge). Sudah real sejak seed dibuang. Endpoint statis `/api/v1/{tracker,cip}/dashboard` di backend **dorman** (tak dipakai FE).

### 4.8 Import Excel nyata ✅
- Tambah **SheetJS (`xlsx`)**, di-expose `window.XLSX` di `legacyRuntime.ts`.
- `ContractImport.jsx`: input file nyata → `cmParseImportFile` (parse .xlsx → map kolom via `CM_IMPORT_MAPPING` → contract rows) → preview baris asli (distinct/merge) → **Migrate** `cmSaveContracts(rows)` → bridge → **projection** menulis `cm.CONTRACT_T`/`CONTRACT_VERSION_T`. Reuse pipeline, tanpa endpoint baru.
- **Batasan:** Excel berisi **link SharePoint** (bukan file) → link disimpan sebagai metadata, **belum** dimigrasi ke Blob (perlu akses SharePoint untuk fetch→upload).

### 4.9 Settings benar-benar diterapkan ✅
Audit menemukan: hanya kelompok **Session** (sessionEnabled/timeout/countdown/lockScreen via `App.jsx` idle monitor) yang dulu diterapkan. Ditambahkan:
- **Retensi (Point 1):** `RetentionService` baca `core.SETTING_T` → `ExecuteDeleteAsync` di `AUDIT_LOG_T`/`NOTIFICATION_T`(+state)/`EMAIL_SENT_T` lebih tua dari `auditDays`/`notifDays`/`emailLogDays` (jika `*Delete` aktif). `RetentionBackgroundService` (harian, +2 menit startup). Endpoint manual `POST /api/v1/super-admin/settings/retention/run` (settings.update). **Terbukti**: suntik audit lama → run → `auditDeleted:1`, baris terhapus.
- **Email/SMTP (Point 2):** `IEmailSender`/`SmtpEmailSender` (System.Net.Mail; baca smtp/port/encryption/auth/login/pwd/from/cc/bcc dari settings; catat tiap percobaan ke `core.EMAIL_SENT_T` Delivered/Failed/Skipped; tak pernah throw). Di-wire ke CM reminder send (email ke PIC). **Terbukti**: reminder → row `EMAIL_SENT_T` (status Failed dari dev karena SMTP tak terjangkau; Delivered dari lingkungan ber-akses SMTP).
- **Belum:** password policy & lockout (hanya relevan modul vendor yang di-skip; backend masih hardcode `RequiredLength=12`).

---

## 5. Database Migrations (15)
```
20260622011116_InitialIdentityAndVendorFoundation
20260623013438_AddFrontendStateTable
20260623024544_MoveTablesToDomainSchemasAndPascalColumns
20260623030755_RenameIamInternalTables
20260623035136_AddModuleDomainStateStores
20260623064933_AddTrackerDomainTables
20260623071046_AddCipDomainTables
20260623074110_AddContractMonitoringDomainTables
20260623102847_AddSuspendedInternalUserStatus
20260623112706_AddAuditLogTable
20260623114440_AddMenuAndSettingsTables
20260623121001_AddMasterDataTables
20260623151502_AddCommunicationTables
20260624052741_AddNotificationTables
20260624120259_AddCipDocumentBlobColumns
```

---

## 6. Backend API Reference (ringkas, fokus yang baru)
```
# Health / Platform
GET  /api/health/ready
GET  /api/v1/platform/foundation-manifest
GET  /api/v1/platform/blob-check                 ← diagnostik Blob

# Internal Auth
GET  /api/v1/internal/auth/me
POST /api/v1/internal/auth/dev-login   { personnelNo | email }
POST /api/v1/internal/auth/logout

# Documents (Azure Blob) — semua InternalUser + RBAC
POST   /api/v1/documents/{module}/upload   (multipart: file, entityId, docType)
GET    /api/v1/documents/download?container=&key=
DELETE /api/v1/documents/{module}?container=&key=

# Notifications — InternalUser
GET    /api/v1/notifications
POST   /api/v1/notifications/{id}/read | /unread | /read-all
DELETE /api/v1/notifications/{id}

# Tracker/{tracker.view group, command tracker.manage}, CIP{cip.*}, CM{contracts.*}
#   (lihat handover sebelumnya untuk daftar penuh; semua list GET kini mengembalikan data DB apa adanya, tanpa sample)

# Super Admin (per-endpoint permission)
GET/PUT /api/v1/super-admin/settings                      (settings.view / settings.update)
POST    /api/v1/super-admin/settings/retention/run        (settings.update)  ← retensi manual
GET     /api/v1/super-admin/audit                         (audit.view)
... (languages/language-text/email-templates/email-sent/menu-tree/permissions)

# Administration / Master Data — per-endpoint permission (users.*, roles.*, permissions.assign, masterdata.*)
```

---

## 7. Frontend Status
- Bridge: `app/bootstrap/apiBackedStorage.ts` (rute `ag_tracker_*`→/tracker/storage, `ag_cip_*`→/cip/storage, `ag_cm_*`→/contracts/storage, lain→/frontend-state).
- Globals legacy di `app/bootstrap/legacyRuntime.ts`: React, ReactDOM, lucide, **XLSX**.
- **Tidak ada** seed mockup aktif di 3 modul. Dokumen via Blob. Dashboard dari store. Notifikasi dari API.
- Hydration setelah login (App.jsx).

---

## 8. GOTCHAS (penting!)
1. **Restart DLL setelah ubah backend** — proses lama menyajikan kode lama (pernah bikin download balas 302 lama → "unable to view document").
2. **Azure SQL:** pakai endpoint `.public...,3342`. Timeout = firewall IP/network, bukan kode. `dotnet ef` butuh `--connection` eksplisit (tanpa itu salah ke LocalDB).
3. **Cross-origin (FE :8008 ↔ API :5055):** preview dokumen pakai **SAS URL** (fetch JSON `{url}` lalu set iframe src) — iframe lintas-origin tak bawa cookie. Jangan andalkan cookie untuk blob.
4. **Email "Delivered"** butuh akses jaringan ke SMTP `smtp.saptaindra.co.id:25` (port 25 keluar sering diblok di dev → "Failed", itu wajar). Wiring & pencatatan sudah benar.
5. **Seeder add-only** — ubah mapping role-permission tidak menghapus baris lama; bersihkan `iam.ROLE_PERMISSION_T` sekali bila perlu re-seed benar.
6. **Test harness integration berbagi env var** `ConnectionStrings__DefaultConnection`; tiap test class harus seed IAM sendiri (`SeedInitialIamDataAsync`). 4 test (`FoundationManifest`, `InternalAuth`) **konek ke Azure live** (tanpa override) → gagal bila Azure tak terjangkau.
7. **Import Excel:** dokumen = link SharePoint (metadata), belum ke Blob.
8. **PDF generate → Blob:** dataUri dikonversi via `fetch(dataUri).then(r=>r.blob())` lalu di-upload.
9. **`sqlcmd` di Windows butuh `-I`** (QUOTED_IDENTIFIER) untuk DELETE pada tabel ber-filtered-index.
10. **Path `/tmp` beda** antara bash (MSYS) dan Windows tools (curl/python) — pakai path Windows absolut untuk file yang dishare.

---

## 9. How To Run / Verify
```powershell
# Build & test
cd D:\Projects\IntegratedProcurement
dotnet build Code\backend\IntegratedProcurement.slnx
dotnet test  Code\backend\IntegratedProcurement.slnx --no-build      # 28 passed (butuh Azure reachable utk 4 test)

# Frontend build
cd Code\frontend ; npm run build

# Apply migrations (Azure)
cd ..\backend
dotnet ef database update --connection 'Server=sqlmisis-test.public.ca87cd4bc197.database.windows.net,3342;Database=PROCUREMENT_DB;User Id=procurementdbtes;Password=<REDACTED>;MultipleActiveResultSets=true;Encrypt=True' --project src\Platform\Persistence\IntegratedProcurement.Platform.Persistence.csproj --startup-project src\AppHost\IntegratedProcurement.AppHost.Api.csproj --context ProcurementDbContext

# Run API (dari folder AppHost)
cd src\AppHost
$env:ASPNETCORE_ENVIRONMENT='Development'
dotnet bin\Debug\net10.0\IntegratedProcurement.AppHost.Api.dll --urls http://localhost:5055

# Frontend dev
cd ..\..\..\frontend
npm run dev -- --host 127.0.0.1 --port 8008

# Smoke
Invoke-RestMethod http://localhost:5055/api/health/ready
Invoke-RestMethod http://localhost:5055/api/v1/platform/blob-check     # configured:true, reachable:true
```
**Login dev:** PersonnelNo/email. Contoh: `usep.rusnandar` (Super Admin), `lestari.putri` (Section Head Tracker), `tono.hartono`/`agus.pratama` (Officer Tracker), `bayu.setiawan` (Admin Contract Monitoring).

### Status verifikasi terakhir (2026-06-24)
```
Backend build : 0 error (8 warning gaya/analyzer: CA1848/CA1873/CA1859/xUnit2031 — kosmetik)
Backend tests : 28 passed (Azure reachable)
Frontend build: passed
Blob          : upload/SAS-download/delete terbukti (Tracker + CIP container)
Retensi       : terbukti hapus record lama (auditDeleted:1)
Email         : terbukti mencoba SMTP + catat EMAIL_SENT_T (Failed dari dev)
Data state    : Tracker 3 proposal ReadyToDistribute (owner Lestari Putri); CIP/CM kosong
```

---

## 10. Remaining Work / Recommended Next
1. **Email "Delivered"**: uji dari lingkungan ber-akses SMTP (atau set SMTP relay yang reachable).
2. **Import dokumen → Blob**: bila ada akses SharePoint, fetch file dari link → upload ke Blob saat import.
3. **Password policy & lockout** dari settings: terapkan saat modul **vendor** diaktifkan (kini hardcode).
4. **Backend dashboard endpoints** (`/tracker|cip/dashboard`) masih statis (dorman) — hitung dari DB bila ingin dipakai langsung.
5. **0-warning**: rapikan 8 warning gaya (LoggerMessage delegates, dll).
6. **Bridge → domain API murni** (jangka panjang): pindahkan reads/commands modul dari storage bridge ke API domain.
7. **Vendor Workspace/Management**: saat di-unskip — freeze mockup → sync → domain API + auth vendor.

---

## 11. Key Files
```
# Authorization
src/AppHost/Auth/{AuthorizationPolicies,PermissionRequirement,PermissionAuthorizationHandler,PermissionPolicyProvider,PermissionEndpointExtensions}.cs
src/Platform/Persistence/Seeding/InitialIamDataSeeder.cs

# Notifications
src/Platform/Persistence/Support/NotificationEntries.cs
src/AppHost/Services/NotificationService.cs
src/AppHost/Endpoints/NotificationEndpoints.cs
frontend/src/platform/notifications/legacy/Notifications.jsx

# Documents / Blob
src/AppHost/Services/DocumentStorage.cs
src/AppHost/Endpoints/DocumentEndpoints.cs
src/Modules/ContractIntelligentPlatform/Domain/CipCaseDocument.cs
src/Platform/Persistence/Configurations/CipDomainConfiguration.cs
frontend/src/app/bootstrap/legacyRuntime.ts        (window.XLSX)
frontend/src/modules/proposal-tracker/legacy/{TrackerData,TrackerProposals}.jsx
frontend/src/modules/contract-intelligent-platform/legacy/{ContractCIPData,ContractCIPWorkflow,ContractCIPScreens}.jsx

# Settings enforcement
src/AppHost/Services/RetentionService.cs
src/AppHost/Services/EmailSender.cs
src/AppHost/Services/AdminConsoleConfigurationService.cs
frontend/src/platform/settings/legacy/SettingsStore.jsx

# Import
frontend/src/modules/contract-monitoring/legacy/ContractImport.jsx
src/Platform/Persistence/ModuleState/ModuleStateStore.cs   (projection)

# Endpoints (modul)
src/AppHost/Endpoints/{Tracker,Cip,ContractMonitoring,AdminConsole}Endpoints.cs
src/AppHost/Program.cs

# Tests
backend/tests/AppHost/{PermissionEnforcementTests,NotificationLifecycleTests,DomainCommandEndpointTests,AdministrationReadEndpointTests}.cs
```

---

## 12. Definition of Done (per task)
1. Backend build 0 error, tests pass (Azure reachable).
2. Frontend build pass.
3. UI tidak berubah visual (bandingkan mockup).
4. Data persist ke DB; dokumen ke Blob; **tanpa mockup/base64**.
5. Audit & Notification TIDAK di-seed.
6. Integration test untuk endpoint baru bila applicable.
7. Handover/next steps dijelaskan.

---

---

## 13. Langkah Uji Per Modul (Manual QA)

Prasyarat: backend live di `:5055` (Azure reachable), frontend `npm run dev` di `:8008`, **hard-refresh browser** agar ambil source terbaru. Login dev pakai PersonnelNo/email.

User uji yang tersedia (seed IAM):
| Login | Role | Akses |
|---|---|---|
| `usep.rusnandar` (P-00001) | Super Admin | semua |
| `lestari.putri` (P-00010) | Section Head Tracker | Tracker (owner proposal), view-only dokumen |
| `agus.pratama` (P-00015) | Officer Tracker | Tracker (upload/complete) |
| `nadia.salsabila` (P-00017) | Officer CIP | CIP |
| `bayu.setiawan` (P-00005) | Administrator Contract Monitoring | CM + master data |

### 13.0 Authorization / RBAC
1. Login `agus.pratama` → buka **Tracker** (tampil). Buka **CIP**/**Contract Monitoring**/**Administration** → harus **tidak bisa** (menu tidak muncul / akses ditolak). Backend: GET `/api/v1/cip/cases` sebagai user ini = **403**.
2. Login `usep.rusnandar` → semua modul tampil. GET endpoint apa pun = **200**.
3. Tanpa login → API internal = **401**.

### 13.1 Proposal Tracker (end-to-end → LOA)
1. Login `lestari.putri` (Section Head, owner) → **Tracker → Proposals**: tampil **tepat 3 proposal** `PR-2026-9001/9002/9003`, status **Ready to Distribute**, owner Lestari Putri. *(Tidak ada 40+; tidak ada notes/evidence karangan.)*
2. **Distribute** PR-2026-9001 → assign officer **Agus Pratama**. Status → On Progress. (Notifikasi terbit ke tim Tracker; Agus dapat notif **Direct** "assigned".)
3. Logout, login `agus.pratama` (Officer):
   - Buka proposal → step **Invitation & Aanwijzing** → klik **+** per vendor → upload PDF. File naik ke Blob (`app-proposaltracker`); tampil tombol **View** + **Delete** (Officer).
   - Klik **View** → PDF tampil (ditarik dari Blob via SAS).
   - Klik **Delete** → file hilang dari list **dan** dari Blob (cek Azure portal/`blob-check`).
   - **Complete** tiap aktivitas (RFQ, Negotiation, Bid Evaluation → pilih winner + upload winner proof) hingga step **LOA** → **Generate LOA**. LOA (PDF generate) ter-upload ke Blob; preview via SAS.
4. Logout, login `lestari.putri` (Section Head) → buka proposal yang sama:
   - Dokumen punya tombol **View** saja (tidak ada Upload/Delete). Klik View → PDF tampil. *(View-only enforced.)*

### 13.2 Contract Intelligent Platform (LOA → Final Contract)
1. Login `nadia.salsabila`/`usep.rusnandar` → **CIP → LOA Inbox**: LOA hasil Tracker (langkah 13.1) muncul.
2. **Create case from LOA** → case dibuat (`CIP-2026-xxx`). Preview LOA di repository → tampil dari Blob (lintas-modul, container `app-proposaltracker`).
3. **Verify** → **Generate Term Sheet** (PDF generate → Blob `app-contractmanagement`) → preview.
4. **Select template** → **Generate Draft** (→ Blob) → preview.
5. **Upload Final Contract** (file .pdf/.docx) → ke Blob → preview.
6. **Repository CIP**: keempat dokumen (LOA, termsheet, draft, final) bisa di-View/Open dari Blob. Tidak ada base64 di DB (`cip.CASE_DOCUMENT_T` simpan `BlobKey`/`Container`).

### 13.3 Contract Monitoring (Import + Reminder)
1. Login `bayu.setiawan`/`usep.rusnandar` → **Contract Monitoring → Import & Migration**.
2. **Select file** → pilih `.xlsx` (template export) → preview menampilkan **baris asli dari file** (aturan distinct/merge) → **Confirm & migrate** → **Contract Database** terisi (data dari Excel, tersimpan ke `cm.CONTRACT_T`/`CONTRACT_VERSION_T`).
3. **Contract Database**: kontrak expiring tampil. Pada kontrak yang due, **Send reminder** → tercatat di **Email Sent** (status **Delivered** bila SMTP terjangkau; **Failed** dari dev). Notifikasi terbit ke tim CM.
4. **Run daily scan** → reminder massal untuk yang due.

### 13.4 Notifications
1. Bell (kanan atas) mulai **kosong** (tanpa dummy).
2. Lakukan aksi nyata (distribute, reassign, kirim reminder, buat user) → notifikasi muncul sesuai audience:
   - distribute → tim Tracker; reassign → **Direct** ke officer; user dibuat → admin (`users.view`); languages diubah → **semua** (announcement).
3. **Mark read / Mark all / Delete** dari bell maupun halaman Notifications → state **per-user** tersimpan di backend (login user lain → state berbeda).

### 13.5 Settings (yang sudah diterapkan)
1. **Session**: Super Admin → Settings → set `timeout` kecil (mis. 1 menit) + `lockScreen` on → diamkan → muncul countdown lalu **lock/logout**. *(sessionEnabled/timeout/countdown/lockScreen aktif.)*
2. **Retensi**: set `auditDelete` on + `auditDays` → `POST /api/v1/super-admin/settings/retention/run` (atau tunggu job harian) → audit/notification/email-log lebih tua dari ambang terhapus.
3. **Email**: lihat 13.3 (reminder → Email Sent). Delivered butuh akses SMTP.

### 13.6 Verifikasi Blob (opsional, kuat)
- `GET http://localhost:5055/api/v1/platform/blob-check` → `reachable:true` kedua container.
- Setelah upload: cek di Azure Storage (container `app-proposaltracker`/`app-contractmanagement`) file ada. Setelah Delete: file hilang.

---

## 14. Diagram Alur Dokumen (Azure Blob)

### 14.1 Upload file nyata (evidence Tracker, final contract CIP)
```
[User pilih file] ──multipart──▶ POST /api/v1/documents/{module}/upload   (RBAC {module}.manage)
                                        │
                                        ▼
                              BlobDocumentStorage.UploadAsync
                                        │  (dev: connection string / prod: Managed Identity)
                                        ▼
                          Azure Blob container  (tracker→app-proposaltracker,
                                                  cip/cm→app-contractmanagement)
                                        │  key: {entityId}/{docType}/{guid}-{file}
                                        ▼
        respons { container, blobKey, fileName, size }
                                        │
                                        ▼
   Frontend simpan METADATA saja ({container, blobKey, fileName}) ke store/bridge → DB
   (TIDAK ada base64 di DB)
```

### 14.2 Dokumen di-GENERATE (LOA Tracker, Term Sheet & Draft CIP)
```
[Aksi generate] ─▶ buildPdf(...) → dataURI (PDF di memori)
                        │  fetch(dataURI) → Blob → File
                        ▼
                 (sama dengan 14.1: POST /documents/{module}/upload)
                        ▼
                 Azure Blob + metadata {container, blobKey}   (dataURI dibuang, no base64)
```

### 14.3 View / Download
```
[User klik View] ─▶ GET /api/v1/documents/download?container=&key=   (credentials: include)
                          │
                          ▼
                 BlobDocumentStorage.CreateReadSasUriAsync
                   dev: Service SAS (shared key) | prod: User Delegation SAS (MI)
                          │
                          ▼
                 respons { url: <SAS, exp 15 menit> }
                          │
                          ▼
        Frontend set iframe.src = SAS  /  window.open(SAS)
                          │  (URL ber-token → browser ambil blob LANGSUNG dari Azure,
                          ▼   tanpa cookie → aman lintas-origin FE:8008 ↔ API:5055)
                 Azure Blob → PDF tampil
```

### 14.4 Delete (hapus blob, lalu metadata)
```
[User klik Delete] ─▶ await DELETE /api/v1/documents/{module}?container=&key=  (RBAC manage)
                          │
                          ▼
                 BlobDocumentStorage.DeleteAsync  → blob HILANG dari Azure
                          │  (jika gagal → toast error, baris dipertahankan)
                          ▼
                 Frontend hapus metadata dari store/bridge → DB
```

### 14.5 LOA lintas-modul Tracker → CIP
```
TRACKER: Generate LOA ─▶ Blob container "app-proposaltracker"
            │  metadata {container:"app-proposaltracker", blobKey} disimpan di
            ▼  store.loaDocuments (bridge → DB) + trk.LOA_DOCUMENT_T
CIP LOA Inbox: cipLoaInbox(trackerStore) membaca LOA → item bawa {container, blobKey}
            │
            ▼
CIP Create Case: cipBuildCaseFromLoaItem → case simpan {loaContainer, loaBlobKey}
            │
            ▼
CIP Repository/Preview: GET /documents/download?container=app-proposaltracker&key=...
            ▼  (endpoint download menerima container APA PUN)
   SAS URL → LOA tampil di CIP (file fisik tetap satu, di container Tracker)
```

### 14.6 Prinsip kunci
- **File ada di Azure Blob; DB hanya simpan referensi** (`container` + `blobKey` + `fileName`).
- **Tidak ada base64** di database maupun bridge.
- **Download selalu via SAS** (URL ber-token, kedaluwarsa 15 menit) — bukan via cookie/iframe lintas-origin.
- **RBAC**: upload/delete butuh `{module}.manage` (mis. Officer); view terbuka untuk user internal modul tsb.

---

*End of full handover document.*
