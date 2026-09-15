# Integrated Procurement - Project Handover

Last updated: 2026-06-23  
Workspace root: `D:\Projects\IntegratedProcurement`  
Active implementation root: `D:\Projects\IntegratedProcurement\Code`

This document is the handover entry point for continuing the project with another AI assistant or engineer.

## 1. Critical Working Rules

- Work only inside `D:\Projects\IntegratedProcurement\Code`.
- Do not modify `D:\Projects\IntegratedProcurement\Mockup` or `D:\Projects\IntegratedProcurement\MockupVite`; those are user-owned reference/mockup folders.
- Frontend visual design and workflow must remain the same as the mockup, especially completed modules.
- Do not redesign the frontend.
- Replace browser persistence with backend APIs. Do not reintroduce direct `localStorage`, `sessionStorage`, or IndexedDB usage.
- The module name is **Contract Monitoring**, not Contract Management.
- Schema `cm` means **Contract Monitoring**.
- Frontend dev port is `8008`.
- Backend API port is `5055`.

## 2. Product Context

Application: Integrated Procurement

Main stack:

- Backend: ASP.NET Core 10 modular monolith, EF Core, SQL Server LocalDB.
- Frontend: React, Vite, TypeScript, legacy mockup modules loaded through a Vite shell.
- Database: SQL Server LocalDB database `IntegratedProcurement`.

Completed business modules in the mockup and current backend focus:

- Proposal Tracker
- Contract Intelligent Platform, also called CIP
- Contract Monitoring

Other modules exist and are partially supported:

- Vendor Workspace
- Vendor Onboarding
- Super Admin
- Administration
- Master Data

## 3. Current Folder Structure

Top-level target structure:

```text
Code/
  backend/
  docs/
  frontend/
  tools/
```

Important backend paths:

```text
Code/backend/IntegratedProcurement.slnx
Code/backend/src/AppHost
Code/backend/src/Modules/ProposalTracker
Code/backend/src/Modules/ContractIntelligentPlatform
Code/backend/src/Modules/ContractMonitoring
Code/backend/src/Modules/VendorOnboarding
Code/backend/src/Platform/Persistence
Code/backend/tests/AppHost
```

Important frontend paths:

```text
Code/frontend
Code/frontend/src/app/bootstrap/apiBackedStorage.ts
Code/frontend/src/modules/proposal-tracker
Code/frontend/src/modules/contract-intelligent-platform
Code/frontend/src/modules/contract-monitoring
Code/frontend/src/platform
Code/frontend/src/shared
```

Important docs:

```text
Code/docs/phase-1-architecture.md
Code/docs/phase-2-manifest-and-contracts.md
Code/docs/phase-3-foundation-skeleton.md
Code/docs/phase-4-data-auth-foundation.md
Code/docs/phase-5-vendor-invitation-registration-flow.md
Code/docs/phase-6-completed-modules-api-driven-frontend.md
Code/docs/phase-7-admin-master-data-console.md
Code/docs/database-conventions.md
Code/docs/frontend-backend-feature-checklist.md
```

## 4. What Has Been Done

### Phase 1 - Architecture

Architecture documentation exists in:

```text
Code/docs/phase-1-architecture.md
```

Core decisions:

- Clean architecture direction.
- Modular backend aligned to frontend modules.
- Internal users and vendor users are separate identity domains.
- Internal users use SISWarrior custom SSO and `PersonnelNo` as internal identity.
- Vendor users use ASP.NET Core Identity.
- Database schemas are separated by domain ownership.

### Phase 2 - Manifest and Contracts

Manifest/contracts documentation exists in:

```text
Code/docs/phase-2-manifest-and-contracts.md
```

This defines:

- Backend solution shape.
- MVP file manifest.
- API contract direction.
- Module mapping.

### Phase 3 - Foundation Skeleton

Backend and frontend skeleton exist and build.

Key backend pieces:

- AppHost API.
- Health endpoints.
- Foundation manifest endpoint.
- Internal auth stub/dev auth.
- Vendor auth foundation.
- Modular project references.

Foundation manifest endpoint:

```text
GET /api/v1/platform/foundation-manifest
```

Current manifest includes:

- `tracker`
- `cip`
- `contract-monitoring`
- `vendor-invitations`
- `super-admin`
- `administration`
- `master-data`

### Phase 4 - Data/Auth Foundation

Implemented:

- Database schemas:
  - `core`
  - `iam`
  - `vdr`
  - `trk`
  - `cip`
  - `cm`
