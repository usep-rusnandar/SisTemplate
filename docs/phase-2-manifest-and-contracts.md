# Integrated Procurement - Phase 2 Manifest and Contracts

Tanggal: 2026-06-22
Status: Phase 2 manifest, no implementation code
Depends on: `Code/docs/phase-1-architecture.md`

## 1. Phase 2 Scope

Phase 2 translates the approved Phase 1 architecture into explicit implementation manifests and MVP contracts.

This document defines:

- Target repository tree under `Code/`.
- Backend solution tree.
- Backend project dependencies.
- Backend MVP file manifest.
- Frontend production tree.
- Frontend MVP file manifest.
- API contract for MVP endpoints.
- Database table manifest and migration order.
- Cross-cutting contracts for auth, pagination, errors, audit, and documents.
- Vertical slice implementation order.

No production code is generated in Phase 2.

## 2. Confirmed Decisions from Phase 1

- Architecture style: modular monolith with Clean Architecture.
- Backend stack: ASP.NET Core 10, EF Core SQL Server, ASP.NET Core Identity for vendor users.
- Frontend stack: React, Vite, TypeScript.
- Frontend stance: production implementation of accepted mockup, not redesign.
- Internal authentication: SISWarrior custom SSO with `SSO:Enabled` switch.
- Vendor authentication: ASP.NET Core Identity cookie auth.
- Internal identity table: `USER_T`.
- Vendor Identity table: `USERS_T`.
- `USER_T` and `USERS_T` are completely separated.
- Internal domain identity after SSO mapping: `PERSONNEL_NO`.
- NRP is external and only allowed in the SSO mapping layer.
- Vendor registration: invitation-only.
- First MVP modules: Vendor Invitation/Auth, Proposal Tracker, Contract Intelligent Platform, Contract Monitoring.

## 3. Target Code Root

```text
D:\Projects\IntegratedProcurement\Code
  backend\
  docs\
    phase-1-architecture.md
    phase-2-manifest-and-contracts.md
  frontend\
  tools\
```

Folder purpose:

- `backend`: ASP.NET Core 10 solution, module projects, tests.
- `frontend`: React/Vite/TypeScript production frontend.
- `docs`: architecture, manifest, API contracts, database notes, implementation records.
- `tools`: SQL scripts, database helpers, seed/import scripts, local run helpers.

## 4. Backend Solution Tree

Target:

