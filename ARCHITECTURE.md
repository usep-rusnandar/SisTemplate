# Architecture

High-level structure of SisTemplate. For coordination/workflow see [WORK.md](WORK.md); for
conventions see [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md).

## Shape: modular monolith, Clean Architecture

One deployable API host (`AppHost`) composes independent **modules**. Each module is layered:

```
Modules/<Module>/
  Domain/          # entities, value objects, domain rules (no infra deps)
  Application/     # services, commands/results, port interfaces
  Infrastructure/  # EF repositories, adapters, module DI registration
```

The template ships with `Modules/` empty — the platform pieces below (`Platform/*`) already follow
this same layering and are the reference to copy from when adding a new domain module.

Shared foundations:
- **BuildingBlocks** — `ModuleKeys`, `PermissionKeys` (SoT for keys), base entities, abstractions.
- **Platform** — Persistence (EF `ProcurementDbContext` — historical name, holds the app's core
  schema), Administration (settings/email/languages/audit/master data), InternalIdentity (SSO),
  Documents (Blob storage), Notifications, Audit.
- **AppHost** — minimal-API endpoints, DI wiring (`Program.cs`), auth, OpenAPI, health. **The only
  deployable** — there is no separate external/vendor edge in this template.

**Module independence rule:** modules do not reference each other's Infrastructure. Cross-module
reads go through **ports** defined in the consumer's Application layer and implemented as adapters
(interface in the consumer module, implementation wired via DI) — this keeps modules loosely
coupled even when one needs to read data another module owns.

## Adding a new module

1. Create `backend/src/Modules/<YourModule>/{Domain,Application,Infrastructure}` with their own
   `.csproj` files (mirror an existing `Platform/*` project for the layering + project references:
   `Domain` has no dependencies, `Application` depends on `Domain`, `Infrastructure` depends on both
   plus EF/`Platform.Persistence`).
2. Add a module key to `BuildingBlocks/Application/ModuleKeys.cs` (camelCase) and its permission
   keys to `PermissionKeys.cs` (`moduleKey.action` pattern).
3. Add an `EntityTypeConfiguration` for your entities and register them from
   `Platform/Persistence` (or keep persistence inside your module's `Infrastructure` project and
   reference it from `ProcurementDbContext` — either is consistent with the existing pattern).
4. Register your module's services in its own `Infrastructure` DI extension method (e.g.
   `AddYourModule(this IServiceCollection services)`), then call it from `AppHost/Program.cs`.
5. Add your module's endpoints under `AppHost/Endpoints/` (minimal-API, `RequirePermission` on
   each route using your new permission keys).
6. Add a corresponding frontend area under `frontend/src/modules/<your-module>` and wire it into
   the shell's navigation (`frontend/src/app`, `frontend/src/platform`), gated on the same
   permission keys returned by `/auth/me`.
7. Add/expand tests under `backend/tests/AppHost` (integration) and `backend/tests/Architecture`
   (dependency-direction rules — these enforce the module-independence rule above).
8. Once your module's EF configuration is in place, run
   `dotnet ef migrations add <YourMigration>` from `backend/` and commit the generated migration.

## Data

- **SQL Server / Azure SQL**, one database. The template's own schema (`core`/`iam`) holds
  platform concerns only: settings, email, master data, audit, internal identity. Your new module
  is free to introduce its own schema/table prefix.
- EF Core 10. **Migrations auto-apply at startup** (the seeder calls `MigrateAsync`); the
  design-time factory reads env `SISTEMPLATE_CONNECTION` (falls back to the legacy
  `INTEGRATED_PROCUREMENT_CONNECTION` name, else LocalDB).
- **Blob Storage** for documents, served via short-lived read links (Managed Identity in Azure,
  local disk in dev — see the BLOB AUTH section of [AGENTS.md](AGENTS.md)). Rule: deleting a record
  that owns a Blob document must delete the blob too.
- **Seed/master data** is backend-owned: embedded JSON in `Platform/Persistence/Seeding/SeedData/`,
  seeded idempotently at startup. The frontend reads it via API (it is not the source of truth).

## AuthN / AuthZ

- **Internal users:** authenticated via the app's internal SSO/session mechanism (NRP-style
  identity, or any identifier scheme you plug in). No local password. `/auth/me` returns the user's
  permissions.
- A no-op `InternalAuthenticationHandler` is registered as the default authentication scheme so
  that anonymous requests to permission-gated endpoints correctly get a 401/403 challenge — the
  real principal is attached to `HttpContext.User` by SSO middleware earlier in the pipeline
  (`UseAuthentication → UseSession → UseInternalSso → UseAuthorization`).
- **RBAC is permission-driven:** permission is the single authz primitive; menu nodes, API
  endpoints (`RequirePermission`), and UI all gate on permission keys (`moduleKey.action`); a role
  is a bundle of permissions.

## Frontend

- **Legacy React via runtime Babel:** components are imported `?raw` and transpiled in the browser,
  sharing a single global scope (no per-file modules/type-check). Validate these with eslint/Babel.
- **One Vite bundle:** `internal` (the app shell + all modules) — there is no separate
  external/vendor bundle in this template.
- The `Mockup/` sync (`frontend/scripts/sync-mockup.mjs`) is currently **inert** (no source dir) —
  edit `frontend/src/**` directly.

## Email

Backend-owned send + logging: `SmtpEmailSender` delivers (mode `api` gateway or `smtp`) and records
every attempt to the audit/email log table. Bodies are rendered from **admin-editable templates**
(Email Template page) via `EmailTemplateNotifier` — never hardcoded. Per-module From/mailbox is
configured in Settings.

## Deployment topology

Single deployable: the API host (`AppHost`) with the internal SPA published into `wwwroot`
(`InternalFrontendHosting` serves it) on one Azure App Service (or any host that runs `dotnet
<app>.dll`). GitHub Actions setup: [docs/deployment-github.md](docs/deployment-github.md).

## What was removed to make this a template

This repo started as a copy of a corporate procurement application. Everything specific to that
domain has been removed to make it reusable as a generic foundation:

- All domain modules (proposal tracking, contract initiation/monitoring, vendor onboarding) and
  their schemas/migrations/seed data.
- The external vendor-facing edge entirely: `VendorGateway` (YARP reverse proxy + vendor SPA),
  `ModuleGateway`, and the `VendorIdentity` module (local-account auth for external users). This
  template is **internal-only**: `AppHost` is the single deployable.
- Vendor/procurement-specific admin features (e.g. brand master-data import) and test coverage
  tied to the removed modules.

What remains is the cross-cutting platform: RBAC, admin console, audit, documents, notifications,
internal SSO, and the AppHost composition/auth/health plumbing — the pieces every internal app
needs regardless of its domain.