- PascalCase database column convention.
- `_T` table suffix convention.
- Internal SSO option structure.
- Internal user access function.
- Vendor Identity foundation with ASP.NET Core Identity tables under `vdr`.
- CORS configured for frontend port `8008`.

SSO note:

- `SSO:Enabled = false` supports local development.
- `SSO:Enabled = true` is intended for SISWarrior integration.
- Internal user identity rule: map NRP to `PersonnelNo`; do not use NRP beyond mapping layer.

### Phase 5 - Vendor Invitation Registration Flow

Implemented backend foundation for invitation-based vendor registration:

- Vendor users use ASP.NET Core Identity.
- Vendor users are separate from internal users.
- Vendor invitation endpoints exist.
- Password reset endpoints exist.
- Vendor registration is invitation-based.

Important endpoint families:

```text
/api/v1/vendor/auth
/api/v1/vendor/invitations
/api/v1/vendor/registration
```

Check exact current routes in:

```text
Code/backend/src/AppHost/Endpoints/VendorAuthEndpoints.cs
Code/backend/src/AppHost/Endpoints/VendorInvitationEndpoints.cs
```

### Phase 6 - Completed Modules API-Driven Frontend

The three completed modules are API-backed:

- Proposal Tracker
- CIP
- Contract Monitoring

Important endpoint families:

```text
/api/v1/tracker
/api/v1/cip
/api/v1/contracts
```

The frontend keeps the mockup look/workflow but no longer directly uses browser storage. Instead, legacy storage calls go through:

```text
Code/frontend/src/app/bootstrap/apiBackedStorage.ts
```

Storage routes:

```text
ag_tracker_* -> /api/v1/tracker/storage
ag_cip_*     -> /api/v1/cip/storage
ag_cm_*      -> /api/v1/contracts/storage
other keys   -> /api/v1/frontend-state
```

### Phase 7 - Admin and Master Data Console

Read-model/API foundation exists for:

- Super Admin
- Administration
- Master Data

These are not yet fully normalized domain modules. Current implementation is mostly read-model/data surface for frontend compatibility.

## 5. Database Status

Connection string:

```json
"DefaultConnection": "Server=(localdb)\\MSSQLLocalDB;Database=IntegratedProcurement;Trusted_Connection=True;TrustServerCertificate=True"
```

Defined schema ownership:

```text
core = shared/platform technical tables
iam  = internal identity / SSO / PersonnelNo
vdr  = vendor identity / invitation / vendor profile
trk  = Proposal Tracker
cip  = Contract Intelligent Platform
cm   = Contract Monitoring
```

Important normalized tables:

```text
trk.STATE_T
trk.PROPOSAL_T
trk.PROPOSAL_ACTIVITY_T
trk.LOA_DOCUMENT_T

cip.STATE_T
cip.CASE_T
cip.CASE_DOCUMENT_T
cip.CASE_ACTIVITY_T

cm.STATE_T
cm.CONTRACT_T
cm.CONTRACT_VERSION_T
cm.REMINDER_T
```

Current migration list:

```text
20260622011116_InitialIdentityAndVendorFoundation
20260623013438_AddFrontendStateTable
20260623024544_MoveTablesToDomainSchemasAndPascalColumns
20260623030755_RenameIamInternalTables
20260623035136_AddModuleDomainStateStores
20260623064933_AddTrackerDomainTables
20260623071046_AddCipDomainTables
20260623074110_AddContractMonitoringDomainTables
```

Last verified normalized data counts:

```text
trk.PROPOSAL_T           = 50
cip.CASE_T               = 41
cm.CONTRACT_T            = 100
cm.CONTRACT_VERSION_T    = 132
cm.REMINDER_T            = 0
```

`cm.REMINDER_T` is empty because no reminder send/scan action has been executed in the UI since the normalized projection was added.

## 6. Projection Strategy

The current backend still uses a transitional storage bridge for legacy mockup workflow state, but completed modules now project that state into domain tables.

### Tracker

Store key:

```text
ag_tracker_rebuild_v14
```

Projection target:

```text
trk.PROPOSAL_T
trk.PROPOSAL_ACTIVITY_T
trk.LOA_DOCUMENT_T
```

Read endpoints use normalized tables when data exists.

### CIP

Store key:

```text
ag_cip_store_v7
```

Projection target:

```text
cip.CASE_T
cip.CASE_DOCUMENT_T
cip.CASE_ACTIVITY_T
```