```text
backend/
  IntegratedProcurement.sln
  Directory.Build.props
  Directory.Packages.props
  README.md
  src/
    AppHost/
      IntegratedProcurement.AppHost.Api.csproj
      Program.cs
      appsettings.json
      appsettings.Development.json
      Properties/
        launchSettings.json
      Auth/
        AuthenticationSchemes.cs
        AuthorizationPolicies.cs
        CurrentActorEndpointFilter.cs
      Endpoints/
        HealthEndpoints.cs
        InternalAuthEndpoints.cs
        VendorAuthEndpoints.cs
        VendorInvitationEndpoints.cs
        TrackerEndpoints.cs
        CipEndpoints.cs
        ContractMonitoringEndpoints.cs
        AdministrationEndpoints.cs
        NotificationEndpoints.cs
        DocumentEndpoints.cs
      Middleware/
        ExceptionHandlingMiddleware.cs
        SsoMiddleware.cs
        CorrelationIdMiddleware.cs
      OpenApi/
        OpenApiConfiguration.cs
      Security/
        CsrfConfiguration.cs
        CookieConfiguration.cs

    BuildingBlocks/
      Domain/
        IntegratedProcurement.BuildingBlocks.Domain.csproj
        Entities/
          Entity.cs
          AuditableEntity.cs
          SoftDeleteEntity.cs
        Events/
          DomainEvent.cs
        ValueObjects/
          ValueObject.cs
      Application/
        IntegratedProcurement.BuildingBlocks.Application.csproj
        Abstractions/
          IClock.cs
          ICurrentActor.cs
          ICurrentTenant.cs
          IUnitOfWork.cs
          IOutboxWriter.cs
        Common/
          Result.cs
          PagedResult.cs
          PageRequest.cs
          ErrorCodes.cs
        Validation/
          ValidationError.cs
      Infrastructure/
        IntegratedProcurement.BuildingBlocks.Infrastructure.csproj
        Time/
          SystemClock.cs
        Persistence/
          EfUnitOfWork.cs
          DbContextOptionsExtensions.cs
        Outbox/
          OutboxMessage.cs
          OutboxDispatcher.cs
        Storage/
          IFileStorage.cs
          LocalFileStorage.cs

    Platform/
      InternalIdentity/
        Domain/
          IntegratedProcurement.Platform.InternalIdentity.Domain.csproj
          Users/
            InternalUser.cs
            InternalRole.cs
            InternalPermission.cs
            InternalUserRole.cs
            SsoNrpMapping.cs
        Application/
          IntegratedProcurement.Platform.InternalIdentity.Application.csproj
          Auth/
            InternalSessionDtos.cs
            IInternalSessionService.cs
            IInternalAccessService.cs
            INrpPersonnelMapper.cs
          Permissions/
            InternalPermissionDtos.cs
            IInternalPermissionService.cs
        Infrastructure/
          IntegratedProcurement.Platform.InternalIdentity.Infrastructure.csproj
          Options/
            SsoOptions.cs
          Sso/
            SsoRedirectUrlBuilder.cs
            JwtHelper.cs
            SsoSessionKeys.cs
            SsoSessionService.cs
          Persistence/
            InternalIdentityDbContext.cs
            InternalIdentityDbContextFactory.cs
            InternalIdentityTableConfiguration.cs
          Authorization/
            InternalPermissionHandler.cs
          Seeding/
            InternalIdentitySeeder.cs

      VendorIdentity/
        Application/
          IntegratedProcurement.Platform.VendorIdentity.Application.csproj
          Auth/
            VendorAuthDtos.cs
            IVendorAuthService.cs
            IVendorPasswordResetService.cs
          Provisioning/
            IVendorIdentityProvisioner.cs
        Infrastructure/
          IntegratedProcurement.Platform.VendorIdentity.Infrastructure.csproj
          Persistence/
            VendorIdentityDbContext.cs
            VendorIdentityDbContextFactory.cs
            VendorIdentityTableConfiguration.cs
            ApplicationUser.cs
            ApplicationRole.cs
          Auth/
            VendorAuthService.cs
            VendorPasswordResetService.cs
            VendorIdentityProvisioner.cs
          Options/
            VendorIdentityOptions.cs
          Seeding/
            VendorRoleSeeder.cs

      Administration/
        Domain/
          IntegratedProcurement.Platform.Administration.Domain.csproj
          Menus/
            MenuItem.cs
          Modules/
            AppModule.cs
        Application/
          IntegratedProcurement.Platform.Administration.Application.csproj
          Menus/
            MenuDtos.cs
            IMenuService.cs
          Modules/
            ModuleDtos.cs
            IModuleRegistryService.cs
        Infrastructure/
          IntegratedProcurement.Platform.Administration.Infrastructure.csproj
          Persistence/
            AdministrationDbContext.cs
            AdministrationDbContextFactory.cs
          Menus/
            MenuService.cs
          Seeding/
            AdministrationSeeder.cs

      Audit/
        Domain/
          IntegratedProcurement.Platform.Audit.Domain.csproj
          AuditEvents/
            AuditEvent.cs
            AuditActorType.cs
        Application/
          IntegratedProcurement.Platform.Audit.Application.csproj
          AuditEvents/
            AuditDtos.cs
            IAuditWriter.cs
            IAuditQueryService.cs
        Infrastructure/
          IntegratedProcurement.Platform.Audit.Infrastructure.csproj
          Persistence/
            AuditDbContext.cs
            AuditDbContextFactory.cs
          AuditEvents/
            AuditWriter.cs
            AuditQueryService.cs

      Documents/
        Domain/
          IntegratedProcurement.Platform.Documents.Domain.csproj
          Documents/
            DocumentFile.cs
            DocumentKind.cs
        Application/
          IntegratedProcurement.Platform.Documents.Application.csproj
          Documents/
            DocumentDtos.cs
            IDocumentService.cs
        Infrastructure/
          IntegratedProcurement.Platform.Documents.Infrastructure.csproj
          Persistence/
            DocumentsDbContext.cs
            DocumentsDbContextFactory.cs
          Storage/
            DocumentService.cs

      Notifications/
        Domain/
          IntegratedProcurement.Platform.Notifications.Domain.csproj
          Notifications/
            Notification.cs
            EmailOutboxMessage.cs
        Application/
          IntegratedProcurement.Platform.Notifications.Application.csproj
          Notifications/
            NotificationDtos.cs
            INotificationService.cs
            IEmailOutboxService.cs
        Infrastructure/
          IntegratedProcurement.Platform.Notifications.Infrastructure.csproj
          Persistence/
            NotificationsDbContext.cs
            NotificationsDbContextFactory.cs
          Email/
            EmailOutboxService.cs
            EmailTemplateRenderer.cs

      Settings/
        Domain/
          IntegratedProcurement.Platform.Settings.Domain.csproj
          Settings/
            Setting.cs
        Application/
          IntegratedProcurement.Platform.Settings.Application.csproj
          Settings/
            SettingDtos.cs
            ISettingsService.cs
        Infrastructure/
          IntegratedProcurement.Platform.Settings.Infrastructure.csproj
          Persistence/
            SettingsDbContext.cs
            SettingsDbContextFactory.cs
          Settings/
            SettingsService.cs

    Modules/
      VendorOnboarding/
        Domain/
          IntegratedProcurement.Modules.VendorOnboarding.Domain.csproj
          Vendors/
            Vendor.cs
            VendorStatus.cs
            VendorUser.cs
            VendorUserStatus.cs
          Invitations/
            Invitation.cs
            InvitationStatus.cs
            InvitationAttempt.cs
        Application/
          IntegratedProcurement.Modules.VendorOnboarding.Application.csproj
          Vendors/
            VendorDtos.cs
            IVendorQueryService.cs
          Invitations/
            InvitationDtos.cs
            IInvitationService.cs
            CreateInvitationCommand.cs
            RegisterVendorFromInvitationCommand.cs
        Infrastructure/
          IntegratedProcurement.Modules.VendorOnboarding.Infrastructure.csproj
          Persistence/
            VendorOnboardingDbContext.cs
            VendorOnboardingDbContextFactory.cs
          Vendors/
            VendorQueryService.cs
          Invitations/
            InvitationService.cs

      ProposalTracker/
        Domain/
          IntegratedProcurement.Modules.ProposalTracker.Domain.csproj
          Proposals/
            TrackerProposal.cs
            TrackerProposalStatus.cs
            TrackerActivity.cs
            TrackerActivityStatus.cs
            TrackerActivityHistory.cs
          MasterData/
            TrackerStep.cs
            TrackerMethod.cs
            TrackerHoliday.cs
          Documents/
            TrackerLoaDocument.cs
        Application/
          IntegratedProcurement.Modules.ProposalTracker.Application.csproj
          Proposals/
            TrackerProposalDtos.cs
            ITrackerProposalService.cs
          Workflow/
            TrackerWorkflowDtos.cs
            DistributeProposalCommand.cs
            CompleteActivityCommand.cs
            RecycleActivityCommand.cs
            CancelProposalCommand.cs
            ReassignOfficerCommand.cs
          Dashboard/
            TrackerDashboardDtos.cs
            ITrackerDashboardService.cs
          Handoff/
            TrackerLoaDtos.cs
            ITrackerLoaQueryService.cs
        Infrastructure/
          IntegratedProcurement.Modules.ProposalTracker.Infrastructure.csproj
          Persistence/
            ProposalTrackerDbContext.cs
            ProposalTrackerDbContextFactory.cs
          Proposals/
            TrackerProposalService.cs
          Dashboard/
            TrackerDashboardService.cs
          Handoff/
            TrackerLoaQueryService.cs
          Seeding/
            TrackerSeedData.cs

      ContractIntelligentPlatform/
        Domain/
          IntegratedProcurement.Modules.ContractIntelligentPlatform.Domain.csproj
          Cases/
            CipCase.cs
            CipCaseStage.cs
            CipCaseStatus.cs
            CipStageHistory.cs
            CipCaseNote.cs
          Templates/
            CipTemplate.cs
          Documents/
            CipDocument.cs
            CipDocumentType.cs
          Authorization/
            CipAuthorizationBand.cs
            CipAuthorizationRole.cs
            CipAuthorizationMatrixCell.cs
            CipContractSigningMatrixCell.cs
        Application/
          IntegratedProcurement.Modules.ContractIntelligentPlatform.Application.csproj
          Inbox/
            CipLoaInboxDtos.cs
            ICipLoaInboxService.cs
          Cases/
            CipCaseDtos.cs
            ICipCaseService.cs
          Termsheets/
            CipTermsheetDtos.cs
            ICipTermsheetService.cs
          Templates/
            CipTemplateDtos.cs
            ICipTemplateService.cs
          Documents/
            CipDocumentDtos.cs
            ICipDocumentService.cs
          Authorization/
            CipAuthorizationDtos.cs
            ICipAuthorizationService.cs
        Infrastructure/
          IntegratedProcurement.Modules.ContractIntelligentPlatform.Infrastructure.csproj
          Persistence/
            CipDbContext.cs
            CipDbContextFactory.cs
          Inbox/
            CipLoaInboxService.cs
          Cases/
            CipCaseService.cs
          Termsheets/
            CipTermsheetService.cs
          Templates/
            CipTemplateService.cs
          Documents/
            CipDocumentService.cs
          Authorization/
            CipAuthorizationService.cs
          Seeding/
            CipTemplateSeedData.cs

      ContractMonitoring/
        Domain/
          IntegratedProcurement.Modules.ContractMonitoring.Domain.csproj
          Contracts/
            Contract.cs
            ContractVersion.cs
            ContractStatus.cs
            ContractDocument.cs
          Reminders/
            ContractReminderRule.cs
            ContractReminderLog.cs
          Imports/
            ContractImportBatch.cs
            ContractImportRow.cs
        Application/
          IntegratedProcurement.Modules.ContractMonitoring.Application.csproj
          Contracts/
            ContractDtos.cs
            IContractService.cs
          Dashboard/
            ContractDashboardDtos.cs
            IContractDashboardService.cs
          Reminders/
            ContractReminderDtos.cs
            IContractReminderService.cs
          Imports/
            ContractImportDtos.cs
            IContractImportService.cs
        Infrastructure/
          IntegratedProcurement.Modules.ContractMonitoring.Infrastructure.csproj
          Persistence/
            ContractMonitoringDbContext.cs
            ContractMonitoringDbContextFactory.cs
          Contracts/
            ContractService.cs
          Dashboard/
            ContractDashboardService.cs
          Reminders/
            ContractReminderService.cs
            ContractReminderJob.cs
          Imports/
            ContractImportService.cs

  tests/
    AppHost/
      IntegratedProcurement.AppHost.Api.IntegrationTests.csproj
    Platform/
      InternalIdentity/
        IntegratedProcurement.Platform.InternalIdentity.Tests.csproj
      VendorIdentity/
        IntegratedProcurement.Platform.VendorIdentity.Tests.csproj
      Audit/
        IntegratedProcurement.Platform.Audit.Tests.csproj
    Modules/
      VendorOnboarding/
        IntegratedProcurement.Modules.VendorOnboarding.Tests.csproj
      ProposalTracker/
        IntegratedProcurement.Modules.ProposalTracker.Tests.csproj
      ContractIntelligentPlatform/
        IntegratedProcurement.Modules.ContractIntelligentPlatform.Tests.csproj
      ContractMonitoring/
        IntegratedProcurement.Modules.ContractMonitoring.Tests.csproj
```

## 5. Backend Project Dependencies

Dependency rules:

- Domain projects may reference only `BuildingBlocks.Domain`.
- Application projects may reference their Domain project and `BuildingBlocks.Application`.
- Infrastructure projects may reference their Application project, their Domain project, and `BuildingBlocks.Infrastructure`.
- `AppHost.Api` references all Application and Infrastructure projects required for endpoint registration and dependency injection.
- Business modules must not reference `AppHost.Api`.
- Vendor Identity must not reference Internal Identity.
- Internal Identity must not reference Vendor Identity.
- Vendor Onboarding may use Vendor Identity through an application abstraction, not direct database access to Identity internals.
- CIP may query Tracker LOA output through `ProposalTracker.Application` contracts, not through Tracker EF DbContext.

Project dependency map:

