# Project Handover - Integrated Procurement

**Date:** 2026-06-23 20:52:54 (UTC+7)  
**Handover prepared by:** Cursor AI (Claude)  
**Previous handover:** `Code/docs/PROJECT_HANDOVER_2026-06-23.md`  
**Project Root:** `D:\Projects\IntegratedProcurement`  
**Active Implementation Root:** `D:\Projects\IntegratedProcurement\Code`

Dokumen ini adalah serah terima lengkap untuk melanjutkan proyek dengan AI assistant atau engineer lain. Baca dokumen ini **dan** `PROJECT_HANDOVER_2026-06-23.md` sebagai referensi arsitektur dasar.

---

## 1. Primary Request and Intent

Tujuan utama user: mengubah **Integrated Procurement** menjadi aplikasi enterprise yang **real** — lengkap dengan backend, API, data model, auth, role/permission, menu, audit, dan integrasi modul — sambil **mempertahankan UI/UX mockup persis seperti aslinya**.

### Modul Status

| Status | Modul |
|--------|-------|
| **Selesai (mockup + integrasi prioritas)** | Proposal Tracker, Contract Intelligent Platform (CIP), Contract Monitoring |
| **Belum selesai (user kerjakan mockup paralel)** | Vendor Workspace, Vendor Onboarding |
| **Sedang dibangun (backend platform)** | Super Admin, Administration, Master Data, IAM, Menu, Settings, Audit |

### Aturan Kerja Kritis (WAJIB)

1. Kerja **hanya** di dalam `D:\Projects\IntegratedProcurement\Code`.
2. **Jangan** modifikasi `D:\Projects\IntegratedProcurement\Mockup` atau `MockupVite` — folder referensi milik user.
3. **Jangan redesign frontend.** Mockup adalah **locked visual contract**. Perubahan frontend hanya untuk wiring data ke backend API.
4. Modul bernama **Contract Monitoring**, bukan Contract Management. Schema `cm` = Contract Monitoring.
5. Ganti browser storage (`localStorage`, `sessionStorage`, IndexedDB) dengan backend API. Frontend aktif sudah memakai `window.__procurementStorage` → backend.
6. Saat data dipindah ke database, **seed awal harus sama dengan mockup** agar aplikasi langsung bisa ditest.
7. **Audit dan Notification tidak perlu seed dummy** — biarkan kosong, isi dari aktivitas sistem nyata.
8. Frontend dev port: **8008**. Backend API port: **5055**.

### Kesepakatan Integrasi Mockup Paralel

User mungkin menyelesaikan mockup Vendor Workspace / Vendor Onboarding secara paralel. Proses penggabungan:

1. **Freeze mockup** saat modul selesai (screen, state, action, role, lifecycle).
2. **Sync ke `Code/frontend`** via `Code/frontend/scripts/sync-mockup.mjs` (copy dari referensi ke Code, bukan sebaliknya).
3. **Map state ke domain** — identifikasi storage keys, shape JSON, aksi tulis.
4. **Buat backend API** (read + command) per bounded context.
5. **Ganti bridge secara bertahap** — frontend tetap sama, hanya sumber data berubah.

---

## 2. Technical Stack and Architecture

### Stack

- **Backend:** ASP.NET Core 10 modular monolith, EF Core, SQL Server LocalDB
- **Frontend:** React, Vite, TypeScript, legacy mockup modules via Vite shell
- **Database:** `IntegratedProcurement` on `(localdb)\MSSQLLocalDB`

### Arsitektur Transisi: Bridge-to-Domain

Aplikasi dalam tahap transisi:

```
Frontend (legacy JSX, UI locked)
    ↓ window.__procurementStorage
Backend bridge (FrontendStateEntry / ModuleStateEntry JSON)
    ↓ projection (ModuleStateStore)
Normalized domain tables (trk.*, cip.*, cm.*, iam.*, core.*)
    ↓ (target)
Dedicated domain command/query APIs
```

**Prioritas saat ini:** ganti interaksi bridge dengan domain API per modul, tanpa mengubah tampilan.

### Identity

