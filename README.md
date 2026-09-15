# Integrated Procurement

Corporate procurement platform for PT Saptaindra Sejati / Alamtri — a **.NET 10 modular monolith**
backend (Proposal Tracker, Contract Initiation Platform, Contract Monitoring, Vendor Onboarding) with a
**legacy-React** frontend served as the internal Suite console, the external vendor portal, and three
per-module portals. RBAC is permission-driven; documents live in Azure Blob; data in Azure SQL.

> **Working on this repo with an AI agent?** Read **[WORK.md](WORK.md) first** — it is the working board
> (open items, conventions, runtime, tech debt), with [CLAUDE.md](CLAUDE.md) as the agent brief.
> **`master` is the single long-lived branch** (production trunk): do each change on a short-lived
> feature branch, open a pull request into `master`, and delete the branch once merged.
> Structure in [ARCHITECTURE.md](ARCHITECTURE.md), secret rules in [SECURITY.md](SECURITY.md).

## Modules

| Module | What it does |
|---|---|
| **Proposal Tracker** (`proposalTracker`) | Procurement proposal lifecycle → award result → LOA / hand-off to CIP |
| **Contract Initiation Platform** (`contractInitiationPlatform`) | Term Sheet + contract drafting from Word templates; case workflow |
| **Contract Monitoring** (`contractMonitoring`) | Contract registry, expiry reminders (tiered, template-driven), SharePoint import |
| **Vendor Onboarding** (`vendorOnboarding`) | Vendor registry, approval workflow, e-certificate, master data (internal) |
| **Vendor Workspace** | External vendor portal: invite-only registration, profile wizard, documents |

Cross-cutting platform: RBAC (permission-driven), admin console (settings/email/languages),
notifications, audit, document storage (Azure Blob), internal identity (SSO), vendor identity.

## Repository layout

```
Code/                         # git root
  backend/                    # .NET 10 solution (IntegratedProcurement.slnx)
    src/
      AppHost/                # API host (minimal APIs, endpoints, DI) — the startup project
      Modules/<Module>/       # Domain / Application / Infrastructure per module
      Platform/               # Persistence, Administration, Identity, Documents, Notifications, Audit
      BuildingBlocks/         # ModuleKeys, PermissionKeys, shared abstractions
      VendorGateway/          # public vendor edge (SPA + YARP allowlist) on App Service vendor-workspace
    tests/
  frontend/                   # Vite; legacy React via runtime Babel; internal + external bundles
  docs/                       # deployment guides (start: docs/deployment-github.md)
  WORK.md CLAUDE.md ARCHITECTURE.md SECURITY.md
```

## Prerequisites

- **.NET SDK 10.0.x**
- **Node.js 20+**
- Access to an Azure SQL database (dev) + Azure Blob Storage (or the emulator)

## Configure (local dev)

Secrets are **never committed**. Put your dev connection string + keys in
`backend/src/AppHost/appsettings.Development.json` (gitignored) or env vars:

```jsonc
// backend/src/AppHost/appsettings.Development.json
{
  "ConnectionStrings": { "DefaultConnection": "Server=...;Database=...;User Id=...;Password=...;Encrypt=True" }
}
```

Enable the secret-scan pre-commit hook once (see [SECURITY.md](SECURITY.md)):

```bash
git config core.hooksPath .githooks
```

## Run (local dev)

From `frontend/` — builds the internal SPA then starts the backend:

```bash
npm ci
npm run serve        # = vite build --mode internal && dotnet run --project ../backend/src/AppHost
```

- Backend: **http://localhost:5055** — health check `GET /api/health/live`.
- Dev sign-in (SSO is off locally): `POST /api/v1/internal/auth/dev-login` with `{"identifier":"<NRP>"}`.
- The app **auto-applies EF migrations + seeds** at startup.
- `dotnet run` launches via `dotnet <dll>` in Debug (the csproj sets `UseAppHost=false` because
  Windows AppLocker blocks the unsigned apphost `.exe`).

Run just the backend (from `backend/`): `dotnet run --project src/AppHost`.

## Build & test

```bash
# backend (from backend/)
dotnet build            # expected: 0 warnings / 0 errors
dotnet test

# frontend (from frontend/)
npm run build           # internal + external bundles
npm run lint
```

## Deployment (summary)

Two deployables (details in `docs/`):
1. **Internal** — API host with the internal SPA bundled into `wwwroot` (App Service `contractone`).
2. **External vendor portal** — vendor SPA + YARP allowlist on App Service `vendor-workspace` (production + staging slot).

**Deploy via GitHub (recommended):**
- Internal → [docs/deployment-github.md](docs/deployment-github.md) (Actions **Deploy Internal**; push `master` → staging)
- Vendor → [docs/deployment-github-vendor.md](docs/deployment-github-vendor.md) (Actions **Deploy Vendor**; push `master` → staging)

Azure App Service runs the app via `dotnet <dll>` and provides secrets as app settings /
environment variables — never from committed files.

## Conventions

See [CLAUDE.md](CLAUDE.md) and WORK.md §5. Highlights: module key =
camelCase full; permission = `moduleKey.action`; RBAC permission-driven; store UTC display WIB
(Asia/Jakarta); backend is the source of truth (no browser-storage outbox; email rendered from
editable templates); deleting a record that owns a Blob doc deletes the blob too.