```text
AppHost.Api
  -> BuildingBlocks.Application
  -> BuildingBlocks.Infrastructure
  -> Platform.*.Application
  -> Platform.*.Infrastructure
  -> Modules.*.Application
  -> Modules.*.Infrastructure

BuildingBlocks.Application
  -> BuildingBlocks.Domain

BuildingBlocks.Infrastructure
  -> BuildingBlocks.Application
  -> BuildingBlocks.Domain

Platform.InternalIdentity.Application
  -> Platform.InternalIdentity.Domain
  -> BuildingBlocks.Application

Platform.InternalIdentity.Infrastructure
  -> Platform.InternalIdentity.Application
  -> Platform.InternalIdentity.Domain
  -> Platform.Audit.Application
  -> BuildingBlocks.Infrastructure

Platform.VendorIdentity.Application
  -> BuildingBlocks.Application

Platform.VendorIdentity.Infrastructure
  -> Platform.VendorIdentity.Application
  -> Platform.Audit.Application
  -> BuildingBlocks.Infrastructure

Modules.VendorOnboarding.Application
  -> Modules.VendorOnboarding.Domain
  -> Platform.VendorIdentity.Application
  -> Platform.Notifications.Application
  -> Platform.Audit.Application
  -> BuildingBlocks.Application

Modules.VendorOnboarding.Infrastructure
  -> Modules.VendorOnboarding.Application
  -> Modules.VendorOnboarding.Domain
  -> BuildingBlocks.Infrastructure

Modules.ProposalTracker.Application
  -> Modules.ProposalTracker.Domain
  -> Platform.Documents.Application
  -> Platform.Audit.Application
  -> BuildingBlocks.Application

Modules.ProposalTracker.Infrastructure
  -> Modules.ProposalTracker.Application
  -> Modules.ProposalTracker.Domain
  -> BuildingBlocks.Infrastructure

Modules.ContractIntelligentPlatform.Application
  -> Modules.ContractIntelligentPlatform.Domain
  -> Modules.ProposalTracker.Application
  -> Platform.Documents.Application
  -> Platform.Audit.Application
  -> BuildingBlocks.Application

Modules.ContractIntelligentPlatform.Infrastructure
  -> Modules.ContractIntelligentPlatform.Application
  -> Modules.ContractIntelligentPlatform.Domain
  -> BuildingBlocks.Infrastructure

Modules.ContractMonitoring.Application
  -> Modules.ContractMonitoring.Domain
  -> Platform.Notifications.Application
  -> Platform.Documents.Application
  -> Platform.Audit.Application
  -> BuildingBlocks.Application

Modules.ContractMonitoring.Infrastructure
  -> Modules.ContractMonitoring.Application
  -> Modules.ContractMonitoring.Domain
  -> BuildingBlocks.Infrastructure
```

## 6. Backend MVP Package Manifest

Central package management target: `Directory.Packages.props`.

Required packages:

- `Microsoft.AspNetCore.OpenApi`.
- `Microsoft.AspNetCore.Authentication.JwtBearer`.
- `Microsoft.AspNetCore.Identity.EntityFrameworkCore`.
- `Microsoft.EntityFrameworkCore`.
- `Microsoft.EntityFrameworkCore.SqlServer`.
- `Microsoft.EntityFrameworkCore.Design`.
- `System.IdentityModel.Tokens.Jwt`.
- `FluentValidation`.
- `Serilog.AspNetCore` or structured built-in logging with OpenTelemetry.
- `OpenTelemetry.Extensions.Hosting`.
- `OpenTelemetry.Instrumentation.AspNetCore`.
- `OpenTelemetry.Instrumentation.Http`.
- `OpenTelemetry.Instrumentation.EntityFrameworkCore`.
- `Hangfire.AspNetCore` or `Quartz.Extensions.Hosting`; final choice in Phase 3.
- `DocumentFormat.OpenXml`.
- `Azure.Storage.Blobs` if Azure Blob Storage is confirmed.
- `MailKit` if SMTP/email gateway is required directly.

Test packages:

- `xunit`.
- `xunit.runner.visualstudio`.
- `FluentAssertions`.
- `Microsoft.AspNetCore.Mvc.Testing`.
- `Microsoft.EntityFrameworkCore.InMemory` for unit-like tests only.
- `Testcontainers.MsSql` if Docker is available; otherwise use LocalDB integration tests.

## 7. Frontend Production Tree

Target:

```text
frontend/
  package.json
  vite.config.ts
  tsconfig.json
  tsconfig.node.json
  index.html
  .env.example
  README.md
  public/
    assets/
  src/
    main.tsx
    app/
      App.tsx
      routes.tsx
      providers.tsx
      layouts/
        InternalShell.tsx
        VendorShell.tsx
      startup/
        bootstrap.ts
    platform/
      api/
        httpClient.ts
        apiError.ts
        pagination.ts
        queryClient.ts
      auth/
        internalAuth.ts
        vendorAuth.ts
        AuthProvider.tsx
        RequireInternalAuth.tsx
        RequireVendorAuth.tsx
      config/
        env.ts
      navigation/
        menuTypes.ts
        menuApi.ts
        menuStore.ts
      notifications/
        notificationApi.ts
        NotificationProvider.tsx
      i18n/
        i18n.ts
        strings.ts
      theme/
        theme.ts
        ThemeProvider.tsx
      session/
        currentActor.ts
        sessionApi.ts
    shared/
      components/
        Button.tsx
        IconButton.tsx
        Modal.tsx
        Field.tsx
        TextInput.tsx
        Select.tsx
        Textarea.tsx
        Badge.tsx
        Tabs.tsx
        DataTable.tsx
        PageHeader.tsx
        DetailCard.tsx
        MetricCard.tsx
        Alert.tsx
        Spinner.tsx
        Tooltip.tsx
      styles/
        colors_and_type.css
        globals.css
      utils/
        date.ts
        format.ts
        ids.ts
    modules/
      vendor-onboarding/
        api/
          invitationApi.ts
          vendorApi.ts
        components/
          InvitationCreateModal.tsx
          InvitationDetailModal.tsx
          InvitationStatusChip.tsx
        pages/
          VendorInvitationPage.tsx
          VendorDatabasePage.tsx
        types.ts
      vendor-workspace/
        api/
          vendorAuthApi.ts
          vendorRegistrationApi.ts
          vendorProfileApi.ts
        components/
          VendorLoginForm.tsx
          VendorRegistrationWizard.tsx
          VendorForgotPasswordForm.tsx
          VendorResetPasswordForm.tsx
        pages/
          VendorLoginPage.tsx
          VendorRegisterPage.tsx
          VendorWorkspaceHomePage.tsx
          VendorProfilePage.tsx
        types.ts
      proposal-tracker/
        api/
          trackerApi.ts
          trackerWorkflowApi.ts
        components/
          TrackerProposalTable.tsx
          TrackerProposalDetail.tsx
          TrackerActivityStep.tsx
          DistributeProposalModal.tsx
          CompleteActivityModal.tsx
          RecycleActivityModal.tsx
          CancelProposalModal.tsx
          GenerateLoaPanel.tsx
        pages/
          TrackerDashboardPage.tsx
          TrackerProposalsPage.tsx
          TrackerOverduePage.tsx
          TrackerStepMasterPage.tsx
          TrackerMethodMasterPage.tsx
        types.ts
      contract-intelligent-platform/
        api/
          cipApi.ts
          cipWorkflowApi.ts
          cipTemplateApi.ts
        components/
          CipLoaInbox.tsx
          CipCaseWorkflow.tsx
          CipStageRail.tsx
          CipTermsheetPanel.tsx
          CipTemplatePanel.tsx
          CipDraftPanel.tsx
          CipFinalContractPanel.tsx
          CipRepositoryTable.tsx
        pages/
          CipDashboardPage.tsx
          CipInboxPage.tsx
          CipWorkflowPage.tsx
          CipTemplatesPage.tsx
          CipRepositoryPage.tsx
          CipAuthorizationMasterPage.tsx
        types.ts
      contract-monitoring/
        api/
          contractApi.ts
          contractReminderApi.ts
          contractImportApi.ts
        components/
          ContractDatabaseTable.tsx
          ContractDetailPanel.tsx
          ContractExpiryList.tsx
          ContractReminderHistory.tsx
          ContractImportMapping.tsx
        pages/
          ContractDashboardPage.tsx
          ContractDatabasePage.tsx
          ContractExpiryPage.tsx
          ContractImportPage.tsx
        types.ts
    test/
      setup.ts
      msw/
        handlers.ts
        server.ts
```

## 8. Frontend Dependencies

Runtime dependencies:

- `@vitejs/plugin-react`.
- `vite`.
- `typescript`.
- `react`.
- `react-dom`.
- `react-router-dom`.
- `@tanstack/react-query`.
- `react-hook-form`.
- `zod`.
- `lucide-react`.
- `clsx`.

Development/test dependencies:

- `vitest`.
- `@testing-library/react`.
- `@testing-library/jest-dom`.
- `@testing-library/user-event`.
- `msw`.
- `playwright`.
- `eslint`.
- `prettier`.

Frontend dependency rules:

- `modules/*` may use `platform/*` and `shared/*`.
- `shared/*` must not import business modules.
- `platform/api` must not import React components.
- Business modules must use their own API adapter files.
- Components should not call `fetch` directly.

