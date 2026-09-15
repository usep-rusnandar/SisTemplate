# Architecture

High-level structure of Integrated Procurement. For coordination/workflow see [WORK.md](WORK.md);
for conventions see [CLAUDE.md](CLAUDE.md).

## Shape: modular monolith, Clean Architecture

One deployable API host (`AppHost`) composes independent **modules**. Each module is layered:

```
Modules/<Module>/
  Domain/          # entities, value objects, domain rules (no infra deps)
  Application/     # services, commands/results, port interfaces
  Infrastructure/  # EF repositories, adapters, module DI registration
```

Shared foundations:
- **BuildingBlocks** — `ModuleKeys`, `PermissionKeys` (SoT for keys), base entities, abstractions.
- **Platform** — Persistence (EF `ProcurementDbContext`, migrations, seeding), Administration
  (settings/email/languages/audit), InternalIdentity (SSO), VendorIdentity, Documents (Blob),
  Notifications.
- **AppHost** — minimal-API endpoints, DI wiring (`Program.cs`), auth, OpenAPI, health.

**Module independence rule:** modules do not reference each other's Infrastructure. Cross-module reads
go through **ports** defined in the consumer's Application layer and implemented as adapters — e.g.
`ITrackerBidEvaluationReadPort` lets CIP read the Tracker award result without touching Tracker's schema.

## Data

- **Azure SQL**, one database, schema-per-area: `core` (platform/admin/settings/email/master data),
  `vdr` (vendor), `trk` (proposal tracker), `cip` (contract platform), plus contract-monitoring tables.
- EF Core 10. **Migrations auto-apply at startup** (the seeder calls `MigrateAsync`); design-time
  factory reads env `INTEGRATED_PROCUREMENT_CONNECTION` (else LocalDB).
- **Azure Blob Storage** for documents (containers per area, e.g. `app-vendormanagement`,
  `app-platform-users`), served via short-lived SAS URLs. Rule: deleting a record that owns a Blob
  document must delete the blob too.
- **Seed/master data** is backend-owned: embedded JSON in `Platform/Persistence/Seeding/SeedData/`,
  seeded idempotently. The frontend reads it via API (it is not the source of truth).

## AuthN / AuthZ

- **Internal users:** SISWarrior **SSO** only (NRP-keyed identity). No local password. `/auth/me`
  returns the user's permissions.
- **Vendor users:** local accounts (ASP.NET Identity, cookie auth) in the external portal. Password
  complexity + lockout policy come from Super Admin ▸ Settings ▸ Security (vendor-only).
- **RBAC is permission-driven:** permission is the single authz primitive; menu nodes, API endpoints
  (`RequirePermission`), and UI all gate on permission keys (`moduleKey.action`); a role is a bundle
  of permissions.

## Frontend

- **Legacy React via runtime Babel:** components are imported `?raw` and transpiled in the browser,
  sharing a single global scope (no per-file modules/type-check). Validate these with eslint/Babel.
- **Two Vite bundles:** `internal` (staff console) and `external` (vendor portal, `vendor.html`).
- `window.__procurementStorage` is a backend-backed KV store (shared scope) used by some legacy
  screens. **Backend is the source of truth**; there is no browser-storage email outbox.
- The `Mockup/` sync (`frontend/scripts/sync-mockup.mjs`) is currently **inert** (no source dir) —
  edit `frontend/src/**` directly.

## Email

Backend-owned send + logging: `SmtpEmailSender` delivers (mode `api` gateway or `smtp`) and records
every attempt to `core.EMAIL_SENT_T`. Bodies are rendered from **admin-editable templates** (Email
Template page) via `EmailTemplateNotifier` — never hardcoded. Per-module From/mailbox in Settings.

## Deployment topology

1. **Internal deployment** — the API host with the internal SPA published into `wwwroot`
   (`InternalFrontendHosting` serves it). Single Azure App Service. GitHub: `docs/deployment-github.md`.
2. **External vendor portal** — vendor SPA on App Service `vendor-workspace` (production + staging slot).
   VendorGateway (YARP) serves the SPA and reverse-proxies only allowlisted `/api/v1/vendor*|public/vendor-registration*|vendor-portal*` to AppHost. See `docs/deployment-github-vendor.md`.
3. Azure App Service runs `dotnet <app>.dll`; secrets come from app settings / env vars.

## Known reality & tech debt (read before large changes)

- **KV ↔ domain disconnect:** the Proposal Tracker and Contract Monitoring UIs still run largely on
  browser KV (`ag_tracker_*`, `ag_cm_contracts_v1`), disconnected from the `trk.*` / contract-monitoring
  domain tables. Several backend flows are verified only with manually-seeded domain rows. (WORK.md task #6.)
  - **Phase 1 done:** completing the Bid Evaluation activity now PUTs the award result to
    `trk.AWARD_RESULT_*` (`trkSaveAwardResult`/`trkBuildAwardResultRequest` in `TrackerData.jsx`), so
    CIP F4 can read winners via `ITrackerBidEvaluationReadPort`. This unblocks WORK.md task #3.
  - **Phase 2 pending:** repointing the remaining Tracker/CM reads off KV onto the domain query
    endpoints, and building the CM contract create/version endpoints (currently stubs).
- **CIP documents** are stored as base64 dataURIs in module-state JSON — pending migration to Blob.
- **SSO (SISWarrior)** is live behind the `SSO:Enabled` switch: `SsoMiddleware` auto-redirects anonymous
  navigations, handles the `?token=` callback (shape + expiry only — no signature check, per security-team
  spec), and maps NRP→PersonnelNo directly (NRP == PersonnelNo). `/sso/login` issues the portal redirect
  with `redirectUrl` for the incoming host when it is on `SSO:AllowedApplicationUrls` (else
  `ApplicationUrl`). Suite catches `?token=` on any path; module portals rewrite it to
  `/api/v1/internal/sso/callback`. Flow covered by `SsoRedirectTests` / `SsoMiddlewareFlowTests`.
  Go-live prerequisite: `iam.USER_T` seeded with real 8-digit NRPs (done).
- The relay (SMTP/gateway) is unreachable from dev machines and Azure blocks outbound :25, so emails
  log as `Failed` locally/on-Azure — expected, not a bug.