| Domain | Mekanisme | Identity Key |
|--------|-----------|--------------|
| Internal users | SISWarrior SSO (dev: stub) | `PersonnelNo` |
| Vendor users | ASP.NET Core Identity | Email / Identity user |

**Jangan campur:** internal users tidak pakai ASP.NET Identity; vendor users tidak pakai `PersonnelNo`.

### Schema Ownership

```text
core = platform (audit, menu, settings, master data, frontend state)
iam  = internal identity (users, roles, permissions)
vdr  = vendor identity, invitations, registration
trk  = Proposal Tracker
cip  = Contract Intelligent Platform
cm   = Contract Monitoring
```

---

## 3. Folder Structure

```text
Code/
  backend/
    IntegratedProcurement.slnx
    src/
      AppHost/                          # API host, endpoints
      Modules/
        ProposalTracker/
        ContractIntelligentPlatform/
        ContractMonitoring/
        VendorOnboarding/
      Platform/
        Persistence/                    # DbContext, migrations, seeders
        InternalIdentity/
    tests/AppHost/                      # Integration tests
  frontend/
    src/
      app/bootstrap/apiBackedStorage.ts # Storage bridge ke backend
      modules/
        proposal-tracker/
        contract-intelligent-platform/
        contract-monitoring/
        vendor-onboarding/
      platform/
        administration/
        navigation/
        settings/
        data/legacy/Data.jsx            # IAM seed reference
  docs/
    phase-1-architecture.md … phase-7-admin-master-data-console.md
    frontend-backend-feature-checklist.md
    database-conventions.md
    PROJECT_HANDOVER_2026-06-23.md
    PROJECT_HANDOVER_2026-06-23 205254.md   # dokumen ini
```

---

## 4. What Has Been Done (Session 2026-06-23)

### Phase 0 — Baseline (sebelumnya + diverifikasi ulang)

- Backend build: 0 warnings, 0 errors
- Backend tests: **14 passed** (terakhir diverifikasi 2026-06-23 20:52)
- Frontend build: passed (sesi sebelumnya)
- 12 EF migrations applied (lihat §5)

### Completed Modules — Domain Command APIs

Placeholder command endpoints sudah diganti dengan mutasi database nyata + return read model terbaru.

#### Tracker (`TrackerEndpoints.cs`)

Domain methods di `TrackerProposal.cs`, `TrackerProposalActivity.cs`.

| Endpoint | Frontend wiring |
|----------|-----------------|
| `POST .../distribute` | `TrackerData.jsx` → `trkDomainPost` |
| `POST .../clock-in` | ✓ |
| `POST .../complete` | ✓ |
| `POST .../recycle` | ✓ |
| `POST .../cancel` | ✓ |
| `POST .../reassign-officer` | ✓ |
| `POST .../loa-documents` | ✓ |

Pola wiring: **fire-and-forget** — UI tetap update local state, API dipanggil non-blocking.

#### CIP (`CipEndpoints.cs`)

Domain methods di `CipCase.cs`.

| Endpoint | Frontend wiring |
|----------|-----------------|
| `POST /cases/from-loa` | `ContractCIPData.jsx` → `cipDomainPost` |
| `POST .../verify` | ✓ |
| `POST .../termsheet/generate` | ✓ |
| `POST .../template/select` | ✓ |
| `POST .../draft/generate` | ✓ |
| `POST .../final-contract` | ✓ |
| `POST .../recycle` | ✓ |

#### Contract Monitoring (`ContractMonitoringEndpoints.cs`)

| Endpoint | Frontend wiring |
|----------|-----------------|
| `POST .../reminders/send` | `ContractMonScreens.jsx` → `cmDomainPost` |
| `POST .../reminders/run-scan` | ✓ |
| `POST .../imports` | `ContractImport.jsx` → `cmImportDomainPost` |

### Phase 1 — Application Support Backend (sedang berjalan)

#### 1.1 IAM Read APIs — DONE

`AdminConsoleEndpoints.cs` query database `iam` schema, fallback ke static read model jika kosong.

- `GET /api/v1/administration/users`
- `GET /api/v1/administration/roles`
- `GET /api/v1/super-admin/permissions`
- `GET /api/v1/administration/role-permissions`

#### 1.2 IAM Seed Data — DONE