## 9. Frontend Mockup Mapping Manifest

Mockup source to production target:

| Mockup file | Production target |
| --- | --- |
| `project/app/Tokens.jsx` | `src/shared/styles`, `src/platform/theme` |
| `project/app/Primitives.jsx` | `src/shared/components` |
| `project/app/PrimitivesX.jsx` | `src/shared/components`, `src/shared/utils` |
| `project/app/i18n.jsx` | `src/platform/i18n` |
| `project/app/Data.jsx` | backend seed data plus `src/platform/navigation` |
| `project/app/MenuData.jsx` | `src/platform/navigation` plus Administration API |
| `project/app/Session.jsx` | `src/platform/auth`, `src/platform/session` |
| `project/app/Shell.jsx` | `src/app/layouts/InternalShell.tsx` |
| `project/app/VendorApp.jsx` | `src/app/layouts/VendorShell.tsx`, vendor-workspace pages |
| `project/app/VendorOnboardingData.jsx` | backend VendorOnboarding seed and invitation API |
| `project/app/VendorRegister.jsx` | `src/modules/vendor-workspace/pages/VendorRegisterPage.tsx` |
| `project/app/ScreensVendorMore.jsx` | `src/modules/vendor-onboarding/pages/VendorInvitationPage.tsx` |
| `project/app/TrackerData.jsx` | backend ProposalTracker domain/application plus tracker API |
| `project/app/TrackerProposals.jsx` | `src/modules/proposal-tracker/pages/TrackerProposalsPage.tsx` |
| `project/app/TrackerDashboard.jsx` | `src/modules/proposal-tracker/pages/TrackerDashboardPage.tsx` |
| `project/app/TrackerCalendar.jsx` | backend SLA/date services plus `src/shared/utils/date.ts` |
| `project/app/TrackerMasterData.jsx` | backend Tracker master data and seed |
| `project/app/ContractCIPData.jsx` | backend CIP domain/application plus CIP API |
| `project/app/ContractCIPScreens.jsx` | CIP dashboard/inbox/templates/repository pages |
| `project/app/ContractCIPWorkflow.jsx` | `src/modules/contract-intelligent-platform/components/CipCaseWorkflow.tsx` |
| `project/app/ContractMonData.jsx` | backend ContractMonitoring seed and domain |
| `project/app/ContractMonScreens.jsx` | Contract Monitoring pages and components |
| `project/app/ContractImport.jsx` | Contract import page and API |

## 10. Common API Contracts

Base route:

```text
/api/v1
```

Authentication route groups:

- Internal APIs: `/api/v1/internal/*`
- Vendor APIs: `/api/v1/vendor/*`
- Public APIs: `/api/v1/public/*`
- Platform APIs: `/api/v1/platform/*`
- Business APIs: `/api/v1/tracker/*`, `/api/v1/cip/*`, `/api/v1/contracts/*`

Auth schemes:

- Internal route groups require `InternalSso` or `DevelopmentInternal`.
- Vendor route groups require `VendorIdentity`.
- Public route groups are anonymous but rate-limited where needed.

Common error contract:

```json
{
  "type": "https://integrated-procurement/errors/validation",
  "title": "Validation failed",
  "status": 400,
  "traceId": "00-...",
  "code": "VALIDATION_FAILED",
  "errors": [
    {
      "field": "email",
      "message": "Email is required."
    }
  ]
}
```

Common paged response:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalItems": 0,
  "totalPages": 0
}
```

Common audit fields in DTOs:

```json
{
  "createdAt": "2026-06-22T00:00:00Z",
  "createdBy": "10001234",
  "updatedAt": "2026-06-22T00:00:00Z",
  "updatedBy": "10001234"
}
```

Current actor response:

```json
{
  "actorType": "Internal",
  "personnelNo": "10001234",
  "displayName": "Usep Rusnandar",
  "roles": ["Super Admin"],
  "permissions": ["tracker.proposals.view"],
  "sessionMode": "Sso"
}
```

Vendor actor response:

```json
{
  "actorType": "Vendor",
  "identityUserId": "00000000-0000-0000-0000-000000000000",
  "vendorUserId": "00000000-0000-0000-0000-000000000000",
  "vendorId": "00000000-0000-0000-0000-000000000000",
  "displayName": "Rahmat Wijaya",
  "email": "rahmat.wijaya@bkenergi.co.id",
  "roles": ["VENDOR_USER"]
}
```

## 11. Authentication API Contract

### Internal SSO

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/internal/auth/me` | Internal | Return internal current actor |
| GET | `/api/v1/internal/sso/login` | Anonymous | Start SISWarrior redirect when SSO enabled |
| GET | `/api/v1/internal/sso/callback?token=` | Anonymous | Receive SISWarrior JWT, map NRP to PersonnelNo, establish session |
| POST | `/api/v1/internal/auth/logout` | Internal | Clear internal session |
| POST | `/api/v1/internal/auth/dev-login` | Anonymous, dev only | Create development internal session when `SSO:Enabled=false` |

Internal dev-login request:

```json
{
  "personnelNo": "10001234"
}
```

Internal auth response:

```json
{
  "success": true,
  "user": {
    "personnelNo": "10001234",
    "displayName": "Usep Rusnandar",
    "roles": ["Super Admin"],
    "permissions": ["tracker.proposals.view"]
  }
}
```

SSO callback behavior:

- Validate token is present.
- Validate token shape and expiry.
- Validate issuer/audience/signature when SISWarrior validation details are available.
- Extract NRP and display name.
- Map NRP to PersonnelNo.
- Check `CEK_USER_ACCESS_FN(@PersonnelNo)`.
- Store session keys server-side/protected cookie.
- Redirect to clean frontend URL.

### Vendor Identity

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/vendor/auth/me` | Vendor | Return vendor current actor |
| POST | `/api/v1/vendor/auth/login` | Anonymous | Vendor email/password login |
| POST | `/api/v1/vendor/auth/logout` | Vendor | Clear vendor cookie |
| POST | `/api/v1/vendor/auth/password-reset/request` | Anonymous | Request password reset email |
| POST | `/api/v1/vendor/auth/password-reset/confirm` | Anonymous | Confirm reset token and set new password |

Vendor login request:

```json
{
  "email": "rahmat.wijaya@bkenergi.co.id",
  "password": "P@ssw0rd.Vendor"
}
```

Vendor login response:

```json
{
  "success": true,
  "user": {
    "identityUserId": "00000000-0000-0000-0000-000000000000",
    "vendorUserId": "00000000-0000-0000-0000-000000000000",
    "vendorId": "00000000-0000-0000-0000-000000000000",
    "name": "Rahmat Wijaya",
    "email": "rahmat.wijaya@bkenergi.co.id",
    "roles": ["VENDOR_USER"]
  }
}
```

## 12. Vendor Onboarding API Contract

### Internal invitation management

| Method | Route | Auth | Permission | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/vendor-onboarding/invitations` | Internal | `vendor.invitations.view` | List invitations |
| GET | `/api/v1/vendor-onboarding/invitations/{id}` | Internal | `vendor.invitations.view` | Invitation detail |
| POST | `/api/v1/vendor-onboarding/invitations` | Internal | `vendor.invitations.create` | Create invitation |
| POST | `/api/v1/vendor-onboarding/invitations/{id}/resend` | Internal | `vendor.invitations.update` | Resend invitation |
| POST | `/api/v1/vendor-onboarding/invitations/{id}/revoke` | Internal | `vendor.invitations.update` | Revoke invitation |

Create invitation request:

```json
{
  "vendorName": "PT Sinar Rejeki Equipment",
  "picName": "Joko Susanto",
  "email": "joko.susanto@sinarrejeki.co.id",
  "category": "Heavy Equipment & Rental",
  "expiryDays": 14,
  "note": "Diundang untuk hauling package SERA."
}
```

Invitation response:

```json
{
  "id": "00000000-0000-0000-0000-000000000000",
  "codeMasked": "VW-K7P2-****",
  "email": "joko.susanto@sinarrejeki.co.id",
  "vendorName": "PT Sinar Rejeki Equipment",
  "picName": "Joko Susanto",
  "category": "Heavy Equipment & Rental",
  "status": "Sent",
  "expiresAt": "2026-07-06T00:00:00Z",
  "usedAt": null,
  "registerUrl": "https://app.example/vendor/register?invite=...",
  "createdBy": "10001234",
  "createdAt": "2026-06-22T00:00:00Z"
}
```

Rules:

- Code must be secure random.
- Code should be stored hashed where practical.
- Only one active invitation per email.
- Email must not already exist in `USERS_T` or `VENDOR_USER_T`.
- Resend keeps invitation identity but can rotate code if security policy requires it.
- Revoke prevents later registration.

