# Integrated Procurement - Phase 1 Architecture

Tanggal: 2026-06-22
Target workspace: `D:\Projects\IntegratedProcurement\Code`
Status: Phase 1 architecture, no implementation code

## Executive Summary

Integrated Procurement akan dibangun sebagai aplikasi enterprise end-to-end dengan backend ASP.NET Core 10 dan frontend React/Vite/TypeScript. Sumber kebenaran tampilan dan workflow saat ini adalah mockup di `D:\Projects\IntegratedProcurement\Mockup`, terutama modul Tracker, Contract Intelligent Platform (CIP), dan Contract Monitoring yang sudah dianggap selesai secara UI/workflow.

Keputusan utama Phase 1:

- Gunakan modular monolith terlebih dahulu, bukan microservices.
- Backend berada di `Code/backend`.
- Frontend production berada di `Code/frontend`.
- Dokumentasi dan kontrak teknis berada di `Code/docs`.
- Tooling, SQL, seed, import, dan helper berada di `Code/tools`.
- Frontend tidak dibangun ulang dari nol secara desain. UI/workflow mockup dipertahankan dan dipindahkan ke React/Vite/TypeScript production secara bertahap.
- Data localStorage/static seed di mockup diganti menjadi API backend per modul.
- Internal user memakai custom SSO SISWarrior dan internal `USER_T`.
- Vendor user memakai ASP.NET Core Identity dan tabel Identity `USERS_T`.
- `USER_T` dan `USERS_T` harus sepenuhnya terpisah.
- Untuk internal user, `NRP` hanya boleh ada di mapping layer. Semua domain, database, authorization, dan audit internal memakai `PERSONNEL_NO`.
- Vendor registration wajib invitation-based. Tidak ada manual vendor user creation.

## Section 1: Recommended Architecture

Arsitektur yang direkomendasikan adalah modular monolith berbasis Clean Architecture.

Alasan:

- Modul bisnis saling terhubung kuat, terutama Tracker -> CIP -> Contract Monitoring.
- Aplikasi masih tahap awal production build, sehingga operational overhead microservices belum sebanding.
- ASP.NET Core 10 modular monolith tetap memungkinkan pemisahan domain yang kuat.
- Jika volume dan ownership meningkat, modul dapat diekstrak menjadi service terpisah tanpa merusak domain boundary awal.

Layer utama:

- API Host: endpoint routing, authentication schemes, authorization policies, OpenAPI, exception handling.
- Application: use case, command/query handler, validation, DTO, transaction boundary.
- Domain: entity, value object, domain service, business rule, domain event.
- Infrastructure: EF Core, ASP.NET Identity, SSO integration, email, document storage, scheduler, external services.
- Frontend: React/Vite/TypeScript app, route shell, auth providers, API client, module pages, UI components.

Backend pattern:

- Minimal API endpoint groups per module.
- One database initially, with schema/table boundary per module.
- EF Core migrations per module or per bounded context.
- Domain events for cross-module handoff such as Tracker LOA generated -> CIP LOA inbox.
- Outbox pattern for email, audit, and future integration events.

Frontend pattern:

- Production React/Vite/TypeScript app.
- Module-oriented folders aligned with backend modules.
- API client per module.
- Auth context split between internal SSO session and vendor Identity session.
- TanStack Query or equivalent server-state library for API-backed data.
- Local UI state remains in frontend, business state moves to backend.

Deployment stance:

- Production should prefer same-origin hosting or BFF-style cookie flow to reduce token exposure.
- Development can run frontend and backend separately with CORS and credentials enabled.
- SSO token must not be persisted in browser localStorage.

## Section 2: Solution Structure

Target root:

```text
Code/
  backend/
  frontend/
  docs/
  tools/
```

Backend high-level structure:

```text
backend/
  IntegratedProcurement.sln
  src/
    AppHost/
    BuildingBlocks/
    Platform/
    Modules/
  tests/
```

Platform modules:

- InternalIdentity: SISWarrior SSO, NRP mapping, internal session identity, internal permission resolution.
- VendorIdentity: ASP.NET Core Identity for vendor users only.
- Administration: menu, module registry, role/permission administration for internal users.
- Audit: audit events for internal, vendor, and system actors.
- Documents: document metadata and storage abstraction.
- Notifications: email outbox, notification records, delivery status.
- Settings: application configuration stored in database where needed.

Business modules:

- VendorOnboarding.
- ProposalTracker.
- ContractIntelligentPlatform.
- ContractMonitoring.

Frontend high-level structure:

```text
frontend/
  src/
    app/
    platform/
    shared/
    modules/
      vendor-onboarding/
      vendor-workspace/
      proposal-tracker/
      contract-intelligent-platform/
      contract-monitoring/
```

Frontend rule:

- Preserve existing mockup UI and workflow semantics.
- Replace localStorage/static data with API-backed module adapters.
- Do not redesign modules that are already accepted.

## Section 3: Backend Projects and Responsibilities

Recommended backend projects:

- `IntegratedProcurement.AppHost.Api`
  - ASP.NET Core host.
  - Authentication scheme registration.
  - Authorization policies.
  - Endpoint groups.
  - OpenAPI.
  - Health checks.
  - CORS and production hosting configuration.

- `IntegratedProcurement.BuildingBlocks.Domain`
  - Base entity.
  - Auditable entity.
  - Domain event.
  - Value object base.

- `IntegratedProcurement.BuildingBlocks.Application`
  - Result pattern.
  - Pagination.
  - Validation abstractions.
  - Current actor abstraction.
  - Transaction and unit-of-work contracts.

- `IntegratedProcurement.BuildingBlocks.Infrastructure`
  - Clock.
  - Storage abstractions.
  - Outbox infrastructure.
  - Common EF helpers.

- `IntegratedProcurement.Platform.InternalIdentity`
  - SSO options.
  - SSO redirect URL builder.
  - SSO callback/session middleware.
  - JWT expiry validation.
  - NRP -> PersonnelNo mapping service.
  - Internal user access service.
  - Internal permission service.
  - Development internal login only when `SSO:Enabled = false`.

- `IntegratedProcurement.Platform.VendorIdentity`
  - ASP.NET Core Identity setup.
  - Identity table mapping to `USERS_T`, `ROLES_T`, `USER_ROLES_T`, `USER_CLAIMS_T`, `USER_LOGINS_T`, `USER_TOKENS_T`.
  - Cookie auth for vendor users.
  - Password reset flow.
  - Vendor role enforcement.

- `IntegratedProcurement.Modules.VendorOnboarding`
  - `VENDOR_T`.
  - `VENDOR_USER_T`.
  - `INVITATION_T`.
  - Invitation lifecycle.
  - Invite-only registration use case.
  - Invitation attempt logging and brute-force protection.

- `IntegratedProcurement.Modules.ProposalTracker`
  - Proposal lifecycle.
  - Activity lifecycle.
  - Distribution.
  - Completion.
  - Recycle.
  - Cancel.
  - Reassignment.
  - LOA generation metadata.
  - Dashboard/query projections.

- `IntegratedProcurement.Modules.ContractIntelligentPlatform`
  - LOA inbox from Tracker.
  - CIP case creation.
  - Verification.
  - Termsheet payload.
  - Template recommendation/selection.
  - Draft contract metadata.
  - Final contract upload metadata.
  - CIP repository.

- `IntegratedProcurement.Modules.ContractMonitoring`
  - Contract database.
  - Contract versions/amendments.
  - Expiry grouping.
  - Reminder bucket rules.
  - Reminder sending.
  - Scheduled scan.
  - Contract import metadata.

## Section 4: Frontend Integration Strategy

The frontend is a first-class part of this architecture.

Current state:

- The active mockup source is static React/Babel under `Mockup/project/app`.
- Internal portal entry is `Mockup/project/index.html`.
- Vendor portal entry is `Mockup/project/vendor.html`.
- `Code/frontend` is the target production frontend.

Target frontend:

- React.
- Vite.
- TypeScript.
- Module-oriented structure.
- Shared design system.
- API-backed state.
- Same visual and workflow behavior as accepted mockup.

Migration principles:

- Do not redesign accepted screens.
- Do not change business wording unless requested.
- Preserve internal portal and vendor portal separation.
- Preserve role/menu visibility semantics.
- Preserve workflow actions and state transitions.
- Replace mock stores incrementally.
- Prefer vertical slices over big-bang migration.

Frontend tracks:

- Track A: Shell and platform
  - App bootstrapping.
  - Routing.
  - Theme.
  - Language.
  - Notification surface.
  - API client.
  - Auth providers.

- Track B: Internal portal
  - SSO callback handling.
  - Internal session query.
  - Menu/permission loading.
  - Internal shell from mockup.

- Track C: Vendor portal
  - Vendor login.
  - Invitation registration.
  - Password reset.
  - Vendor workspace shell.

- Track D: Completed business modules
  - Proposal Tracker.
  - Contract Intelligent Platform.
  - Contract Monitoring.