- `InitialIamDataSeeder.cs` — data dari `Data.jsx` (22 users, 17 roles, 24 permissions)
- Idempotent, jalankan `MigrateAsync()` sebelum seed
- Aktif via `DataSeeding:SeedInitialIam` (default `true`) di `Program.cs`
- Test context: set `DataSeeding:SeedInitialIam=false`

#### 1.3 IAM Command APIs — DONE

| Endpoint | Audit |
|----------|-------|
| `POST /api/v1/administration/users` | ✓ |
| `PUT /api/v1/administration/users/{personnelNo}` | ✓ |
| `PUT .../status` | ✓ |
| `PUT .../roles` | ✓ |
| `POST /api/v1/administration/roles` | ✓ |
| `PUT /api/v1/administration/roles/{roleCode}` | ✓ |
| `PUT .../permissions` | ✓ |

Domain methods: `InternalUser.SetStatus()`, `UpdateProfile()`, `InternalRole.Update()`.

#### 1.4 Frontend IAM Wiring — DONE

| Screen | File | API |
|--------|------|-----|
| Users | `ScreensUsers.jsx` | administration/users |
| Roles | `ScreensRoles.jsx` | administration/roles |
| Role Permissions | `ScreensMore.jsx` | role-permissions + PUT permissions |
| Audit Log | `ScreensMore.jsx` | super-admin/audit |

Fallback lokal jika API gagal (console.warn, tidak redesign UI).

#### 1.5 Audit Log — DONE

- Entity: `AuditLogEntry` → `core.AUDIT_LOG_T`
- Migration: `20260623112706_AddAuditLogTable`
- `GET /api/v1/super-admin/audit` — baca dari DB, **mulai kosong**
- Administration commands menulis audit otomatis via `WriteAuditAsync`

#### 1.6 Menu & Settings — DONE

- Entities: `MenuTreeEntry` → `core.MENU_T`, `SettingEntry` → `core.SETTING_T`
- Migration: `20260623114440_AddMenuAndSettingsTables`
- APIs: `GET/PUT /api/v1/super-admin/menu-tree`, `GET/PUT /api/v1/super-admin/settings`
- Frontend wired: `MenuData.jsx`, `SettingsStore.jsx`
- Auto-seed ke backend dari `DEFAULT_MENU` / `DEFAULT_SETTINGS` jika DB kosong

#### 1.7 Master Data Backend Foundation — DONE (belum frontend wiring)

- Entities: `MasterDataSetEntry` → `core.MASTER_DATA_SET_T`, `MasterDataRecordEntry` → `core.MASTER_DATA_RECORD_T`
- Migration: `20260623121001_AddMasterDataTables`
- APIs:
  - `GET /api/v1/master-data/sets` — list sets + record count
  - `GET /api/v1/master-data/sets/{key}` — detail + records, fallback ke `AdminConsoleReadModels`
  - `PUT /api/v1/master-data/sets/{key}/records/{code}` — upsert record, auto-create set, audit log

**Master data set keys (static fallback):**

```text
holiday, tracker-step, tracker-method, cip-authorization,
vendor-relationship, vendor-document, brand, kbli, country, readonly-master
```

**Hierarchy master data (masih frontend bridge only):**

```text
Province, City, District, Village — storage keys ag_*_master_v1
Commodity, Special Requirement — storage keys ag_*_master_v1
```

Frontend files masih pakai `window.__procurementStorage`:

```text
BrandMasterData.jsx      → ag_brand_master_v1
KbliMasterData.jsx       → ag_kbli_master_v1
CountryMasterData.jsx    → ag_country_master_v1
ProvinceMasterData.jsx   → ag_province_master_v1
CityMasterData.jsx       → ag_city_master_v1
DistrictMasterData.jsx   → ag_district_master_v1
VillageMasterData.jsx    → ag_village_master_v1
SpecialReqMasterData.jsx → ag_special_req_master_v1
```

#### 1.8 Integration Tests — DONE

`tests/AppHost/AssemblyInfo.cs`: `[CollectionBehavior(DisableTestParallelization = true)]`