### Public vendor registration

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/v1/public/vendor-registration/validate-invitation` | Anonymous | Validate invitation code |
| POST | `/api/v1/public/vendor-registration/register` | Anonymous | Register vendor from valid invitation |

Validate invitation request:

```json
{
  "code": "VW-K7P2-9MQX"
}
```

Validate invitation response:

```json
{
  "valid": true,
  "invitationId": "00000000-0000-0000-0000-000000000000",
  "vendorName": "PT Sinar Rejeki Equipment",
  "picName": "Joko Susanto",
  "email": "joko.susanto@sinarrejeki.co.id",
  "category": "Heavy Equipment & Rental",
  "expiresAt": "2026-07-06T00:00:00Z"
}
```

Register vendor request:

```json
{
  "invitationCode": "VW-K7P2-9MQX",
  "company": {
    "legalName": "PT Sinar Rejeki Equipment",
    "tradeName": "Sinar Rejeki",
    "field": "Heavy Equipment & Rental",
    "scale": "M",
    "established": "2018",
    "employees": "120",
    "website": "https://sinarrejeki.co.id",
    "address": "Jakarta"
  },
  "legal": {
    "npwp": "00.000.000.0-000.000",
    "nib": "1234567890",
    "pkp": "Yes",
    "akta": "AKTA-001"
  },
  "classification": {
    "category": "Heavy Equipment & Rental",
    "kbli": "77301",
    "products": "Excavator rental, hauling equipment"
  },
  "bank": {
    "bankName": "Bank Mandiri",
    "account": "1234567890",
    "holder": "PT Sinar Rejeki Equipment",
    "branch": "Jakarta"
  },
  "account": {
    "picName": "Joko Susanto",
    "picPosition": "Director",
    "picPhone": "+6281234567890",
    "email": "joko.susanto@sinarrejeki.co.id",
    "password": "P@ssw0rd.Vendor",
    "confirmPassword": "P@ssw0rd.Vendor"
  }
}
```

Register response:

```json
{
  "success": true,
  "vendorId": "00000000-0000-0000-0000-000000000000",
  "vendorUserId": "00000000-0000-0000-0000-000000000000",
  "status": "PendingApproval"
}
```

Registration transaction:

- Validate invitation exists.
- Validate not expired.
- Validate not used.
- Validate not revoked.
- Validate email exactly matches invitation email.
- Validate email unique.
- Create `VENDOR_T`.
- Create Identity user in `USERS_T`.
- Assign Identity role `VENDOR_USER`.
- Create `VENDOR_USER_T`.
- Mark invitation as used.
- Write audit event.
- Write email outbox message.

## 13. Tracker API Contract

Base route: `/api/v1/tracker`

| Method | Route | Auth | Permission | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/dashboard` | Internal | `tracker.dashboard.view` | Tracker dashboard metrics |
| GET | `/proposals` | Internal | `tracker.proposals.view` | Paged proposal list |
| GET | `/proposals/{proposalId}` | Internal | `tracker.proposals.view` | Proposal detail |
| POST | `/proposals/{proposalId}/distribute` | Internal | `tracker.proposals.distribute` | Distribute proposal |
| POST | `/proposals/{proposalId}/activities/{activityId}/clock-in` | Internal | `tracker.activities.update` | Clock-in activity |
| POST | `/proposals/{proposalId}/activities/{activityId}/complete` | Internal | `tracker.activities.complete` | Complete activity |
| POST | `/proposals/{proposalId}/activities/{activityId}/recycle` | Internal | `tracker.activities.recycle` | Recycle completed activity |
| POST | `/proposals/{proposalId}/activities/{activityId}/cancel` | Internal | `tracker.proposals.cancel` | Cancel proposal |
| POST | `/proposals/{proposalId}/reassign-officer` | Internal | `tracker.proposals.reassign` | Reassign responsible officer |
| POST | `/proposals/{proposalId}/activities/{activityId}/loa-documents` | Internal | `tracker.loa.generate` | Generate/register LOA document |
| GET | `/loa-documents` | Internal | `tracker.loa.view` | Query LOA documents for handoff |
| GET | `/master/steps` | Internal | `tracker.master.view` | Tracker step master |
| GET | `/master/methods` | Internal | `tracker.master.view` | Tracker method master |

Distribute request:

```json
{
  "assignedOfficerPersonnelNo": "10001234",
  "startActivityDate": "2026-06-22",
  "strategy": "Standard distribution",
  "adjustedSla": [
    {
      "stepCode": "RFQ",
      "adjustedDays": 3
    }
  ]
}
```

Distribute rules:

- Proposal must be `ReadyToDistribute`.
- Assigned officer must be active internal user.
- Estimated finish date must not exceed requirement date where rule applies.
- Server recalculates dates; frontend submitted dates are not trusted.
- Audit event is required.

Complete activity request:

```json
{
  "remark": "Activity completed.",
  "evidenceNames": ["BA Negotiation.pdf"]
}
```

Generate LOA request:

```json
{
  "vendorId": "VEN-001",
  "awardValue": 1500000000,
  "awardPercent": 100,
  "payload": {
    "scope": "Hauling service",
    "paymentTerms": "Monthly",
    "notes": "Generated from approved award."
  }
}
```

LOA response:

```json
{
  "id": "00000000-0000-0000-0000-000000000000",
  "proposalId": "TRK-2026-001",
  "activityId": "ACT-LOA",
  "vendorId": "VEN-001",
  "loaNumber": "123/LOA/SIS-JA/PROC/VI/2026",
  "fileName": "LOA_TRK-2026-001_VEN-001.pdf",
  "documentFileId": "00000000-0000-0000-0000-000000000000",
  "generatedAt": "2026-06-22T00:00:00Z"
}
```

## 14. CIP API Contract

Base route: `/api/v1/cip`

| Method | Route | Auth | Permission | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/dashboard` | Internal | `cip.dashboard.view` | CIP dashboard |
| POST | `/cases/from-award-result` | Internal | `cip.cases.create` | Create CIP case(s) from Tracker award result |
| GET | `/cases` | Internal | `cip.cases.view` | List CIP cases |
| GET | `/cases/{caseId}` | Internal | `cip.cases.view` | CIP case detail |
| POST | `/cases/{caseId}/verify` | Internal | `cip.workflow.update` | Verify LOA data |
| POST | `/cases/{caseId}/termsheet/generate` | Internal | `cip.termsheet.generate` | Generate/register termsheet |
| POST | `/cases/{caseId}/template/select` | Internal | `cip.template.select` | Select template |
| POST | `/cases/{caseId}/draft/generate` | Internal | `cip.draft.generate` | Generate/register draft contract |
| POST | `/cases/{caseId}/final-contract` | Internal | `cip.final.upload` | Register final contract |
| POST | `/cases/{caseId}/recycle` | Internal | `cip.workflow.recycle` | Recycle CIP sub-stage |
| GET | `/templates` | Internal | `cip.templates.view` | Template library |
| GET | `/repository` | Internal | `cip.repository.view` | CIP document repository |
| GET | `/authorization-master` | Internal | `cip.authorization.view` | Authorization matrix |
| PUT | `/authorization-master` | Internal | `cip.authorization.update` | Update authorization matrix |

LOA inbox item:

```json
{
  "key": "TRK-2026-001-VEN-001",
  "proposalId": "TRK-2026-001",
  "proposalNumber": "PR-2026-001",
  "vendorId": "VEN-001",
  "vendorName": "PT Bumi Khatulistiwa Energi",
  "loaNo": "123/LOA/SIS-JA/PROC/VI/2026",
  "title": "Hauling Service",
  "jobsite": "JAHO",
  "department": "Procurement",
  "requirementDate": "2026-07-10",
  "estimatedFinishDate": "2026-07-05",
  "amount": 1500000000,
  "proposalTotalValue": 1500000000,
  "awardPercent": 100,
  "method": "Tender",
  "ownerName": "Sari Indah",
  "officerName": "Andi Wijaya",
  "generatedAt": "2026-06-22T00:00:00Z",
  "fileName": "LOA_TRK-2026-001_VEN-001.pdf",
  "documentFileId": "00000000-0000-0000-0000-000000000000",
  "caseId": null,
  "caseStage": null
}
```

Create case from LOA request:

```json
{
  "loaDocumentId": "00000000-0000-0000-0000-000000000000"
}
```

CIP case response:

```json
{
  "id": "CIP-2026-001",
  "source": "Tracker",
  "proposalId": "TRK-2026-001",
  "proposalNumber": "PR-2026-001",
  "vendorId": "VEN-001",
  "vendorName": "PT Bumi Khatulistiwa Energi",
  "title": "Hauling Service",
  "stage": "Loa",
  "status": "InProgress",
  "loaDocumentFileId": "00000000-0000-0000-0000-000000000000",
  "termsheetNo": "TS/CIP-2026-001/V001/VI/2026",
  "contractNo": "CTR/CIP-2026-001/V001/VI/2026"
}
```

Rules:

- Case cannot be created twice for the same proposal/vendor/LOA.
- Only completed Tracker LOA activity may appear in CIP LOA inbox.
- CIP case must preserve Tracker traceability.
- Stage transitions are server-enforced.

## 15. Contract Monitoring API Contract

Base route: `/api/v1/contracts`

| Method | Route | Auth | Permission | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/dashboard` | Internal | `contracts.dashboard.view` | Contract dashboard |
| GET | `/` | Internal | `contracts.database.view` | Paged contract groups |
| GET | `/{contractId}` | Internal | `contracts.database.view` | Contract detail with versions |
| POST | `/` | Internal | `contracts.database.create` | Create contract metadata |
| POST | `/{contractId}/versions` | Internal | `contracts.database.update` | Add amendment/version |
| GET | `/expiry` | Internal | `contracts.expiry.view` | Expiring contract list |
| POST | `/{contractId}/reminders/send` | Internal | `contracts.reminders.send` | Send reminder for current tier |
| POST | `/reminders/run-scan` | Internal | `contracts.reminders.run` | Run scheduled scan manually |
| GET | `/reminders` | Internal | `contracts.reminders.view` | Reminder history |
| POST | `/imports` | Internal | `contracts.import.create` | Create import batch |
| GET | `/imports/{batchId}` | Internal | `contracts.import.view` | Import batch detail |