- Track E: Remaining modules
  - Vendor workspace enhancements.
  - Vendor Onboarding extension.
  - Other in-progress modules after MVP.

State migration:

- Mockup localStorage state becomes backend database state.
- Mockup local UI state remains frontend state.
- Mockup seed data becomes backend seed/import data.
- Mockup generated documents become document metadata plus storage references.
- Mockup email outbox becomes backend notification/email outbox.

Frontend API integration:

- Use a typed API client.
- Use server-state caching for list/detail/query screens.
- Use mutations for workflow actions.
- Optimistic update only where safe.
- Prefer re-fetch after workflow transition for critical state.
- Use MSW or an equivalent mock API only during frontend development when backend endpoint is not ready.

## Section 5: Authentication Architecture

The system supports three modes:

1. Internal users through SISWarrior custom SSO.
2. Vendor users through ASP.NET Core Identity.
3. Development mode when SSO is disabled.

Authentication schemes:

- `InternalSso`
  - Used by internal portal and internal APIs.
  - Backed by server session/cookie.
  - Principal identity is `PERSONNEL_NO`.

- `VendorIdentity`
  - Used by vendor portal and vendor APIs.
  - Backed by ASP.NET Core Identity cookie.
  - Principal identity is Identity user id plus vendor user id.

- `DevelopmentInternal`
  - Enabled only when `SSO:Enabled = false`.
  - Allows local development without SISWarrior redirect.
  - Must not use ASP.NET Identity tables for internal users.

Internal SSO flow:

- If `SSO:Enabled = true`, unauthenticated internal access redirects to SISWarrior.
- Redirect URL is built from:
  - `SSO:SsoUrl`.
  - `SSO:Application`.
  - `SSO:ApplicationUrl`.
- SISWarrior returns with `token=<JWT>`.
- Backend validates token shape and expiry.
- Production should also validate issuer, audience, and signature when the SISWarrior validation material is available.
- Backend extracts NRP and display name.
- Backend maps NRP to PersonnelNo.
- Backend verifies PersonnelNo access using `USER_T` and `CEK_USER_ACCESS_FN`.
- Backend stores session data:
  - SsoJwtToken.
  - PersonnelNo.
  - DisplayName.
- Backend redirects to clean URL without token.
- Frontend never stores raw SSO token in localStorage.

SSO disabled flow:

- If `SSO:Enabled = false`, no redirect to SISWarrior.
- SSO middleware behavior is bypassed.
- Internal development login or seeded dev user may be used.
- This mode is only for local/dev/test.

Vendor Identity flow:

- Vendor user logs in using email and password.
- ASP.NET Core Identity validates credentials.
- Vendor auth uses cookie-based authentication.
- Vendor roles are Identity roles only:
  - `VENDOR_ADMIN`.
  - `VENDOR_USER`.
- Vendor roles must not apply to internal users.
- Internal roles must not be stored in Identity tables.

Password reset:

- Vendor password reset uses ASP.NET Identity token providers.
- Token is time-limited.
- Token should be treated as single-use from the user workflow perspective.
- All request, send, submit, success, and failure events are audited.

## Section 6: Session and Identity Mapping Strategy

Internal identity:

- SISWarrior token claim contains NRP and display name.
- NRP is external identity only.
- NRP is translated to PersonnelNo in the mapping layer.
- PersonnelNo becomes the only internal identity used after mapping.
- Domain entities must not store NRP.
- Audit records for internal actors must store PersonnelNo, not NRP.
- Authorization policies for internal users must evaluate PersonnelNo.

Recommended mapping layer:

- `SSO_NRP_MAPPING_T` or external HR/personnel service.
- Mapping table/service is the only allowed place to persist or reference NRP.
- Mapping output is PersonnelNo plus display profile.

Internal session:

- Backend session/cookie contains internal auth state.
- Server-side session or protected ticket contains:
  - SsoJwtToken.
  - PersonnelNo.
  - DisplayName.
  - Internal permission snapshot or role references if needed.

Vendor identity:

- Identity user id is stored in `USERS_T`.
- Vendor business identity is stored in `VENDOR_USER_T`.
- `VENDOR_USER_T.IDENTITY_USER_ID` references `USERS_T.ID`.
- Vendor user does not have PersonnelNo.
- Vendor user authorization uses Identity roles.

Current actor abstraction:

- Backend must expose one current actor abstraction to application modules.
- It must distinguish:
  - Internal actor.
  - Vendor actor.
  - System actor.
