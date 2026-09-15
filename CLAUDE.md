# CLAUDE.md — SisTemplate (project)

## Read WORK.md first
`WORK.md` is the working board — open items, conventions, runtime. **Read it at the start of every
session.**

**Branching:** **`main` is the single long-lived branch** — the production trunk. Start each task on
a short-lived feature branch, open a pull request into `main`, and delete the branch once it
merges. No module ownership, no worktree isolation — you own the whole repo.
- The whole codebase is yours to edit; scope discipline comes from the task, not from ownership.
- **Verify before you commit:** backend build 0 warnings / 0 errors, and drive the real flow for
  anything non-trivial. The legacy `?raw` frontend has no build-time typecheck — Babel-parse
  changed `.jsx`.
- Commit small and often; conventional messages ending with the `Co-Authored-By:` trailer.
- **Ship via pull request.** Push your feature branch and open a PR into `main`.
- **Announce destructive data work** (bulk import, truncate, re-seed, data migration) and get the
  user's go-ahead first. The app auto-migrates and re-seeds at startup, so seeders must stay
  idempotent.

## Architecture (quick map)
- Backend: .NET 10 / EF Core 10 / minimal APIs, modular monolith. Platform pieces live under
  `backend/src/Platform/*`; your own domain modules go under `backend/src/Modules/<Module>/*`
  (empty by default in this template). Azure SQL + Azure Blob.
  Cross-cutting: `AppHost/Program.cs`, `BuildingBlocks/Application/{ModuleKeys,PermissionKeys}.cs`,
  `Platform/Persistence/{Migrations,Seeding,Configurations}`.
- Frontend: legacy React via runtime Babel (`?raw`, single global scope) under
  `frontend/src/{modules,platform}/**`. No build-time typecheck on these — validate with
  eslint/Babel. `Mockup/` sync is inert; edit `frontend/src/**` directly.
- Modules don't reference each other's Infrastructure — cross-module reads go through **ports** in
  the consumer's Application layer. See `ARCHITECTURE.md`.
- **AppHost is the only deployable.** There is no separate external/vendor edge in this template.

## Conventions (non-negotiable — full list in WORK.md §5)
- **BLOB AUTH — pattern, adapt per real deployment:** Production/staging authenticate to Azure Blob
  with **Managed Identity** (`AzureBlob:ServiceUri`). Development defaults to **local disk**, not
  Azure SAS. If Azure IAM is container-scoped rather than account-scoped, `canSignReadSas` stays
  false and stream/proxy through `AppHost` is the correct production URL path (not a workaround).
  Never Account Key on Staging/Production. Never `DefaultAzureCredential` in place of the
  Managed Identity path. Full table: `WORK.md` §6.
- Module key = camelCase; URL = kebab; permission = `moduleKey.action` (SoT:
  `ModuleKeys.cs`/`PermissionKeys.cs`).
- RBAC = permission-driven (menu + API + UI gate on permission keys; role = bundle). `/auth/me`
  returns permissions.
- WIB: store UTC, display/day-boundary in Asia/Jakarta; `fmtAppDate`/`fmtAppDateTime` (FE),
  `JakartaTime` (BE); never persist +7. (Adjust the timezone convention if your deployment isn't
  Indonesia-based.)
- Backend is source of truth: no browser-storage outbox; seed from backend embedded JSON; email
  backend-owned + rendered from admin-editable templates (`EmailTemplateNotifier`) — never
  hardcode email bodies.
- Master-data payload: seeder writes `payloadJson` camelCase; frontend providers read
  payload/parent keys case-insensitively.
- Deleting a record that owns a Blob doc must delete the blob too.
- Internal users are SSO-only (no local password) in this template.

## Runtime
- `dotnet run` launches via `dotnet <dll>` in Debug (AppLocker blocks the apphost .exe). Health:
  `GET /api/health/live`. Dev sign-in: `POST /api/v1/internal/auth/dev-login {"identifier":"<id>"}`.
- Backend port **5055**; frontend `npm run dev` in `frontend/` on **8008** with its `/api` proxy
  already on 5055. If a stale process locks the build output, `dotnet build-server shutdown`
  releases the MSBuild/Roslyn handles.
- DB auto-migrates at startup; design-time factory reads env `SISTEMPLATE_CONNECTION` (falls back
  to the legacy `INTEGRATED_PROCUREMENT_CONNECTION`, else LocalDB).
- Verify non-trivial changes end-to-end (build 0/0 + drive the flow) before commit. Commit messages
  end with the Co-Authored-By trailer.