Contract group response:

```json
{
  "contractId": "CM-2026-0001",
  "contractNo": "CTR/001/SIS/2026",
  "title": "Hauling Service",
  "supplier": "PT Bumi Khatulistiwa Energi",
  "jobsite": "JAHO",
  "classification": "Service Agreement",
  "currentExpiry": "2026-12-31",
  "daysToExpiry": 192,
  "status": "Expiring",
  "versionsCount": 2,
  "latestVersionId": "00000000-0000-0000-0000-000000000000",
  "picName": "Sari Indah",
  "picEmail": "sari.indah@saptaindra.co.id"
}
```

Send reminder response:

```json
{
  "sent": true,
  "tier": "M6",
  "escalated": false,
  "emailOutboxId": "00000000-0000-0000-0000-000000000000"
}
```

Reminder rules:

- Reminder tiers are idempotent per contract and tier.
- Manual send may force resend but must create a new audit record.
- Scheduled scan runs as system actor.
- Final short-term tier escalates to section head.

## 16. Platform API Contract

Administration:

| Method | Route | Auth | Permission | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/platform/menus/my` | Internal or Vendor | Authenticated | Current menu tree |
| GET | `/api/v1/platform/modules` | Internal | `platform.modules.view` | Module registry |
| GET | `/api/v1/platform/permissions` | Internal | `platform.permissions.view` | Permission catalog |

Notifications:

| Method | Route | Auth | Permission | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/platform/notifications` | Internal | Authenticated | User notifications |
| GET | `/api/v1/platform/email-outbox` | Internal | `platform.email.view` | Email outbox |

Documents:

| Method | Route | Auth | Permission | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/platform/documents/{documentFileId}` | Internal or Vendor | Authorized resource | Download/view document |
| POST | `/api/v1/platform/documents` | Internal | `platform.documents.create` | Upload/register document |

Audit:

| Method | Route | Auth | Permission | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/platform/audit-events` | Internal | `platform.audit.view` | Audit event query |

## 17. Database Migration Order

Migration batches:

```text
001_Platform_InternalIdentity
002_Platform_VendorIdentity
003_Platform_Administration
004_Platform_Audit
005_Platform_Documents
006_Platform_Notifications
007_Platform_Settings
010_Module_VendorOnboarding
020_Module_ProposalTracker
030_Module_ContractIntelligentPlatform
040_Module_ContractMonitoring
090_Functions_And_Indexes
```

Rule:

- `CEK_USER_ACCESS_FN` must be created after `USER_T`.
- Vendor Identity tables must exist before invitation registration can create users.
- Tracker tables must exist before CIP LOA inbox can be fully integrated.
- Document tables must exist before Tracker/CIP document metadata is generated.
- Notification/email outbox tables must exist before invitation and reminder flows are enabled.

## 18. Database Table Manifest

### Internal Identity

`USER_T`

- `ID uniqueidentifier PK`
- `PERSONNEL_NO nvarchar(20) unique not null`
- `DISPLAY_NAME nvarchar(200) not null`
- `EMAIL nvarchar(256) null`
- `DEPARTMENT nvarchar(100) null`
- `POSITION nvarchar(100) null`
- `STATUS nvarchar(32) not null`
- `CREATED_AT datetimeoffset not null`
- `CREATED_BY nvarchar(100) null`
- `UPDATED_AT datetimeoffset null`
- `UPDATED_BY nvarchar(100) null`
- `DELETED_AT datetimeoffset null`

Constraints:

- Unique filtered index on `PERSONNEL_NO` where `DELETED_AT IS NULL`.
- `STATUS` allowed values: `Active`, `Inactive`.

`SSO_NRP_MAPPING_T`

- `ID uniqueidentifier PK`
- `NRP nvarchar(20) unique not null`
- `PERSONNEL_NO nvarchar(20) not null`
- `DISPLAY_NAME nvarchar(200) null`
- `STATUS nvarchar(32) not null`
- `CREATED_AT datetimeoffset not null`
- `UPDATED_AT datetimeoffset null`

Constraints:

- `NRP` must not be referenced by business tables.
- `PERSONNEL_NO` references active internal user logically.

`iam.ROLE_T`

- `ID uniqueidentifier PK`
- `CODE nvarchar(100) unique not null`
- `NAME nvarchar(200) not null`
- `MODULE_KEY nvarchar(100) null`
- `IS_SYSTEM bit not null`
- `CREATED_AT datetimeoffset not null`

`iam.USER_ROLE_T`

- `ID uniqueidentifier PK`
- `USER_ID uniqueidentifier FK USER_T.ID`
- `ROLE_ID uniqueidentifier FK iam.ROLE_T.ID`
- `CREATED_AT datetimeoffset not null`

`PERMISSION_T`

- `ID uniqueidentifier PK`
- `KEY nvarchar(200) unique not null`
- `MODULE_KEY nvarchar(100) not null`
- `NAME nvarchar(200) not null`
- `DESCRIPTION nvarchar(500) null`

`iam.ROLE_PERMISSION_T`

- `ID uniqueidentifier PK`
- `ROLE_ID uniqueidentifier FK iam.ROLE_T.ID`
- `PERMISSION_ID uniqueidentifier FK PERMISSION_T.ID`

### Vendor Identity

Identity tables:

- `USERS_T`
- `ROLES_T`
- `USER_ROLES_T`
- `USER_CLAIMS_T`
- `USER_LOGINS_T`
- `USER_TOKENS_T`
- `ROLE_CLAIMS_T`

Additional required `USERS_T` columns:

- `FULL_NAME nvarchar(200) not null`
- `STATUS nvarchar(32) not null`

Identity role seed:

- `VENDOR_ADMIN`
- `VENDOR_USER`

### Vendor Onboarding

`VENDOR_T`

- `ID uniqueidentifier PK`
- `NAME nvarchar(250) not null`
- `STATUS nvarchar(32) not null`
- `CATEGORY nvarchar(100) null`
- `NPWP nvarchar(100) null`
- `NIB nvarchar(100) null`
- `ADDRESS nvarchar(1000) null`
- `CREATED_AT datetimeoffset not null`
- `CREATED_BY nvarchar(100) null`
- `UPDATED_AT datetimeoffset null`
- `UPDATED_BY nvarchar(100) null`
- `DELETED_AT datetimeoffset null`

`VENDOR_USER_T`

- `ID uniqueidentifier PK`
- `IDENTITY_USER_ID uniqueidentifier not null`
- `VENDOR_ID uniqueidentifier FK VENDOR_T.ID`
- `NAME nvarchar(200) not null`
- `EMAIL nvarchar(256) not null`
- `PHONE nvarchar(50) null`
- `POSITION nvarchar(100) null`
- `STATUS nvarchar(32) not null`
- `CREATED_AT datetimeoffset not null`
- `CREATED_BY nvarchar(100) null`
- `UPDATED_AT datetimeoffset null`
- `UPDATED_BY nvarchar(100) null`
- `DELETED_AT datetimeoffset null`