Read endpoints use normalized tables when data exists.

Current caveat:

- `cip.CASE_ACTIVITY_T` can be empty if the current `ag_cip_store_v7` payload has no `activityHistory`.

### Contract Monitoring

Store keys:

```text
ag_cm_contracts_v1
ag_cm_reminders_v1
```

Projection target:

```text
cm.CONTRACT_T
cm.CONTRACT_VERSION_T
cm.REMINDER_T
```

Important rule:

- `ag_cm_contracts_v1` contains raw contract document rows.
- Duplicate `contractId` rows are merged into one record in `cm.CONTRACT_T`.
- All original/amendment rows remain in `cm.CONTRACT_VERSION_T`.
- This mirrors the mockup's distinct Contract No rule.

Projection code:

```text
Code/backend/src/Platform/Persistence/ModuleState/ModuleStateStore.cs
```

## 7. Current Backend Endpoints

Health:

```text
GET /api/health/live
GET /api/health/ready
```

Platform:

```text
GET /api/v1/platform/foundation-manifest
GET /api/v1/frontend-state
```

Internal auth:

```text
GET  /api/v1/internal/auth/me
POST /api/v1/internal/auth/dev-login
POST /api/v1/internal/auth/logout
```

Tracker:

```text
GET  /api/v1/tracker/dashboard
GET  /api/v1/tracker/proposals
GET  /api/v1/tracker/proposals/{proposalId}
GET  /api/v1/tracker/loa-documents
GET  /api/v1/tracker/storage
PUT  /api/v1/tracker/storage/{key}
DELETE /api/v1/tracker/storage/{key}
POST /api/v1/tracker/proposals/{proposalId}/distribute
POST /api/v1/tracker/proposals/{proposalId}/activities/{activityId}/clock-in
POST /api/v1/tracker/proposals/{proposalId}/activities/{activityId}/complete
POST /api/v1/tracker/proposals/{proposalId}/activities/{activityId}/recycle
POST /api/v1/tracker/proposals/{proposalId}/activities/{activityId}/cancel
POST /api/v1/tracker/proposals/{proposalId}/reassign-officer
POST /api/v1/tracker/proposals/{proposalId}/activities/{activityId}/loa-documents
```

CIP:

```text
GET  /api/v1/cip/dashboard
GET  /api/v1/cip/loa-inbox
GET  /api/v1/cip/cases
GET  /api/v1/cip/cases/{caseId}
GET  /api/v1/cip/templates
GET  /api/v1/cip/repository
GET  /api/v1/cip/authorization-master
GET  /api/v1/cip/storage
PUT  /api/v1/cip/storage/{key}
DELETE /api/v1/cip/storage/{key}
POST /api/v1/cip/cases/from-loa
POST /api/v1/cip/cases/{caseId}/verify
POST /api/v1/cip/cases/{caseId}/termsheet/generate
POST /api/v1/cip/cases/{caseId}/template/select
POST /api/v1/cip/cases/{caseId}/draft/generate
POST /api/v1/cip/cases/{caseId}/final-contract
POST /api/v1/cip/cases/{caseId}/recycle
```

Contract Monitoring:

```text
GET  /api/v1/contracts/dashboard
GET  /api/v1/contracts
GET  /api/v1/contracts/{contractId}
GET  /api/v1/contracts/expiry
GET  /api/v1/contracts/reminders
GET  /api/v1/contracts/storage
PUT  /api/v1/contracts/storage/{key}
DELETE /api/v1/contracts/storage/{key}
POST /api/v1/contracts
POST /api/v1/contracts/{contractId}/versions
POST /api/v1/contracts/{contractId}/reminders/send
POST /api/v1/contracts/reminders/run-scan
POST /api/v1/contracts/imports
```

Admin/Master Data:

```text
/api/v1/super-admin/*
/api/v1/administration/*
/api/v1/master-data/*
```

See:

```text
Code/backend/src/AppHost/Endpoints/AdminConsoleEndpoints.cs
```

## 8. Frontend Status

Frontend root:

```text
Code/frontend
```

Port:

```text
8008
```

Important facts:

- The frontend was copied from `MockupVite` into `Code/frontend`.
- The current goal is to preserve mockup appearance and workflow exactly.
- Legacy modules still exist, but their storage is redirected through backend APIs via `window.__procurementStorage`.
- Contract Monitoring folder is now `src/modules/contract-monitoring`.
- There should be no direct `localStorage`, `sessionStorage`, or IndexedDB usage in active frontend source.