| Test class | Tests |
|------------|-------|
| `HealthEndpointTests` | ReadyEndpointReturnsSuccess |
| `InternalAuthEndpointTests` | MeEndpointDoesNotRedirectWhenSsoIsDisabled |
| `FoundationManifestEndpointTests` | FoundationManifestReturnsModuleContracts |
| `VendorInvitationCodeTests` | GeneratedCodeUsesVendorInvitationFormat, HashNormalizesInvitationCode |
| `DomainCommandEndpointTests` | TrackerComplete, CipCreateCaseFromLoa, ContractReminderSend |
| `AdministrationReadEndpointTests` | IAM seed, commands, audit, menu/settings, master data, read endpoints |

Isolated test DB: `IsolatedAdministrationApi`, `IsolatedCommandApi` — temporary LocalDB, guard against deleting main DB.

---

## 5. Database Status

### Connection String

```json
"DefaultConnection": "Server=(localdb)\\MSSQLLocalDB;Database=IntegratedProcurement;Trusted_Connection=True;TrustServerCertificate=True"
```

Lokasi: `Code/backend/src/AppHost/appsettings.json`

### Migration List (12 migrations)

```text
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
```

### Normalized Domain Tables

```text
trk.PROPOSAL_T, trk.PROPOSAL_ACTIVITY_T, trk.LOA_DOCUMENT_T
cip.CASE_T, cip.CASE_DOCUMENT_T, cip.CASE_ACTIVITY_T
cm.CONTRACT_T, cm.CONTRACT_VERSION_T, cm.REMINDER_T
iam.USER_T, iam.ROLE_T, iam.PERMISSION_T, iam.USER_ROLE_T, iam.ROLE_PERMISSION_T
core.AUDIT_LOG_T, core.MENU_T, core.SETTING_T
core.MASTER_DATA_SET_T, core.MASTER_DATA_RECORD_T
```

### Data Counts (terakhir diverifikasi sesi sebelumnya)

```text
trk.PROPOSAL_T        = 50
cip.CASE_T            = 41
cm.CONTRACT_T         = 100
cm.CONTRACT_VERSION_T = 132
cm.REMINDER_T         = 0  (kosong sampai reminder send/scan dijalankan)
iam users (seed)      = 22
iam roles (seed)      = 17
```

### Projection Store Keys

| Modul | Storage key | Projection target |
|-------|-------------|-------------------|
| Tracker | `ag_tracker_rebuild_v14` | trk.* |
| CIP | `ag_cip_store_v7` | cip.* |
| Contract Monitoring | `ag_cm_contracts_v1`, `ag_cm_reminders_v1` | cm.* |

Projection code: `Code/backend/src/Platform/Persistence/ModuleState/ModuleStateStore.cs`

**Caveat CIP:** `cip.CASE_ACTIVITY_T` bisa kosong jika payload `ag_cip_store_v7` tidak punya `activityHistory`.

**Caveat CM:** `ag_cm_contracts_v1` berisi raw document rows; duplicate `contractId` di-merge ke `cm.CONTRACT_T`, semua versi di `cm.CONTRACT_VERSION_T`.

---

## 6. Backend API Reference

### Health & Platform

```text
GET  /api/health/live
GET  /api/health/ready
GET  /api/v1/platform/foundation-manifest
GET  /api/v1/frontend-state
```

### Internal Auth

```text
GET  /api/v1/internal/auth/me
POST /api/v1/internal/auth/dev-login
POST /api/v1/internal/auth/logout
```

### Tracker — `/api/v1/tracker`

```text
GET  /dashboard, /proposals, /proposals/{id}, /loa-documents
GET|PUT|DELETE /storage, /storage/{key}
POST /proposals/{id}/distribute
POST /proposals/{id}/activities/{activityId}/clock-in|complete|recycle|cancel
POST /proposals/{id}/reassign-officer
POST /proposals/{id}/activities/{activityId}/loa-documents
```

### CIP — `/api/v1/cip`

```text
GET  /dashboard, /loa-inbox, /cases, /cases/{id}, /templates, /repository, /authorization-master
GET|PUT|DELETE /storage, /storage/{key}
POST /cases/from-loa
POST /cases/{id}/verify|termsheet/generate|template/select|draft/generate|final-contract|recycle
```