Constraints:

- Unique `IDENTITY_USER_ID`.
- Unique active `EMAIL`.
- Vendor users do not have PersonnelNo.

`INVITATION_T`

- `ID uniqueidentifier PK`
- `CODE_HASH nvarchar(512) unique not null`
- `CODE_MASKED nvarchar(50) not null`
- `EMAIL nvarchar(256) not null`
- `VENDOR_NAME nvarchar(250) not null`
- `PIC_NAME nvarchar(200) not null`
- `CATEGORY nvarchar(100) null`
- `VENDOR_ID uniqueidentifier null FK VENDOR_T.ID`
- `EXPIRED_AT datetimeoffset not null`
- `USED_AT datetimeoffset null`
- `USED_BY uniqueidentifier null FK VENDOR_USER_T.ID`
- `STATUS nvarchar(32) not null`
- `NOTE nvarchar(1000) null`
- `CREATED_AT datetimeoffset not null`
- `CREATED_BY nvarchar(100) not null`
- `UPDATED_AT datetimeoffset null`
- `UPDATED_BY nvarchar(100) null`

Constraints:

- Only one active invitation per email.
- `EMAIL` must match registration email exactly.
- `STATUS`: `Draft`, `Sent`, `Opened`, `Registered`, `Expired`, `Revoked`.

`INVITATION_ATTEMPT_T`

- `ID uniqueidentifier PK`
- `INVITATION_ID uniqueidentifier null FK INVITATION_T.ID`
- `EMAIL nvarchar(256) null`
- `CODE_MASKED nvarchar(50) null`
- `IP_ADDRESS nvarchar(64) null`
- `USER_AGENT nvarchar(1000) null`
- `RESULT nvarchar(32) not null`
- `REASON nvarchar(200) null`
- `ATTEMPTED_AT datetimeoffset not null`

### Proposal Tracker

`TRACKER_PROPOSAL_T`

- `ID nvarchar(50) PK`
- `PROPOSAL_NUMBER nvarchar(100) unique not null`
- `TITLE nvarchar(500) not null`
- `DEPARTMENT nvarchar(100) null`
- `JOBSITE nvarchar(100) null`
- `METHOD_ID uniqueidentifier FK TRACKER_METHOD_T.ID`
- `AMOUNT decimal(18,2) not null`
- `REQUIREMENT_DATE date null`
- `LIFECYCLE_STATUS nvarchar(50) not null`
- `CURRENT_STAGE nvarchar(100) null`
- `OWNER_PERSONNEL_NO nvarchar(20) not null`
- `ASSIGNED_OFFICER_PERSONNEL_NO nvarchar(20) null`
- `DISTRIBUTED_AT datetimeoffset null`
- `UPDATED_AT datetimeoffset null`
- `CREATED_AT datetimeoffset not null`

`TRACKER_ACTIVITY_T`

- `ID uniqueidentifier PK`
- `PROPOSAL_ID nvarchar(50) FK TRACKER_PROPOSAL_T.ID`
- `STEP_ID uniqueidentifier FK TRACKER_STEP_T.ID`
- `TITLE nvarchar(200) not null`
- `STATUS nvarchar(50) not null`
- `TARGET_DATE date null`
- `STARTED_AT datetimeoffset null`
- `COMPLETED_AT datetimeoffset null`
- `REMARK nvarchar(2000) null`
- `LOCKED_REASON nvarchar(500) null`
- `DISPLAY_ORDER int not null`

`TRACKER_ACTIVITY_HISTORY_T`

- `ID uniqueidentifier PK`
- `ACTIVITY_ID uniqueidentifier FK TRACKER_ACTIVITY_T.ID`
- `EVENT_TYPE nvarchar(100) not null`
- `ACTOR_PERSONNEL_NO nvarchar(20) not null`
- `MESSAGE nvarchar(2000) not null`
- `OCCURRED_AT datetimeoffset not null`

`TRACKER_LOA_DOCUMENT_T`

- `ID uniqueidentifier PK`
- `PROPOSAL_ID nvarchar(50) FK TRACKER_PROPOSAL_T.ID`
- `ACTIVITY_ID uniqueidentifier FK TRACKER_ACTIVITY_T.ID`
- `VENDOR_ID nvarchar(100) not null`
- `VENDOR_NAME nvarchar(250) not null`
- `LOA_NUMBER nvarchar(150) not null`
- `AWARD_VALUE decimal(18,2) not null`
- `AWARD_PERCENT decimal(9,4) not null`
- `DOCUMENT_FILE_ID uniqueidentifier FK DOCUMENT_FILES_T.ID`
- `GENERATED_AT datetimeoffset not null`
- `GENERATED_BY nvarchar(20) not null`

Constraints:

- Unique `PROPOSAL_ID`, `ACTIVITY_ID`, `VENDOR_ID`.

Master tables:

- `TRACKER_STEP_T`
- `TRACKER_METHOD_T`
- `TRACKER_HOLIDAY_T`

### Contract Intelligent Platform

`CIP_CASE_T`

- `ID nvarchar(50) PK`
- `SOURCE nvarchar(50) not null`
- `PROPOSAL_ID nvarchar(50) null`
- `PROPOSAL_NUMBER nvarchar(100) null`
- `TRACKER_LOA_DOCUMENT_ID uniqueidentifier null FK TRACKER_LOA_DOCUMENT_T.ID`
- `VENDOR_ID nvarchar(100) not null`
- `VENDOR_NAME nvarchar(250) not null`
- `TITLE nvarchar(500) not null`
- `JOBSITE nvarchar(100) null`
- `VALUE decimal(18,2) not null`
- `STAGE nvarchar(50) not null`
- `STATUS nvarchar(50) not null`
- `TERMSHEET_NO nvarchar(150) null`
- `CONTRACT_NO nvarchar(150) null`
- `TEMPLATE_ID uniqueidentifier null FK CIP_TEMPLATE_T.ID`
- `CREATED_AT datetimeoffset not null`
- `CREATED_BY nvarchar(100) not null`
- `UPDATED_AT datetimeoffset null`
- `UPDATED_BY nvarchar(100) null`

Constraints:

- Unique `TRACKER_LOA_DOCUMENT_ID` where not null.

`CIP_STAGE_HISTORY_T`

- `ID uniqueidentifier PK`
- `CASE_ID nvarchar(50) FK CIP_CASE_T.ID`
- `STAGE nvarchar(50) not null`
- `EVENT_TYPE nvarchar(100) not null`
- `MESSAGE nvarchar(2000) null`
- `ACTOR_PERSONNEL_NO nvarchar(20) not null`
- `OCCURRED_AT datetimeoffset not null`

`CIP_TERMSHEET_T`

- `ID uniqueidentifier PK`
- `CASE_ID nvarchar(50) FK CIP_CASE_T.ID`
- `PAYLOAD_JSON nvarchar(max) not null`
- `DOCUMENT_FILE_ID uniqueidentifier null FK DOCUMENT_FILES_T.ID`
- `GENERATED_AT datetimeoffset null`
- `GENERATED_BY nvarchar(20) null`

`CIP_DRAFT_CONTRACT_T`

- `ID uniqueidentifier PK`
- `CASE_ID nvarchar(50) FK CIP_CASE_T.ID`
- `TEMPLATE_ID uniqueidentifier FK CIP_TEMPLATE_T.ID`
- `PAYLOAD_JSON nvarchar(max) not null`
- `PDF_DOCUMENT_FILE_ID uniqueidentifier null FK DOCUMENT_FILES_T.ID`
- `DOCX_DOCUMENT_FILE_ID uniqueidentifier null FK DOCUMENT_FILES_T.ID`
- `GENERATED_AT datetimeoffset null`
- `GENERATED_BY nvarchar(20) null`

`CIP_DOCUMENT_T`

- `ID uniqueidentifier PK`
- `CASE_ID nvarchar(50) FK CIP_CASE_T.ID`
- `DOCUMENT_TYPE nvarchar(50) not null`
- `DOCUMENT_FILE_ID uniqueidentifier FK DOCUMENT_FILES_T.ID`
- `CREATED_AT datetimeoffset not null`

Template and authorization tables:

- `CIP_TEMPLATE_T`
- `CIP_AUTHORIZATION_BAND_T`
- `CIP_AUTHORIZATION_ROLE_T`
- `CIP_AUTHORIZATION_MATRIX_T`
- `CIP_CONTRACT_SIGNING_MATRIX_T`

### Contract Monitoring

`CONTRACT_T`