Important bootstrap file:

```text
Code/frontend/src/app/bootstrap/apiBackedStorage.ts
```

If mockup changes need to be synced later, inspect:

```text
Code/frontend/scripts/sync-mockup.mjs
```

The sync script references Contract Monitoring paths and should not write to `MockupVite`; it should only copy from reference folders into `Code/frontend` when intentionally used.

## 9. How To Run

Backend:

```powershell
cd D:\Projects\IntegratedProcurement\Code\backend
dotnet run --project src\AppHost\IntegratedProcurement.AppHost.Api.csproj --urls http://localhost:5055
```

If `dotnet run` hits Windows apphost access/lock issues, run the DLL directly:

```powershell
cd D:\Projects\IntegratedProcurement
$env:ASPNETCORE_ENVIRONMENT='Development'
dotnet Code\backend\src\AppHost\bin\Debug\net10.0\IntegratedProcurement.AppHost.Api.dll --urls http://localhost:5055
```

Frontend:

```powershell
cd D:\Projects\IntegratedProcurement\Code\frontend
npm run dev -- --host 127.0.0.1 --port 8008
```

Health checks:

```powershell
Invoke-RestMethod http://localhost:5055/api/health/ready
Invoke-RestMethod http://localhost:5055/api/v1/platform/foundation-manifest
Invoke-RestMethod http://localhost:5055/api/v1/tracker/proposals
Invoke-RestMethod http://localhost:5055/api/v1/cip/cases
Invoke-RestMethod http://localhost:5055/api/v1/contracts
```

Port checks:

```powershell
netstat -ano | Select-String ':5055'
netstat -ano | Select-String ':8008'
```

## 10. Build, Test, Migration Commands

Backend build:

```powershell
cd D:\Projects\IntegratedProcurement
dotnet build Code\backend\IntegratedProcurement.slnx
```

Backend test:

```powershell
cd D:\Projects\IntegratedProcurement
dotnet test Code\backend\IntegratedProcurement.slnx --no-build
```

Frontend build:

```powershell
cd D:\Projects\IntegratedProcurement\Code\frontend
npm run build
```

Migration list:

```powershell
cd D:\Projects\IntegratedProcurement\Code\backend
dotnet ef migrations list --project src\Platform\Persistence\IntegratedProcurement.Platform.Persistence.csproj --startup-project src\AppHost\IntegratedProcurement.AppHost.Api.csproj --context ProcurementDbContext
```

Apply database migrations:

```powershell
cd D:\Projects\IntegratedProcurement\Code\backend
dotnet ef database update --project src\Platform\Persistence\IntegratedProcurement.Platform.Persistence.csproj --startup-project src\AppHost\IntegratedProcurement.AppHost.Api.csproj --context ProcurementDbContext
```

If build fails because files are locked by a running backend, stop the PID listening on `5055`:

```powershell
$backend = netstat -ano | Select-String ':5055' | Select-Object -First 1
$parts = ($backend.ToString() -split '\s+') | Where-Object { $_ }
Stop-Process -Id ([int]$parts[-1]) -Force
```

## 11. Last Verified Status

Last verified by Codex on 2026-06-23:

```text
Backend build: 0 warnings, 0 errors
Backend tests: 5 passed
Frontend build: passed
Backend live: http://localhost:5055
Frontend live: http://localhost:8008
Foundation manifest module: contract-monitoring / Contract Monitoring / /contract-monitoring
Tracker proposals API count: 50
CIP cases API count: 41
Contract Monitoring contracts API count: 100
```

## 12. Important Recent Correction

The module previously referred to as "Contract Management" was corrected to **Contract Monitoring**.

Renamed source/module concepts:

```text
Code/backend/src/Modules/ContractMonitoring
IntegratedProcurement.Modules.ContractMonitoring.*
Code/backend/src/AppHost/Endpoints/ContractMonitoringEndpoints.cs
Code/backend/src/Platform/Persistence/Configurations/ContractMonitoringDomainConfiguration.cs
Code/frontend/src/modules/contract-monitoring
```

Migration name was also corrected:

```text
20260623074110_AddContractMonitoringDomainTables
```

Do not reintroduce:

```text
Contract Management
ContractManagement
contract-management
```

## 13. Known Transitional Design

The app is intentionally in a bridge-to-domain stage.

Current reality:

