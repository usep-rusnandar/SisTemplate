# WORK.md — SisTemplate working board

This is the working board for whoever (human or AI agent) is developing on top of this template:
open items, conventions, and runtime notes. Architecture map: [ARCHITECTURE.md](ARCHITECTURE.md).
Agent brief: [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md).

This repo is a **generic foundation**, not a product. There is no procurement/vendor domain here —
if you're starting a new application from this template, replace the sections below with your own
project's open items as soon as you add your first domain module.

## §1. Branching

**`main` is the single long-lived branch** (production trunk). Work on short-lived feature
branches and open pull requests into `main`; delete each branch once merged. No module ownership —
the whole repo is yours to edit.

## §2. Open items (template maintenance)

- [ ] None currently — the template is in a clean, buildable, tested state (backend `dotnet
      build`/`dotnet test` green; frontend `npm run build`/`npm run lint` green).
- When you add your first domain module, replace this section with your application's real task
  list.

## §3. Runtime

- `dotnet run` launches via `dotnet <dll>` in Debug (AppLocker blocks the unsigned apphost `.exe`
  on locked-down Windows machines). Health: `GET /api/health/live`.
- Dev sign-in (SSO off locally): `POST /api/v1/internal/auth/dev-login {"identifier":"<id>"}`.
- Backend port **5055**; frontend `npm run dev` in `frontend/` on **8008** with its `/api` proxy
  already pointed at 5055.
- DB auto-migrates + seeds at startup; the EF design-time factory reads env
  `SISTEMPLATE_CONNECTION` (falls back to the legacy `INTEGRATED_PROCUREMENT_CONNECTION`, else
  LocalDB).
- If a stale process locks the build output, `dotnet build-server shutdown` releases the
  MSBuild/Roslyn file handles.
- Verify non-trivial changes end-to-end (build 0/0 + drive the flow) before committing. Commit
  messages end with a `Co-Authored-By:` trailer when produced by an AI agent.

## §4. Deployment

One deployable: **AppHost**. GitHub Actions setup: [docs/deployment-github.md](docs/deployment-github.md).

## §5. Conventions (non-negotiable)

- Module key = camelCase; permission = `moduleKey.action` (SoT:
  `backend/src/BuildingBlocks/Application/ModuleKeys.cs` / `PermissionKeys.cs`).
- RBAC is permission-driven (menu + API + UI gate on permission keys; a role is a bundle of
  permissions). `/auth/me` returns the current user's permissions.
- Store timestamps in UTC; convert to the app's local timezone only at display time.
- Backend is the source of truth: no browser-storage outbox; seed data ships as backend-embedded
  JSON; email is backend-owned and rendered from admin-editable templates
  (`EmailTemplateNotifier`) — never hardcode email bodies.
- Master-data payloads: the seeder writes `payloadJson` as camelCase; frontend providers should
  read payload/parent keys case-insensitively.
- Deleting a record that owns a Blob document must delete the blob too.
- Modules do not reference each other's Infrastructure — cross-module reads go through **ports**
  defined in the consumer's Application layer (see [ARCHITECTURE.md](ARCHITECTURE.md)).
- Internal users authenticate via the app's internal SSO/session mechanism; there is no local
  password login for internal users in this template.

## §6. BLOB AUTH pattern (kept as a documented example — adapt or remove for your app)

How the **app** talks to storage does not have to be the same as how the **browser** gets a
download/upload URL. The template's `Documents` module supports:

| Environment | App → storage (credential) | Browser URL |
|---|---|---|
| **Production/Staging (Azure)** | Managed Identity + `AzureBlob:ServiceUri` | User Delegation SAS if IAM scope allows it; otherwise stream/proxy through `AppHost` (`/api/v1/documents/*`) as a fallback that only needs Data Contributor at container scope. |
| **Development** | Local disk (`LocalFileDocumentStorage`, default `UseLocalStorage=true`) | An HMAC ticket that only *looks* like SAS (`/api/v1/documents/local`) — not real Azure SAS. |

If your Azure IAM is scoped at the storage **account** level, `GetUserDelegationKey` works and you
can sign real User Delegation SAS URLs directly for the browser. If IAM is scoped at the
**container** level only, `GetUserDelegationKey` cannot be granted and you must keep using the
stream/proxy endpoints — this is a legitimate, supported production path in this template, not a
workaround. Never fall back to an Account Key / connection string to work around a container-scoped
IAM policy; never use `DefaultAzureCredential` for these particular calls.

See `Platform/Documents/Infrastructure/BlobDocumentStorage.cs` /
`AzureBlobStorageMode.cs` for the source of truth if you adapt this pattern.