- `ID uniqueidentifier PK`
- `CONTRACT_NO nvarchar(150) unique not null`
- `TITLE nvarchar(500) not null`
- `SUPPLIER_NAME nvarchar(250) not null`
- `JOBSITE nvarchar(100) null`
- `CLASSIFICATION nvarchar(100) null`
- `STATUS nvarchar(50) not null`
- `CREATED_AT datetimeoffset not null`
- `CREATED_BY nvarchar(100) null`
- `UPDATED_AT datetimeoffset null`
- `UPDATED_BY nvarchar(100) null`

`CONTRACT_VERSION_T`

- `ID uniqueidentifier PK`
- `CONTRACT_ID uniqueidentifier FK CONTRACT_T.ID`
- `VERSION_NO int not null`
- `VERSION_LABEL nvarchar(100) not null`
- `CONTRACT_DATE date null`
- `EFFECTIVE_DATE date null`
- `EXPIRED_DATE date null`
- `VALUE decimal(18,2) null`
- `PIC_NAME nvarchar(200) null`
- `PIC_EMAIL nvarchar(256) null`
- `DOCUMENT_FILE_ID uniqueidentifier null FK DOCUMENT_FILES_T.ID`
- `CREATED_AT datetimeoffset not null`

Constraints:

- Unique `CONTRACT_ID`, `VERSION_NO`.

`CONTRACT_REMINDER_RULE_T`

- `ID uniqueidentifier PK`
- `TIER_KEY nvarchar(50) unique not null`
- `MAX_DAYS int not null`
- `LABEL nvarchar(100) not null`
- `ESCALATE_TO_SECTION_HEAD bit not null`
- `IS_ACTIVE bit not null`

`CONTRACT_REMINDER_LOG_T`

- `ID uniqueidentifier PK`
- `CONTRACT_ID uniqueidentifier FK CONTRACT_T.ID`
- `TIER_KEY nvarchar(50) not null`
- `TRIGGER_TYPE nvarchar(50) not null`
- `EMAIL_OUTBOX_ID uniqueidentifier null`
- `DAYS_TO_EXPIRY int not null`
- `ESCALATED bit not null`
- `SENT_AT datetimeoffset not null`
- `SENT_BY nvarchar(100) not null`

Constraints:

- Unique scheduled reminder per `CONTRACT_ID`, `TIER_KEY`, `TRIGGER_TYPE = Scheduled`.

Import tables:

- `CONTRACT_IMPORT_BATCH_T`
- `CONTRACT_IMPORT_ROW_T`

### Platform Tables

`AUDIT_EVENTS_T`

- `ID uniqueidentifier PK`
- `ACTOR_TYPE nvarchar(50) not null`
- `ACTOR_ID nvarchar(100) not null`
- `ACTOR_DISPLAY_NAME nvarchar(200) null`
- `MODULE_KEY nvarchar(100) not null`
- `EVENT_TYPE nvarchar(100) not null`
- `RESOURCE_TYPE nvarchar(100) null`
- `RESOURCE_ID nvarchar(100) null`
- `DESCRIPTION nvarchar(2000) not null`
- `IP_ADDRESS nvarchar(64) null`
- `OCCURRED_AT datetimeoffset not null`

`DOCUMENT_FILES_T`

- `ID uniqueidentifier PK`
- `FILE_NAME nvarchar(500) not null`
- `CONTENT_TYPE nvarchar(200) null`
- `STORAGE_PROVIDER nvarchar(50) not null`
- `STORAGE_KEY nvarchar(1000) not null`
- `SIZE_BYTES bigint null`
- `CHECKSUM nvarchar(200) null`
- `CREATED_AT datetimeoffset not null`
- `CREATED_BY nvarchar(100) null`

`EMAIL_OUTBOX_T`

- `ID uniqueidentifier PK`
- `TO_EMAIL nvarchar(256) not null`
- `TO_NAME nvarchar(200) null`
- `CC_JSON nvarchar(max) null`
- `SUBJECT nvarchar(500) not null`
- `BODY_HTML nvarchar(max) not null`
- `TEMPLATE_KEY nvarchar(100) null`
- `STATUS nvarchar(50) not null`
- `ATTEMPT_COUNT int not null`
- `LAST_ERROR nvarchar(2000) null`
- `CREATED_AT datetimeoffset not null`
- `SENT_AT datetimeoffset null`

Other platform tables:

- `MENU_ITEMS_T`
- `NOTIFICATIONS_T`
- `SETTINGS_T`

## 19. Required SQL Function Contract

Function name:

```sql
dbo.CEK_USER_ACCESS_FN
```

Contract:

- Input: `@PersonnelNo nvarchar(20)`.
- Output: `nvarchar(20)`.
- Return values: `true` or `false`.
- Checks active internal users only.
- Uses `USER_T.PERSONNEL_NO`.
- Does not use NRP.

SQL shape for Phase 3:

```sql
CREATE FUNCTION [dbo].[CEK_USER_ACCESS_FN] (@PersonnelNo nvarchar(20))
RETURNS nvarchar(20)
AS
BEGIN
    DECLARE @retValue varchar(20) = 'False';

    SELECT @retValue =
        CASE
            WHEN COUNT(*) > 0 THEN 'true'
            ELSE 'false'
        END
    FROM USER_T
    WHERE DELETED_AT IS NULL
      AND PERSONNEL_NO = @PersonnelNo;

    RETURN @retValue;
END
```

Compatibility note:

- If SISWarrior requires an NRP-based compatibility function, create a separate SSO-layer function later.
- Business modules must not call NRP-based access checks.

## 20. MVP Permission Manifest

Internal permissions:

```text
platform.modules.view
platform.permissions.view
platform.audit.view
platform.email.view
platform.documents.create

vendor.invitations.view
vendor.invitations.create
vendor.invitations.update
vendor.database.view

tracker.dashboard.view
tracker.proposals.view
tracker.proposals.distribute
tracker.proposals.reassign
tracker.proposals.cancel
tracker.activities.update
tracker.activities.complete
tracker.activities.recycle
tracker.loa.view
tracker.loa.generate
tracker.master.view

cip.dashboard.view
cip.inbox.view
cip.cases.view
cip.cases.create
cip.workflow.update
cip.workflow.recycle
cip.termsheet.generate
cip.template.select
cip.draft.generate
cip.final.upload
cip.templates.view
cip.repository.view
cip.authorization.view
cip.authorization.update

contracts.dashboard.view
contracts.database.view
contracts.database.create
contracts.database.update
contracts.expiry.view
contracts.reminders.view
contracts.reminders.send
contracts.reminders.run
contracts.import.view
contracts.import.create
```

Vendor roles:

```text
VENDOR_ADMIN
VENDOR_USER
```

Internal roles are separate from Identity roles and will be seeded in `iam.ROLE_T`.

## 21. MVP Vertical Slice Order

1. Backend and frontend skeleton.
2. Internal identity and SSO switch.
3. Vendor Identity and cookie auth.
4. Vendor invitation and registration.
5. Tracker proposal workflow.
6. Tracker LOA handoff output.
7. CIP LOA inbox and case creation.
8. CIP termsheet/template/draft/final workflow.
9. Contract Monitoring database and reminders.
10. Hardening, tests, deployment config.

Acceptance gates per slice:

- Backend endpoint exists.
- Database migration exists.
- Frontend page calls real API.
- Authorization policy enforced.
- Audit event written for critical action.
- At least one backend test exists.
- At least one frontend smoke path exists for user-facing workflow.

## 22. Phase 3 Starting Checklist

Before generating code:

- Confirm same-origin vs split frontend/backend deployment.
- Confirm SISWarrior JWT validation details.
- Confirm NRP -> PersonnelNo source.
- Confirm database name and SQL Server target.
- Confirm storage target for documents.
- Confirm scheduler choice: Hangfire or Quartz.NET.
- Confirm whether to copy/adapt existing `EnterpriseStarter/backend` or scaffold clean and selectively port patterns.

Default assumption if not otherwise specified:

- Scaffold clean in `Code/backend`.
- Reuse EnterpriseStarter conventions where they fit.
- Do not mutate `D:\Projects\2026-06-02_Procurement\EnterpriseStarter\backend`.
- Do not mutate `D:\Projects\IntegratedProcurement\Mockup`.
- Use LocalDB for development.
- Use local filesystem storage abstraction for development documents.
- Use `SSO:Enabled=false` for local development until SISWarrior validation material is confirmed.

## 23. Phase 2 Decision Record

- Backend solution manifest is approved for modular Clean Architecture generation.
- Frontend manifest is approved for React/Vite/TypeScript migration from accepted mockup.
- API route boundaries are explicit for internal, vendor, public, platform, and business modules.
- Database table manifest uses `USER_T` for internal and `USERS_T` for vendor Identity.
- MVP will be implemented by vertical slices, starting with identity and vendor invitation before business workflow modules.