- Frontend legacy workflow remains the source of exact UI/workflow behavior.
- Backend stores frontend workflow state through module storage endpoints.
- Backend then projects important completed-module state into normalized domain tables.
- Some command endpoints still return accepted/read-model outcomes rather than full domain command handling.
- Admin/Master Data are still mostly read-model endpoints.

This is acceptable for the current stage because the top priority is:

1. Keep the completed mockup UI/workflow intact.
2. Make it run against backend data.
3. Gradually replace bridge state with real domain APIs per module.

## 14. Recommended Next Work

### Priority 1 - Convert Bridge Writes Into Real Domain Commands

Start with completed modules only:

1. Proposal Tracker
2. CIP
3. Contract Monitoring

For each action currently handled by frontend state mutation, create backend command endpoints that:

- validate request payload,
- update normalized domain tables,
- write audit trail,
- return updated read model,
- keep frontend workflow unchanged.

High-priority actions:

- Tracker distribute proposal.
- Tracker clock-in / complete / recycle / cancel activity.
- Tracker LOA generation and handoff to CIP.
- CIP case creation from LOA.
- CIP termsheet generation.
- CIP draft/final contract handling.
- Contract Monitoring reminder send and daily scan.
- Contract Monitoring import/migration workflow.

### Priority 2 - Replace AppHost Read Models With Module Application Services

Move read logic out of AppHost endpoint files into application services.

Target direction:

```text
Modules/ProposalTracker/Application
Modules/ContractIntelligentPlatform/Application
Modules/ContractMonitoring/Application
```

Endpoints should become thin routing/controller surfaces.

### Priority 3 - Audit Logging

Add audit trail for:

- auth/session events,
- vendor invitation attempts,
- Tracker lifecycle actions,
- CIP document generation and approval/recycle actions,
- Contract Monitoring reminder sends and import batches.

### Priority 4 - Authorization

Add API-level authorization policies:

- internal SSO personnel roles/permissions for internal modules,
- ASP.NET Identity roles for vendor users,
- strict separation between internal users and vendor users.

Important:

- Internal users must not use ASP.NET Identity tables.
- Vendor users must not use `PersonnelNo`.

### Priority 5 - Document Storage

Future document storage should use Azure Blob Storage / Azure Storage, not database blobs.

Recommended model:

- Store files in Azure Storage.
- Store metadata in module/domain tables.
- Keep document ownership clear by module/domain.

The schema `doc` was discussed conceptually, but current implementation does not yet need it unless a shared document metadata domain is added.

## 15. Risks and Gotchas

- Do not redesign frontend screens; the user explicitly rejected redesign.
- Do not modify `Mockup` or `MockupVite`.
- Do not change Contract Monitoring back to Contract Management.
- Be careful with generated EF migrations after namespace renames.
- If renaming migrations after applying them locally, ensure `__EFMigrationsHistory` is consistent.
- LocalDB may retain previous test data. Always verify counts and API behavior.
- Windows may lock backend DLLs if the API is running; stop port `5055` before rebuild or cleanup.
- Some large state files include embedded base64 PDFs; avoid broad noisy searches over `App_Data` unless necessary.

## 16. Suggested First Prompt For The Next AI

Use something like this:

```text
You are continuing an Integrated Procurement project in D:\Projects\IntegratedProcurement.
Read Code/docs/PROJECT_HANDOVER_2026-06-23.md first.
Work only inside Code.
Do not modify Mockup or MockupVite.
Do not redesign the frontend.
The module is Contract Monitoring, not Contract Management.
First verify backend build/test, frontend build, migration list, and API health.
Then continue replacing bridge state with real backend domain APIs for Tracker, CIP, and Contract Monitoring.
```

## 17. Quick Verification Checklist For The Next AI

Run these before editing:

```powershell
cd D:\Projects\IntegratedProcurement
dotnet build Code\backend\IntegratedProcurement.slnx
dotnet test Code\backend\IntegratedProcurement.slnx --no-build

cd D:\Projects\IntegratedProcurement\Code\frontend
npm run build
```

Then confirm naming:

```powershell
cd D:\Projects\IntegratedProcurement
rg -n --glob '!**/bin/**' --glob '!**/obj/**' --glob '!**/dist/**' --glob '!**/node_modules/**' "Contract Management|ContractManagement|contract-management" Code
```

Expected result:

```text
Matches should only be in this handover document if it is not excluded.
For active source/docs verification, add:
--glob '!**/PROJECT_HANDOVER_2026-06-23.md'
```
