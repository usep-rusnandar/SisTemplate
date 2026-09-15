# Project Handover - Integrated Procurement

**Date:** 2026-06-24 (UTC+7)
**Prepared by:** Claude (Claude Code, Opus 4.8)
**Previous handovers:**
- `Code/docs/PROJECT_HANDOVER_2026-06-23.md` (architecture baseline)
- `Code/docs/PROJECT_HANDOVER_2026-06-23 205254.md` (Phase 1 application support)
**Project Root:** `D:\Projects\IntegratedProcurement`
**Active Implementation Root:** `D:\Projects\IntegratedProcurement\Code`

Dokumen ini melanjutkan dua handover sebelumnya. Baca ketiganya. Handover ini mencakup:
1. Pekerjaan sesi pagi 2026-06-24 yang **tidak terdokumentasi** (handover #3 yang hilang).
2. Pekerjaan sesi ini: **Authorization halus, Audit, dan Notification**.

---

## 1. Critical Working Rules (tetap berlaku)

1. Kerja **hanya** di `D:\Projects\IntegratedProcurement\Code`.
2. **Jangan** modifikasi `Mockup` / `MockupVite` (folder referensi user).
3. **Jangan redesign frontend** — mockup = locked visual contract. Perubahan FE hanya wiring data.
4. Modul = **Contract Monitoring** (schema `cm`), bukan Contract Management.
5. Tanpa `localStorage`/`sessionStorage`/IndexedDB di source aktif (lewat `window.__procurementStorage`).
6. Seed awal harus sama dengan mockup. **Audit & Notification TIDAK di-seed dummy** — diisi dari aktivitas sistem nyata.
7. Port: FE `8008`, BE `5055`.
8. **(BARU) Vendor Workspace & Vendor Onboarding di-skip** atas permintaan user. Login eksternal/vendor tidak dikerjakan dulu. Fokus user internal.

---

## 2. Status Verifikasi Terakhir (2026-06-24)

```text
Backend build : 0 error (1 warning pre-existing: CA1859 di AdminConsoleCommunicationService.cs)
Backend tests : 28 passed, 0 failed
Frontend build: passed
Migrations    : 14 applied
Runtime smoke : OK (auth enforcement + notification lifecycle terverifikasi via curl)
```

---

## 3. Pekerjaan Sesi Pagi 2026-06-24 (handover #3 yang hilang)

Dilakukan setelah handover #2 (23 Jun 20:52), sebelum sesi ini:

- **Master Data — frontend wiring SELESAI.** `BrandMasterData.jsx` dkk memakai `/api/v1/master-data/sets/{key}` (fallback `__procurementStorage`).
- **Communication backend BARU.** Migration `20260623151502_AddCommunicationTables` (Languages, Language Text, Email Templates, Email Sent di schema `core`). `AdminConsoleCommunicationService.cs` + wiring `ScreensLang.jsx`, `ScreensEmail.jsx`.
- **`InitialPlatformDataSeeder.cs` BARU.** Seed master data hierarki (Province→City→District→Village, Commodity, Special Requirement) dengan membaca langsung file seed `.jsx` frontend (`FrontendSeedFileLoader`). Flag `DataSeeding:SeedInitialPlatformData` (default `true`).
- **Refactor AdminConsole** → 7 service (`AdminConsole{Audit,Configuration,Communication,IdentityRead,MasterData,UserManagement,RoleManagement}Service.cs`). Endpoint jadi tipis.
- **Internal Auth & SSO implementasi penuh.** `Program.cs`: cookie auth + session + policy `InternalUser`/`VendorUser` + `UseInternalSso()`. `SsoMiddleware.cs`: dev-session saat `SSO:Enabled=false`, callback JWT + mapping NRP→PersonnelNo saat aktif. `InternalAuthEndpoints.cs`: `dev-login`. Frontend `App.jsx` + `internal.ts`: flow login nyata (`checking→login→app`).

---

## 4. Pekerjaan Sesi Ini (2026-06-24) — 3 Prioritas

### 4.1 Prioritas 1 — Authorization Halus (semua modul) ✅

Sebelumnya hanya coarse (`RequireAuthorization(InternalUser)` = sembarang user internal). Sekarang **per-permission**.

**Infrastruktur baru** (`src/AppHost/Auth/`):
- `PermissionRequirement.cs`, `PermissionAuthorizationHandler.cs` (cek claim `permission` + actor internal).
- `PermissionPolicyProvider.cs` — `IAuthorizationPolicyProvider` dinamis: policy bernama `perm:{key}` dibangun on-demand.
- `PermissionEndpointExtensions.cs` — `.RequirePermission("key")`.
- Terdaftar di `Program.cs` (`AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>`, `AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>`).

**Permission keys baru** (di `InitialIamDataSeeder.cs`, total kini 32):
```text
tracker.view/manage      (module: proposal-tracker)
cip.view/manage          (module: contract-intelligent-platform)
contracts.view/manage    (module: contract-monitoring)
masterdata.view/manage   (module: master-data)
```

**Pemetaan role→permission** — pemetaan posisional lama (`Take(PermissionCount)`, salah: mis. Officer Tracker dapat `users.delete`) **diganti pemetaan eksplisit per role-code**. Super Admin = semua (sentinel `null`). Officer/Section/Admin modul = `{module}.view/manage` + `dashboard.view` + read admin terkait.

**Enforcement per-endpoint:**
- Tracker/CIP/CM: grup = `*.view`, command = `*.manage`.
- AdminConsole: dipetakan ke key yang sudah ada (`users.view/create/...`, `roles.*`, `audit.view`, `settings.*`, `languages.*`, `email.*`, `masterdata.*`).

**Terverifikasi runtime:** Super Admin (32 perm) tembus semua; Officer Tracker (`dashboard.view`,`tracker.view`,`tracker.manage`) → tracker 200, cip/contracts/admin/super-admin 403; anonim 401.

### 4.2 Prioritas 2 — Audit Trail Tracker/CIP/CM ✅

Mayoritas command sudah menulis audit (sesi sebelumnya). Sesi ini menambal celah:
- CIP `final-contract`, CIP `recycle`.
- CM `imports`.

Semua command modul kini memanggil `IAdminConsoleAuditService.WriteAuditAsync`. Diverifikasi `DomainCommandEndpointTests` (assert audit tertulis).

### 4.3 Prioritas 3 — Notification (event-driven) ✅

Rancangan: **per-user, dibangkitkan event nyata, tanpa seed dummy.**

**Skema** (migration `20260624052741_AddNotificationTables`):
- `core.NOTIFICATION_T` — Severity, Title, Detail, AudienceScope (`all|role|user`), AudienceRoles (CSV), AudienceUser (username = email local-part), AudienceLabel, Module, LinkPath, CreatedBy, CreatedAt.
- `core.NOTIFICATION_RECIPIENT_STATE_T` — read/dismiss per (NotificationId, PersonnelNo).

**Backend:**
- `src/AppHost/Services/NotificationService.cs` — `INotificationService`: `GetForCurrentActorAsync`, `MarkRead/Unread/AllRead`, `Dismiss`, `NotifyAllAsync`, `NotifyModuleAsync`. Visibility difilter server-side (audience). `NotifyModuleAsync(moduleKey,...)` → role-scoped ke role yang `ModuleKey==moduleKey` ATAU `IsSystem` (Super Admin).
- `src/AppHost/Endpoints/NotificationEndpoints.cs` — grup `/api/v1/notifications` (InternalUser):
  ```text
  GET    /api/v1/notifications            → { items:[...], unread }
  POST   /api/v1/notifications/{id}/read
  POST   /api/v1/notifications/{id}/unread
  POST   /api/v1/notifications/read-all
  DELETE /api/v1/notifications/{id}       (dismiss per-user)
  ```
- Didaftarkan di `Program.cs` (`AddScoped<INotificationService>`, `MapNotificationEndpoints`).

**Event yang membangkitkan notifikasi:**

Role-scoped ke tim modul (via `NotifyModuleAsync`):
- Tracker: `distribute` (Proposal Tracker), `loa-documents` generate (notif ke CIP — LOA siap).
- CIP: `cases/from-loa`, `final-contract`.
- CM: `reminders/send`, `reminders/run-scan` (warning bila ada eskalasi).

Direct ke satu user (via `NotifyAssignedUserAsync`, resolve nama→username, fallback role bila tak ketemu):
- Tracker: `reassign-officer` → notif Direct ke officer yang ditugaskan.

Admin events role-scoped ke pemegang permission (via `NotifyPermissionHoldersAsync`):
- `users.view` holders: user dibuat (info), status user diubah (warning bila Suspended).
- `roles.view` holders: permission role diubah.
- `settings.view` holders: setting platform diubah.

Announcement ke semua (via `NotifyAllAsync`):
- Languages diubah → announcement `all`.

Method service: `NotifyModuleAsync`, `NotifyUserAsync`, `NotifyAssignedUserAsync`, `NotifyPermissionHoldersAsync`, `NotifyAllAsync`. Semua audience type (all/role/user) sudah dipakai & terverifikasi runtime.

**Frontend** (`src/platform/notifications/legacy/Notifications.jsx`):
- Di-rewire dari seed dummy `NOTIF_FULL` + `__procurementStorage` → fetch `/api/v1/notifications`.
- `markRead/markUnread/toggleRead/markAllRead/remove` → API (optimistic + fire-and-forget, pola `console.warn` saat gagal).
- Kontrak context (items, allItems, unread, dst.) **tidak berubah** → Shell/Dashboard/ScreensMore tidak disentuh. UI identik.
- `NOTIF_FULL` masih ada di `Data.jsx` tapi **tidak lagi dipakai** (aman).

**Terverifikasi runtime:** feed awal kosong → `distribute` membuat notif role-scoped → Officer Tracker (anggota role tracker) ikut melihat → read (unread→0) → dismiss (hilang).

---

## 5. Daftar Migration (14)

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
20260623151502_AddCommunicationTables
20260624052741_AddNotificationTables   ← BARU sesi ini
```

---

## 6. Gotchas Penting (BARU)

1. **LocalDB rapuh di mesin ini.** `MSSQLLocalDB` sempat crash saat startup di tengah sesi ("SQL Server process failed to start", error `0x89c5010a`) — recovery DB proyek lain (EnterpriseStarter, PROCUREMENT_DB) lalu mati. Memblok test + app. Pulih sendiri/oleh user setelahnya. **Jangan delete/recreate instance** (dipakai bersama proyek lain). Bila start gagal: coba `sqllocaldb stop MSSQLLocalDB -k` lalu `start`, atau restart mesin.

2. **Harness integration test berbagi env var global** `ConnectionStrings__DefaultConnection` antar test class → kontaminasi silang. **Setiap test class WAJIB seed IAM-nya sendiri** (`SeedInitialIamDataAsync`) supaya dev-login `P-00001` jalan & Super Admin punya permission. `DomainCommandEndpointTests` dulu lolos hanya karena bocoran env var dari `AdministrationReadEndpointTests`; sudah diperbaiki untuk self-seed.

3. **Seeder add-only/idempotent.** Mengubah pemetaan role→permission TIDAK menghapus baris lama. Setelah perbaikan mapping, `iam.ROLE_PERMISSION_T` di dev DB **dibersihkan sekali** (220 baris) agar reseed saat startup menghasilkan mapping benar. Jika ada edit permission role via UI, itu ter-reset ke baseline seed.

4. **dev-login** (`POST /api/v1/internal/auth/dev-login`) butuh PersonnelNo ada di `iam.USER_T`.

5. **Test assertion yang diupdate** akibat permission/permission-group bertambah: `AdministrationReadEndpointTests` — Super Admin permissions 23→**32**, permission groups 8→**12**; `AdministrationReadEndpointsReturnIamDatabaseDataWhenPresent` kini seed IAM penuh + assertion `Single`→`Contains`.

---

## 7. File Kunci (Sesi Ini)

```text
Backend — Authorization
  src/AppHost/Auth/AuthorizationPolicies.cs        (Permission(key) helper)
  src/AppHost/Auth/PermissionRequirement.cs
  src/AppHost/Auth/PermissionAuthorizationHandler.cs
  src/AppHost/Auth/PermissionPolicyProvider.cs
  src/AppHost/Auth/PermissionEndpointExtensions.cs
  src/Platform/Persistence/Seeding/InitialIamDataSeeder.cs   (perm keys + role mapping)
  src/AppHost/Endpoints/{Tracker,Cip,ContractMonitoring,AdminConsole}Endpoints.cs (RequirePermission)
  src/AppHost/Program.cs

Backend — Notifications
  src/Platform/Persistence/Support/NotificationEntries.cs
  src/Platform/Persistence/Configurations/SupportConfiguration.cs (Notification configs)
  src/Platform/Persistence/ProcurementDbContext.cs              (DbSets)
  src/AppHost/Services/NotificationService.cs
  src/AppHost/Endpoints/NotificationEndpoints.cs
  src/Platform/Persistence/Migrations/20260624052741_AddNotificationTables.cs

Frontend
  src/platform/notifications/legacy/Notifications.jsx

Tests
  tests/AppHost/PermissionEnforcementTests.cs   (BARU)
  tests/AppHost/NotificationLifecycleTests.cs   (BARU)
  tests/AppHost/DomainCommandEndpointTests.cs   (fix: self-seed IAM)
  tests/AppHost/AdministrationReadEndpointTests.cs (assertion updates)
```

---

## 8. How To Run / Verify

```powershell
# Build + test
cd D:\Projects\IntegratedProcurement
dotnet build Code\backend\IntegratedProcurement.slnx
dotnet test  Code\backend\IntegratedProcurement.slnx --no-build

# Frontend build
cd Code\frontend ; npm run build

# Apply migrations
cd ..\backend
dotnet ef database update --project src\Platform\Persistence\IntegratedProcurement.Platform.Persistence.csproj --startup-project src\AppHost\IntegratedProcurement.AppHost.Api.csproj --context ProcurementDbContext

# Run API (dari folder AppHost agar connection string terbaca)
cd src\AppHost
$env:ASPNETCORE_ENVIRONMENT='Development'
dotnet bin\Debug\net10.0\IntegratedProcurement.AppHost.Api.dll --urls http://localhost:5055

# Smoke (terminal lain) — dev-login + cek permission/notifikasi
$jar = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod -WebSession $jar -Method Post http://localhost:5055/api/v1/internal/auth/dev-login -ContentType application/json -Body '{"personnelNo":"P-00001"}'
Invoke-RestMethod -WebSession $jar http://localhost:5055/api/v1/notifications
```

---

## 9. Recommended Next Work

1. **Notifikasi: polish lanjutan** — event Direct (reassign), event Admin (user/role/settings), dan announcement (languages) SUDAH ditambahkan (§4.3). Sisa opsi: badge auto-refresh (polling ringan) bila diinginkan; perluas Direct ke event lain (mis. distribute langsung ke officer).
2. **Audit untuk admin commands** sudah ada; pertimbangkan audit untuk notifikasi-trigger bila perlu jejak.
3. **Authorization vendor** — ditunda (vendor di-skip). Saat vendor diaktifkan kembali: terapkan `VendorUser` policy + role vendor.
4. **Refactor read logic AppHost → Application services** (Priority 2 lama handover #1) untuk Tracker/CIP/CM.
5. **Bereskan warning CA1859** di `AdminConsoleCommunicationService.cs` bila ingin 0-warning.
6. **Production hardening** — Azure Blob untuk dokumen, SSO SISWarrior production, dll.

---

## 10. Definition of Done (per task) — tetap

1. Backend build 0 error, tests pass.
2. Frontend build pass.
3. UI tidak berubah visual (bandingkan mockup).
4. Data persist; seed bila modul butuh data awal; Audit/Notification TIDAK di-seed.
5. Integration test ditambahkan untuk endpoint baru.
6. Handover/next steps dijelaskan.

---

*End of handover document.*