### Contract Monitoring — `/api/v1/contracts`

```text
GET  /dashboard, /, /{id}, /expiry, /reminders
GET|PUT|DELETE /storage, /storage/{key}
POST /, /{id}/versions
POST /{id}/reminders/send
POST /reminders/run-scan
POST /imports
```

### Super Admin — `/api/v1/super-admin`

```text
GET  /overview, /modules, /permissions, /menus
GET  /menu-tree          ← DB-backed
PUT  /menu-tree          ← DB-backed + audit
GET  /languages          ← static read model (belum DB)
GET  /language-text      ← static
GET  /email-templates    ← static
GET  /email-sent         ← static
GET  /audit              ← DB-backed, starts empty
GET  /settings           ← DB-backed
PUT  /settings           ← DB-backed + audit
```

### Administration — `/api/v1/administration`

```text
GET  /overview, /users, /roles, /role-permissions   ← DB-backed
POST /users
PUT  /users/{personnelNo}
PUT  /users/{personnelNo}/status
PUT  /users/{personnelNo}/roles
POST /roles
PUT  /roles/{roleCode}
PUT  /roles/{roleCode}/permissions
```

### Master Data — `/api/v1/master-data`

```text
GET  /overview, /sets, /sets/{key}
PUT  /sets/{key}/records/{code}
```

Endpoint source: `Code/backend/src/AppHost/Endpoints/AdminConsoleEndpoints.cs`

### Vendor (Phase 5 foundation)

```text
/api/v1/vendor/auth/*
/api/v1/vendor-onboarding/invitations/*
/api/v1/public/vendor-registration/*
```

---

## 7. Frontend Wiring Status

### Storage Bridge

```text
Code/frontend/src/app/bootstrap/apiBackedStorage.ts
```

Routes:

```text
ag_tracker_*  → /api/v1/tracker/storage
ag_cip_*      → /api/v1/cip/storage
ag_cm_*       → /api/v1/contracts/storage
other keys    → /api/v1/frontend-state
```

**Tidak ada** `localStorage`/`sessionStorage`/`indexedDB` di `Code/frontend/src` (sudah diverifikasi).

### Wiring Matrix

| Area | Status | Notes |
|------|--------|-------|
| Tracker commands | ✅ Wired | `trkDomainPost` fire-and-forget |
| CIP commands | ✅ Wired | `cipDomainPost` |
| CM reminders/import | ✅ Wired | `cmDomainPost`, `cmImportDomainPost` |
| Users | ✅ Wired | `ScreensUsers.jsx` |
| Roles | ✅ Wired | `ScreensRoles.jsx` |
| Role Permissions | ✅ Wired | `ScreensMore.jsx` |
| Audit Log | ✅ Wired | read only, no seed |
| Menu Tree | ✅ Wired | `MenuData.jsx` |
| Settings | ✅ Wired | `SettingsStore.jsx` |
| Master Data screens | ❌ Not wired | masih `__procurementStorage` |
| Languages | ❌ Static API | belum DB |
| Language Text | ❌ Static API | belum DB |
| Email Templates | ❌ Static API | belum DB |
| Email Sent | ❌ Static API | belum DB |
| Notifications | ❌ Not wired | no seed by design |

---

## 8. Work Plan Utama (Disepakati User)

### Phase 0 — Stabilize Baseline ✅

Build, test, migration, API health, data projection counts.

### Phase 1 — Application Support Backend (IN PROGRESS ~70%)

| Item | Status |
|------|--------|
| IAM read + seed + commands | ✅ |
| IAM frontend wiring | ✅ |
| Audit log (no seed) | ✅ |
| Menu + Settings persistence + wiring | ✅ |
| Master Data generic API | ✅ backend only |
| Master Data frontend wiring | ❌ next |
| Languages, Language Text, Email Templates, Email Sent | ❌ static |
| Menu Tree full CRUD (node-level) | ❌ partial (PUT whole tree only) |
| API authorization enforcement | ❌ policies exist, not applied to endpoints |

### Phase 2 — Harden Completed Modules

- Pindahkan read logic dari AppHost ke Application services
- Audit trail untuk Tracker/CIP/CM actions
- Kurangi ketergantungan bridge storage untuk reads