- Internal actor id is PersonnelNo.
- Vendor actor id is VendorUserId, with IdentityUserId available for auth support.
- System actor is used by scheduled jobs and background workers.

## Section 7: Module Mapping (Backend <-> Frontend)

### Platform and Shell

Mockup source:

- `Session.jsx`.
- `MenuData.jsx`.
- `Shell.jsx`.
- `Data.jsx`.
- `ScreensAuth.jsx`.

Production frontend:

- `src/platform/auth`.
- `src/platform/navigation`.
- `src/platform/session`.
- `src/app/shell`.

Backend modules:

- InternalIdentity.
- VendorIdentity.
- Administration.
- Audit.
- Notifications.
- Settings.

Key integration:

- Frontend menu should load from backend or from a versioned menu registry.
- Internal menu filtering uses internal roles/permissions.
- Vendor menu filtering uses vendor roles.
- Impersonation, if retained, must be internal Super Admin only and fully audited.

### Vendor Onboarding and Vendor Workspace

Mockup source:

- `VendorOnboardingData.jsx`.
- `ScreensVendorMore.jsx`.
- `VendorRegister.jsx`.
- `VendorApp.jsx`.
- `VendorWorkspaceScreens.jsx`.

Production frontend:

- `src/modules/vendor-onboarding`.
- `src/modules/vendor-workspace`.

Backend modules:

- VendorOnboarding.
- VendorIdentity.
- Notifications.
- Audit.

Key API capabilities:

- Create vendor invitation.
- Resend invitation.
- Revoke invitation.
- Validate invitation code.
- Register vendor from invitation.
- Vendor login.
- Vendor password reset.
- Vendor profile query/update.

Critical rules:

- No open self-registration.
- No manual vendor user creation.
- Vendor admin must not create users.
- One active invitation per email.
- Email must match invitation exactly.
- Email must not already be registered.

### Proposal Tracker

Mockup source:

- `TrackerData.jsx`.
- `TrackerProposals.jsx`.
- `TrackerDashboard.jsx`.
- `TrackerCalendar.jsx`.
- `TrackerMore.jsx`.
- `TrackerMasterData.jsx`.

Production frontend:

- `src/modules/proposal-tracker`.

Backend module:

- ProposalTracker.

Key API capabilities:

- Proposal dashboard.
- Proposal list.
- Proposal detail.
- Distribute proposal.
- Clock-in activity.
- Complete activity.
- Recycle activity.
- Cancel proposal.
- Reassign officer.
- Generate LOA document metadata.
- Query LOA outputs for CIP.

Important business rules:

- Proposal distribution must enforce SLA/date rules on server.
- Estimated Finish Date must not exceed Requirement Date where applicable.
- Workflow transitions must be server-enforced, not only UI-disabled.
- LOA handoff must be created from completed LOA activity only.
- Canceled proposal must stop downstream activity.

### Contract Intelligent Platform

Mockup source:

- `ContractCIPData.jsx`.
- `ContractCIPScreens.jsx`.
- `ContractCIPWorkflow.jsx`.

Production frontend:

- `src/modules/contract-intelligent-platform`.

Backend module:

- ContractIntelligentPlatform.

Key API capabilities:

- LOA inbox from Tracker.
- Create CIP case from LOA.
- Prevent duplicate CIP case for same proposal/vendor/LOA.
- Verify LOA data.
- Generate termsheet payload and document metadata.
- Maintain authorization master.
- Recommend and select template.
- Generate draft contract metadata.
- Upload/register final contract.
- Query CIP document repository.
- Recycle contract sub-stage.

Important business rules:

- CIP case source from Tracker must keep traceability to proposal, vendor, LOA, method, dates, and value.
- Termsheet and draft generation must be auditable.
- Template library must be versioned.
- Final contract upload must preserve metadata and source chain.

### Contract Monitoring

Mockup source:

- `ContractMonData.jsx`.
- `ContractMonScreens.jsx`.
- `ContractImport.jsx`.

Production frontend:

- `src/modules/contract-monitoring`.

Backend module:

- ContractMonitoring.

Key API capabilities:

- Contract dashboard.
- Contract database.
- Contract detail.
- Contract version/amendment history.
- Expiry query.
- Manual reminder send.
- Scheduled reminder scan.
- Reminder history.
- Contract import metadata.

Important business rules:

- Contract rows with same contract number must be grouped into one contract with versions/amendments.
- Contract title comes from original/earliest row where the mockup does so.
- Current metadata comes from latest amendment where applicable.
- Reminder tiers must be idempotent per contract/tier unless manually forced.
- Escalation applies for the final short-term tier.

