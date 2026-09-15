# SisTemplate

**SisTemplate** is a generic starting-point / foundation for internal company applications: a
**.NET 10 modular monolith** backend with a **legacy-React** frontend, wired together as a single
deployable (`AppHost`). It ships with only the cross-cutting platform pieces every internal app
needs — RBAC, admin console, notifications, audit, document storage, internal SSO — and no
product-specific domain modules. Fork/copy this repo to start a new internal application.

> **Working on this repo with an AI agent?** Read **[WORK.md](WORK.md) first** — it is the working
> board (open items, conventions, runtime), with [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md) as
> the agent brief. **`main` is the single long-lived branch** (production trunk): do each change on
> a short-lived feature branch, open a pull request into `main`, and delete the branch once merged.
> Structure in [ARCHITECTURE.md](ARCHITECTURE.md), secret rules in [SECURITY.md](SECURITY.md).

## What's included (the foundation)

| Area | What it does |
|---|---|
| **Internal identity / SSO** | Session/JWT-based internal-user authentication, NRP-style identity, dev-login for local work when SSO is off |
| **RBAC** | Permission-driven authorization — a role is a bundle of permissions; menu, API endpoints, and UI all gate on permission keys |
| **Administration** | Admin console: settings, email configuration, languages, background processes, generic master-data sets |
| **Audit** | Append-only audit log of user/system actions |
| **Documents** | Blob-backed document storage with short-lived read links (Managed Identity in Azure, local disk in dev) |
| **Notifications** | Backend-owned email sending + logging, bodies rendered from admin-editable templates |
| **Foundation manifest / health** | `/api/health/live`, `/api/v1/about`, `/api/v1/foundation/manifest` — building blocks for ops/monitoring |

There is **no** product/domain module in this template — that is intentional. Add your
application's own modules under `backend/src/Modules/<YourModule>` following the same
Domain/Application/Infrastructure pattern used by the platform pieces (see
[ARCHITECTURE.md](ARCHITECTURE.md) for the walkthrough).

## Repository layout

```
backend/                    # .NET 10 solution (SisTemplate.slnx)
  src/
    AppHost/                 # API host (minimal APIs, endpoints, DI, auth) — the only deployable
    Modules/                 # empty by default — add your domain modules here
    Platform/                 # Persistence, Administration, InternalIdentity, Documents, Notifications, Audit
    BuildingBlocks/           # ModuleKeys, PermissionKeys, shared abstractions
  tests/
frontend/                   # Vite; legacy React via runtime Babel; single internal SPA bundle
docs/                        # deployment guide (docs/deployment-github.md)
WORK.md CLAUDE.md AGENTS.md ARCHITECTURE.md SECURITY.md
```

## Prerequisites

- **.NET SDK 10.0.x**
- **Node.js 20+**
- Access to a SQL Server / Azure SQL database (dev) — or LocalDB on Windows

## Configure (local dev)

Secrets are **never committed**. Put your dev connection string + keys in
`backend/src/AppHost/appsettings.Development.json` (gitignored) or env vars:

```jsonc
// backend/src/AppHost/appsettings.Development.json
{
  "ConnectionStrings": { "DefaultConnection": "Server=...;Database=...;User Id=...;******;Encrypt=True" }
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
npm run serve        # = npm run build && dotnet run --project ../backend/src/AppHost
```

- Backend: **http://localhost:5055** — health check `GET /api/health/live`.
- Dev sign-in (SSO is off locally): `POST /api/v1/internal/auth/dev-login` with `{"identifier":"<id>"}`.
- The app **auto-applies EF migrations + seeds** at startup.
- `dotnet run` launches via `dotnet <dll>` in Debug (the csproj sets `UseAppHost=false` because
  Windows AppLocker blocks the unsigned apphost `.exe`).

Run just the backend (from `backend/`): `dotnet run --project src/AppHost`.
Run just the frontend dev server (from `frontend/`): `npm run dev` (port 8008, proxies `/api` to 5055).

## Build & test

```bash
# backend (from backend/)
dotnet build            # expected: 0 warnings / 0 errors
dotnet test

# frontend (from frontend/)
npm run build
npm run lint
```

## Deployment (summary)

One deployable: **AppHost**, the API host with the internal SPA bundled into `wwwroot`.

**Deploy via GitHub (recommended):** [docs/deployment-github.md](docs/deployment-github.md)
(Actions **Deploy Internal**; push `main` → staging, manual dispatch → production).

Azure App Service (or any host that can run `dotnet <dll>`) provides secrets as app settings /
environment variables — never from committed files.

## Using this template for a new application

1. Fork/copy this repo (or use it as a GitHub template repository).
2. Rename the solution/projects if you want your own branding (search for `SisTemplate` and
   replace consistently in `.slnx`/`.csproj` file names, C# namespaces, `package.json`, and
   `appsettings.json`).
3. Add your domain module(s) under `backend/src/Modules/<YourModule>/{Domain,Application,Infrastructure}`,
   register its DI/module composition and permission keys, and add its endpoints in `AppHost`.
4. Add your module key to `BuildingBlocks/Application/ModuleKeys.cs` and its permission keys to
   `PermissionKeys.cs`.
5. Build your module's frontend screens under `frontend/src/modules/<your-module>` and wire them
   into the shell's navigation/menu.
6. Run `dotnet ef migrations add <YourMigration>` once your module's EF configuration is in place.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full pattern walkthrough.

## Conventions

See [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md) and WORK.md. Highlights: module key =
camelCase; permission = `moduleKey.action`; RBAC is permission-driven; store UTC, display in the
app's local timezone; backend is the source of truth (no browser-storage outbox; email rendered
from editable templates); deleting a record that owns a Blob document deletes the blob too.