### Phase 3 — Vendor Invitation & Registration

- API-driven vendor invitation page
- API-driven vendor registration (`vendor.html`)
- Vendor auth cookie endpoints

### Phase 4 — Vendor Onboarding & Vendor Workspace

Menunggu mockup user selesai → freeze → sync → domain APIs.

### Phase 5 — Production Hardening

- Authorization enforcement
- Azure Blob Storage untuk dokumen
- SSO SISWarrior production config
- Performance, monitoring, deployment

---

## 9. Recommended Next Steps (Prioritas)

### Immediate (paling tepat)

1. **Wire frontend Master Data** ke generic API, mulai dataset kecil:
   - `brand` → `BrandMasterData.jsx`
   - `country` → `CountryMasterData.jsx`
   - `kbli` → `KbliMasterData.jsx`
2. **Seed master data** dari frontend seeds ke DB saat pertama load (pola sama seperti menu/settings).
3. **Hierarchy master data** setelah flat datasets:
   - Province → City → District → Village
   - Commodity, Special Requirement
4. **Languages, Language Text, Email Templates, Email Sent** — persistence + APIs + wiring.

### Setelah Phase 1

5. Authorization policies pada semua endpoint baru.
6. Audit untuk Tracker/CIP/CM domain commands.
7. Refactor AppHost endpoints → module Application services.

---

## 10. How To Run

### Backend

```powershell
cd D:\Projects\IntegratedProcurement\Code\backend
dotnet run --project src\AppHost\IntegratedProcurement.AppHost.Api.csproj --urls http://localhost:5055
```

Jika DLL terkunci atau `appsettings.json` tidak terbaca:

```powershell
cd D:\Projects\IntegratedProcurement\Code\backend\src\AppHost
$env:ASPNETCORE_ENVIRONMENT='Development'
dotnet bin\Debug\net10.0\IntegratedProcurement.AppHost.Api.dll --urls http://localhost:5055
```

**Penting:** Jalankan dari folder `AppHost` agar `DefaultConnection` terbaca.

### Frontend

```powershell
cd D:\Projects\IntegratedProcurement\Code\frontend
npm run dev -- --host 127.0.0.1 --port 8008
```

### Health Checks

```powershell
Invoke-RestMethod http://localhost:5055/api/health/ready
Invoke-RestMethod http://localhost:5055/api/v1/platform/foundation-manifest
Invoke-RestMethod http://localhost:5055/api/v1/tracker/proposals
Invoke-RestMethod http://localhost:5055/api/v1/cip/cases
Invoke-RestMethod http://localhost:5055/api/v1/contracts
Invoke-RestMethod http://localhost:5055/api/v1/administration/users
Invoke-RestMethod http://localhost:5055/api/v1/master-data/sets
```

### Stop Backend (jika DLL locked)

```powershell
$backend = netstat -ano | Select-String ':5055' | Select-Object -First 1
$parts = ($backend.ToString() -split '\s+') | Where-Object { $_ }
Stop-Process -Id ([int]$parts[-1]) -Force
```

---

## 11. Build, Test, Migration Commands

```powershell
# Backend build
cd D:\Projects\IntegratedProcurement
dotnet build Code\backend\IntegratedProcurement.slnx

# Backend test (stop API dulu jika perlu)
dotnet test Code\backend\IntegratedProcurement.slnx --no-build

# Frontend build
cd D:\Projects\IntegratedProcurement\Code\frontend
npm run build

# Migration list
cd D:\Projects\IntegratedProcurement\Code\backend
dotnet ef migrations list `
  --project src\Platform\Persistence\IntegratedProcurement.Platform.Persistence.csproj `
  --startup-project src\AppHost\IntegratedProcurement.AppHost.Api.csproj `
  --context ProcurementDbContext

# Apply migrations
dotnet ef database update `
  --project src\Platform\Persistence\IntegratedProcurement.Platform.Persistence.csproj `
  --startup-project src\AppHost\IntegratedProcurement.AppHost.Api.csproj `
  --context ProcurementDbContext
```

---

## 12. Last Verified Status