## Section 8: Recommended Libraries

Backend:

- ASP.NET Core 10.
- EF Core SQL Server.
- ASP.NET Core Identity for vendor users.
- ASP.NET Core Data Protection for cookies/session protection.
- System.IdentityModel.Tokens.Jwt for SISWarrior JWT parsing/validation.
- FluentValidation for application validation.
- Serilog or built-in structured logging with OpenTelemetry.
- OpenTelemetry for traces, metrics, and logs.
- Hangfire or Quartz.NET for scheduled reminders and background jobs.
- Azure Blob Storage SDK or a storage abstraction with local filesystem implementation for development.
- MailKit or internal SMTP/email gateway integration.
- Open XML SDK for Word document/template processing.
- PDF generation/rendering library selected after document prototype validation.
- xUnit for tests.
- FluentAssertions for readable assertions.
- WebApplicationFactory for API integration tests.
- Testcontainers for SQL Server integration tests if Docker is available; otherwise LocalDB test harness.

Frontend:

- React.
- Vite.
- TypeScript.
- React Router.
- TanStack Query or equivalent for server state.
- React Hook Form.
- Zod or equivalent schema validation.
- MSW for API mocks during frontend migration.
- Vitest.
- React Testing Library.
- Playwright for smoke/e2e tests.
- lucide-react for icons, aligned with the mockup icon language.

Database/tooling:

- SQL Server.
- EF Core migrations.
- SQL scripts under `Code/tools/database`.
- Seed/import scripts for mockup data migration.

## Section 9: Database and Identity Design

Database rules:

- All tables use UPPERCASE.
- Use underscore naming.
- End table names with `_T`.
- Prefer UPPERCASE underscore column names for database consistency.
- C# property names can remain idiomatic and map explicitly to database column names.
- Every business table should include audit columns:
  - CREATED_AT.
  - CREATED_BY.
  - UPDATED_AT.
  - UPDATED_BY.
  - DELETED_AT where soft delete is needed.

Internal identity tables:

- `USER_T`
  - Internal users only.
  - Primary identity is `PERSONNEL_NO`.
  - Must not be ASP.NET Identity user.

- `SSO_NRP_MAPPING_T`
  - Mapping layer only.
  - Stores NRP to PersonnelNo mapping if not provided by external HR/personnel service.
  - Not referenced by business modules.

- `iam.ROLE_T`
  - Internal role definitions.
  - Separate from ASP.NET Identity roles.

- `iam.USER_ROLE_T`
  - Internal user to role mapping.
  - References PersonnelNo or internal user id from `USER_T`.

- `PERMISSION_T`
  - Permission catalog.

- `iam.ROLE_PERMISSION_T`
  - Internal role permission mapping.

Required database function:

- `CEK_USER_ACCESS_FN`
  - Final recommended input: `@PersonnelNo nvarchar(20)`.
  - Returns true/false string for active internal user access.
  - Checks `USER_T.DELETED_AT IS NULL`.
  - Checks `USER_T.PERSONNEL_NO = @PersonnelNo`.
  - If an NRP-based compatibility function is required by SISWarrior integration, it must live in the SSO mapping layer and must map to PersonnelNo before domain access.

Vendor Identity tables:

- `USERS_T`
  - ASP.NET Core Identity users.
  - Vendor users only.

- `ROLES_T`
  - ASP.NET Core Identity roles.
  - Vendor roles only.

- `USER_ROLES_T`
- `USER_CLAIMS_T`
- `USER_LOGINS_T`
- `USER_TOKENS_T`
- `ROLE_CLAIMS_T` if Identity role claims are enabled.

Vendor domain tables:

- `VENDOR_T`
  - Vendor master.

- `VENDOR_USER_T`
  - Vendor business user profile.
  - References `USERS_T.ID` through `IDENTITY_USER_ID`.
  - References `VENDOR_T.ID`.

- `INVITATION_T`
  - Invitation code.
  - Email.
  - Vendor reference.
  - Expiry.
  - Used timestamp.
  - Status.
  - CreatedBy/CreatedAt/UsedBy/UsedAt.

- `INVITATION_ATTEMPT_T`
  - Logs validation and registration attempts.
  - Required for brute-force detection and traceability.

Tracker tables:

- `TRACKER_PROPOSAL_T`.
- `TRACKER_ACTIVITY_T`.
- `TRACKER_ACTIVITY_HISTORY_T`.
- `TRACKER_ACTIVITY_NOTE_T`.
- `TRACKER_ACTIVITY_DOCUMENT_T`.
- `TRACKER_VENDOR_STEP_T`.
- `TRACKER_BID_EVALUATION_T`.
- `TRACKER_LOA_DOCUMENT_T`.
- `TRACKER_METHOD_T`.
- `TRACKER_STEP_T`.
- `TRACKER_HOLIDAY_T`.

CIP tables:

- `CIP_CASE_T`.
- `CIP_CASE_STAGE_HISTORY_T`.
- `CIP_CASE_NOTE_T`.
- `CIP_TERMSHEET_T`.
- `CIP_DRAFT_CONTRACT_T`.
- `CIP_TEMPLATE_T`.
- `CIP_DOCUMENT_T`.
- `CIP_AUTHORIZATION_BAND_T`.
- `CIP_AUTHORIZATION_ROLE_T`.
- `CIP_AUTHORIZATION_MATRIX_T`.
- `CIP_CONTRACT_SIGNING_MATRIX_T`.

Contract Monitoring tables:

- `CONTRACT_T`.
- `CONTRACT_VERSION_T`.
- `CONTRACT_DOCUMENT_T`.
- `CONTRACT_REMINDER_RULE_T`.
- `CONTRACT_REMINDER_LOG_T`.
- `CONTRACT_IMPORT_BATCH_T`.
- `CONTRACT_IMPORT_ROW_T`.

Shared platform tables:

- `AUDIT_EVENT_T` or existing starter-compatible `AUDIT_EVENTS_T`.
- `DOCUMENT_FILE_T` or existing starter-compatible `DOCUMENT_FILES_T`.
- `NOTIFICATION_T` or existing starter-compatible `NOTIFICATIONS_T`.
- `EMAIL_OUTBOX_T`.
- `SETTING_T` or existing starter-compatible `SETTINGS_T`.
- `MENU_ITEM_T` or existing starter-compatible `MENU_ITEMS_T`.

Naming note:

- The starter backend already uses plural table names such as `AUDIT_EVENTS_T` and `DOCUMENT_FILES_T`.
- For new procurement tables, use singular names unless there is a strong reason to preserve starter naming.
- In Phase 2, the manifest must decide whether to preserve starter table names or normalize them before first production migration.

## Section 10: Authorization Model

Internal authorization:

- Uses internal user identity from SSO.
- Principal key is PersonnelNo.
- Role/permission data comes from internal authorization tables, not ASP.NET Identity.
- Authorization policies should be permission-based.
- Module access should match accepted mockup role/menu behavior.
- Internal roles may include:
  - Super Admin.
  - Administrator Vendor.
  - Administrator Tracker.
  - Administrator Contract Intelligent Platform.
  - Administrator Contract Monitoring.
  - Section Head Tracker.
  - Officer Tracker.
  - Section Head Contract Intelligent Platform.
  - Officer Contract Intelligent Platform.
  - Section Head Contract Monitoring.
  - Officer Contract Monitoring.
  - User Contract Monitoring.
  - Division Head.
  - Department Head 1.
  - Department Head 2.

Vendor authorization:

- Uses ASP.NET Core Identity roles only.
- Allowed vendor roles:
  - `VENDOR_ADMIN`.
  - `VENDOR_USER`.
- Vendor roles must not grant internal module access.
- Internal users must not be inserted into Identity role tables.
- Vendor APIs must enforce vendor tenant boundary by `VENDOR_ID`.
- Vendor admin must not create users.
- Vendor admin may manage vendor profile permissions only if explicitly allowed later.

API route boundary:

- Internal APIs should require `InternalSso` or `DevelopmentInternal`.
- Vendor APIs should require `VendorIdentity`.
- Public APIs are limited to:
  - SSO callback.
  - Vendor invitation validation.
  - Vendor registration submit.
  - Vendor login/password reset.
  - Health endpoints if configured public.

Frontend authorization:

- UI hides unavailable actions.
- Backend still enforces every rule.
- Disabled buttons are not security.
- Menu filtering is user experience only; API policies are authoritative.

## Section 11: Audit Logging and Security Design

Audit requirements:

- Log all authentication events.
- Log SSO redirect/callback success/failure.
- Log NRP mapping failure without exposing raw token.
- Log internal access checks.
- Log vendor login/password reset.
- Log invitation creation, resend, revoke, validation, failed attempt, successful registration.
- Log Tracker workflow transitions.
- Log LOA generation.
- Log Tracker -> CIP handoff.
- Log CIP document generation and stage transition.
- Log final contract upload.
- Log Contract Monitoring reminder send and scheduled scan.
- Log impersonation if enabled.

