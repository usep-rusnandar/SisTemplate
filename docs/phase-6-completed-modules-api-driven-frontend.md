# Phase 6 - Completed Modules API-Driven Frontend

## Scope

Phase 6 turns the three completed mockup modules into API-driven module workspaces in `Code`:

- Proposal Tracker
- Contract Intelligent Platform
- Contract Monitoring

`Mockup` and `MockupVite` remain read-only references. All implementation lives under `Code`.

## Backend Slice

The current phase introduces AppHost read models for the finished workflow path:

Tracker proposal -> Tracker LOA -> CIP case -> CIP final contract -> Contract register.

Implemented endpoint families:

- `GET /api/v1/tracker/dashboard`
- `GET /api/v1/tracker/proposals`
- `GET /api/v1/tracker/proposals/{proposalId}`
- `GET /api/v1/tracker/loa-documents`
- `POST /api/v1/tracker/proposals/{proposalId}/distribute`
- `POST /api/v1/tracker/proposals/{proposalId}/activities/{activityId}/clock-in`
- `POST /api/v1/tracker/proposals/{proposalId}/activities/{activityId}/complete`
- `POST /api/v1/tracker/proposals/{proposalId}/activities/{activityId}/recycle`
- `POST /api/v1/tracker/proposals/{proposalId}/activities/{activityId}/cancel`
- `POST /api/v1/tracker/proposals/{proposalId}/activities/{activityId}/loa-documents`
- `GET /api/v1/cip/dashboard`
- `POST /api/v1/cip/cases/from-award-result`
- `GET /api/v1/cip/cases`
- `GET /api/v1/cip/cases/{caseId}`
- `POST /api/v1/cip/cases/{caseId}/verify`
- `POST /api/v1/cip/cases/{caseId}/termsheet/generate`
- `POST /api/v1/cip/cases/{caseId}/template/select`
- `POST /api/v1/cip/cases/{caseId}/draft/generate`
- `POST /api/v1/cip/cases/{caseId}/final-contract`
- `GET /api/v1/cip/templates`
- `GET /api/v1/cip/repository` (CIP documents plus Tracker LOA projected by `{proposalKey}-{vendorId}` ↔ case `loaKey`)
- `GET /api/v1/cip/authorization-master`

Retired CIP handoff-inbox endpoints (no longer registered): `GET /loa-inbox`, `POST /cases/from-loa`. New CIP cases originate only from award finalization; LOA remains a supporting Tracker document shown via repository projection.
- `GET /api/v1/contracts/dashboard`
- `GET /api/v1/contracts`
- `GET /api/v1/contracts/{contractId}`
- `GET /api/v1/contracts/expiry`
- `GET /api/v1/contracts/reminders`
- `POST /api/v1/contracts/{contractId}/reminders/send`
- `POST /api/v1/contracts/reminders/run-scan`

## Frontend Slice

The three module pages are no longer static status-card placeholders.

Implemented:

- API clients per module.
- React Query data fetching.
- Metrics row from `/dashboard`.
- Search and segmented filters.
- Operational tables.
- Detail panels with activities, stages, milestones, findings, LOA documents, timeline, and handoff links.
- No `localStorage`, `sessionStorage`, or IndexedDB usage.

## Design Alignment

The UI reuses the existing enterprise shell and visual primitives:

- page heading
- metric cards
- segmented controls
- search box
- enterprise table
- status badges
- detail panel
- compact timeline
- handoff cards

The layout is intentionally dense, scan-friendly, and operational, matching the completed mockup modules rather than becoming a landing page.

## Architecture Note

The backend read models currently live in AppHost because the module application/domain persistence model is not yet implemented. This is an explicit transitional slice:

1. Freeze the API contracts and frontend workflow.
2. Replace read-model seeds with module application services.
3. Move persistent entities into module-owned persistence migrations.
4. Add command validation, audit logging, and authorization policies per endpoint.

## Verification

Commands executed:

- `dotnet build Code\backend\src\AppHost\IntegratedProcurement.AppHost.Api.csproj --no-restore --disable-build-servers -m:1 -v:minimal`
- `dotnet test Code\backend\tests\AppHost\IntegratedProcurement.AppHost.Api.IntegrationTests.csproj --no-restore --disable-build-servers -m:1 -v:minimal`
- `npm run build`
- `npm run lint`
- `rg -n "localStorage|sessionStorage|indexedDB" Code\frontend\src`

Result:

- Backend build passed.
- Backend tests passed.
- Frontend build passed.
- Frontend lint passed.
- No browser local storage usage found.