**Verified: 2026-06-23 20:52 (handover author)**

```text
Backend build:  0 warnings, 0 errors
Backend tests:  14 passed, 0 failed
Migrations:     12 listed, all present
Frontend build: passed (sesi sebelumnya; re-run jika perlu)
```

Re-run verification sebelum mengedit:

```powershell
cd D:\Projects\IntegratedProcurement
dotnet build Code\backend\IntegratedProcurement.slnx
dotnet test Code\backend\IntegratedProcurement.slnx --no-build
cd Code\frontend && npm run build
```

---

## 13. Configuration Flags

| Key | Default | Purpose |
|-----|---------|---------|
| `DataSeeding:SeedInitialIam` | `true` | Seed IAM dari mockup saat startup |
| `SSO:Enabled` | `false` (dev) | SISWarrior SSO |
| `ConnectionStrings:DefaultConnection` | LocalDB | Required |

Test factories set `DataSeeding:SeedInitialIam=false`.

---

## 14. Key Files Reference

### Backend Endpoints

```text
Code/backend/src/AppHost/Endpoints/TrackerEndpoints.cs
Code/backend/src/AppHost/Endpoints/CipEndpoints.cs
Code/backend/src/AppHost/Endpoints/ContractMonitoringEndpoints.cs
Code/backend/src/AppHost/Endpoints/AdminConsoleEndpoints.cs
Code/backend/src/AppHost/Endpoints/VendorAuthEndpoints.cs
Code/backend/src/AppHost/Endpoints/VendorInvitationEndpoints.cs
```

### Domain Entities (recent changes)

```text
Code/backend/src/Modules/ProposalTracker/Domain/TrackerProposal.cs
Code/backend/src/Modules/ProposalTracker/Domain/TrackerProposalActivity.cs
Code/backend/src/Modules/ContractIntelligentPlatform/Domain/CipCase.cs
Code/backend/src/Platform/InternalIdentity/Domain/InternalUser.cs
Code/backend/src/Platform/InternalIdentity/Domain/InternalRole.cs
Code/backend/src/Platform/Audit/Domain/AuditLogEntry.cs
Code/backend/src/Platform/Persistence/Support/MasterDataSetEntry.cs
Code/backend/src/Platform/Persistence/Support/MasterDataRecordEntry.cs
Code/backend/src/Platform/Persistence/Support/MenuTreeEntry.cs
Code/backend/src/Platform/Persistence/Support/SettingEntry.cs
```

### Seeding & Projection

```text
Code/backend/src/Platform/Persistence/Seeding/InitialIamDataSeeder.cs
Code/backend/src/Platform/Persistence/ModuleState/ModuleStateStore.cs
Code/backend/src/AppHost/ReadModels/AdminConsoleReadModels.cs
```

### Frontend Wiring

```text
Code/frontend/src/app/bootstrap/apiBackedStorage.ts
Code/frontend/src/modules/proposal-tracker/legacy/TrackerData.jsx
Code/frontend/src/modules/contract-intelligent-platform/legacy/ContractCIPData.jsx
Code/frontend/src/modules/contract-monitoring/legacy/ContractMonScreens.jsx
Code/frontend/src/modules/contract-monitoring/legacy/ContractImport.jsx
Code/frontend/src/platform/administration/legacy/ScreensUsers.jsx
Code/frontend/src/platform/administration/legacy/ScreensRoles.jsx
Code/frontend/src/platform/administration/legacy/ScreensMore.jsx
Code/frontend/src/platform/navigation/legacy/MenuData.jsx
Code/frontend/src/platform/settings/legacy/SettingsStore.jsx
Code/frontend/src/platform/data/legacy/Data.jsx
```

### Tests

```text
Code/backend/tests/AppHost/AdministrationReadEndpointTests.cs
Code/backend/tests/AppHost/DomainCommandEndpointTests.cs
Code/backend/tests/AppHost/AssemblyInfo.cs
```

---

## 15. Risks and Gotchas