Audit actor model:

- Internal actor:
  - ActorType = Internal.
  - PersonnelNo required.
  - DisplayName optional snapshot.

- Vendor actor:
  - ActorType = Vendor.
  - VendorUserId required.
  - IdentityUserId optional support field.
  - VendorId required where applicable.

- System actor:
  - ActorType = System.
  - Used by scheduler/background jobs.

Security controls:

- Store auth cookies as HttpOnly and Secure in production.
- Use SameSite policy appropriate for deployment topology.
- Use CSRF protection for cookie-authenticated unsafe methods.
- Do not store SSO JWT in frontend localStorage.
- Do not log raw JWT, password, password reset token, invitation code full value, or sensitive document content.
- Hash invitation code at rest if practical; display/send raw code only once.
- Rate-limit invitation validation and vendor registration attempts.
- Lock out vendor users after configured failed login attempts.
- Use Data Protection key persistence in production.
- Enforce unique vendor email.
- Enforce one active invitation per email.
- Use database transactions for invitation registration.
- Use optimistic concurrency or rowversion on workflow aggregates.

## Section 12: Testing Strategy

Backend tests:

- Domain unit tests for workflow state transitions.
- Application tests for command validation and business rules.
- Integration tests for endpoints and authentication policies.
- EF migration tests against SQL Server-compatible database.
- SSO middleware tests for enabled/disabled behavior.
- NRP -> PersonnelNo mapping tests.
- `CEK_USER_ACCESS_FN` migration verification.
- Identity table mapping tests.
- Vendor invitation registration transaction tests.
- Authorization tests for internal vs vendor route boundaries.
- Audit logging tests for critical actions.
- Scheduler tests for contract reminder idempotency.

Frontend tests:

- Component tests for shared primitives and module widgets.
- Auth provider tests for internal and vendor modes.
- API client tests with mocked responses.
- Module flow tests with MSW during migration.
- Playwright smoke tests for:
  - Internal login/dev session.
  - Vendor invitation registration.
  - Tracker proposal detail and workflow action.
  - Tracker LOA output visible in CIP inbox.
  - CIP case flow to termsheet/draft/final.
  - Contract Monitoring reminder workflow.

End-to-end strategy:

- Use vertical-slice validation.
- Each module migration is done only when backend endpoint, frontend page, API contract, and smoke test pass together.
- Do not rely on screenshots only. Verify actual state changes through API/database.

Contract testing:

- API DTO contracts must be versioned or tested through generated client types.
- Frontend should fail typecheck when backend contract changes incompatibly.

## Section 13: MVP Scope

MVP includes:

- Backend skeleton and frontend skeleton.
- Internal SSO enabled/disabled support.
- Internal `USER_T` and PersonnelNo identity.
- `CEK_USER_ACCESS_FN`.
- Vendor Identity with required Identity table names.
- Vendor invitation lifecycle.
- Vendor invite-only registration.
- Vendor password reset.
- Audit logging.
- Email outbox.
- Document metadata and storage abstraction.
- Tracker:
  - Dashboard.
  - Proposal list/detail.
  - Distribute.
  - Complete activity.
  - Recycle.
  - Cancel.
  - Reassign.
  - Generate LOA metadata.
- CIP:
  - LOA inbox from Tracker.
  - Create case from LOA.
  - Verify.
  - Generate termsheet metadata.
  - Select template.
  - Generate draft metadata.
  - Register final contract.
  - Repository view.
- Contract Monitoring:
  - Contract list/detail.
  - Grouped versions/amendments.
  - Expiry dashboard.
  - Reminder rules.
  - Manual reminder.
  - Scheduled scan.
  - Reminder history.
- Frontend production app for the MVP modules using accepted mockup UI/workflow.

Out of MVP:

- Full AI document drafting beyond deterministic template/data merge.
- Full OCR/import automation.
- External vendor admin user-management.
- Microservice decomposition.
- Advanced BI dashboards.
- Mobile app.
- Non-completed mockup modules unless needed for shell/navigation.

## Section 14: Implementation Roadmap

Phase 1: Architecture

- Produce this architecture document.
- Confirm identity boundaries.
- Confirm frontend integration stance.
- Confirm module MVP.

Phase 2: Manifest and Contracts

- Create backend solution manifest.
- Create frontend manifest.
- Create API contract outline.
- Create database table manifest.
- Create migration order.
- Create mockup-to-frontend mapping.

Phase 3: Foundation Skeleton