1. **Jangan redesign UI** — user secara eksplisit menolak hasil redesign AI sebelumnya.
2. **Jangan modifikasi Mockup/MockupVite.**
3. **Contract Monitoring, bukan Contract Management** — jangan reintroduce nama lama.
4. **DLL lock** — stop proses di port 5055 sebelum rebuild.
5. **Test isolation** — jangan hapus DB `IntegratedProcurement` dari test; guard sudah ada tapi tetap waspada.
6. **IAM seeder** di test harus `false` agar tidak kontaminasi.
7. **Restore data CM** — jika `cm.CONTRACT_T` kosong, post ulang `ag_cm_contracts_v1` dari seed frontend via storage API.
8. **App_Data backup** — `Code/backend/src/AppHost/App_Data/frontend-state.json` berisi backup bridge state.
9. **Large base64 PDFs** di state files — hindari grep broad pada App_Data.
10. **Fire-and-forget domain posts** — UI update lokal dulu; jika API gagal, state bisa drift. Pertimbangkan error handling tanpa ubah UI.

---

## 16. User Messages Log (Penting)

| # | Ringkasan |
|---|-----------|
| 1 | Lanjutkan dari handover; verify build/test; ganti bridge dengan domain API Tracker/CIP/CM |
| 2 | Buat Work Plan enterprise; jelaskan next steps setelah setiap tugas |
| 3 | Parallel mockup: freeze → sync → map → API → replace bridge |
| 4 | UI mockup tidak boleh berubah; mockup = locked visual contract |
| 5 | Seed data harus sama dengan mockup saat pindah ke database |
| 6 | Audit & Notification: **tidak perlu seed**, biarkan kosong |
| 7 | Lanjutkan 3 poin next: Master Data wiring (Brand, Country, KBLI dulu) |

---

## 17. Suggested First Prompt For Next AI

```text
You are continuing Integrated Procurement in D:\Projects\IntegratedProcurement.
Read BOTH handover docs:
  - Code/docs/PROJECT_HANDOVER_2026-06-23.md
  - Code/docs/PROJECT_HANDOVER_2026-06-23 205254.md
Work only inside Code. Do not modify Mockup or MockupVite. Do not redesign frontend.
Module name is Contract Monitoring, not Contract Management.

First verify: backend build/test, frontend build, migration list (12), API health.
Then continue Phase 1: wire Master Data frontend screens (Brand, Country, KBLI first)
to the generic Master Data API at /api/v1/master-data/sets/{key}.
Seed initial master data from frontend seeds when DB is empty (same as mockup).
Audit and Notification must NOT be seeded with dummy data.
```

---

## 18. Quick Verification Checklist

```powershell
# 1. Build & test
cd D:\Projects\IntegratedProcurement
dotnet build Code\backend\IntegratedProcurement.slnx
dotnet test Code\backend\IntegratedProcurement.slnx --no-build

# 2. Frontend
cd Code\frontend
npm run build

# 3. Migrations (expect 12)
cd ..\backend
dotnet ef migrations list --project src\Platform\Persistence\IntegratedProcurement.Platform.Persistence.csproj --startup-project src\AppHost\IntegratedProcurement.AppHost.Api.csproj --context ProcurementDbContext

# 4. Naming check (should find no active Contract Management references)
rg -n --glob '!**/bin/**' --glob '!**/obj/**' --glob '!**/dist/**' --glob '!**/node_modules/**' --glob '!**/PROJECT_HANDOVER*.md' "Contract Management|ContractManagement|contract-management" Code

# 5. Start API & smoke test
cd src\AppHost
dotnet bin\Debug\net10.0\IntegratedProcurement.AppHost.Api.dll --urls http://localhost:5055
# In another terminal:
Invoke-RestMethod http://localhost:5055/api/health/ready
Invoke-RestMethod http://localhost:5055/api/v1/administration/users
Invoke-RestMethod http://localhost:5055/api/v1/master-data/sets/brand
```

---

## 19. Definition of Done (per task)

Selesai jika:

1. Backend build 0 errors, tests pass.
2. Frontend build pass.
3. UI tidak berubah secara visual (bandingkan dengan mockup).
4. Data persist ke database, seed tersedia jika modul membutuhkan data awal.
5. Integration test ditambahkan untuk endpoint baru (jika applicable).
6. Handover/next steps dijelaskan ke user.

---

*End of handover document.*