- Scaffold backend solution in `Code/backend`.
- Scaffold frontend app in `Code/frontend`.
- Add shared docs/tools structure.
- Add health endpoint, OpenAPI, logging, database connection, and CI-ready test skeleton.
- Add frontend shell, routing, API client, and environment config.

Phase 4: Identity and Security Vertical Slice

- Implement InternalIdentity.
- Implement SSO enabled/disabled behavior.
- Implement PersonnelNo mapping and `USER_T`.
- Implement `CEK_USER_ACCESS_FN`.
- Implement VendorIdentity.
- Implement cookie auth and CSRF posture.
- Implement current actor abstraction.
- Add authentication and authorization tests.
- Wire frontend internal and vendor auth flows.

Phase 5: Vendor Invitation Vertical Slice

- Implement vendor and invitation tables.
- Implement invitation creation/resend/revoke.
- Implement validation attempt logging.
- Implement invite-only registration.
- Implement Identity user creation transaction.
- Implement password reset.
- Wire vendor registration frontend.
- Add end-to-end smoke test.

Phase 6: Tracker Vertical Slice

- Implement Tracker database model.
- Implement proposal dashboard/list/detail.
- Implement workflow commands.
- Implement LOA metadata generation.
- Wire frontend Tracker module.
- Add workflow transition tests.

Phase 7: Tracker -> CIP Vertical Slice

- Implement LOA inbox query.
- Implement create CIP case from LOA.
- Enforce duplicate guard.
- Preserve source traceability.
- Wire CIP inbox frontend.
- Add smoke test proving actual data handoff.

Phase 8: CIP Workflow Vertical Slice

- Implement CIP case workflow.
- Implement termsheet payload/document metadata.
- Implement template library and recommendation.
- Implement draft/final metadata.
- Wire CIP workflow frontend.
- Add tests for stage transitions and document traceability.

Phase 9: Contract Monitoring Vertical Slice

- Implement contract database.
- Implement version/amendment grouping.
- Implement expiry/reminder rules.
- Implement scheduled scan.
- Implement email outbox integration.
- Wire Contract Monitoring frontend.
- Add idempotency tests for reminders.

Phase 10: Hardening

- Security review.
- Performance pass on heavy list queries.
- Audit completeness review.
- Database index review.
- Deployment configuration.
- Production SSO validation details.
- User acceptance smoke suite.

## Key Risks and Mitigations

Risk: SSO JWT validation details are incomplete.

- Mitigation: Build expiry/shape validation now, but require issuer/audience/signature validation material before production.

Risk: Internal and vendor identity accidentally mix.

- Mitigation: Separate schemes, separate tables, separate route groups, separate role systems, and tests that prove separation.

Risk: Frontend migration becomes a redesign.

- Mitigation: Use mockup as source of truth and migrate module-by-module with visual/workflow parity checks.

Risk: Backend becomes CRUD and loses workflow semantics.

- Mitigation: Model actions as business commands with server-side transition rules.

Risk: Tracker -> CIP handoff becomes only UI narrative.

- Mitigation: Add integration test proving LOA generated in Tracker appears in CIP inbox and creates a traceable CIP case.

Risk: Invitation code brute-force.

- Mitigation: Attempt logging, rate limiting, lockout thresholds, and partial masking in logs.

Risk: Document generation scope expands too early.

- Mitigation: MVP stores/generates metadata and deterministic outputs first; advanced document automation is later.

## Open Decisions Before Phase 2

- Confirm whether production will host frontend and backend same-origin.
- Confirm final SISWarrior JWT validation mechanism.
- Confirm source of NRP -> PersonnelNo mapping: database table, HR API, or both.
- Confirm whether to preserve starter plural platform table names or normalize new platform tables to singular names.
- Confirm SQL Server database name and deployment environment.
- Confirm document storage target for production: Azure Blob Storage, network share, or another internal store.
- Confirm whether existing mockup seed data should be imported as demo data in development.
- Confirm whether internal impersonation remains part of MVP.

## Phase 1 Decision Record

- Approved architecture style: modular monolith with Clean Architecture.
- Approved frontend stance: production React/Vite/TypeScript implementation of accepted mockup, not redesign.
- Approved identity separation: internal SSO with `USER_T`; vendor Identity with `USERS_T`.
- Approved internal key: PersonnelNo only after SSO mapping.
- Approved vendor registration policy: invitation-only, no manual creation.
- Approved first business modules: Tracker, CIP, Contract Monitoring.
- Approved next step: Phase 2 manifest and API/database contract.
